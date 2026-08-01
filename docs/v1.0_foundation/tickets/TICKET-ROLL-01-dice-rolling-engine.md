# TICKET-ROLL-01 — Dice simulator and combat roll aggregator

- **Area:** Combat rolls
- **Type:** Feature
- **Traceability:** Requirements 5.5, 5.6
- **Replaces plan items:** tasks.md §5.1, §5.2

## User story

As a Player, I want a combat skill roll to simulate its configured dice and add my calculated
bonus, so that I can resolve combat actions with the ruleset my User designed.

## Description

The configuration side of combat skills is complete — a User can already define a Combat_Skill
with a quantity per die type and a bonus formula — but nothing rolls them. This ticket adds the
pure logic layer: a dice simulator and an aggregator that combines dice results with the
calculated bonus into a breakdown. No UI; the roller component (plan §12.5) consumes this.

## Current situation (as-is)

- No dice code exists anywhere in [src/engine/](../../../src/engine/) — this is the last unbuilt
  piece of the logic layer.
- The shapes are already declared and unused:
  [`DiceRollResult`](../../../src/types/formula.ts) (`dieType`, `rolls[]`, `total`) and
  `CombatRollResult` (`skillCode`, `skillName`, `diceResults[]`, `diceTotal`, `bonus`, `total`,
  `timestamp`) in `src/types/formula.ts`.
- The input shape is [`DiceConfig`](../../../src/types/config.ts) on `CombatSkill` — a count per
  die type (`{ d4: 0, d6: 2, d8: 0, ... }`), so a roll means "roll `n` of each type where `n > 0`".
- The bonus half already works:
  [`calculateCombatSkillBonuses()`](../../../src/engine/calculators/combatSkillCalculator.ts)
  resolves a skill's `bonusFormula` against a character's totals plus equipment bonuses.
- [`useUIStore`](../../../src/stores/uiStore.ts) already keeps a session `rollHistory` with
  `addRollResult()` — **but its `RollResult` type declares `diceResults: Record<string, number[]>`,
  which does not match `CombatRollResult.diceResults: DiceRollResult[]`.** Two shapes for one
  concept; this ticket has to reconcile them rather than add a third.

## Desired result (to-be)

- `src/engine/dice/diceSimulator.ts` exposes a pure roll function that takes a `DiceConfig` (and an
  injectable RNG, defaulting to `Math.random`) and returns `DiceRollResult[]` — one entry per die
  type with a non-zero count, carrying every individual die result, not just the sum.
- `src/engine/dice/combatRoll.ts` exposes the aggregator: given a `CombatSkill`, a
  `CalculatedCharacter`, and the configuration, it rolls the dice, reads the bonus from the
  existing combat-skill calculator, and returns a fully populated `CombatRollResult` — dice
  breakdown, `diceTotal`, `bonus`, `total`, `timestamp`.
- The two roll-result shapes are unified on `CombatRollResult`, with `useUIStore`'s `RollResult`
  extending or wrapping it (it additionally needs `id`, `characterId`, `characterName`) instead of
  redeclaring `diceResults` differently.
- The RNG is injectable so tests are deterministic; production callers pass nothing.

## Acceptance criteria

- [x] Rolling a `DiceConfig` returns one `DiceRollResult` per die type with a count `> 0`, and none for counts of `0`. (`rollDice()` in `src/engine/dice/diceSimulator.ts` skips any count `<= 0`. Tests *"should return one result per die type with a count above zero"*, *"should return no entry for a die type with a count of zero"*, *"should roll exactly as many dice as the count asks for"*, and *"should order the breakdown ascending by die size"*.)
- [x] Each `DiceRollResult` lists every individual die result, and `total` equals their sum. (Test *"should list every individual die result, with total equal to their sum"* — a scripted RNG of `[0, 0.5, 0.999999]` over 3d6 yields `rolls: [1, 4, 6]`, `total: 11`. The property test *"should keep the breakdown total consistent with the individual rolls"* asserts it for arbitrary configurations.)
- [x] Every rolled value for a die type `dN` lies in `1..N` inclusive, for all six types (d4, d6, d8, d10, d12, d20). (fast-check property test *"should keep every rolled value within 1..N for each die type"* over arbitrary counts 0–5 of all six types; also asserts each value is an integer and that the roll count matches the configured count. Boundary behaviour is pinned separately by *"should map the low end of the range to 1 and the high end to the die size"*.)
- [x] The aggregator's `total` equals `diceTotal + bonus`, where `bonus` comes from `calculateCombatSkillBonuses()` — not a re-implementation of formula evaluation. (`rollCombatSkill()` in `src/engine/dice/combatRoll.ts` calls the calculator and does no formula work of its own. Tests *"should produce a total equal to the dice total plus the calculated bonus"*, *"should take the bonus from the combat skill calculator, not a re-evaluation"* (asserts `result.bonus === character.combatSkillBonuses.MEL`), and *"should include equipment bonuses, because the calculator does"* (equipping a `MEL +5` sword moves the roll bonus 12 → 17 with no code in the aggregator that knows about equipment).)
- [x] A roll of a skill whose `DiceConfig` is all zeros returns an empty dice breakdown and a `total` equal to the bonus alone (no crash, no `NaN`). (Test *"should handle an all-zero dice configuration without NaN"* — `diceResults: []`, `diceTotal: 0`, `total: 6` = the bonus. A skill missing from the configuration is also covered: *"should contribute no bonus for a skill the configuration does not define"* returns `bonus: 0` rather than `undefined`/`NaN`.)
- [x] `useUIStore`'s `RollResult` and `CombatRollResult` agree on the shape of `diceResults`; nothing in the codebase carries two different dice-result shapes after this ticket. (`RollResult` now reads `extends CombatRollResult` and adds only `id`/`characterId`/`characterName` — it no longer restates `diceResults`, `bonus`, `total` or `timestamp`. `grep -rn "Record<string, number\[\]>" src/` returns nothing. `src/stores/uiStore.test.ts`'s fixture updated to the array shape; all 23 of its tests still pass, and the verifier confirmed the type change produced no new `tsc` errors at any call site.)
- [x] The RNG is injectable; no test depends on real randomness. (`RandomSource = () => number` is the last-but-one parameter of both `rollDice` and `rollCombatSkill`, defaulting to `Math.random`; `rollCombatSkill` also takes an injectable timestamp so a result is fully reproducible. Every assertion about specific values passes its own source; tests *"should be deterministic under a seeded source of randomness"* exist for both modules. The two property tests use real randomness deliberately — they assert bounds and internal consistency, which hold for any source.)
- [x] Engine purity holds: no React, no store imports, no `localStorage` in `src/engine/dice/`. (`grep -rEn "from 'react|from \"react|stores/|localStorage" src/engine/dice/` returns nothing.)
- [x] Unit tests cover: per-type quantity honoured; bounds for all six die types (fast-check property test over arbitrary configs); sum consistency (`diceTotal` = Σ per-type totals); empty config; aggregator total = dice + bonus with a stubbed bonus; deterministic output under a seeded RNG. (+18 tests: `diceSimulator.test.ts` (11, two of them fast-check properties), `combatRoll.test.ts` (7). Suite: 472 passing, 0 failing, 0 skipped.)
- [x] Verified via the fallow skill and the ~~react-conventions~~ **coding-conventions** skill *(renamed since the ticket was written)*. (`fallow audit --base HEAD` → `"verdict": "pass"`, 0 introduced findings of any kind across 7 changed files; `fallow dead-code` lists nothing under `src/engine/dice/`. Conventions: camelCase engine modules with `**Validates: Requirements**` headers, an `export *` barrel at `src/engine/dice/index.ts`, relative imports, pure engine logic tested directly with no React, and `fast-check` used for the numeric invariants as the conventions prescribe for calculators.)

## Notes

- No UI in this ticket. The roll button, dice animation, and history display are plan §12.5
  (a later `TICKET-ROLL-02`), and the character sheet's per-skill roll buttons depend on this too.
- Dice bounds are the natural fast-check property here — `fast-check` is already a dev dependency
  and the engine's existing specs use it.
- Reconciling the two `RollResult` shapes touches `useUIStore` and its spec. That is in scope
  precisely because leaving both shapes in place would guarantee a conversion bug at the UI layer;
  keep the change to the type + any compile fallout, not a store redesign.
