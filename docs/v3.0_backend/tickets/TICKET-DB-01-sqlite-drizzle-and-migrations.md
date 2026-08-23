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

- [ ] A fresh database file is created and migrated by `runMigrations()`; running it twice is a
      no-op, and a failing migration leaves the process refusing to serve rather than half-applied.
- [ ] Each migration ships a test that applies it to the previous schema and asserts the resulting
      shape — the milestone's forward-only rule from [overview.md](../overview.md#definition-of-done-applies-to-every-ticket).
- [ ] Foreign keys are enforced: deleting a `game_session` with members fails or cascades by an
      explicitly chosen rule, and a test pins whichever was chosen for each relation.
- [ ] `event.seq` is unique per session and monotonic, enforced by a constraint rather than by
      application code being careful.
- [ ] A JSON document column round-trips a real `Configuration` from `docs/imports/ducklets.json`
      byte-for-identical after write → read, formulas and curve override flags included.
- [ ] No file outside `server/repositories/` imports Drizzle or the connection. **TICKET-DX-08 turns
      this into the `queries-belong-to-repositories` dependency-cruiser rule** — land it here as a
      criterion, and let DX-08 be what keeps it true.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.

## Notes

- `revision` starts at 1 and is incremented **inside the repository's update**, in the same
  statement that checks the caller's base revision. A read-then-write in the handler would be a
  race even in a single process, because two requests interleave at `await` points.
- Store timestamps as integer epoch milliseconds. A SQLite text date is a formatting decision that
  leaks into every comparison.
- The `character.data` document holds only what the Kernel sanctions as player state. What that set
  is grows twice this milestone — `grantedStatPoints` in DM-01, `purse` in CUR-02 — and both are
  document changes, not migrations, which is the point of D4.
