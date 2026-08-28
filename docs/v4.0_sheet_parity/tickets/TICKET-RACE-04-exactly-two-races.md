# TICKET-RACE-04 — Exactly two races: `Empty` is deleted

- **Area:** Races / character creation
- **Type:** Feature (reshape, clean break)
- **Traceability:** System [04 · Races](../systems/04-races.md) (gap 2); overview
  [Rulings 2026-08-29](../overview.md#rulings-user-2026-08-29) ("Two race slots, both real") and
  [D6](../overview.md#d6--no-backwards-compatibility-v40-is-a-clean-break-user-2026-08-29).
  **Needs TICKET-RACE-03** (the 25-race catalog this rule selects from).

## User story

As a Player, I want to pick my character's two parent races — a pure-blood being the same race
picked twice — so my ancestry works the way the sheet's Setup form has it.

## Description

The sheet's Setup form has exactly two race slots (Mothers race / Fathers race are a relabelled
mirror, settled by formula), and "pure Ducklets" is Ducklets twice — exactly what the sample
character does and what the blend rewards. `Empty` — the old sheet's no-race placeholder — is
deleted, and a character has **exactly two** races, not "at most 2".

## Current situation (as-is)

- `MAX_RACE_COUNT` caps `Character.raceIds` at two but allows fewer
  ([characterCreation.ts](../../../src/shared/services/characterCreation.ts),
  [statCalculator.ts](../../../src/shared/engine/calculators/statCalculator.ts)); the wizard
  ([useCharacterCreation.ts](../../../src/client/components/play/creation/useCharacterCreation.ts))
  accepts a single pick, and `Empty` in [races.json](../../imports/races.json) is how a single
  race is expressed without halving.
- The blend already reads two blocks — nothing else changes in `calculateRaceStatBases`.

## Desired result (to-be)

- **`Character.raceIds` is exactly 2.** `MAX_RACE_COUNT` stays the one place the number lives;
  the creation rules refuse a single pick, and halving stops being a way to express a single race
  (a pure-blood is the same id twice, which the `MAX(1, ROUNDUP(a+b)/2)` chain returns intact).
- **The wizard requires both picks**, and may caption the two slots as the sheet does (Mothers
  race / Fathers race) — two pickers, duplicates legal.
- **`Empty` is deleted** from the fragment and seeds with no conversion (D6): a stored character
  holding `race-empty` or a single id meets `IncompatibleDataNotice`
  ([IncompatibleDataNotice.tsx](../../../src/client/components/shared/IncompatibleDataNotice.tsx))
  with a backup offer; `race-empty` earns a `RETIRED_FIELDS`-style note naming the replacement
  ("pick the race twice").

## Acceptance criteria

- [ ] Creating a character with fewer than two race ids is refused by the shared creation rules
      with the reason (server and local through the same Kernel rule); the same id twice is legal
      and reproduces the unblended block — both pinned by `characterCreation` tests.
- [ ] The wizard cannot advance past the race step with one pick; picking the same race in both
      slots works and previews the intact block — component test.
- [ ] `Empty` appears nowhere in seeds, corpus, or picker; the retirement note names the
      replacement so an old file's error message is a sentence, not a shape error.
- [ ] No conversion code exists for the old shape (D6) — the milestone's
      `SUPPORTED_SCHEMA_VERSION` bump covers it; if this ticket lands the bump, say so.
- [ ] [races.json](../../imports/races.json) updated (Empty removed, note recorded);
      `yarn run sheet:import` regenerated.
- [ ] Unit tests cover: refuse-one, allow-duplicate, the blend on a duplicate pair, and the
      incompatible-data path for a single-race stored character.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser check of the wizard's two-slot step (ask the User first).

## Notes

- The overview flagged this line as "no longer data-only" — the reshape's blast radius is
  character creation and the allocation path, which is why it is split from RACE-03.
- Existing v4-shape characters all carry two ids by construction after this lands; the sample
  character (Ducklets twice) is the golden case TICKET-DX-09 pins.
