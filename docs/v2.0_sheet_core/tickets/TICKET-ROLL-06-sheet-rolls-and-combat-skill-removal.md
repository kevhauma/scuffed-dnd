# TICKET-ROLL-06 — The sheet rolls the definitions; combat skills removed

- **Area:** Dice & rolls
- **Type:** Feature + Refactor (breaking — deletes `CombatSkill`; completes the triad collapse)
- **Traceability:** Concept [08 · Roll definition](../../excel%20export%20summary/concepts/08-roll-definition.md); v1.0 Req 15.x (roll UX, preserved)

## User story

As a Player, I want my roll buttons driven by my actual numbers through the ladder — a stronger
character rolls bigger dice — with the roll feel and history I already have.

## Description

Wires ROLL-05's definitions into the sheet, replacing the combat-skill section and deleting the
old model. This closes the last row of the overview's triad-collapse table.

## Current situation (as-is)

- [`CombatSkillsSection`](../../../src/components/play/sheet/CombatSkillsSection.tsx) renders
  per-skill roll buttons via [`useCombatRoller`](../../../src/components/play/rolls/useCombatRoller.ts)
  → [`rollCombatSkill`](../../../src/engine/dice/combatRoll.ts); history lives in
  `useUIStore.rollHistory`, with `RollResult` extending `CombatRollResult` — the one dice-result
  shape.
- Post-SKL-02/MAT-02, combat skills run on re-authored formulas and no equipment term — the
  entity is the last v1 remnant.

## Desired result (to-be)

- **Sheet flow per definition** (grouped by `category`, ordered by `order`): evaluate input →
  decompose through its ladder → button shows the pool notation → roll → breakdown (input value
  with FORM-05 provenance, decomposition, per-die results, flat, total) → history entry. Settle
  animation and history panel preserved (v1.0 ROLL-02's UX).
- The result shape reshapes to carry the decomposition — still exactly **one** dice-result shape
  (`RollResult` keeps extending it); `RandomSource` stays injectable.
- **The old model is deleted:** `CombatSkill`, `DiceConfig`, `combatSkillCalculator`,
  `rollCombatSkill`, the combat section of `/config/skills`, and the last of STAT-03's
  abbreviation bridge; no `skillCode`-keyed modifier shape remains anywhere (closes MAT-01's
  note).

## Acceptance criteria

- [ ] End-to-end: melee input evaluating to 39 shows and rolls `1D20 + 1D12 + 1D6 + 1` on the seed ladder — button label, dice, and breakdown agree (integration test).
- [ ] Changing a ladder or input changes affected rolls on next read; a roll can never disagree with the sheet's displayed numbers (single-source test, ROLL-02's guarantee preserved).
- [ ] History records reshaped results; the settle animation path still works; RNG injected in tests.
- [ ] Grep criteria: `CombatSkill`, `DiceConfig`, and `skillCode` yield zero hits in `src/`; the bridge test from STAT-03 is deleted with the bridge.
- [ ] Components compose `ui/` primitives, theme tokens only.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.
- [ ] Verified live in the browser: raise a stat, watch the pool change, roll, check breakdown and history — the settle animation is the part only a browser confirms. (Ask the User first per CLAUDE.md.)

## Notes

- This closes the triad collapse: stats (STAT-01), skills (SKL-02), rolls (here). After it lands,
  nothing of the v1 core model remains.
- APT near the roll buttons is sheet composition (it's a derived stat since STAT-01), not a new
  concept — note for a polish pass if the User wants it.
