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

## Implementation note (2026-07-31) — the reference graph is layered, so most cycles are unreachable from the dialogs

Found while building: the three formula-owning dialogs cannot produce a multi-formula cycle,
because the set of codes each one offers is strictly lower in the layering.
Per Requirements 2.2, 3.3 and 4.4, and as implemented in the managers' `availableSkillCodes`:

| Formula | May reference | Referenced by |
|---|---|---|
| Stat (`useStatManager`) | main skill codes | nothing — stats are keyed by `id` and no formula can name a stat |
| Speciality skill (`useSpecialitySkillManager`) | main skill codes | combat skills |
| Combat skill (`useCombatSkillManager`) | main + speciality codes | nothing |

Main skills carry no formula, so the graph is a DAG by construction: `main ← stat / speciality ←
combat`. The two reachable failures are a **self-reference** (`STL = STL + 1`) and an **undefined
code**, both of which today are annotated by `FormulaEditor` but do **not** block the save
(`form.setError` on an unregistered field does not stop `handleSubmit`). A genuine multi-formula
cycle can only enter by **import** of hand-edited JSON, which is `validateConfiguration`'s job
(plan §17.2).

What this ticket therefore builds: a save-time guard in the engine
(`validateFormulaChange`) that refuses the save and names the problem, checking the configuration
*as it would be after the save*. It runs the existing `validateFormulaCollection` /
`detectCircularDependencies` over the post-save formula set regardless — it is cheap, it is the
reuse the criteria ask for, and it catches a cycle in a configuration that arrived by import and
is then edited. Criteria below are annotated where reachability differs from the original wording.

## Acceptance criteria

- [x] Saving a formula that introduces a direct self-reference (~~`health` = `health + 1`~~ — stats are keyed by `id` and no formula can name a stat, so the reachable case is a skill: `STL` = `STL + 1`) is refused, with the cycle named in the message. (`validateFormulaChange` puts the edited entry into the graph, so the detector reports it as `STL → STL`. Tests: `formulaChange.test.ts` *"should refuse a formula that references its own entity, naming the cycle"* and `useSpecialitySkillManager.test.ts` *"should refuse a formula that references the skill itself, naming the cycle"*. Browser: editing Stealth to `STL + 1` showed **"Circular dependency detected: STL → STL"** and left the card's formula at `DEX / 2`.)
- [x] Saving a formula that introduces an indirect cycle across two or more formulas is refused, with the full chain named. **Not reachable from the dialogs** — see the implementation note above; the layering makes a two-formula cycle impossible to author. Covered at the engine level for configurations that arrive by import: `formulaChange.test.ts` *"should refuse an indirect cycle and name the whole chain"* asserts the message matches `Circular dependency detected: STL → ACR → STL`. Cycles are checked before undefined codes precisely so this reports as a cycle rather than as an undefined variable.
- [x] The check evaluates the post-save state: editing an existing formula into a cycle is caught, not just creating a new one. (`dependenciesAfterChange` drops the entry being replaced and substitutes the edited formula. Test *"should evaluate the post-save state, catching an edit that turns a valid formula circular"* asserts the same configuration passes with one formula and fails with another; *"should not report a cycle against the entry being replaced when a code is renamed"* covers the rename case.)
- [x] A formula that is *not* circular still saves, including one that legitimately references several other skills (no false positives). (Tests *"should accept a formula that legitimately references several skills"* (`STR * 2 + DEX + CON / 2`), *"should accept a combat formula referencing a speciality skill"*, `useStatManager.test.ts` *"should save a valid multi-reference formula"*. Browser: `STR * 2 + DEX` saved and rendered with a live preview value of 30.)
- [x] Saving a formula referencing an undefined skill code is refused with the offending code named (Req 16.6). (Guard runs inside `handleSave` **before** the store call and returns early. Tests *"should refuse a formula referencing an undefined code, naming the code"* in both `formulaChange.test.ts` and the two manager test files. `StatFormDialog` no longer routes `FormulaEditor.onValidate` into `form.setError` — the guard is now the single thing that refuses a save, so the block is provable rather than incidental.)
- [x] Cycle detection reuses the engine's existing `detectCircularDependencies` / `validateFormulaCollection`; no duplicate implementation is added. (`src/engine/formula/formulaChange.ts` imports `validateFormula` and `validateFormulaCollection` from `./validator` and adds no graph traversal of its own; it keys stats by `id` and skills by `code`, the same keys `engine/validator.ts` uses, so both paths agree on what a cycle is.)
- [x] `useSkillDependencies` uses parser-derived `referencedVariables`; no `String.includes` formula scanning remains in `src/components/`. (`grep -rn "formula.includes\|Formula.includes" src/components/` returns nothing. Test *"should not false-match a code that only appears inside a longer token"* — `STRIKE * 2` no longer reports Health as a dependent of `STR`, which the substring scan did.)
- [x] Deleting a skill that is referenced is still blocked with its dependents listed (Req 2.5, 2.6 — no regression from the detection change). (Tests *"should still block deleting a skill another formula references, listing the dependents"* and *"should delete a skill nothing references"* in `useSpecialitySkillManager.test.ts`.)
- [x] Unit tests cover: direct cycle refused; indirect cycle refused with chain; edit-into-cycle refused; valid multi-reference formula accepted; undefined code refused; dependency lookup finds a reference the substring scan would have found, and no longer reports one it would have false-matched. (+23 tests: `formulaChange.test.ts` (10), `useStatManager.test.ts` (4), `useSpecialitySkillManager.test.ts` (5), `useSkillDependencies.test.ts` (4). Suite: 454 passing, 0 failing, 0 skipped.)
- [x] Verified via the fallow skill and the ~~react-conventions~~ **coding-conventions** skill *(renamed since the ticket was written)*. (`fallow audit --base HEAD` → verdict `warn`: **0** dead-code and **0** complexity findings introduced; the warn is 3 duplication groups between `CombatSkillFormDialog`/`SpecialitySkillFormDialog` and their managers, which were already near-identical twins — 6 groups inherited — and my parallel edits to both lengthened the matched regions. Not new logic; flagged for a separate refactor rather than restructuring two domains inside this ticket. Conventions: the check lives in the engine (pure, no React/store), the managers call it, `FormulaEditor` stays ignorant of the configuration, dialogs use the `Text` primitive with `variant="error"` instead of raw markup, `**Validates: Requirements**` headers added to all four touched modules.)
- [x] Verified live in the browser, with the scenario adjusted to a reachable one — ~~two stats whose formulas reference each other~~ is impossible (see the implementation note). What was verified on `localhost:5173`: (1) a stat formula `STR * * 2`, which `FormulaEditor` does **not** flag because `STR` is a valid code, was refused on submit with *"Unexpected token MULTIPLY at position 6"* and the list still read "No stats configured yet" — proving the guard, not the editor's annotation, is what blocks; (2) correcting it in place to `STR * 2 + DEX` cleared the message and saved; (3) editing speciality skill Stealth to `STL + 1` was refused with *"Circular dependency detected: STL → STL"* while the card kept `DEX / 2`; (4) correcting it to `DEX / 2 + STR` saved.

## Notes

- This closes the "prevent vs detect" question: Requirement 16.5's wording stands as written —
  the app blocks, it doesn't merely report afterwards.
- The configuration-wide validation report (plan §17.2) is still worth building; it catches
  configurations that arrived by **import**, which never pass through these dialogs. The two are
  complements, not alternatives — note that in the §17.2 work.
- Where the check lives matters: put it in the `useXManager` hooks' save path (or a small shared
  helper they all call), not in `FormulaEditor` — the editor is a base component and must not know
  about the configuration store.
