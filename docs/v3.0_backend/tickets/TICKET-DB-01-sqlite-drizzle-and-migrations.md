# TICKET-DB-01 — SQLite, Drizzle and migrations

- **Area:** Persistence (new area)
- **Type:** Feature
- **Traceability:** v3 [Req 46](../requirements.md#requirement-46-persistence); overview
  [D2](../overview.md#d2--sqlite-through-drizzle-migrations-through-drizzle-kit),
  [D4](../overview.md#d4--a-ruleset-is-stored-as-a-json-document-not-normalised)

## User story

As an operator, I want all server state in one SQLite file with versioned migrations, so that
backing the game up is copying a file and upgrading it is starting the process.

## Description

The database, its schema, and the rule about what is normalised and what is a JSON document. It
ships the tables the *server's own model* needs — rulesets, game sessions, members, invites,
characters, events — but **not** the auth tables, which AUTH-01 brings with Better Auth's own
schema against this same connection.

## Current situation (as-is)

- No database. [`services/storage.ts`](../../../src/services/storage.ts) is the whole persistence
  layer: two LocalStorage keys holding a `Configuration` and a `Character[]`.
- `SUPPORTED_SCHEMA_VERSION` in [`types/config.ts`](../../../src/types/config.ts) versions the
  *document*, and TICKET-IO-03 established that an unsupported version is refused rather than
  migrated. That rule is about the document and is unaffected by anything here.
- SRV-01 gave us `src/server/` and the env loader; `DATABASE_URL` is already declared there.

## Desired result (to-be)

- A `src/server/db/` module owning the connection (`better-sqlite3`, WAL, `foreign_keys = ON`), the
  Drizzle schema for the server's model, and `runMigrations()` — applied at start-up, refusing to
  serve when one fails rather than serving a half-migrated schema.
- The schema: `ruleset` (owner, name, `schema_version`, `revision`, `data` JSON), `game_session`
  (ruleset id, dm, name, status, `snapshot` JSON, `snapshot_taken_at`), `session_member`
  (session, account, role), `session_invite` (session, code, email?, expires, revoked, redeemed),
  `character` (session, owner, name, `revision`, `data` JSON), `event` (session, seq, actor, type,
  `payload` JSON, created) — foreign keys real, every multi-row write in a transaction, `event`
  append-only.
- A repository layer (`src/server/repositories/`), one module per aggregate, that is the only code
  issuing queries. Handlers call repositories; they never build SQL or touch Drizzle directly.

## Acceptance criteria

- [x] A fresh database file is created and migrated by `runMigrations()`; running it twice is a
      no-op, and a failing migration leaves the process refusing to serve rather than half-applied.
      *Verified in the browser: `yarn dev` created `data/app.db` with its `-wal`/`-shm` companions
      and all six tables on the first request, and `/api/health` answered from the same process.
      `entry.ts` calls `runMigrations(getDatabase())` at load, so **upgrading is starting the
      process** — there is no separate command to forget between pulling a build and restarting.*
- [x] Each migration ships a test that applies it to the previous schema and asserts the resulting
      shape — the milestone's forward-only rule from [overview.md](../overview.md#definition-of-done-applies-to-every-ticket).
      *`0000_initial`'s previous schema is an empty database. Beyond the shape,
      [`migrate.test.ts`](../../../src/server/db/migrate.test.ts) pins the two properties every
      later migration inherits, using a temporary migrations folder holding deliberately broken
      SQL: a failure leaves **nothing** of itself behind (a table created by the statement before
      the broken one is rolled back with it) and does **not** mark itself applied, so a fixed build
      retries it.*
- [x] Foreign keys are enforced: deleting a `game_session` with members fails or cascades by an
      explicitly chosen rule, and a test pins whichever was chosen for each relation.
      *First that they are enforced **at all** — SQLite defaults `foreign_keys` *off*, per
      connection, so a schema full of `REFERENCES` clauses enforces nothing until `client.ts` says
      so, and there is a test that catches the pragma's removal. Then each rule:
      `game_session.ruleset_id` is **SET NULL** because the session holds a pinned snapshot and a
      live game must not end when a DM tidies up (D7); members, invites, characters and events
      **CASCADE**, because the game is the unit. Both directions are asserted.*
- [x] `event.seq` is unique per session and monotonic, enforced by a constraint rather than by
      application code being careful.
      *`UNIQUE(session_id, seq)`. The repository takes the next number inside a **transaction**, so
      two concurrent appends cannot read the same maximum; the index is the backstop rather than
      the mechanism. Tested both ways — gapless 1, 2, 3 through the repository, and a raw duplicate
      insert refused by the database.*
- [x] A JSON document column round-trips a real `Configuration` from `docs/imports/ducklets.json`
      byte-for-identical after write → read, formulas and curve override flags included.
      *All 306 KB of it, `toBe`-identical. Plus a second round-trip through
      `serializeConfiguration` — the server stores exactly what the Kernel produces rather than a
      second serialisation this layer invented (D5).*
- [x] No file outside `server/repositories/` imports Drizzle or the connection. **TICKET-DX-08 turns
      this into the `queries-belong-to-repositories` dependency-cruiser rule** — land it here as a
      criterion, and let DX-08 be what keeps it true.
      *True as written, with one deliberate exception that DX-08's rule must allow: `entry.ts`
      imports `getDatabase` to hand it to `runMigrations` at start-up. It issues no query. The
      test files under `db/` also open connections directly, which is what they are testing.*
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.
      *1925 tests green (+42), `tsc` at the documented 2-error baseline, `yarn run check` clean.
      `fallow audit --base HEAD`: zero introduced findings in every category — the one it did
      report, a nine-line clone between `ruleset` and `character`, is gone because the three tables
      that carry `created_at`/`updated_at` now share a `timestamps()` helper. `drizzle-kit generate`
      confirms that refactor changed no column. The `conventions-reviewer` pass found a start-up
      bug and eight wrong requirement citations — see below.*

## Notes

- `revision` starts at 1 and is incremented **inside the repository's update**, in the same
  statement that checks the caller's base revision. A read-then-write in the handler would be a
  race even in a single process, because two requests interleave at `await` points.
- Store timestamps as integer epoch milliseconds. A SQLite text date is a formatting decision that
  leaks into every comparison.
- The `character.data` document holds only what the Kernel sanctions as player state. What that set
  is grows twice this milestone — `grantedStatPoints` in DM-01, `purse` in CUR-02 — and both are
  document changes, not migrations, which is the point of D4.

## How it landed

- **`better-sqlite3` is pinned to `^12`, deliberately, and this is the reason.** v13 ships its
  prebuilt binaries inside the tarball (prebuildify + `node-gyp-build`), which is strictly better —
  no download, works offline. But Yarn v1 auto-runs `node-gyp rebuild` for any package that has a
  `binding.gyp` and *no* install script, and v13 has exactly that shape, so a fresh `yarn install`
  fails on any machine without the Visual Studio C++ build tools. **Verified**: a clean install
  from this repo's `package.json` + `yarn.lock` in an empty directory exits **1** on v13 and **0**
  on v12, which keeps its `prebuild-install || node-gyp rebuild` script and therefore downloads a
  binary instead of building one. The alternative — telling every contributor to install a C++
  toolchain — is a worse answer for software whose whole deployment story is "run one process".
  Revisit when the repo leaves Yarn v1.
- **The repository layer is deliberately two modules, not six.** The criteria need a document that
  round-trips and a sequence that cannot race; `rulesetRepository` and `eventRepository` prove both.
  RUL-01, GAM-01, CHAR-04 and PLY-01 each bring their own aggregate **with its own routes and its
  own authorization tests** — writing them now would be writing them blind, against imagined
  handlers.
- **`ENV_VARIABLES` gained its first required entry**, which is what makes SRV-01's eager refusal
  worth having. Confirmed end to end: with no `.env`, every request fails with
  `MissingEnvironmentError: … DATABASE_URL. See .env.example.` rather than 500ing on the first
  write. `cp .env.example .env` is now a required setup step in ONBOARDING rather than an optional
  one, and `data/` plus `*.db*` are gitignored.
- **`session_invite` and `session_member` are here but unused.** They are part of the schema the
  ticket specifies, and a migration is the one thing that is genuinely cheaper to get right once
  than to add later — a second migration to add a table is fine, but a second migration to *change*
  one that already holds rows is the expensive case this avoids.

## What the review changed

The `conventions-reviewer` pass found one bug that would have hit every fresh clone, and a set of
forward costs that were cheap now and expensive after the migration ships. `0000_initial` was
regenerated rather than amended, because it has never been applied anywhere but here.

- **A fresh clone could not start.** `data/` is gitignored and `new Database()` does not create a
  missing parent directory, so the first `yarn dev` on a clean machine died at start-up with a raw
  `SqliteError` — and the local check passed only because `data/` already existed. `createDatabase`
  now creates it, with a test that opens a database two directories deep into nowhere. Verified by
  deleting `data/` and restarting: the directory came back, migrations applied, and `/api/health`
  reported the applied migration hash.
- **Two foreign-key child columns had no index.** SQLite does not index one for you, so
  `game_session.ruleset_id` — which is *literally* Req 33.7's "refuse to delete a Ruleset a session
  was created from" — and `session_invite.session_id` would each have cost a full scan on the query
  *and* on every parent delete.
- **Req 39.2's "exactly one DM per session" was left to a handler**, in a table whose own comment
  says constraints beat handlers. It is a partial unique index now.
- **The DM was recorded in two places with nothing saying which wins.** `game_session.dm_account_id`
  is now documented as authoritative and `session_member`'s `dm` row as the mirror that grants
  access; GAM-04's transfer updates both in one transaction.
- **`appendEvent`'s transaction was deferred**, which is what `BEGIN` means by default. Within one
  synchronous process that is unobservable — but a deferred transaction upgrades its lock on the
  `INSERT`, and under WAL a second writer makes that upgrade fail with `SQLITE_BUSY_SNAPSHOT`,
  which `busy_timeout` does *not* retry. `{ behavior: 'immediate' }` takes the write lock up front.
  The JSDoc claimed the loser "retries"; nothing retried, and it now says the caller must.
- **`updateRulesetData` returned `null` for both a stale revision and an unknown id**, which Req
  33.8 needs told apart — a conflict the User can resolve is not a 404. It returns a discriminated
  result, and the extra read happens only on the failure path.
- **Row types were hand-written copies of the schema.** Now `typeof ruleset.$inferSelect`, because
  the drift would have been *silent*: a column added by a later migration assigns cleanly to a
  narrower declared type and simply becomes invisible.
- **`status` and `role` were untyped `text`.** Drizzle's `enum` option is type-level only, so the
  generated SQL is unchanged and a handler can no longer store `'DM'`.
- **`declined_at` was missing**, though Req 38.4 asks for a distinct message for each of expired,
  revoked, **declined** and redeemed. Free now; an `ALTER TABLE` later.
- **`/api/health` promised what DB-01 did not deliver.** Its own comment said this ticket would add
  database reachability and the applied migration version (Req 47.5). It does now, through
  `db/health.ts` — a route does not open a connection — which also gave `appliedMigrations()` the
  production caller it was missing.
- **Eight `Validates:` lines cited the wrong requirement.** Req 46's clauses are 1 = single file,
  2 = migrate at start-up, 3 = JSON documents, 4 = foreign keys and transactions, 5 = events
  append-only; the per-session sequence number is 44.5, not 44.4. All corrected.
- **`runMigrations()` now defaults its arguments**, so `entry.ts` imports `./db/migrate` and not
  the connection. That lets DX-08 write the repository rule as a path prefix —
  `^src/server/` minus `^src/server/(db|repositories)/` may not reach `drizzle-orm` or
  `db/client` — rather than as an exception naming `entry.ts`.
- `listRulesetsByOwner` and `deleteRuleset` were **removed**: no caller, no criterion here, and
  RUL-01 owns list/rename/delete along with the confirm-before-delete Req 33.7 asks for.

**One forward risk is recorded rather than fixed**, in `schema.ts`'s own header: the six account
columns cannot gain foreign keys by `drizzle-kit generate` later. SQLite has no `ADD CONSTRAINT`,
the generated table-recreate relies on `PRAGMA foreign_keys = OFF`, and that pragma is a **no-op
inside a transaction** — which is how every migration runs. A ticket that wants them needs a
hand-written migration and its own test.
