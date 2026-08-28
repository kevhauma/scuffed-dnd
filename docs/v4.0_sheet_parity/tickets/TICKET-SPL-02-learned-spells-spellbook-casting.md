# TICKET-SPL-02 — Learned spells, the Spellbook, and casting

- **Area:** Spells (play mode)
- **Type:** Feature
- **Traceability:** System [13 · Spells](../systems/13-spells.md) (gaps 2, 3); overview
  [Rulings 2026-08-29](../overview.md#rulings-user-2026-08-29) (spells unlock **manually**;
  "Chosen abiltie" is nothing yet). **Needs TICKET-SPL-01** (the entity).

## User story

As a Player, I want to mark spells learned, read them in my Spellbook, and spend mana to cast —
so my magic works the way the sheet's Spellbook tab plays.

## Description

Learned-per-character tracking (a hand-set flag — no rule derives it, nothing gates it), the
play-mode Spellbook mirroring the sheet's own `FILTER`-down-to-learned view, and casting as a
mana spend against the existing resource pool. A cast is a resource spend, not a dice roll —
server-resolved rolls are untouched.

## Current situation (as-is)

- TICKET-SPL-01 gives the ruleset its compendium; no character state references it.
- Resource spends exist: `adjustCurrentStatValue` and the player-action pipeline
  ([playerActions.ts](../../../src/shared/services/playerActions.ts), TICKET-PLY-01) already
  carry refuse-below-zero discipline for pools.
- The sheet's Setup tab has a "Chosen abiltie" box — **ruled a placeholder**; it gets no model,
  no wiring to learned spells, no signature-spell concept.

## Desired result (to-be)

- **`Character.learnedSpellIds?: string[]`** — absent-means-none (the sheet's `locked` default),
  set and unset by hand from the play surface; persistence through the store action locally and
  the existing player-action route on the server.
- **The Spellbook view**: the learned subset with name, mana cost, range/time and effect —
  the sheet's own play surface, specified by its `Spellbook` tab. (Effects render as stored text
  until TICKET-SPL-03 resolves templates.)
- **Casting spends mana**: a cast action deducts `manaCost` from the Mana pool through the
  existing resource actions. Whether an unaffordable cast is refused or allowed (going negative)
  is decided **with the User** in this ticket — refuse is the house default; record the answer.

## Acceptance criteria

- [ ] Marking a spell learned adds it to the Spellbook; unmarking removes it; a deleted spell id
      is a validation finding, not a crash — pinned through the store and the shared service.
- [ ] A cast moves `currentResourceValues` for Mana by exactly `manaCost`, through the existing
      action (no new arithmetic path); the insufficient-mana decision is implemented as the User
      ruled it and pinned by a test naming the choice.
- [ ] The server path: learned edits and casts ride existing player-action routes
      (overview [D2](../overview.md#d2--the-backend-does-not-change) — no new route surface);
      a DM's view is untouched.
- [ ] "Chosen abiltie" appears nowhere — no field, no UI (ruled placeholder; grep stays empty).
- [ ] The guarded-delete edge lands: deleting a spell a character has learned is refused naming
      the character ([dependencies.ts](../../../src/shared/engine/dependencies.ts) walker).
- [ ] Unit tests cover: absent default, learn/unlearn round-trip, the cast's spend and its
      refusal case, and the delete guard.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser check: learn, read, cast, watch the pool (ask the User first).

## Notes

- The sheet's flag matches case-insensitively (`"learned"` vs `Learned`) — a transcription note
  for the fragment, not app logic: the app stores ids, not flags.
- Additive-optional character field — no version bump of its own.
