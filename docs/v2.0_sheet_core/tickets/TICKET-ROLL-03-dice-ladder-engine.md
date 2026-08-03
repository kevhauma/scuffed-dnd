# TICKET-ROLL-03 — Dice ladder entity and decomposition

- **Area:** Dice & rolls
- **Type:** Feature (engine + types, no UI)
- **Traceability:** Concept [07 · Dice ladder](../../excel%20export%20summary/concepts/07-dice-ladder.md)

## User story

As a User, I want to define how a number becomes dice — which die sizes, greedy, with what
remainder — so "roll your melee" means the sheet's `39 → 1D20 + 1D12 + 1D6 + 1`.

## Description

The sheet decomposes a computed value down a ladder of die sizes; the app hand-types pools over a
fixed six-die set and bolts the value on afterwards as a flat bonus — a different distribution.
This ticket is the ladder entity and the pure decomposition. Rolling/notation is TICKET-ROLL-04;
consumers and UI are ROLL-05/06.

## Current situation (as-is)

- [`DiceConfig`](../../../src/types/config.ts) is a fixed six-key record; die sizes are hardcoded
  again in [`diceSimulator.ts`](../../../src/engine/dice/diceSimulator.ts) (`DIE_SIDES`) and in
  the combat-skill dialog. Nothing anywhere derives a pool from a value —
  [`combatRoll.ts`](../../../src/engine/dice/combatRoll.ts) computes `diceTotal + bonus`.

## Desired result (to-be)

- `DiceLadder` entity `{ id, name, description, dieSizes: number[] (descending, arbitrary — a
  d100 is data), maxPerDie?, showZeroTerms: boolean, remainder: 'flat' }` with CRUD store actions
  and export/import shape coverage (editor UI in ROLL-05).
- Pure `decomposeValue(value, ladder)` → `{ counts: [{ size, count }], flat }` — greedy, largest
  die first, `maxPerDie` caps a rung, leftover becomes flat. Pinned against the concept page on
  the `[20, 12, 6]` seed: `10 → 0D20 + 0D12 + 1D6 + 4`, `39 → 1D20 + 1D12 + 1D6 + 1`.
- Ladder validation: empty/unsorted/non-positive `dieSizes` are named errors; non-integer or
  negative input values decompose to flat-only (documented, tested).

## Acceptance criteria

- [ ] Both concept-page decompositions reproduce exactly (later DX-04 fixtures).
- [ ] Greedy edge cases tested: value below smallest die, exact multiples, zero, `maxPerDie` pushing remainder down-ladder, arbitrary sizes (`[100, 20, 12, 6]`).
- [ ] Ladder validation errors are named and surfaced through the standard validation path.
- [ ] CRUD round-trips persistence and export/import; the existing `DiceConfig`/`rollDice` surface is untouched and no test is edited.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.

## Notes

- `decomposition: 'balanced' | 'custom'` deferred — the sheet is greedy; keep the field an enum
  of one so adding modes is additive.
- The `dice` *formula type* (spec §5.2) stays deferred until spells force it; the ladder turns
  numbers into pools, which is all the core needs.
