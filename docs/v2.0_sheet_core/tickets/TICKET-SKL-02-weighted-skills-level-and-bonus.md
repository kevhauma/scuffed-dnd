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

- [x] The new entity and character shape replace the old in types, store actions, and shape validation; export → import round-trips. (`Skill { id, name, description, statWeights, category? }` and `Character.investedSkillPoints` in [config.ts](../../../src/types/config.ts):146 and [character.ts](../../../src/types/character.ts):43; `addSkill`/`updateSkill`/`deleteSkill` in [configStore.ts](../../../src/stores/configStore.ts):578-604, covered by *Skills CRUD (TICKET-SKL-02)* — 4 tests; per-field structural validation in [importExport.ts](../../../src/services/importExport.ts):499-536, covered by *should validate skill structure* and *should reject a weight row that names no stat or carries no number*; round-trip by *should create valid JSON content, with references resolved to ids*, which also pins that weight rows need no id-resolution because they hold ids already)
- [x] The verified table passes as engine tests (re-pinned later by DX-04); changing `const.bonus_divider` moves every bonus on next read. (New [skillCalculator.test.ts](../../../src/engine/calculators/skillCalculator.test.ts) — 20 tests. *Concept 02's verified table* reproduces all six rows: Charm 11.7→2, Trading 11.7→2, Brewing 4.5→1, Black smithing 2.0→0, alchemy 1.6→0, Persuasion 13.2→3, plus *rounds half away from zero — level 7.5 is bonus 2, not 1*. The divider is covered by *moves every bonus when the constant is retuned* (5→4 turns Charm's 2 into a 3), *falls back to the seeded 5 when the ruleset defines no such constant*, and three fall-back cases for 0, -5 and NaN)
- [x] Multi-weight sums, empty weights (level = invested), unknown `statId` (validation error) tested. (*sums a two-stat skill, the sheet's 0.2 + 0.1 split*; *is exactly the invested points when a skill has no weights at all* and *is 0 for a skill with neither weights nor investment*; the validation error is [validator.ts](../../../src/engine/validator.ts):95-107 covered by *should detect a weight naming a stat the ruleset does not define*, with the calculator's own behaviour — contribute nothing rather than poison the level — in *skips a weight naming a stat the ruleset no longer defines*. Concept 02's zero-weight **warn** rule is also covered, by *should warn about a skill with no weights at all, without refusing it*)
- [x] Renaming a stat breaks no skill (REF-01 applied to weight rows). (*keeps a skill computing the same level when a stat it weights is renamed* in [references.test.ts](../../../src/engine/formula/references.test.ts) — `skillLevels` and `skillBonuses` are identical either side of an abbreviation *and* name change, and the weight row still reads `{ statId: 'id-dex' }`. Reinforced from the store side by *rewrites every formula naming a stat whose abbreviation changes*, which asserts `skills[0].statWeights` is untouched)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill. (`verifier`: **1284 passing, 0 failing, 0 skipped**; `npx tsc --noEmit` at the documented 2-error baseline with zero new errors; `yarn run check` clean across 271 files. `fallow audit --base 7877707`: verdict **pass** — 0 introduced dead code, 0 introduced complexity, 0 duplication clone groups; the 2 dead-code and 3 complexity findings it reports are all inherited. `conventions-reviewer` found one HIGH regression and four smaller items, **all fixed** — see implementation note 7)

## Implementation notes (2026-08-14)

1. **The source landed before the tests did.** Commits `02e779a`, `8b8e00d` and `7877707` migrated
   the source to the weighted `Skill` and left the whole test layer on `SpecialitySkill`: 171
   failing tests and 83 new type errors, from one cause. The pre-commit hook did not catch it
   because it runs Biome only, and Biome was genuinely clean. Everything from `8a913d5` onward is
   the test layer catching up, plus the three source fixes below.

2. **`levelOf` could not name the skill it was computing.** It returned
   `withSource(statError, { kind: 'skill' })`, but `withSource` keeps the *first* source it is
   given and a stat's error already carries one — so the call was dead, the skill was never named,
   and the chain stopped at one link. It now builds an `upstream` error naming the stat with the
   original as `cause`, matching how the evaluator chains between formulas, so the sheet chips the
   skill's row with the whole provenance. Pinned by *should chain provenance from a broken skill
   into the combat skill reading it* in `calculator.test.ts`.

3. **`FormulaPreview` could not express `skills.*`.** The namespace is in scope for a combat
   formula and resolves as of this ticket, but the preview supplied no skill values, so
   `STR + skills.stealth` collapsed to "Unknown namespace" rather than previewing. Extended per the
   standing rule in [CLAUDE.md](../../../CLAUDE.md) rather than worked around: it runs the sample
   stat values through `calculateSkills`, the same function the sheet reads. **Skills deliberately
   get no sample boxes of their own** — once the sample stats are chosen the levels are decided,
   so a box could only disagree with them.

4. **FORM-09's four preview placements are three.** The speciality dialog had a `bonusFormula`
   field with a preview beneath it; a `Skill` has no formula field at all, so there is nothing to
   preview. Recorded on [TICKET-FORM-09](./TICKET-FORM-09-formula-preview-everywhere.md) and
   asserted by *offers no formula field, and therefore no preview*.

5. **One code-keyed character field outlived the rename plumbing.** `renameSkillCode` and
   `useSkillCodeRename` were deleted with the source-side change, correctly: `investedStatPoints`
   is keyed by stat id (STAT-01) and `investedSkillPoints` by skill id (this ticket). But
   **`focusStatCode` still holds a stat abbreviation**, so renaming a stat orphans a character's
   focus, and nothing chases it any more. Not fixed here — re-adding a store action for a field
   [TICKET-ARC-03](./TICKET-ARC-03-wizard-step-and-focus-stat-retirement.md) is about to delete
   would be work in the wrong direction. Recorded in `characterStore.test.ts`'s describe header and
   in `useStatManager.ts`'s JSDoc so it cannot be lost. **Related**: the sheet's `focus stat` badge
   is now unreachable — `SkillBreakdownRow` still accepts `isFocusStat`, but the only section that
   ever passed it was the speciality one this ticket deleted. Left in place for ARC-03 to remove
   with the concept, and pinned by *marks no row as the focus stat, because nothing passes the flag
   any more* so it cannot rot silently.

6. **Two cycle cases could not be carried over.** A `Skill` holds no formula, so it is not a node
   in the dependency graph at all — the "two speciality skills reference each other" cases were
   rewritten over combat skills, which still are. A new test, *cannot cycle through a skill,
   because a skill holds no formula*, pins the new invariant rather than leaving the gap silent.
   The *mixed namespaced-and-bare syntax* cycle test was **deleted**: `dependencyKeysOf` maps a
   dotted reference to its member and a bare one to its code, and the graph is keyed by entity id —
   a parity only speciality skills ever had, because only they had `id === code === member`. That
   is a pre-existing limitation of the graph's keying, not something this ticket introduced, and it
   is out of scope here.

7. **The `conventions-reviewer` caught a regression note 3 had introduced.** Teaching
   `FormulaPreview` the `skills` namespace was only half the job: `previewInputs` still
   short-circuited on `namespace !== 'stats'`, so a `skills.<name>` reference got **no sample box**,
   `calculateSkills` received a `statValues` map missing that skill's weighted stats, and `levelOf`
   skipped them — `skills.stealth * 2` previewed as a confident **0** with the ladder suppressed.
   Strictly worse than the `Unknown namespace` it replaced, and a contradiction of the module's own
   header. A skills reference now contributes the stats it is weighted on. **The existing placement
   test could not have caught it**: its Stealth was weighted on the same `str-id` the combat
   formulas name bare, so the box was there for the wrong reason — Stealth moved to CHA and a
   skills-only case was added. Four smaller findings fixed in the same commit: the `as Character`
   cast became `Pick<Character, 'investedSkillPoints'>` on `calculateSkills` (so ARC-02 widening it
   is a compile error, not a runtime `undefined`); a stale structural-error JSDoc; the calculator's
   own error test, which asserted only `formulaError: true` and a source and so would have passed
   against the *broken* code note 2 fixed — it now pins `kind`, the message and `cause` identity;
   and an orphan comment in `useStatManager`. `CLAUDE.md`'s flat-namespace and derived-values hard
   rules were still written in terms of speciality skills and were corrected too.

## Notes

- Combat skills still exist until ROLL-05/06; their formulas referencing speciality codes must
  either resolve against the new skills namespace or be re-authored — a clean-break milestone
  allows re-authoring, but the plan must say which and test what holds.
- `unlock_condition` needs boolean formulas — deferred with the same JSDoc-note rule as
  constants-as-formulas.
