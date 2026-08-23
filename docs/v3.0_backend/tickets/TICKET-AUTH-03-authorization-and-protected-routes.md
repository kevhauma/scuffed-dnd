# TICKET-AUTH-03 — Authorization primitives and protected routes

- **Area:** Accounts
- **Type:** Feature
- **Traceability:** v3 [Req 32](../requirements.md#requirement-32-access-control); overview
  [Definition of Done](../overview.md#definition-of-done-applies-to-every-ticket) rule 2

## User story

As an account holder, I want my data to be mine, so that no other account can read or change my
rulesets, my sessions or my characters.

## Description

**The ticket the rest of the milestone leans on.** AUTH-01 answers *who is this*; this answers *may
they*. Every guard the milestone needs is written once here, so that RUL-01 through DM-02 each spend
one line rather than reimplementing ownership.

There is nothing user-visible except the redirect — and that is the point: the guards must exist
before the first owned resource does, not after.

## Current situation (as-is)

- SRV-01's request context resolves an Account or `null`; nothing consumes it.
- No owned resources exist yet — RUL-01 brings the first. This ticket lands its guards first so that
  RUL-01's tests can be written against a guard rather than against a hand-rolled check.
- Every route in `src/routes/` is public and always has been — and under
  [D6](../overview.md#d6--local-mode-stays-sign-in-gates-connected-play-only) most of them **stay**
  that way: the whole configuration UI and the whole play surface work signed out against the
  browser's local ruleset.

## Desired result (to-be)

- `requireAccount(ctx)` → the Account or an `UnauthenticatedError`, and the ownership guards built
  on it: `requireOwner(resource)`, `requireMember(gameSessionId)`, `requireDM(gameSessionId)`,
  `requireCharacterWriter(characterId)` — each returning the loaded row so the handler does not
  fetch twice.
- A **single** `NotFoundError` thrown for both "does not exist" and "exists but is not yours", so
  that identifiers cannot be probed (v3 Req 32.5). The distinction is logged server-side and never
  reaches the response.
- Client-side route protection **scoped to server-owned data only** (D6): account rulesets, game
  sessions and invitations are protected; every local-mode route stays open. An unauthenticated
  visitor on a protected route is redirected to sign-in and returned afterwards, and `AppShell`
  reflects signed-in state without gating anything local.

## Acceptance criteria

- [ ] Each guard has its own tests: allowed for the right Account, `NotFoundError` for the wrong
      one, `UnauthenticatedError` for nobody.
- [ ] A read of a resource that exists but belongs to another Account is byte-identical to a read of
      an id that does not exist — same status, same body (v3 Req 32.5).
- [ ] The guards return the loaded row, and a test asserts a guarded handler issues one query for
      the resource rather than two.
- [ ] An unauthenticated visit to a protected route redirects to sign-in and lands back on the
      originally requested route after signing in, query string preserved.
- [ ] An unauthenticated visitor reaches **every** local-mode route — the eleven config panels, the
      creation wizard and the character sheet — and is redirected from none of them (v3 Req 32.6).
      The protected set is an explicit list, tested by enumerating the route tree, so a future route
      is open unless someone says otherwise.
- [ ] `requireDM` refuses a `player` Member, and `requireMember` refuses a non-member — both tested
      against real membership rows rather than mocks.
- [ ] A test walks the server route tree and fails on any handler that reads a path parameter naming
      an owned resource without calling a guard — so a future route cannot forget.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check (ask the User first).

## Notes

- The tree-walking test in the sixth criterion is the load-bearing one. Review catches a missing
  guard on the day it is written and never again; a test catches it in six months. **It has to be a
  purpose-written test rather than a dependency-cruiser rule** — dependency-cruiser sees imports, and
  this obligation is about a *call site*: a handler that imports the guard module and never calls it
  passes every import rule there is. TICKET-DX-08's criterion six exists to write that limit down.
- `requireMember` and `requireDM` take a Game_Session id even though no such table has rows until
  GAM-01. That is deliberate — the guard exists before its first caller, unlike the pattern
  TICKET-ROLL-03 flagged where a guard with no possible referrer is an unfalsifiable green box.
  Here it *is* falsifiable: DX-06 can seed a membership row directly.
- The return-to-destination redirect gets a **second caller** in TICKET-AUTH-04: a session expiring
  while the app is open routes through exactly this path, so that "you were signed out" and "you
  were never signed in" land the User in the same place rather than in two surfaces that drifted.
  Build it as one mechanism taking a destination, not as a redirect that happens to work.
- Rate limiting on authenticated routes is not in this ticket. AUTH-01 rate-limits sign-in, which
  is the surface that matters; anything more is a POL-03 concern.
