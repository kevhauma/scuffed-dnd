# TICKET-RACE-03 — Races ×25, creature identity, and the blend floor

- **Area:** Races configuration
- **Type:** Feature (data revision + engine term)
- **Traceability:** System [04 · Races](../systems/04-races.md) (gaps 1, 3, 4, 5); system
  [14 · Reference tables](../systems/14-passives-and-reference-tables.md) (sizes and types).

## User story

As a User, I want the new workbook's 25 races — each with its creature type, size and challenge
rate — so my players pick from the roster the table actually plays.

## Description

The picker grows from 10 to 25 real races, each gaining the identity fields the old sheet never
gave a race, and the blend gains the sheet's `MAX(1, …)` floor. The companion reshape — exactly
two races, `Empty` deleted — is TICKET-RACE-04.

## Current situation (as-is)

- [races.json](../../imports/races.json) holds ten races from the old sheet (TICKET-RACE-01/02):
  human, elf, Hamster, dwarf, Raccoon, Demon, Demur, Empty, Monolith, Gods. No type, size, or
  challenge-rate field exists on [`Race`](../../../src/shared/types/config.ts).
- `calculateRaceStatBases` in
  [statCalculator.ts](../../../src/shared/engine/calculators/statCalculator.ts) blends two blocks
  as `roundup((a + b) / race_blend_divisor)` — the xlsx's chain is the same arithmetic **except
  one new term: the `MAX(1, …)` floor**. A stat both races have at 0 reads 1 in the sheet, 0 in
  the app.
- The sheet's size and type vocabularies (Naming BD3:BE9, BG3:BH19) exist nowhere in the app.

## Desired result (to-be)

- **The race list replaced**: keep human, elf, Hamster, dwarf, Raccoon (numbers unchanged,
  spot-checked); drop Demon, Demur, Monolith, Gods (always Concept 04 bestiary rows the old picker
  happened to include); add the twenty new blocks from systems/04's table.
- **Identity fields**: optional `type?`, `size?`, `challengeRate?` on `Race`, with the sheet's
  sizes and creature types landing as **two optional reference lists on the `Configuration`** that
  the race fields validate against — free User strings (`humaniod`, `guargantian` are theirs to
  fix), not hard-coded const objects; smallest shape wins (systems/14).
- **The blend floor**: `MAX(1, …)` added to `calculateRaceStatBases` beside the existing divisor —
  only all-zero pairings move, from 0 to 1.

## Acceptance criteria

- [ ] The seeded picker offers 25 races; Ducklets + Ducklets reproduces the sample's block
      unchanged (8/9/8/8/12/14, H3, M210, S20) through the engine — the `MAX(1, ROUNDUP(8+8)/2)`
      chain pinned by a `statCalculator` test, including an all-zero pairing reading 1.
- [ ] A race's type/size validate against the Configuration's reference lists (validation finding,
      not a crash, when they don't); `challengeRate` is stored and **built on nothing** — no
      engine, no display logic beyond the config panel.
- [ ] Derived values still come from the engine; the blend has exactly one home.
- [ ] [races.json](../../imports/races.json) re-sourced to `Background Referenes Race: scaling`
      (typo intact) with `source.ranges` cited, the duplicate stat-block rows 18–26 noted, the
      six-core-only total row confirmed in `notes`, and new `exportedAt`;
      `yarn run sheet:import` regenerated. No number invented for any field the sheet lacks.
- [ ] Unit tests cover: the floor (all-zero pairing → 1), an unchanged non-zero blend, reference-
      list validation, and the 25-count import.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser check of the picker and one blended character (ask the User
      first).

## Notes

- **Challenge rate is 0 for every playable race** — a creature-facing field waiting for a
  bestiary. Store it because the sheet has it; build nothing on it (systems/04's open question).
- `Empty`'s deletion and the exactly-two-races reshape are **TICKET-RACE-04** — kept separate
  because that one touches character creation and the allocation path (the overview's "§4 is no
  longer a data-only line" warning), while this one is catalog + one engine term.
