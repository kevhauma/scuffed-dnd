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

- [ ] Two tests running in the same file cannot see each other's rows; a test that writes and a
      test that counts pass in either order and in parallel.
- [ ] `callRoute` reaches the same pipeline production uses — a handler throwing `AppError` produces
      the mapped status in a test exactly as it does in the server.
- [ ] A three-line refusal test is demonstrated on `/api/health`'s successor or a scratch route:
      anonymous → refused, wrong account → refused, right account → allowed.
- [ ] `seedRealRuleset()` produces a `Configuration` that `validateConfigurationShape` accepts and
      `calculateCharacter` runs against without error values other than the ones the corpus already
      carries.
- [ ] Suite runtime does not regress materially — the per-test database setup is measured and
      recorded in [TEST_STATUS.md](../../../TEST_STATUS.md).
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.

## Notes

- Resist a global test server. A shared listening process reintroduces test-order coupling, which
  is the thing this ticket exists to prevent.
- The fixtures return rows rather than ids on purpose: a test asserting `revision` should not have
  to re-read what it just seeded.
- `seedRealRuleset()` is the bridge that keeps server tests honest. A toy ruleset with two stats
  will not catch a formula-reference bug in a snapshot copy; the corpus will.
