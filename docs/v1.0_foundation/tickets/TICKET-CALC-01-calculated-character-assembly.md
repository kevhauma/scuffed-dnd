# TICKET-CALC-01 — Assemble `CalculatedCharacter` and apply equipment bonuses to the whole chain

- **Area:** Calculation engine
- **Type:** Feature
- **Traceability:** Requirements 11.5, 13.1, 13.2, 13.3, 6.7, 3.6, 8.4, 9.3
- **Replaces plan items:** none — this gap is not in tasks.md; §4 was marked complete without it

## User story

As a Player, I want every derived number on my character — stats, speciality skills, combat
bonuses — to come from one calculation that already accounts for my races, focus stat, and
equipment, so that what the sheet shows is actually correct.

## Description

Task §4 ("Implement calculation engine") is checked off and its five calculators exist, but
nothing composes them. `CalculatedCharacter` is declared and never produced, and equipment
bonuses reach combat skills only — so a material that boosts a Main_Skill or a Speciality_Skill
changes nothing today, contrary to Requirement 6.7 and 13.3. Every play-mode ticket needs this,
so it goes first.

## Current situation (as-is)

- [`calculateCharacterStats(character, config)`](../../../src/engine/calculator.ts) is the only
  composed entry point and returns **`Record<statId, number>`** — max stat values only. It runs
  `calculateTotalMainSkillLevels` → `calculateMaxStatValues` and stops there. It never calls the
  speciality, combat, or equipment calculators.
- [`CalculatedCharacter`](../../../src/types/character.ts) (`totalMainSkillLevels`,
  `maxStatValues`, `specialitySkillTotalLevels`, `combatSkillBonuses`, `equipmentBonuses`) is
  declared and **has no producer anywhere in `src/`**.
- Equipment bonuses are applied in exactly one place:
  [`calculateCombatSkillBonuses`](../../../src/engine/calculators/combatSkillCalculator.ts)
  filters `equipmentBonuses` by the combat skill's own code and adds them.
  [`calculateTotalMainSkillLevels`](../../../src/engine/calculators/mainSkillCalculator.ts) takes
  only the character and its races, and
  [`calculateSpecialitySkillLevels`](../../../src/engine/calculators/specialitySkillCalculator.ts)
  takes only `totalMainSkillLevels` — neither has an equipment input at all.
- [`calculateEquipmentBonuses`](../../../src/engine/calculators/equipmentBonusCalculator.ts)
  already resolves equipped items → material → material level → `SkillModifier[]`, keyed by
  `skillCode`, and `SkillModifier.skillCode` explicitly "References Main/Speciality/Combat skill
  code" — so the data to satisfy 6.7 is being produced and then mostly discarded.
- Consequence for stat formulas: because equipment never reaches main skills, a stat derived from
  `STR` does not change when the Player equips a `STR +2` item, which contradicts Requirement 13.3.

## Desired result (to-be)

- A single composed entry point in `src/engine/calculator.ts` — `calculateCharacter(character,
  config): CalculatedCharacter` — runs the chain in dependency order and returns every derived
  value the UI needs:
  1. equipment bonuses from equipped items;
  2. total main skill levels = allocated levels + racial modifiers + equipment modifiers targeting
     main skill codes (+ focus-stat bonus if the focus is a Main_Skill);
  3. max stat values from the stat formulas over those totals;
  4. speciality skill totals = base + formula bonus + focus bonus + equipment modifiers targeting
     speciality codes;
  5. combat skill bonuses (already handles its own equipment slice).
- The focus-stat bonus is applied in exactly one place for each skill kind — today
  `calculateSpecialitySkillLevels` applies it for speciality skills and nothing applies it for
  main skills (Requirement 9.2 allows either kind).
- `calculateCharacterStats()` either becomes a thin wrapper over the new function or is removed
  and its callers updated. **Do not leave two entry points that disagree about what "calculated"
  means.**
- The chain stays pure: no React, no store access, no persistence.

## Acceptance criteria

- [ ] `calculateCharacter(character, config)` returns a fully populated `CalculatedCharacter` — every field of the type is filled, none left as an empty object.
- [ ] A material bonus targeting a **Main_Skill** code raises that skill's total level and, through it, every stat formula that references it (Req 6.7, 13.3).
- [ ] A material bonus targeting a **Speciality_Skill** code raises that skill's total level (Req 6.7).
- [ ] A material bonus targeting a **Combat_Skill** code still lands exactly once — no double-counting now that equipment flows through more of the chain (Req 13.2).
- [ ] Unequipping removes the bonus: the same character with an empty `equippedItems` produces the pre-equip numbers exactly (Req 13.5).
- [ ] Racial modifiers from multiple races combine additively and are still separable from the base allocation for display (Req 8.4, 13.4).
- [ ] The focus-stat bonus is applied once, whether the focus stat is a Main_Skill or a Speciality_Skill, and never to both (Req 9.3, 9.4).
- [ ] Only one composed entry point exists after this ticket; `calculateCharacterStats` is either a documented wrapper or gone, with all callers updated.
- [ ] A formula referencing an undefined skill code produces a clear, attributable error (which skill, which formula) rather than an unhandled throw from the parser (Req 16.6).
- [ ] Engine purity holds: no React, no store imports, no `localStorage` under `src/engine/`.
- [ ] Unit tests cover: full assembly against a fixture configuration; equipment bonus to a main skill propagating into a stat value; equipment bonus to a speciality skill; combat bonus not double-counted; unequip returns to baseline; multi-race additive stacking; focus bonus on a main skill and on a speciality skill; undefined-code error message.
- [ ] Verified via the fallow skill and the react-conventions skill.

## Notes

- This is the prerequisite for TICKET-CHAR-01 (level summary), TICKET-CHAR-02 (review step),
  the character sheet, the inventory panel, and the equipment-bonus wiring (plan §14.1) — §14.1
  becomes "call the recalculation and render it" once this lands, rather than "invent the
  recalculation".
- Ordering is load-bearing and worth a comment in the code: equipment must be resolved before main
  skills, main skills before stats and speciality skills, speciality before combat.
- Watch the focus-stat double-application risk when main-skill focus support is added — that is
  what the "applied once, never both" criterion is guarding.
- The plan file marks §4 complete. That was true of the individual calculators and false of the
  composition; this ticket closes the difference rather than reopening §4.
