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

## Acceptance criteria

- [ ] An unaffordable spend is refused by the server with the reason, even when the client sends it
      directly — the refusal is proven with a request, not with a UI interaction.
- [ ] A resource write clamps to the Snapshot-derived maximum server-side, a negative passes through
      (Req 14.4), and a stored current above a fallen maximum is left alone and flagged rather than
      rewritten (TICKET-RES-03's rule, now server-side).
- [ ] An equip whose `Item.equipmentSlotType` does not match the target slot is refused, including
      an item with no slot type and a slot the Snapshot does not define.
- [ ] A write to a character the Account does not own is refused; the DM's equivalent power is
      DM-01/DM-02 and does not leak in here.
- [ ] Every accepted action writes exactly one Event with before and after values; every refused
      action writes none — asserted by counting rows.
- [ ] A refused action leaves the client surface showing the pre-action state with the server's
      reason, and a test asserts the store state after a refusal.
- [ ] The server calls `src/engine/` for every check — a test asserts no rule is reimplemented in
      `src/server/` by checking the module imports rather than by reading them.
- [ ] Every action on a **local** character still works with the network stubbed to throw, with the
      same refusals it has today — the existing `characterStore` tests pass unchanged, which is the
      cheapest proof that local mode did not regress (D6).
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check (ask the User first).

## Notes

- **Optimistic updates are out of scope here.** Send, wait, adopt. The actions are one per human
  decision, not one per keystroke, and a spend that appears and then un-appears is worse than one
  that takes 80ms. LIVE-02 may revisit this for *other people's* changes; a Player's own action
  stays synchronous.
- The before/after values on an Event are what makes DM-01's audit and LIVE-02's reconciliation
  possible without re-reading the whole character. Record them even where they feel redundant.
- Resist adding a generic "patch character" route. Each action is a named intent, which is what lets
  the Event log say what happened rather than that something did.
