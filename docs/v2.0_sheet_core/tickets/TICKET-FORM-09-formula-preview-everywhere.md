# TICKET-FORM-09 — Every formula field previews

- **Area:** Formula engine (authoring UI)
- **Type:** Feature
- **Traceability:** Concept [00 · Field model §5](../../excel%20export%20summary/concepts/00-field-model.md);
  Requirements 4.2, 5.4, 16.1–16.4, 21.1–21.7

## User story

As a User, I want the same preview under every formula I write — a skill's bonus, a combat roll's
bonus, a curve column's generator — so that knowing what a formula produces does not depend on
which panel I happen to be in.

## Description

TICKET-FORM-08 builds `FormulaPreview` and proves it on the stat dialog. This ticket takes it to
the three remaining formula fields. Each is a wiring change — a different `FormulaOwner`, a
different variable set — not new preview behaviour.

## Current situation (as-is)

- Three dialogs render [`FormulaEditor`](../../../src/components/ui/FormulaEditor/FormulaEditor.tsx)
  with no preview under it:
  - [`SpecialitySkillFormDialog`](../../../src/components/config/skills/speciality/SpecialitySkillFormDialog.tsx)
    — `bonusFormula`, owner `speciality-skill`, bare stat codes in scope.
  - [`CombatSkillFormDialog`](../../../src/components/config/skills/combat/CombatSkillFormDialog.tsx)
    — `bonusFormula`, owner `combat-skill`, stat **and** speciality codes in scope
    ([`scoping.ts`](../../../src/engine/formula/scoping.ts) `LEGACY_CODE_SCOPES`).
  - [`CurveColumnDialog`](../../../src/components/config/curves/CurveColumnDialog.tsx) — a column
    `generator`, owner `curve-generator`, whose only variable is the row's `key` alongside
    `const.*` (TICKET-CRV-02).
- The imported Ducklets ruleset makes the gap concrete: 48 speciality skills carry formulas like
  `STR * 0.2 + CHA * 0.1` ([`docs/imports/speciality-skills.json`](../../imports/speciality-skills.json))
  and none of them can be checked without saving and reading a character sheet.

## Desired result (to-be)

- **`SpecialitySkillFormDialog` and `CombatSkillFormDialog`** render `FormulaPreview` under the
  bonus formula field, each with its own owner so the combat dialog previews speciality codes and
  the speciality dialog does not offer them.
- **`CurveColumnDialog`** renders it under the generator field with owner `curve-generator`: the
  ladder sweeps `key`, which reads as the generated column's own values at rows 1…50 — the
  fastest way to see that `0.75 * (key + 1)` is the intended progression before it overwrites a
  table.
- **The sweep is honest about what it cannot resolve.** A combat formula naming a speciality code
  has no resolver behind `skills.*` until TICKET-SKL-02; the preview shows the validator's message
  for that reference rather than a number, and says so once rather than per row.

## Acceptance criteria

- [ ] All three dialogs render `FormulaPreview` with their own `FormulaOwner`; no dialog
      constructs a namespace source or evaluates a formula itself.
- [ ] The curve-generator preview sweeps `key` and its single-result box edits `key`, matching what
      `regenerateCurveTable` will compute for that row — verified against a generated column.
- [ ] A reference the current build cannot resolve (an unresolved namespace member) renders as one
      explanatory line, not nine `NaN`s or nine dashes.
- [ ] Feature components compose `ui/` primitives; layout stays in the dialogs; theme tokens only.
- [ ] Unit tests cover: the speciality dialog previewing `STR * 0.2 + CHA * 0.1`; the combat dialog
      previewing a formula naming a speciality code; the curve dialog previewing
      `0.75 * (key + 1)` and matching `regenerateCurveTable`'s values for rows 1, 5 and 10; an
      unresolvable reference showing one message.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.
- [ ] Verified live in the browser: with the Ducklets import loaded, edit `intimidation`, read the
      ladder, then edit the `point_buy` `main` column and read its generator preview.

## Notes

- **Needs TICKET-FORM-08** — this ticket adds no preview behaviour, only placements. If a
  placement wants behaviour FORM-08 did not build, that is a change to FORM-08's component with a
  note there, not a second preview here.
- TICKET-ROLL-05 replaces `CombatSkill` with roll definitions and TICKET-SKL-02 reshapes speciality
  skills. Both keep a User-authored expression, so both inherit the preview — see the standing rule
  in [CLAUDE.md](../../../CLAUDE.md); neither is a reason to delay this ticket, since the component
  takes an owner rather than an entity.
- Once `skills.*` has a resolver (SKL-02), the combat preview stops needing its "cannot resolve"
  line for speciality references. Nothing here needs changing when that lands.
