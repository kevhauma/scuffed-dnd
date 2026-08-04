# TICKET-CALC-02 — An unallocated main skill is 0, not missing

- **Area:** Calculation engine
- **Type:** Bug fix
- **Traceability:** Concept [01 · Stat](../../excel%20export%20summary/concepts/01-stat.md) ("where a
  character's stat value comes from" — a stat with no invested points still has a value), Concept
  [00 · Field model §5](../../excel%20export%20summary/concepts/00-field-model.md) (the evaluation
  context provides the whole namespace, not the populated subset); v1.0 Requirements 3.2, 3.6,
  11.5, 16.6

## User story

As a Player, I want a main skill I put no points into to count as 0 in every formula, so my sheet
still calculates instead of reporting an undefined variable for a skill the ruleset clearly
defines.

## Description

`calculateTotalMainSkillLevels` builds its result from the character's allocation map, so a main
skill the configuration defines but the character never allocated is **absent** from
`totalMainSkillLevels` rather than present with 0. Every stat, speciality and combat formula
naming that code then fails with `Undefined variable: <CODE>`. This closes the cause behind the
v1.0 known bug that [TICKET-FORM-06](./TICKET-FORM-06-error-chips-on-the-sheet.md) made survivable.

## Current situation (as-is)

- [`calculateTotalMainSkillLevels`](../../../src/engine/calculators/mainSkillCalculator.ts:70)
  seeds its accumulator with `{ ...character.mainSkillLevels }` — the character's *allocation* map.
  A configured code with no allocation is therefore never a key, and every later step
  (`totalLevels[code] || 0`) only ever adds to codes that already exist or that a racial/equipment
  modifier introduces.
- The function already receives the configured list as `options.mainSkills` and uses it for
  `isMainSkillCode`, the equipment-bonus namespace check — the data needed to seed is in hand and
  discarded.
- That sparse map is the formula context for the rest of the chain:
  [`calculateMaxStatValues`](../../../src/engine/calculators/statCalculator.ts:34),
  [`calculateSpecialitySkillLevels`](../../../src/engine/calculators/specialitySkillCalculator.ts:41)
  and [`calculateCombatSkillBonuses`](../../../src/engine/calculators/combatSkillCalculator.ts) all
  pass it straight into `FormulaContext.variables`, so an unallocated code reads as undefined
  everywhere at once.
- Reproduced in the browser 2026-08-04: a ruleset with main skill `SPD` and a stat
  `max(1, round(SPD / 30))`, plus a character created without allocating `SPD`, makes the creation
  wizard's review step report `Stat "Aptitude": Undefined variable: SPD`.
- The two sibling calculators do **not** have this gap — `calculateSpecialitySkillLevels` and
  `calculateCombatSkillBonuses` both iterate `config.*Skills` and emit an entry per configured
  skill. Main skills are the one namespace built from character data instead of configuration.
- Pre-existing: this predates TICKET-FORM-02..05, none of which touched this file. It only became
  easy to notice once [TICKET-FORM-05](./TICKET-FORM-05-errors-as-values-engine.md) started
  reporting the specific message instead of a generic throw.

## Desired result (to-be)

- Every code in `options.mainSkills` is present in the returned record, seeded to **0** before
  allocations, racial modifiers, equipment bonuses and the focus-stat bonus are applied — so the
  main-skill namespace handed to the formula engine is the configured namespace, complete.
- A stat / speciality / combat formula referencing a configured-but-unallocated code evaluates to a
  number. `Undefined variable` is reserved for codes the configuration genuinely does not define.
- Omitting `options.mainSkills` keeps today's behaviour exactly — the plain "allocations + racial"
  shape, and the `skillCode in character.mainSkillLevels` fallback in `isMainSkillCode` — so no
  caller that never had a configuration to seed from changes.

## Acceptance criteria

- [x] `calculateTotalMainSkillLevels(character, races, { mainSkills })` returns an entry for every
      configured code; one the character never allocated is `0`, not absent.
      (`mainSkillCalculator.ts:79-86` seeds from `options.mainSkills` before spreading the
      allocations; `mainSkillCalculator.test.ts` → *"should total a configured but unallocated
      skill to 0 rather than omitting it"* asserts `{ STR: 10, DEX: 8, CON: 0 }`.)
- [x] Called without `options.mainSkills`, the function returns exactly what it returns today —
      the existing tests in
      [`mainSkillCalculator.test.ts`](../../../src/engine/calculators/mainSkillCalculator.test.ts)
      that assert the sparse shape with `toEqual` stay green **unchanged**, and any that must move
      are named here with the reason.
      (**No test moved.** All four original `toEqual` sparse-shape tests and the four
      equipment/focus tests are untouched in the diff and green — with an empty seed
      `{ ...seededLevels, ...character.mainSkillLevels }` is equivalent to the old
      `{ ...character.mainSkillLevels }`. A new *"should keep the sparse allocation shape when no
      main skills are given"* test pins the no-options contract explicitly.)
- [x] `calculateCharacter` on a configuration whose stat/speciality/combat formulas reference an
      unallocated main skill returns numbers throughout — no `FormulaError` entry, so
      `firstCalculationError` is `undefined`.
      (`calculator.test.ts` → describe *"calculateCharacter over an unallocated main skill
      (TICKET-CALC-02)"*, first case: `insight` 0, `STL` 2, `MEL` 9, `firstCalculationError`
      `undefined`.)
- [x] Seeding stays inside the calculator: no store action, no component-side defaulting, and
      `Character.mainSkillLevels` is **not** back-filled on save — the zero is derived, never
      persisted.
      (The whole non-test diff is `src/engine/calculators/mainSkillCalculator.ts`; no store,
      component, hook or `services/storage` file is touched. Confirmed by the
      `conventions-reviewer` subagent: "nothing writes back onto `Character` … the zero is derived
      at read time on every call".)
- [x] Unit tests cover: a configured code with no allocation totals 0; the same code with only a
      racial modifier totals the modifier; with only an equipment bonus totals the bonus; as the
      focus stat totals `focusStatBonusLevel`; a stat formula over an unallocated code evaluates
      instead of erroring; a code that is *not* configured still produces `Undefined variable`.
      (First four: `mainSkillCalculator.test.ts` → describe *"with the configured main skill
      namespace"*, five cases over an unallocated `CON`. Last two: `calculator.test.ts` → describe
      *"calculateCharacter over an unallocated main skill (TICKET-CALC-02)"*, where the same config
      calculates `WIS` and still reports `Undefined variable: MAG` for an undefined code.)
- [x] Regression test at the reported level: a ruleset gains a main skill and a stat referencing
      it, an existing character has no allocation for it, and the sheet plus the creation wizard's
      review step show numbers rather than an error. (The sheet half already exists as
      `CharacterSheet.test.tsx` → *"should survive the v1.0 bug…"*, which currently passes by
      showing a **chip**; it must pass by showing the **number** after this ticket, so update its
      assertion rather than adding a second test.)
      (Sheet: that test was updated in place — now `CharacterSheet.test.tsx` → *"should calculate a
      new stat over it rather than chipping the sheet"*, asserting `Insight` renders `of 0 max` and
      `queryAllByRole('img', { name: /Undefined variable/ })` is empty. It was also lifted out of
      the `TICKET-FORM-06` describe into its own *"a main skill no character allocated"* block,
      since it now asserts the opposite of that group's premise. Wizard: new
      `CharacterCreationWizard.test.tsx` → *"should preview numbers on review before anything is
      allocated (TICKET-CALC-02)"* — load-bearing because `useCharacterCreation` defaults
      `mainSkillLevels: {}`, so before this fix the review step rendered the "formula that does not
      evaluate" card.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.
      (`verifier`: 809 passing / 0 failing / 0 skipped — +8 on the 801 baseline; `npx tsc --noEmit`
      at the documented 4-error baseline, none in changed files; `yarn run check` clean after one
      mechanical `biome check --write` on `calculator.test.ts`. `fallow audit --base HEAD`: verdict
      **pass**, 0 issues introduced, 0 complexity findings, 0 clone groups. `conventions-reviewer`:
      clean — no layering, persistence, derived-never-stored, engine-math, component-split or
      theme-token violations; its one structural note, the misfiled describe, is applied above.)
- [x] Verified live in the browser: the reported repro — main skill `SPD`, stat
      `max(1, round(SPD / 30))`, a character with no `SPD` allocation — shows a calculated
      Aptitude in the wizard review step and on the sheet, with no error chip.
      (2026-08-04, dev server on :5173 against the exact ruleset in the ticket. Created
      *"Unallocated Una"* through the wizard allocating nothing. **Review step**: `Speed (SPD) 0`,
      `Aptitude 1`, `Stealth (STL) 0`, and no "formula that does not evaluate" notice. **Sheet**:
      `Speed (SPD) allocated 0 → 0`, `Aptitude … of 1 max`, `Stealth (STL) base 0 → 0`.
      `document.querySelectorAll('[role="img"]')` returned `[]` and the page text contains no
      `Undefined variable`. A live `console.error` hook captured zero errors across a sheet
      re-render; the `{value, error}` React warnings in the tab's console buffer are stale from
      earlier in this long-running dev session — their count is unchanged across a full reload and
      the only two `DerivedValue` consumers, `SkillBreakdownRow` and `StatEditor`, destructure it.)

## Notes

- **Three to-be items, per the milestone's ticket-size decision.** The fix is a few lines; the
  weight is in the test matrix and in not regressing the no-options call shape.
- **Deliberately not in scope:** stray keys from a racial or equipment modifier that names a code
  the configuration does not define. Those still land in the record today and would be filtered by
  the same `mainSkills` list — but filtering is a behaviour change with its own blast radius, and
  [TICKET-REF-02](./TICKET-REF-02-guarded-deletes.md) is where dangling references get their
  treatment.
- **The invariant must survive [TICKET-STAT-01](./TICKET-STAT-01-unified-stat-model-and-engine.md)**,
  which merges `MainSkill` + `Stat` and rewrites this calculator into the composition chain of
  Concept 01. State it there as a rule — *every configured stat has a value; absence is not a
  state* — and carry the regression test across. Fixing it now rather than waiting for STAT-01 is
  the point: it is a live bug on the shipped model, and it costs one seeding line.
- Complements TICKET-FORM-06 rather than undoing it: chips remain the right rendering for a
  genuinely broken formula. This ticket removes the case where a *correct* formula produced one.
