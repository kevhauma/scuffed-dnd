# TICKET-FORM-01 — Block circular formulas on save, and derive dependencies from the parser

- **Area:** Formula engine
- **Type:** Bug fix
- **Traceability:** Requirements 16.5, 16.6, 18.2, 2.5, 2.6
- **Decision:** "block and report" — recorded in [overview.md](../overview.md), 2026-07-30

## User story

As a User, I want the app to stop me saving a formula that depends on itself, so that my ruleset
can't reach a state where a Player's character sheet cannot be calculated.

## Description

Requirement 16.5 says the Application *prevents* circular dependencies. Detection exists but is
wired only into the configuration-wide validator, whose report has no UI yet — so today a circular
formula saves cleanly, nothing warns the User, and the first symptom is a character sheet that
cannot compute. The agreed behaviour is **block and report**: the save is refused and the cycle is
named. While in the same code, the skill-dependency check moves from substring matching to the
parser's own reference list.

## Current situation (as-is)

- [`detectCircularDependencies`](../../../src/engine/formula/validator.ts) and
  `validateFormulaCollection` exist and work. Their **only** caller is
  [`engine/validator.ts:154`](../../../src/engine/validator.ts), the whole-configuration validator —
  which has no UI (plan §17.2), so nothing reaches it at save time.
- [`FormulaEditor`](../../../src/components/ui/FormulaEditor/FormulaEditor.tsx) validates the
  formula it is editing — syntax and undefined variable references — but knows nothing about the
  other formulas in the configuration, so it cannot see a cycle.
- The three form dialogs that persist formulas — `StatFormDialog`, `SpecialitySkillFormDialog`,
  `CombatSkillFormDialog` — save through their `useXManager` hook straight into the store with no
  cross-formula check.
- [`useSkillDependencies.ts`](../../../src/components/config/skills/shared/useSkillDependencies.ts)
  answers "is this skill referenced?" (Req 2.5, 2.6) with `stat.formula.includes(code)` — a raw
  substring scan across stat, speciality, and combat formulas. It happens to work because every
  code is exactly three letters, but the parser already returns
  `FormulaValidationResult.referencedVariables`, which is the correct source.

## Desired result (to-be)

- Saving a stat, speciality skill, or combat skill whose formula would create a cycle is **refused**,
  and the User is shown the cycle in plain terms — e.g. "`health` → `STR` → `armour` → `health`" —
  not a generic "invalid formula".
- The check runs against the configuration as it *would be* after the save (the edited formula
  substituted in), not the configuration as it currently is — otherwise editing an existing formula
  into a cycle slips through.
- The check reuses `validateFormulaCollection` / `detectCircularDependencies`. No second cycle
  detector is written, and the dialogs do not parse formulas by hand.
- `useSkillDependencies` derives references from `validateFormula(...).referencedVariables` instead
  of `String.includes`, so a dependency is a real parsed reference.
- A formula referencing an undefined skill code stays a save-time error too (Req 16.6) — it already
  surfaces in the editor; make sure it also blocks the save rather than only annotating the field.

## Acceptance criteria

- [ ] Saving a formula that introduces a direct self-reference (`health` = `health + 1`) is refused, with the cycle named in the message.
- [ ] Saving a formula that introduces an indirect cycle across two or more formulas is refused, with the full chain named.
- [ ] The check evaluates the post-save state: editing an existing formula into a cycle is caught, not just creating a new one.
- [ ] A formula that is *not* circular still saves, including one that legitimately references several other skills (no false positives).
- [ ] Saving a formula referencing an undefined skill code is refused with the offending code named (Req 16.6).
- [ ] Cycle detection reuses the engine's existing `detectCircularDependencies` / `validateFormulaCollection`; no duplicate implementation is added.
- [ ] `useSkillDependencies` uses parser-derived `referencedVariables`; no `String.includes` formula scanning remains in `src/components/`.
- [ ] Deleting a skill that is referenced is still blocked with its dependents listed (Req 2.5, 2.6 — no regression from the detection change).
- [ ] Unit tests cover: direct cycle refused; indirect cycle refused with chain; edit-into-cycle refused; valid multi-reference formula accepted; undefined code refused; dependency lookup finds a reference the substring scan would have found, and no longer reports one it would have false-matched.
- [ ] Verified via the fallow skill and the react-conventions skill.
- [ ] Verified live in the browser: create two stats whose formulas reference each other and confirm the second save is blocked with a readable message; then break the cycle and confirm it saves.

## Notes

- This closes the "prevent vs detect" question: Requirement 16.5's wording stands as written —
  the app blocks, it doesn't merely report afterwards.
- The configuration-wide validation report (plan §17.2) is still worth building; it catches
  configurations that arrived by **import**, which never pass through these dialogs. The two are
  complements, not alternatives — note that in the §17.2 work.
- Where the check lives matters: put it in the `useXManager` hooks' save path (or a small shared
  helper they all call), not in `FormulaEditor` — the editor is a base component and must not know
  about the configuration store.
