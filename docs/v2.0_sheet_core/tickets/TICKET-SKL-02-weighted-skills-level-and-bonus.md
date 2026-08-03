# TICKET-SKL-02 — Skill entity and weighted derivation

- **Area:** Skills configuration
- **Type:** Refactor + Feature (breaking — `SpecialitySkill` becomes the spec's Skill)
- **Traceability:** Concept [02 · Skill](../../excel%20export%20summary/concepts/02-skill.md); Concept [05 · Constant](../../excel%20export%20summary/concepts/05-constant.md) (`bonus_divider`)

## User story

As a User, I want skills defined by weighted links to their governing stats — Charm = Char × 0.3 —
producing a level *and* the integer bonus a Player rolls with, so skills compute what the sheet
computes.

## Description

The sheet derives `level = Σ(weight × stat) + invested` and `bonus = round(level /
bonus_divider)`, verified row-by-row on the concept page. The app's `SpecialitySkill` has the
right direction but an opaque formula string, no bonus, no shared divider. This ticket replaces
the entity and derivation; panel, sheet grid, and skill validation are TICKET-SKL-03.

## Current situation (as-is)

- [`SpecialitySkill`](../../../src/types/config.ts) `{ code, name, description, maxBaseLevel,
  bonusFormula }`;
  [`specialitySkillCalculator.ts`](../../../src/engine/calculators/specialitySkillCalculator.ts)
  returns one unrounded total. A global rebalance means editing every skill's string — the
  disease the concept page opens with.
- Investment (`specialitySkillBaseLevels`) adds 1:1, keyed by mutable code.

## Desired result (to-be)

- `Skill` entity `{ id, name, description, statWeights: [{ statId, weight }], category? }`
  replaces `SpecialitySkill` (`maxBaseLevel` and `bonusFormula` deleted); character side becomes
  `investedSkillPoints: Record<skillId, number>`.
- Derivation in the calculator: `level = Σ(weight × statValue) + invested` (1:1, documented as
  provisional — the invested conversion is the concept page's open question) and
  `bonus = round(level / const.bonus_divider)`, half-away-from-zero; `CalculatedCharacter`
  exposes both per skill.
- The concept page's verified table reproduces: Charm 11.7 → 2, Brewing 4.5 → 1,
  Black smithing 2.0 → 0, alchemy 1.6 → 0, Persuasion 13.2 → 3; boundary 7.5 → 2.

## Acceptance criteria

- [ ] The new entity and character shape replace the old in types, store actions, and shape validation; export → import round-trips.
- [ ] The verified table passes as engine tests (re-pinned later by DX-04); changing `const.bonus_divider` moves every bonus on next read.
- [ ] Multi-weight sums, empty weights (level = invested), unknown `statId` (validation error) tested.
- [ ] Renaming a stat breaks no skill (REF-01 applied to weight rows).
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.

## Notes

- Combat skills still exist until ROLL-05/06; their formulas referencing speciality codes must
  either resolve against the new skills namespace or be re-authored — a clean-break milestone
  allows re-authoring, but the plan must say which and test what holds.
- `unlock_condition` needs boolean formulas — deferred with the same JSDoc-note rule as
  constants-as-formulas.
