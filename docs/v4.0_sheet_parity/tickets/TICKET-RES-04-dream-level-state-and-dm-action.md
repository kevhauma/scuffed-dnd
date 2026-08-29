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
  and Dream level displayed in the sheet's identity block beside Level and APT.

## Implementation note (2026-08-29) — the local sheet got the control too

**One addition to the to-be above, made while building and recorded here rather than after.** The
to-be named two surfaces (the DM panel and the identity-block display); the build also gives the
**signed-out** sheet a control, through `characterStore.updateDreamLevel` → the same Kernel rule.

The reason is `awardExperience`'s, stated at the top of
[dmActions.ts](../../../src/shared/services/dmActions.ts): signed out there is no DM, the Player
keeps their own sheet, and that is one person playing both parts. Without it a browser-only ruleset
could never raise a dream level at all, which would leave TICKET-ARC-04's whole gain term inert on
the path [CLAUDE.md](../../../CLAUDE.md) says must not degrade. At a table the local action is
refused with the sentence experience and the purse are refused with, so the ruling — *the DM raises
it* — holds exactly where there is a DM to hold it.

## Acceptance criteria

- [x] A character with no `dreamLevel` reads 1 everywhere it is consumed — pinned by an engine
      test (the neutral default is the reader's rule, not a stored backfill).
      (`src/shared/engine/dreamLevel.ts`'s `dreamLevelOf`; `dreamLevel.test.ts` — *reads 1 for a
      character that has never had one, without the field appearing* also asserts no key was
      written, and *falls back rather than returning a number no gain formula could multiply by*
      covers `undefined`/`null`/`NaN`. Every consumer goes through it: `useCharacterSheet`,
      `setDreamLevel`, and `dm.test.ts`'s assertion on the persisted document.)
- [x] Setting Dream level below 1 is refused with the reason and writes nothing; a valid set
      writes one Event naming the DM, the Character, and before/after — same discipline and same
      pipeline as TICKET-DM-01's actions (`dm.test.ts` pattern).
      (`setDreamLevel` in `src/shared/services/dmActions.ts` — `A dream level cannot be below 1.`,
      naming the floor from `DEFAULT_DREAM_LEVEL`; `dm.test.ts` → *stores the number that was typed*
      asserts one Event with `actorAccountId` = the DM, `characterId`, `before: 1, after: 3`, and
      *refuses a level below the floor* asserts `400`, the field still `undefined`, and **zero**
      Events. Same `applyPlayerAction` pipeline as the other five adjustments.)
- [x] A `player` Member calling the DM setter is refused with the indistinguishable 404
      (`requireCharacterDM`); persistence goes through the store action locally and the shared
      service on the server — no component touches storage.
      (`src/server/routes/dm/dmSetDreamLevel.ts` calls `requireCharacterDM`, which `dmRules.test.ts`
      asserts for every write module in the folder; `dm.test.ts` → *refuses a `player` Member with
      the same 404 a stranger gets* compares the body byte-for-byte with the never-minted-id answer.
      Client side: `characterStore.dmSetDreamLevel` / `updateDreamLevel` are the only writers —
      `SheetHeader` and `DmControlsPanel` receive callbacks and touch no storage.)
- [x] The sheet's identity block shows Dream level; the DM panel exposes the control on any
      Character in their session.
      (`CharacterSummaryLine` renders `Dream level N` beside the level, fed by `SheetHeader` from
      `useCharacterSheet.dreamLevel`; `DmControlsPanel` renders an `AdjustmentField` row —
      `DmControlsPanel.test.tsx` → *sends a dream level as the new total, and says where it stands
      now* types into it and asserts the handler and the "2 now" readout.)
- [x] CLAUDE.md's stored-exceptions list and the `data-model` skill both name `dreamLevel` in this
      change, with the "nothing derives it" justification.
      (CLAUDE.md's *Derived values are computed, never stored* rule now reads **five** sanctioned
      exceptions; `.claude/skills/data-model/SKILL.md`'s derived-vs-stored section carries the field
      and the same test — nothing derives it, the archetype gains derive *from* it.)
- [x] Unit tests cover: absent-means-1, refuse-below-1, the Event's before/after, and the
      player-refused case.
      (21 new tests: `dreamLevel.test.ts` 3, `dmActions.test.ts` +6, `dm.test.ts` +3,
      `characterStore.test.ts` +5, `characterStore.table.test.ts` +2,
      `DmControlsPanel.test.tsx` +1, `describeAdjustment.test.ts` +1. Suite 3067 → **3088**,
      0 failing, 0 skipped.)
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser check with two accounts — DM raises, player sees (ask the User
      first; the two-cookie-jar setup from CLAUDE.md's Verifying section).
      **Half done, deliberately open.** `npx vitest run` (3088 passing / 194 files / 0 failing /
      0 skipped), `npx tsc --noEmit` (the documented 2, unchanged), `yarn run lint` and
      `yarn run check` (clean, 0 findings, 686 modules cruised) and `fallow audit --base main`
      (**pass**, 0 introduced dead-code / complexity / duplication findings) all ran.
      **The browser check was skipped by User instruction for this run**, so this box stays open.

## Notes

- **Must land before TICKET-ARC-04** — the overview's build-order note: §14's `dreamLevel` field
  is a prerequisite of §2's gain formula. This ticket carries the field and the action; ARC-04
  carries the formula that reads it.
- Additive-optional character field → needs no version bump on its own (overview
  [D6](../overview.md#d6--no-backwards-compatibility-v40-is-a-clean-break-user-2026-08-29)'s
  standing rule); the milestone's single bump is whichever reshaping ticket lands first.
- The rest of plan §14 — the one shared point pool and the Points readout — is TICKET-RES-05.
