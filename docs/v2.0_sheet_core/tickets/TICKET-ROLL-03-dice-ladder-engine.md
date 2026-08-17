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

## Implementation notes

1. **The delete is unguarded, deliberately.** Every other entity's delete goes through
   `guardedDelete`, but nothing in the ruleset can point at a ladder yet — a roll definition is the
   only thing that ever will (Concept 08), and it arrives with TICKET-ROLL-05. A
   `ReferenceTargetKind` with no possible referrer is a check that can never fire, which is the
   unfalsifiable-green-box trap TICKET-ARC-01 avoided by landing `Character.archetypeId?` early.
   ROLL-05 adds the kind and routes `deleteDiceLadder` through the guard at the same time as the
   thing that makes it falsifiable. Recorded on the store action's own type.
2. **No schema bump.** `Configuration.diceLadders?` is purely additive, so it takes ARC-01's
   refinement of RACE-01's rule rather than the rule itself: nothing *moved*, so a build without
   ladders ignores the key and a ruleset written before them reads as having none.
3. **One validation rule beyond the to-be**, and it is the concept page's own: a ladder whose
   smallest die is large leaves big flat remainders, which Concept 07 asks for "as information,
   since it may be intended". That is exactly TICKET-SKL-03's third severity, so it is reported as
   `information` and never affects `isValid`.
4. **The `conventions-reviewer` found the walk's one non-total case.** `decomposeValue` skipped a
   rung only on `size <= 0`, so a `NaN` size — reachable from a hand-edited file, since the import
   check rejects non-finite sizes but nothing re-checks after that — made `Math.floor(NaN)` poison
   every count *and* the flat, breaking the module's own stated invariant. The rung guard now
   mirrors the validator's rule (`!Number.isInteger(size) || size <= 0`), so one bad size costs its
   own rung and nothing else, with a test for it. Four smaller findings landed with it: the
   value-guard comment justified a loop guard that was not there, `entityType` read `'Dice ladder'`
   where every other rule emits camelCase (`ValidationReport` renders it verbatim), the empty-id
   message said "must be a string", and the per-file test split in
   [TEST_STATUS.md](../../../TEST_STATUS.md) was off by one in two places.
5. **`fallow audit` moved the import-side check into its own function.** The first cut inlined the
   `diceLadders` block in `importExport.validateConfiguration`, which the audit attributed as an
   introduced complexity finding on a function already 365 lines long. Extracting
   `diceLadderShapeErrors` follows that file's own precedent (`curveShapeErrors`) and took the
   parent to 333 lines. What the audit reports now is two *new* functions —
   `diceLadderShapeErrors` (12 cyclomatic) and `diceLadderErrors` (11) — both flat sequences of
   independent `if (bad) push(message)` checks, both below the existing `curveShapeErrors` at 18.
   That is what a validation rule list scores; splitting them further would hide the rules, not
   simplify them. Accepted rather than suppressed.

## Acceptance criteria

- [x] Both concept-page decompositions reproduce exactly (later DX-04 fixtures). (`decomposeValue` in [`src/engine/dice/diceLadder.ts`](../../../src/engine/dice/diceLadder.ts); [`diceLadder.test.ts`](../../../src/engine/dice/diceLadder.test.ts) `should reproduce the sheet decomposition of %i` pins **all six** ✅ rows of Concept 07's table — 10, 11, 16, 18, 32 and 39 — not just the two the to-be named. Re-asserted end to end on the merged corpus in `sheetImport.test.ts` › `keeps the dice ladder decomposing the sheet values (Concept 07)`.)
- [x] Greedy edge cases tested: value below smallest die, exact multiples, zero, `maxPerDie` pushing remainder down-ladder, arbitrary sizes (`[100, 20, 12, 6]`). (One case each in `diceLadder.test.ts`, plus `should cap every rung, not only the largest` — 100 capped at 2 is `2D20 + 2D12 + 2D6 + 24` — a rungless ladder, a negative/fractional input, and two `fast-check` properties — one that the decomposition conserves its input, one that the flat remainder stays below the smallest die.)
- [x] Ladder validation errors are named and surfaced through the standard validation path. (`diceLadderErrors`/`diceLadderObservations` in [`engine/validator.ts`](../../../src/engine/validator.ts), reached from `validateConfiguration` like every other rule; 8 cases in `validator.test.ts` › `dice ladders (TICKET-ROLL-03)` covering the empty, non-positive, unsorted, repeated-size and dead-cap errors plus the large-smallest-die *information*. Import-side shape errors are `diceLadders[i].…` in `services/importExport.ts`.)
- [x] CRUD round-trips persistence and export/import; the existing `DiceConfig`/`rollDice` surface is untouched and no test is edited. (`add`/`update`/`deleteDiceLadder` in [`configStore.ts`](../../../src/stores/configStore.ts); `configStore.test.ts` › `Dice ladders CRUD (TICKET-ROLL-03)` asserts three `saveConfiguration` calls, the `maxPerDie` clear removing the key, and the export→`importConfiguration` round trip. `diceSimulator.ts`/`combatRoll.ts` are unchanged — `git diff` touches neither — and the +33 tests are all additions. **One existing case did change**, and it is the one that is supposed to: `sheetImport.test.ts` › `finds a fragment for every built feature` lists the corpus filename by filename, so `dice-ladders.json` had to be added to it. That is the test doing its job, not a test bent to fit; no assertion was weakened.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill. (`verifier`: 1526/1526 vitest passing, 0 skipped; `tsc --noEmit` at the documented 2-error baseline; `yarn run check` clean. `fallow audit` and the `conventions-reviewer` both run on the diff, the latter finding a real defect — implementation notes 4 and 5.)

## Notes

- `decomposition: 'balanced' | 'custom'` deferred — the sheet is greedy; keep the field an enum
  of one so adding modes is additive.
- The `dice` *formula type* (spec §5.2) stays deferred until spells force it; the ladder turns
  numbers into pools, which is all the core needs.
- The sheet fragment is [`docs/imports/dice-ladders.json`](../../imports/dice-ladders.json),
  `confidence: confirmed` — the die sizes read from the Calculator's literal `20 | 12 | 6` row and
  confirmed a second time by the six decompositions. No `maxPerDie`: the sheet caps nothing, so the
  key is absent rather than set to a number that would look proven.
