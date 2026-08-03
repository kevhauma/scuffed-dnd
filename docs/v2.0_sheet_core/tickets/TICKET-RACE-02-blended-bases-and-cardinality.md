# TICKET-RACE-02 — Blended bases and race cardinality

- **Area:** Races configuration
- **Type:** Feature + Bug fix (replaces additive stacking with the sheet's blend)
- **Traceability:** Concept [04 · Creature](../../excel%20export%20summary/concepts/04-creature.md) (hybrid blend); Concept [05 · Constant](../../excel%20export%20summary/concepts/05-constant.md) (`race_blend_divisor`)

## User story

As a Player, I want my base stats to come from my race — or the round-up average of my two races —
so that race math matches the sheet, where picking the same race twice changes nothing.

## Description

The app sums racial modifiers additively across an unbounded race list (same race twice doubles
it); the sheet blends exactly 1–2 races as `roundup((a + b) / 2)`. This ticket wires RACE-01's
stat blocks into the composition and enforces the cardinality.

## Current situation (as-is)

- [`calculateRacialSkillModifiers`](../../../src/engine/calculators/mainSkillCalculator.ts)
  documents "Multiple races combine additively"; `Character.raceIds: string[]` has no length
  limit in the wizard or the store.
- STAT-01's composition carries `race base = 0` awaiting this ticket.

## Desired result (to-be)

- **Base term:** one race → its `statValues`; two races → `roundup((a + b) /
  const.race_blend_divisor)` (seeded divisor 2), computed in the calculator — same race twice
  degenerates to itself.
- **Cardinality 1–2 enforced** in the store action (a third race refused as data validation) and
  in the wizard's race step.
- The sheet's racial section renders the base contribution per stat from the calculator's
  breakdown, replacing the modifier list.

## Acceptance criteria

- [ ] Blend pinned: single race, even sum, odd sum (`(9 + 12) / 2 → 11`), same-race identity; divisor read from the constant (changing it changes the blend — test).
- [ ] Store action and wizard both refuse a third race (tests for each).
- [ ] Sheet renders base contributions from the breakdown; no component computes blends.
- [ ] Composition integration through `calculateCharacter`: race base + invested + equipment sum correctly per stat.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.
- [ ] Verified live in the browser: a two-race character shows blended bases. (Ask the User first per CLAUDE.md.)

## Notes

- The concept page writes the blend as `roundup(race_a.stat + race_b.stat) / 2`; the worked
  samples show the intent is round-up of the average. The composition eventually becoming
  editable formula-data (spec) is deferred; calculator code reading the constant is the honest
  v2.0 scope.
