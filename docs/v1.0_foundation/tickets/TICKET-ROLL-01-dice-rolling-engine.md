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

- [ ] Rolling a `DiceConfig` returns one `DiceRollResult` per die type with a count `> 0`, and none for counts of `0`.
- [ ] Each `DiceRollResult` lists every individual die result, and `total` equals their sum.
- [ ] Every rolled value for a die type `dN` lies in `1..N` inclusive, for all six types (d4, d6, d8, d10, d12, d20).
- [ ] The aggregator's `total` equals `diceTotal + bonus`, where `bonus` comes from `calculateCombatSkillBonuses()` — not a re-implementation of formula evaluation.
- [ ] A roll of a skill whose `DiceConfig` is all zeros returns an empty dice breakdown and a `total` equal to the bonus alone (no crash, no `NaN`).
- [ ] `useUIStore`'s `RollResult` and `CombatRollResult` agree on the shape of `diceResults`; nothing in the codebase carries two different dice-result shapes after this ticket.
- [ ] The RNG is injectable; no test depends on real randomness.
- [ ] Engine purity holds: no React, no store imports, no `localStorage` in `src/engine/dice/`.
- [ ] Unit tests cover: per-type quantity honoured; bounds for all six die types (fast-check property test over arbitrary configs); sum consistency (`diceTotal` = Σ per-type totals); empty config; aggregator total = dice + bonus with a stubbed bonus; deterministic output under a seeded RNG.
- [ ] Verified via the fallow skill and the react-conventions skill.

## Notes

- No UI in this ticket. The roll button, dice animation, and history display are plan §12.5
  (a later `TICKET-ROLL-02`), and the character sheet's per-skill roll buttons depend on this too.
- Dice bounds are the natural fast-check property here — `fast-check` is already a dev dependency
  and the engine's existing specs use it.
- Reconciling the two `RollResult` shapes touches `useUIStore` and its spec. That is in scope
  precisely because leaving both shapes in place would guarantee a conversion bug at the UI layer;
  keep the change to the type + any compile fallout, not a store redesign.
