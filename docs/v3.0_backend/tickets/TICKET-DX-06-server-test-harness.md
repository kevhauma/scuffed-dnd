# TICKET-DX-06 — Server test harness

- **Area:** Tooling and test infrastructure
- **Type:** Feature
- **Traceability:** v3 [Req 45.3](../requirements.md#requirement-45-server-authority); overview
  [Definition of Done](../overview.md#definition-of-done-applies-to-every-ticket) rule 2

## User story

As a developer, I want one way to spin up a server test with a real database and a signed-in
account, so that "does this route refuse a non-member?" is three lines rather than thirty.

## Description

Test infrastructure, nothing user-visible. **Before AUTH-01 deliberately**: the milestone's
Definition of Done requires every server route to prove it refuses an anonymous caller, a non-owner
and a non-member. If that is expensive, it will be skipped, and the milestone's central claim —
that authorization is real — becomes unfalsifiable.

## Current situation (as-is)

- The suite is 1618 passing / 0 failing / 0 skipped across 86 files
  ([TEST_STATUS.md](../../../TEST_STATUS.md)), all of it pure functions, stores and React Testing
  Library. Nothing tests a request.
- DB-01 gave us a connection and repositories; SRV-01 gave us `defineHandler` and a request context.
- `vitest.config.ts` omits `tanstackStart()` and that stays true — handlers are called directly.

## Desired result (to-be)

- `withTestDatabase()` — a per-test SQLite database (in-memory, or a temp file where WAL matters),
  migrated fresh, torn down after, with no cross-test leakage. Tests never share a database file.
- `callRoute(handler, { as, body, params })` — invokes a route handler through SRV-01's pipeline
  with an optional acting Account, returning `{ status, body }`. `as: undefined` is the anonymous
  caller, so the anonymous-refusal test is one line.
- Seeded fixtures: `seedAccount()`, `seedRuleset()`, `seedSession()`, `seedCharacter()`, each
  returning the real row, and a `seedRealRuleset()` that loads `docs/imports/ducklets.json` so
  Kernel-dependent assertions run against the actual ruleset rather than a toy one.

## Acceptance criteria

- [x] Two tests running in the same file cannot see each other's rows; a test that writes and a
      test that counts pass in either order and in parallel.
      → `harness.test.ts` → *withTestDatabase*: one test seeds three rulesets, the next asserts
      there are none, and a third proves a **nested** call is isolated from its parent — the case a
      naive save/restore gets wrong. Two more prove the database is closed when the body throws and
      when an async body rejects. Isolation is structural rather than swept-up: each call is its own
      `:memory:` database, sharing no file, no page cache and no WAL with any other.
      **The `in parallel` half carries a stated limit** — see the implementation notes. A further
      case, added after review, overlaps two calls deliberately and asserts the harness *refuses*
      rather than corrupts.
- [x] `callRoute` reaches the same pipeline production uses — a handler throwing `AppError` produces
      the mapped status in a test exactly as it does in the server.
      → There is no second pipeline and no test double: `callRoute` calls the `Route` that
      `defineHandler` returned. Eight cases pin it — `notFound` → 404 with the real `ERROR_CODE`
      body, a handler returning nothing → a bodyless 204, a `string` body passed through untouched
      so `readJson`'s own `badRequest` fires, and the `no-store` / `nosniff` headers arriving intact.
- [x] A three-line refusal test is demonstrated on `/api/health`'s successor or a scratch route:
      anonymous → refused, wrong account → refused, right account → allowed.
      → `harness.test.ts` → *a refusal test, in three lines*, on a scratch route carrying the guard
      in the shape AUTH-03 will provide it. A second case asserts the stranger and the missing row
      come back **byte-identical** — the indistinguishable 404, since a 403 would confirm to
      somebody with no right to know that the ruleset exists.
- [x] `seedRealRuleset()` produces a `Configuration` that `validateConfigurationShape` accepts and
      `calculateCharacter` runs against without error values other than the ones the corpus already
      carries.
      → *the corpus the fixtures seed*: `validateConfigurationShape` returns `isValid` with no
      errors, and `calculateCharacter` returns an entry for every configured stat. The function is
      named `seedRuleset` rather than `seedRealRuleset` — see the notes.
- [x] Suite runtime does not regress materially — the per-test database setup is measured and
      recorded in [TEST_STATUS.md](../../../TEST_STATUS.md).
      → **~2–3 ms** per database (open + migrate + close), from `schema.test.ts`'s per-case
      timings. Whole suite, three runs each: before **29.03 / 28.02 / 27.55 s**, after
      **27.26 / 27.35 / 24.59 s** — unchanged inside the noise, with 33 more tests and ~70 more
      databases opened.
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.
      → `verifier`: 1970/1970, tsc at the 2-error baseline, lint clean, arch clean — zero delta.
      `fallow audit --base main`: no issues in the changed files, after deleting an unused
      `SEEDED_AT` export it caught. `fallow health --hotspots --since 6m`: two files above
      threshold, both **stable**, neither touched — no hotspot row owed.
      `conventions-reviewer`: eleven findings, all acted on — see below.

## Implementation notes

**The `conventions-reviewer` pass found two real defects, and the first is the one to remember.**

- **The seam the whole rule-widening was bought for had no coverage.** `withTestDatabase` installs
  its database as the process's so a handler reaching `getDatabase()` finds the test's schema — and
  nothing asserted it. Deleting both `setProcessDatabase` calls left the suite green, because every
  test in the file closed over the `database` argument directly and none went through a route. The
  failure that would have caused is silent and is *exactly* the leakage the harness exists to
  prevent: a future route test reading an unmigrated, file-scoped database. It is now asserted
  through `/api/health`, which reports an applied migration inside the harness and none outside,
  and reports none again afterwards.
- **Two overlapping calls did not merely fail, they corrupted.** A → installs, B → installs,
  A → restores-and-closes, B → restores *A's now-closed handle*. Because `getDatabase()` is
  `opened ??=`, a non-null closed handle is never replaced, so every later call in that module
  registry gets a dead connection — surviving well past the offending test. The restore is now a
  compare-and-swap that throws with a message naming the cause, and the limitation in the docs
  widened from "`it.concurrent` is unsafe" to "any two overlapping calls in one module registry",
  which covers the `Promise.all`-in-one-test case that `it.concurrent` does not describe.

Three findings were a rule promising more than its code delivered, and each was closed by tightening
the code: `RequestScope`'s safety argument was proven for `handleApiRequest` but not for the
*future*, so `pipeline.test.ts` now scans `src/server/` and asserts exactly two modules name the
type at all — a guard that survives AUTH-01 and LIVE-01 in a way the router-specific spy does not;
`setProcessDatabase` sits outside the room `test-harness-stays-in-tests` locks, which is now named
as a residual in its own JSDoc rather than implied; and the anonymous-caller status was documented
as 401 in two places and 404 in two others, now uniformly 404 with the v3 Req 32.5 reason attached.

The rest were KISS and doc accuracy: an unused `CallOptions.headers` and six never-passed seed
options deleted, the 306 KB corpus no longer parsed at module load for files that never seed one,
`MEMBER_ROLE` used instead of bare `'dm'`/`'player'` in assertions, a stranded table in
`src/server/README.md` put back under its own heading, and a stale `seedRealRuleset` reference in
`seeds.ts`'s header. Two options survived the cull by being given tests rather than justifications:
`SeedRulesetOptions.data` and `SeedSessionOptions.from` are the two that make the fixture defaults
overridable, and each now has a case that uses it.

The reviewer also verified what I could not check by eye — that the three migrated files kept every
assertion, counted `it(` and `expect(` before and after — and confirmed the
`test-harness-stays-in-tests` trade is real rather than cosmetic. Its instruction to point
`seedSession` and `seedCharacter` at real repositories was copied into the GAM-01 and CHAR-04
tickets, so it is where someone will act on it rather than only in a file header.

**The one place the ticket's design had to be pushed on: `as` needs somewhere to land.** SRV-01's
`RequestContext.account` is typed `null` — literally, not `Account | null` — because AUTH-01 owns
identity. A `callRoute({ as })` that could not reach it would be a helper whose headline feature
does nothing, so `defineHandler`'s returned `Route` gained an optional second parameter,
`RequestScope`, and `account` widened to `RequestAccount | null`.

**A pipeline that accepts an injected identity is a security claim, so it is tested as one.** The
argument is that the route table never passes a scope: `handleApiRequest` calls `route(request)`
with one argument. `apiRouter.test.ts` asserts it by *observation* rather than by inspection — it
swaps a spy into `ROUTES`, drives a request carrying both an `x-account-id` and an `Authorization`
header, and asserts the route was handed `undefined`. When AUTH-01 resolves the Auth_Session
cookie, that resolution becomes the **default** this overrides rather than a second path beside it.

**Widening one door meant adding a lock.** The harness opens databases and inserts rows, so it must
import the connection and Drizzle — which DX-08's `queries-belong-to-repositories` forbids outside
`db/` and `repositories/`. Rather than quietly weaken that rule, `testing/` was added to it *and* a
new rule, `test-harness-stays-in-tests`, refuses any shipped server module importing `testing/`. It
ships with its own fixture, like every other rule. The trade is explicit: `testing/` may reach the
connection precisely because nothing that answers a real request can reach `testing/`.

**`seedRuleset` and `seedRealRuleset` collapsed into one, deliberately.** The ticket asked for both,
on the reasoning that *a toy ruleset with two stats will not catch a formula-reference bug in a
snapshot copy; the corpus will*. That reasoning argues for one function: if the real one is the
honest one, a second whose only distinguishing feature is being less honest is a trap with a
convenient name. `seedRuleset` holds the corpus by default; a test that genuinely wants two stats
passes `data`.

**`withTestDatabase` is a callback, not a `beforeEach` pair.** A hook pair needs a file-scoped
variable to carry the database between the two halves, and that variable is precisely how one test
comes to see another's rows. The callback owns the whole lifetime and cannot be forgotten. It also
keeps the harness free of `vitest`, so `testing/` is plain server code rather than a second
framework — which is why `no-dev-dep-in-production` has nothing to say about it.

**One limitation, stated rather than discovered.** While the callback runs, its database is also the
*process's* database, so a handler reaching `getDatabase()` finds the test's schema. That is a
module-level swap (`setProcessDatabase`, restored on the way out), which makes nesting and throwing
safe and makes `it.concurrent` **within a single file** unsafe. Vitest parallelises across files,
where each worker has its own module registry, so the criterion's "in parallel" holds where the
runner actually applies it. The alternative — threading a database through `RequestContext` — was
rejected because the pipeline would then have to import `db/client`, which is the exact import
`queries-belong-to-repositories` exists to refuse.

**The setter is named `setProcessDatabase`, not `useDatabase`.** Biome's `useHookAtTopLevel` read
the `use` prefix as a React hook and refused the conditional call. The linter was wrong about the
code and right about the name.

**`vitest.setup.ts` keeps its `DATABASE_URL ??= ':memory:'` line**, which is the opposite of what
DB-01 predicted DX-06 would do with it. `env.ts` reads `process.env` when a module first asks, and
that can happen at *import* time — before any test body runs — so no harness function could be early
enough. It is a floor under the tests that never touch a database at all.

**Three existing files were migrated rather than left.** `rulesetRepository.test.ts`,
`eventRepository.test.ts` and `schema.test.ts` each carried their own copy of `migratedDatabase()`
plus `afterEach` bookkeeping. Not one assertion changed. `eventRepository.test.ts` also lost a
hand-written `INSERT INTO game_session` — a second definition of a session row that the next
migration would have had to remember. `schema.test.ts` **keeps** its raw-SQL seeding on purpose: the
harness seats a DM in `session_member`, and its *refuses a second DM* case needs an empty session.
`client.test.ts` and `migrate.test.ts` were left alone, because a harness built on `createDatabase`
and `runMigrations` cannot be used to test `createDatabase` and `runMigrations`.

## Notes

- Resist a global test server. A shared listening process reintroduces test-order coupling, which
  is the thing this ticket exists to prevent.
- The fixtures return rows rather than ids on purpose: a test asserting `revision` should not have
  to re-read what it just seeded.
- `seedRealRuleset()` is the bridge that keeps server tests honest. A toy ruleset with two stats
  will not catch a formula-reference bug in a snapshot copy; the corpus will.
