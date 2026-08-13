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

- [x] Aggregation across multiple equipped items sums per stat (test); direct skill-targeted equipment bonuses no longer exist in the engine. (`equipmentBonusCalculator.test.ts` → `should combine bonuses from multiple equipped items additively` and `should handle complex scenario with multiple items and overlapping bonuses`, both now asserting `{ statId, modifier }`. The skill-targeted path is **deleted**, not filtered: `calculateSpecialitySkillLevels` and `calculateCombatSkillBonuses` no longer take an equipment argument at all, and the four tests that pinned that behaviour retired with it — `specialitySkillCalculator.test.ts` → `should take no equipment term of its own (TICKET-MAT-02)` is what replaces them.)
- [x] The +50 Mana case passes through `calculateCharacter`; equip/unequip is read-time (no recalc call sites added). (`calculator.test.ts` → `should raise a resource maximum by the tier that grants it — the +50 Mana case`: the fur tier lifts Mana's maximum from 10 to 60 while the stored current value stays at 10. Read-time: `should revert on the next read when the item comes off, with nothing recalculated` — the same character object with the inventory swapped back computes the original numbers, and no call site was added anywhere.)
- [x] Breakdown labelling tested at the component level; no component re-derives bonuses. (`CharacterSheet.test.tsx` → `should label a stat's equipment contribution from the engine (TICKET-MAT-02)`: `equipment +4` on the Dexterity row, and Stealth — whose formula is `DEX` — moves by the same 4, which is the only route a tier modifier has to a skill now. The fixture's Dexterity is deliberately `id: 'dex-id'` against `abbreviation: 'DEX'`, so the assertion fails if anything falls back to matching by spelling. The hook reads `indexStatModifiers(calculated.equipmentBonuses)`; no component sums anything.)
- [x] The equipment abbreviation bridge is gone (its STAT-03 scaffolding test updated to point at the remaining speciality/combat half). (`investedValue` matches `bonus.statId === stat.id`. The `the flat abbreviation bridge` block in `calculator.test.ts` now opens by recording that the **equipment half is already gone** and that what remains is the *formula* spelling, retired by SKL-02 and ROLL-06. The `SkillModifier` type is deleted outright — nothing in `src/` holds that shape any more.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill. (`npx vitest run` 1270 passing / 0 failing / 0 skipped; `npx tsc --noEmit` at the documented 2-error baseline; `yarn run check` clean. `fallow audit --base HEAD`: verdict **pass**, 0 introduced dead code, complexity or duplication. `conventions-reviewer`: layering, engine purity, store-owned persistence, formula engine, theme tokens and the component split all clean — its findings were bookkeeping and are folded in, including one it confirmed as a *fixed* latent bug, see note 2.)
- [ ] Verified live in the browser: equip/unequip and watch the stat plus its breakdown move. — **left open**: the User asked for the browser check to be skipped on this run.

## Implementation notes

1. **Requirement 6.7 now has no implementation anywhere.** "Bonuses and penalties to Main_Skills,
   Speciality_Skills and Combat_Skills" was the v1.0 requirement; MAT-01 removed the shape that
   could author one and this ticket removed the engine term that applied it. Concept 09 puts a
   tier's modifiers on stats, so the citation is dropped from `calculator.ts`,
   `specialitySkillCalculator.ts` and `MaterialLevelFormDialog.tsx` rather than left claiming
   something untrue. Nothing is silently lost: a skill still moves with equipment, through the
   stats its formula reads.
2. **It also fixed a latent double-count.** The deleted equipment branches were reachable when a
   stat's abbreviation collided with a skill code — which `validator.ts` *reports* on import but
   does not refuse — and in that case one bonus was applied twice, once to the stat and once to the
   same-named skill. Matching by stat id makes Requirement 13.2 structural rather than a property
   of the code spaces staying disjoint.
3. **The sheet's speciality rows lost their `equipment` contribution.** It would now always read
   `+0`, and itemising the real contribution would need the engine to split a formula's result by
   cause, which it cannot do. Requirement 13.4 moves with it: `StatsSection` is where an equipment
   term is displayed, so the citation lives there and not on `SpecialitySkillsSection`.
4. **No `SUPPORTED_SCHEMA_VERSION` bump and no `docs/imports/` change**: nothing persisted moved.
   `CalculatedCharacter.equipmentBonuses` is derived and never stored, and `SkillModifier` had no
   persisted use left after MAT-01.

## Notes

- Slot-level concerns (`contributes_stats`, slot counts) stay with the slots/items milestone; the
  aggregation keeps reading every equipped slot for now.
