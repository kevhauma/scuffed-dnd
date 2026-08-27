# TICKET-PLY-01 — Player actions go through the server

- **Area:** Play (session-scoped player actions — new area)
- **Type:** Feature
- **Traceability:** v3 [Req 41](../requirements.md#requirement-41-player-actions),
  [Req 45](../requirements.md#requirement-45-server-authority)

## User story

As a Player, I want to spend my points and manage my resources and inventory at the table, so that
I can play without the DM typing for me — and without being able to give myself points nobody
granted.

## Description

Every write a Player makes to their own sheet **in a session** goes to the server, re-checked by the
**Kernel** rather than by a second implementation. The store actions keep their names and their
refusal semantics; what changes is who decides.

**Local play is untouched** ([D6](../overview.md#d6--local-mode-stays-sign-in-gates-connected-play-only)):
a local character's spend, resource change and equip still run entirely in `useCharacterStore`
against LocalStorage, needing no account and no network. The store branches on where the character
lives, in one place, exactly as RUL-02's save path does.

This is also the first ticket that writes Events. Nothing reads them until LIVE-02, which is
deliberate: the log has to be complete before the feed is worth having.

## Current situation (as-is)

- `useCharacterStore` owns the writes and already refuses rather than clamps where it matters:
  `setInvestedStatPoints` refuses an unaffordable spend (TICKET-RES-02), `equipItem` refuses a
  slot-type mismatch (Req 12.3), `updateCurrentStatValue` clamps to the derived maximum inside the
  action (Req 14.3), and a fallen maximum leaves a stored current alone and flags it
  (TICKET-RES-03).
- Every one of those rules is already in the Kernel or in a store action that calls it — which is
  what makes moving them cheap.
- `useNumericDraft` commits on blur or Enter, so a surface already sends whole values rather than
  keystrokes.

## Desired result (to-be)

- Routes for the player writes — invest points, set/adjust/reset a current resource value, equip,
  unequip, move to misc, move to equipment — each behind `requireCharacterWriter`, each validating
  against the **Snapshot** with the same Kernel functions the client calls.
- Every accepted action appends an Event naming the actor, the character, the action and the before
  and after values. Every refused action writes nothing.
- The client sends the intent and adopts the server's returned character; a refusal is presented as
  a refusal with the server's reason, and the surface never shows an action that did not land.

## Implementation notes (2026-08-27)

Three decisions taken while building, recorded here rather than left to be inferred from the diff:

- **Eleven routes, not seven.** The to-be names seven writes; the sheet has four more controls that
  would otherwise have silently lost what they changed at a table — skill points, and the pack's
  add/remove. They are the same shape, so they are the same ticket rather than a follow-up with a
  broken surface in between. Each is a `PLAYER_ACTION` value, and the value *is* the route's last
  path segment and the Event's `type`.
- **A character at no table is refused with a 409.** v3 Req 41.7 asks every accepted action to write
  an Event, and `event.session_id` is `NOT NULL` — so IO-04's uploaded characters, which sit at no
  Game_Session, have nowhere to log to. Writing the change and quietly skipping the log would be
  worse than refusing, so these routes refuse with the same status and reasoning `requireActive`
  uses for an archived table.
- **There is no client-supplied revision guard**, and `#shared/types/api`'s forward-looking note
  about one is corrected in the same change. A ruleset save states the base revision because it
  carries a whole *document*; a player action carries an **intent** the server applies to the row as
  it stands, so a stale client has nothing to overwrite and a conflict would be a refusal nobody
  could act on. `revision` is still bumped per accepted action, for LIVE-02.
- **Experience and the purse are not drawn on a session sheet.** They are the DM's at a table (D9,
  v3 Req 42), so there is no player route for them and the controls are **absent** rather than
  disabled — TICKET-DM-01 and TICKET-DM-02 bring them back on the DM's side.

## Acceptance criteria

- [x] An unaffordable spend is refused by the server with the reason, even when the client sends it
      directly — the refusal is proven with a request, not with a UI interaction.
      (`server/routes/play/play.test.ts` → *refuses a spend the budget cannot pay for, with the
      reason, on a request the UI cannot make*: `POST /api/characters/:id/invest-stat-points` with
      9,999 points answers 400 naming the budget, the stored allocation is untouched and the row is
      still at revision 1.)
- [x] A resource write clamps to the Snapshot-derived maximum server-side, a negative passes through
      (Req 14.4), and a stored current above a fallen maximum is left alone and flagged rather than
      rewritten (TICKET-RES-03's rule, now server-side).
      (`play.test.ts` → *clamps a write to the maximum the Snapshot derives*, *lets a pool go
      negative*, *takes a delta off what is stored rather than off a clamped reading of it*, and
      *leaves a pool that is already above its maximum exactly where it is* — the last writes a
      9,999,999 straight into storage past every route, then moves a **different** pool and asserts
      the first is unchanged.)
- [x] An equip whose `Item.equipmentSlotType` does not match the target slot is refused, including
      an item with no slot type and a slot the Snapshot does not define.
      (`play.test.ts` → *refuses an item whose slot type is a different one*, *refuses an item with
      no slot type at all*, *refuses a slot the Snapshot does not define*; the rule itself is
      `shared/services/playerActions.ts`'s `slotRefusal`, tested again directly in
      `playerActions.test.ts`. The corpus has seven slots and no equippable item, so the equipment
      cases pin two items onto the **Snapshot** rather than onto the ruleset.)
- [x] A write to a character the Account does not own is refused; the DM's equivalent power is
      DM-01/DM-02 and does not leak in here.
      (`auth/guards.ts` → `requireCharacterPlayer`, which is `requireCharacterWriter` minus the DM;
      `play.test.ts` → *refuses an anonymous caller with a 401 and everybody else with the same 404*
      asserts the **DM's** refusal is byte-identical to a stranger's, and *refuses a Member whose
      seat has gone* keeps GAM-04's retention rule.)
- [x] Every accepted action writes exactly one Event with before and after values; every refused
      action writes none — asserted by counting rows.
      (`play.test.ts` → *writes exactly one event per accepted action, naming the actor and both
      values*, *writes none for a refused action, however many are refused*, *numbers events in the
      order they happened*. The write and the Event are one transaction —
      `characterRepository.recordPlayerAction`.)
- [x] A refused action leaves the client surface showing the pre-action state with the server's
      reason, and a test asserts the store state after a refusal.
      (`client/stores/characterStore.table.test.ts` → *leaves the character exactly as it was when
      the server refuses, and says why*: `tableCharacter` deep-equals its pre-action self and
      `actionError` is the server's own sentence. `CharacterSheet.tsx` renders it as a dismissible
      `role="alert"` banner above the sheet.)
- [x] The server calls `src/engine/` for every check — a test asserts no rule is reimplemented in
      `src/server/` by checking the module imports rather than by reading them.
      (`server/routes/play/playerRules.test.ts`: every handler module in `routes/play/` imports
      `#shared/services/playerActions` and **none** imports `#shared/engine/` directly, with the
      module count asserted against `PLAYER_ACTION` so the scan cannot pass by looking at nothing.
      The rules moved to the Kernel rather than being copied there, so `characterStore` and the
      routes call one implementation.)
- [x] Every action on a **local** character still works with the network stubbed to throw, with the
      same refusals it has today — the existing `characterStore` tests pass unchanged, which is the
      cheapest proof that local mode did not regress (D6).
      (`characterStore.test.ts` is **untouched** and its 82 cases pass; the new cases live in a
      second file. `characterStore.table.test.ts` → *asks the network nothing, even while another
      character is open at a table* stubs `fetch` to **throw**, and
      `useOpenTableCharacter.test.ts` → *asks the server nothing while nobody is signed in* does the
      same for the sheet's own read.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check (ask the User first).
      (`npx vitest run` **2904 passing, 0 failing, 0 skipped** across 181 files — measured against a
      re-run baseline of 2827/176 on `main`, because the recorded 2801/174 was stale;
      `npx tsc --noEmit` at the documented 2-error baseline; `yarn run check` clean, 0 dependency
      violations. `fallow audit --base main`: **0 dead code introduced, 0 complexity introduced**.
      The `conventions-reviewer` pass and the browser check between them found five real defects,
      all fixed with the test that reproduces each — see the review record below.)

## What the review and the browser found (2026-08-27)

Nine findings, five of them defects. None was visible from a failing test, and the two worst were
invisible **by construction** — which is the same shape RUL-02 and IO-04 reported.

1. **A lost update on every route.** The row was read in the guard and the body was read after it,
   so `await context.json()` sat between the read and the write: two overlapping actions both
   applied to the same stale character and one was silently lost, with two Events claiming the
   identical before and after. Every route now reads its body first and guards second.
   `play.test.ts`'s *"loses neither of two actions that overlap"* was verified against the defect —
   it fails `expected -5 to be -10` with the old ordering.
2. **A sheet that never stopped loading**, found in the browser and nowhere else: the effect's own
   success re-ran it and the cleanup cancelled the settle. Fixed with a ref, and reproduced by
   `useOpenTableCharacter.test.ts`'s *"settles even though its own success re-runs the effect"*.
3. **`isActing` was documented as a double-submit gate and gated nothing** — which is what made (1)
   reachable from a sheet. `toTable` now keeps one write in flight per character, `rulesetSync`'s
   rule one aggregate over.
4. **Experience and the purse no-opped silently for a table character**, with the invariant held by
   a JSX conditional rather than by the store. Now an explicit refusal with a reason.
5. **An uploaded character opened by URL was held as a table character it is not** — the sheet
   rendered a configuration mismatch with the purse hidden and every write meeting a 409.
   `openTableCharacter` now refuses a `sessionId: null` document.
6. **A refusal message no surface could render**: a failed *open* set `actionError`, but the banner
   only renders on a drawable sheet. The not-found notice shows it instead.
7. `applyPlayerAction` inferred the actor from the row rather than taking one, which was correct
   only because every caller used `requireCharacterPlayer`. It takes the actor now.
8. Two dead declarations this change introduced (`tableSessionId`, and `updateCurrentStatValues`
   once the delegation reversed) — deleted, not deprecated. `fallow dead-code` sees neither.
9. `useCharacterSheet` was over the cognitive-complexity threshold and this ticket grew it;
   `useSheetActions` came out of it (27 → 17, 157 lines → 66). It is **still 2 over**, inherited
   rather than introduced, and recorded here rather than claimed fixed.

**Deliberately kept, and checked rather than assumed**: the eleven route modules' shared preamble
(`routeGuards.test.ts` scans a *module* for a guard call, so a shared helper would defeat it — three
clone groups, reported and accepted); the 409 for a character at no table; no client revision guard;
and `addMiscItem`/`removeMiscItem` not calling the Kernel locally, because there is no browser-side
rule to share and the server being *stricter* is the right direction.

## Browser check (2026-08-27, `yarn dev`)

Signed in as a throwaway local account, on the real Ducklets corpus imported to it:

- **A session character's sheet opens** from *Open sheet* on the expanded row in `/sessions`, and
  the button appears on the reader's own character and on nobody else's.
- **Spending a point lands on the server**: `investedStatPoints` reaches the row, `revision` goes to
  6, an `invest-stat-points` Event is written with `before: 0, after: 1`, and the sheet's roll label
  moves from `1D6 + 4` to `1D6 + 5` — a derived value following the server's answer.
- **The Event log chains correctly** across a real session: health `5 → 4 → 3 → 2`, a
  `reset-resource` back to 5, three `invest-stat-points`, and a `take-item` with
  `before: null, after: item-helmet-13`.
- **The sheet is a page, not a moment**: a hard load of `/play/character/<id>` in a fresh tab
  renders the character against its table's Snapshot, with **no console errors**.
- **Neither the experience controls nor the purse are drawn** at a table.
- **Back** returns to `/sessions` and puts the browser's own ruleset back.

Two things the check could **not** exercise, and both are honest gaps rather than untested code:
the over-budget refusal banner (the client control correctly disables at 3/3, which is why criterion
1 proves that refusal with a *request*), and equipping (the corpus defines seven slots and not one
item that declares a slot type — the route tests pin two onto a Snapshot for exactly this reason).

## Notes

- **Optimistic updates are out of scope here.** Send, wait, adopt. The actions are one per human
  decision, not one per keystroke, and a spend that appears and then un-appears is worse than one
  that takes 80ms. LIVE-02 may revisit this for *other people's* changes; a Player's own action
  stays synchronous.
- The before/after values on an Event are what makes DM-01's audit and LIVE-02's reconciliation
  possible without re-reading the whole character. Record them even where they feel redundant.
- Resist adding a generic "patch character" route. Each action is a named intent, which is what lets
  the Event log say what happened rather than that something did.
