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

  > **The `AppShell` half needed no change and that is worth recording rather than implying.**
  > TICKET-AUTH-01's `AccountBadge` already reflects signed-in state on the beam and gates nothing;
  > this ticket added no branch to the shell. What proves the *without gating anything local* half
  > is `protectedRoutes.test.ts` enumerating the route tree, plus the browser check fetching all
  > fifteen local-mode routes signed out.

## Acceptance criteria

- [x] Each guard has its own tests: allowed for the right Account, `NotFoundError` for the wrong
      one, `UnauthenticatedError` for nobody. (`src/server/auth/guards.test.ts` — 23 cases, four
      `describe` blocks, each with the allowed case, the wrong-Account 404 and the nobody 401.
      Implementation: [`guards.ts`](../../../src/server/auth/guards.ts). **401 for nobody rather
      than 404 is a deliberate reading of this criterion against 32.5**: `unauthenticated` is thrown
      *before any lookup*, so it says nothing about whether a resource exists, and it is what lets
      the client offer sign-in rather than a dead end. DX-06's `callRoute.ts` header anticipated
      404-for-anonymous and has been corrected to describe what the guards actually do.)
- [x] A read of a resource that exists but belongs to another Account is byte-identical to a read of
      an id that does not exist — same status, same body (v3 Req 32.5). (`guards.test.ts` —
      *answers a read of somebody else's resource exactly as it answers a missing id*, asserted on
      the serialised response through a real `defineHandler` route rather than on the thrown error,
      because the response is what an attacker sees. A companion case does the same for the
      anonymous caller, whose 401 is identical for a session that exists and one that does not.)
- [x] The guards return the loaded row, and a test asserts a guarded handler issues one query for
      the resource rather than two. (`guards.test.ts` — *issues one query for the resource rather
      than two*, counted by wrapping `database.sqlite.prepare` and filtering to statements naming
      `session_member`. `requireOwner` takes the already-loaded row for the same reason: fetching
      again to save the caller a comparison would double every read.)
- [x] An unauthenticated visit to a protected route redirects to sign-in and lands back on the
      originally requested route after signing in, query string preserved.
      (`RequireAccount.test.tsx` for the outbound half, `routes/authRoutes.test.tsx` for the return.
      Browser, 2026-08-25: signed out, `/account?tab=identities` → `/signin?redirect=%2Faccount%3Ftab%3Didentities`
      → sign in → back on `/account?tab=identities`. **Two real bugs came out of that check** and
      both have regression tests — see the last criterion.)
- [x] An unauthenticated visitor reaches **every** local-mode route — the eleven config panels, the
      creation wizard and the character sheet — and is redirected from none of them (v3 Req 32.6).
      The protected set is an explicit list, tested by enumerating the route tree, so a future route
      is open unless someone says otherwise. (`protectedRoutes.test.ts` reads the `fullPaths` union
      out of `routeTree.gen.ts` and asserts the protected subset is exactly `PROTECTED_ROUTES`,
      plus a named list of the sixteen local-mode routes that must stay open *and* still exist.
      Browser, 2026-08-25: all fifteen fetched signed-out, every one 200 with no redirect. A second
      test source-walks each listed route's module for `<RequireAccount>`, so the list cannot claim
      a protection nothing delivers.)
- [x] `requireDM` refuses a `player` Member, and `requireMember` refuses a non-member — both tested
      against real membership rows rather than mocks. (`guards.test.ts`, through DX-06's
      `seedSession`/`seedMember` against a real migrated database. `requireDM` also refuses another
      table's DM, which is the case a role check without a session id would miss.)
- [x] A test walks the server route tree and fails on any handler that reads a path parameter naming
      an owned resource without calling a guard — so a future route cannot forget.
      (`src/server/routes/routeGuards.test.ts`. **The detector is proven against literals**, not
      only against today's tree — one source that guards, one that does not, and one that *imports*
      a guard without calling it, which is the exact hole dependency-cruiser cannot see. The corpus
      is every module under `src/server/` containing `defineHandler(`, found recursively, rather
      than the `routes/` folder: RUL-01's first subfolder and `auth/authRoutes.ts` would both have
      been silently unscanned.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check (ask the User first). (`verifier`: 2203 passing / 0 failing / 0
      skipped, +88 over AUTH-02, typecheck at the documented 2-error baseline, lint and
      `yarn run arch` clean. `fallow`: no introduced dead code, complexity or duplication across 27
      changed files, and **no file this ticket touched came back Accelerating**, so no hotspot row
      is owed. `conventions-reviewer` found one genuine **security defect** — `safeDestination`
      judged the string the browser is *given* rather than the one it will *read*, so
      `/⇥/evil.example` passed every shape check and arrived as an origin; fixed, with the test
      asserting agreement with the real URL parser. It also had the repository-argument question
      right, so DB-01's two were converted rather than left as a second convention.
      **The browser check earned its place twice**: it found a redirect loop compounding
      `?redirect=` until it filled the address bar, and a sign-in that silently never navigated
      because three different router APIs each no-op on a built URL. Neither is visible from a unit
      test written against the same wrong assumption, and both now have one.)

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
