# TICKET-MAT-02 — Equipment bonuses land on stats

- **Area:** Materials configuration (equipment aggregation)
- **Type:** Refactor
- **Traceability:** Concept [01 · Stat](../../excel%20export%20summary/concepts/01-stat.md) (equipment term of the composition); Concept [09](../../excel%20export%20summary/concepts/09-material-family.md)

## User story

As a Player, I want equipping an item to move my stats — and my skills only through the stats
that govern them — so equipment works the way the sheet computes it.

## Description

Completes MAT-01: the equipment aggregation returns per-stat totals consumed by the stat
composition, and STAT-01's temporary abbreviation bridge for equipment goes away. Skills feel
equipment only via stats — spec behaviour, not a regression.

## Current situation (as-is)

- [`equipmentBonusCalculator.ts`](../../../src/engine/calculators/equipmentBonusCalculator.ts)
  aggregates equipped items' bonuses by skill code; the three v1 skill calculators each claimed a
  share, and STAT-01 kept it limping through the abbreviation bridge.

## Desired result (to-be)

- `calculateEquipmentBonuses` returns per-stat totals from equipped items' `StatModifier`s; the
  STAT-01 composition consumes them; the equipment half of the abbreviation bridge is deleted.
- End-to-end: equipping an item whose material tier grants +50 Mana raises the character's Mana
  maximum by 50 (the fur case), read-time — unequipping reverts on next read with no
  recalculation call (v1.0's property preserved).
- The sheet's per-stat breakdown shows the equipment contribution labelled, via the calculator's
  breakdown (retargeted `SkillBreakdownRow` usage).

## Acceptance criteria

- [ ] Aggregation across multiple equipped items sums per stat (test); direct skill-targeted equipment bonuses no longer exist in the engine.
- [ ] The +50 Mana case passes through `calculateCharacter`; equip/unequip is read-time (no recalc call sites added).
- [ ] Breakdown labelling tested at the component level; no component re-derives bonuses.
- [ ] The equipment abbreviation bridge is gone (its STAT-03 scaffolding test updated to point at the remaining speciality/combat half).
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.
- [ ] Verified live in the browser: equip/unequip and watch the stat plus its breakdown move. (Ask the User first per CLAUDE.md.)

## Notes

- Slot-level concerns (`contributes_stats`, slot counts) stay with the slots/items milestone; the
  aggregation keeps reading every equipped slot for now.
