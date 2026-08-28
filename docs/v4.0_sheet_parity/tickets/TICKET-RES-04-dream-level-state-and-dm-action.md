# TICKET-RES-04 — Dream level: player state, raised by the DM

- **Area:** Progression / Dungeon Master controls
- **Type:** Feature
- **Traceability:** System [02 · Progression and identity](../systems/02-progression-and-identity.md)
  (gap 2); overview [Rulings 2026-08-29](../overview.md#rulings-user-2026-08-29) ("the DM, as an
  action"). Prerequisite of TICKET-ARC-04, whose gain formula reads the field.

## User story

As a DM, I want to raise a player's Dream level the way I award experience, so how far they stand
in their dream is on their sheet — and their archetype's gains grow with it.

## Description

Dream level is new stored player state — "Hoe ver je staat in je dream" — that the archetype gain
formulas read (main × dream, sub + dream; TICKET-ARC-04). It is an **input to derivation, not a
derived value**: nothing derives it, which is the same test that admitted `experience`. The DM
raises it as an action on the surface that already awards experience and sets level.

## Current situation (as-is)

- **Dream level does not exist** anywhere in the app — not on
  [`Character`](../../../src/shared/types/character.ts), not in the engine, not in a fragment.
- The DM action surface is TICKET-DM-01's: a pair in
  [dmActions.ts](../../../src/shared/services/dmActions.ts) (`addExperience` /
  `setLevelExperience`), called by `characterStore` in local mode and `routes/dm/` on the server,
  each writing one Event with before/after values and refusing rather than clamping.
- The sanctioned stored exceptions are enumerated in [CLAUDE.md](../../../CLAUDE.md):
  `currentResourceValues`, `experience`, `purse`, `grantedStatPoints`.

## Desired result (to-be)

- **`Character.dreamLevel?: number`** — optional, **absent-means-1** (the sheet's sample and its
  multiplicative role both point at 1 as neutral). It joins the sanctioned stored exceptions;
  CLAUDE.md and the `data-model` skill say so in the same change.
- **A setter in [dmActions.ts](../../../src/shared/services/dmActions.ts)** beside the experience
  pair — refuse-rather-than-clamp (below 1 is refused, naming the floor), one Event naming the DM
  and before/after, callable from `characterStore` locally and the existing DM routes on the
  server (no new route surface; overview [D2](../overview.md#d2--the-backend-does-not-change)).
- **Surfaced where progression already is**: a row in the DM's quick actions / adjustment panel,
  and Dream level displayed in the sheet's identity block beside Level and ATP.

## Acceptance criteria

- [ ] A character with no `dreamLevel` reads 1 everywhere it is consumed — pinned by an engine
      test (the neutral default is the reader's rule, not a stored backfill).
- [ ] Setting Dream level below 1 is refused with the reason and writes nothing; a valid set
      writes one Event naming the DM, the Character, and before/after — same discipline and same
      pipeline as TICKET-DM-01's actions (`dm.test.ts` pattern).
- [ ] A `player` Member calling the DM setter is refused with the indistinguishable 404
      (`requireCharacterDM`); persistence goes through the store action locally and the shared
      service on the server — no component touches storage.
- [ ] The sheet's identity block shows Dream level; the DM panel exposes the control on any
      Character in their session.
- [ ] CLAUDE.md's stored-exceptions list and the `data-model` skill both name `dreamLevel` in this
      change, with the "nothing derives it" justification.
- [ ] Unit tests cover: absent-means-1, refuse-below-1, the Event's before/after, and the
      player-refused case.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser check with two accounts — DM raises, player sees (ask the User
      first; the two-cookie-jar setup from CLAUDE.md's Verifying section).

## Notes

- **Must land before TICKET-ARC-04** — the overview's build-order note: §14's `dreamLevel` field
  is a prerequisite of §2's gain formula. This ticket carries the field and the action; ARC-04
  carries the formula that reads it.
- Additive-optional character field → needs no version bump on its own (overview
  [D6](../overview.md#d6--no-backwards-compatibility-v40-is-a-clean-break-user-2026-08-29)'s
  standing rule); the milestone's single bump is whichever reshaping ticket lands first.
- The rest of plan §14 — the one shared point pool and the Points readout — is TICKET-RES-05.
