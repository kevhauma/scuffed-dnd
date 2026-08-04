# TICKET-FORM-05 — Errors as values in the engine

- **Area:** Formula engine
- **Type:** Feature
- **Traceability:** Concept [00 · Field model §7](../../excel%20export%20summary/concepts/00-field-model.md); spec [§5.5](../../excel%20export%20summary/ttrpg-app-spec.md)

## User story

As a Player, I want one broken formula to poison only its own value, so the rest of my character's
numbers keep computing.

## Description

The spec: errors are values with provenance, never thrown, no `IFERROR`. The engine throws on the
first bad reference and every calculator re-throws, so `calculateCharacter` aborts wholesale —
the root of v1.0's known open bug (a missing formula variable blanks a whole character sheet).
This ticket changes the engine contract; the sheet rendering is TICKET-FORM-06.

## Current situation (as-is)

- [`evaluateFormula`](../../../src/engine/formula/evaluator.ts) throws on an undefined variable;
  [`statCalculator.ts`](../../../src/engine/calculators/statCalculator.ts) and its siblings wrap
  and re-throw, so [`calculateCharacter`](../../../src/engine/calculator.ts) dies on the first
  bad formula.

## Desired result (to-be)

- Evaluation returns **number or `FormulaError`** — carrying what failed, in which formula, on
  which entity. Data problems (undefined reference, unknown function, arity, unavailable
  namespace) never throw; programmer errors (malformed AST, null config) still do.
- **Errors propagate with chained provenance**: a formula reading an errored value yields an
  error naming the upstream cause. There is deliberately no `iferror` function.
- `calculateCharacter` always returns; `CalculatedCharacter`'s derived maps carry per-entry
  results, with a documented accessor for callers that want numbers-or-absent.

## Implementation notes (2026-08-04)

1. **Existing tests were rewritten, not merely added to.** Unlike FORM-02/03, this ticket changes
   a contract, so ~14 assertions that read `expect(() => …).toThrow('Undefined variable: STR')`
   now read `expect(…).toMatchObject({ kind: 'undefined-variable' })`. They were asserting the
   behaviour this ticket exists to replace. Affected: `evaluator.test.ts`, `calculator.test.ts`,
   and the three calculator test files. No test was deleted or skipped.
2. **Both play surfaces keep a whole-surface error state for now, on purpose.** With the engine no
   longer throwing, anything that relied on a `catch` to notice a broken formula would render it
   as a silent `0` — quietly wrong, which is worse than the v1.0 bug it replaces. Exported
   `firstCalculationError(calculated)` from `calculator.ts`; the character sheet and the creation
   wizard's review step both use it and keep their existing "cannot be calculated" states until
   TICKET-FORM-06 renders a chip per value. The engine half of the user story ("one broken formula
   poisons only its own value") is done and tested; the visible half arrives with FORM-06, exactly
   as the ticket's Description says.
   *`conventions-reviewer` caught that I had done this for the sheet but missed the review step,
   where `numberOr(…, 0)` was rendering a broken stat as a confident `0` and the step's error
   branch had become dead code.* Fixed here, and confirmed in the browser both ways.
3. **`rollCombatSkill` returns `CombatRollResult | FormulaError`.** It previously relied on the
   calculator throwing to report a broken bonus formula. Returning `numberOr(bonus, 0)` there
   would have silently rolled with a bonus of zero, so the error is returned and `useCombatRoller`
   reports it beside the skill exactly as before.
4. **`namespace-unavailable` was dropped from `FormulaErrorKind`** — namespace *scoping* is
   TICKET-FORM-04's validator, which produces strings at save time, not evaluator error values.
   Keeping the kind would have described a value the engine can never produce.
5. **Found, not fixed:** a main skill the configuration defines but the character never allocated
   is absent from `totalMainSkillLevels` rather than present as 0, so a formula naming it reports
   `Undefined variable`. Pre-existing — `mainSkillCalculator.ts` is untouched by this diff, and
   before FORM-05 the same case threw and produced the same "cannot be calculated" panel. It only
   became *legible* because the message now names the code. Left for its own ticket rather than
   widened into this one.

## Acceptance criteria

- [x] Each data-error kind returns an error value (tests per kind); programmer errors still throw (test). ([`errors.test.ts`](../../../src/engine/formula/errors.test.ts) → "error values per data-error kind" runs a table over all eight kinds — `syntax`, `undefined-variable`, `unknown-function`, `wrong-arity`, `unknown-namespace`, `unknown-member`, `division-by-zero`, `not-evaluable` — each asserting `.not.toThrow()` **and** the returned kind. "programmer errors still throw" covers the three engine-bug paths: unknown AST node type, unknown binary operator, unknown unary operator.)
- [x] Provenance chains across two formulas (A reads broken B → A's error names B). (`errors.test.ts` → "provenance chains across formulas": a variable holding an error yields `{ kind: 'upstream', message: 'MANA could not be calculated', cause: { … source: { name: 'Mana' } } }`, same through a namespaced reference; `describeFormulaError` renders the chain root-cause last; `rootCause` walks to the origin. End-to-end in `calculator.test.ts` → "should chain provenance from a broken speciality skill into the combat skill reading it": MEL is `STR + STL`, STL is broken, and MEL's error names Stealth as the cause.)
- [x] `calculateCharacter` with one broken stat formula returns every other stat, skill, and bonus computed (test). (`calculator.test.ts` → "should compute every other value when one stat formula is broken": `health` is an error while `evasion` 20, `STL` 7, `ARC` 13, `MEL` 16 and all main skill levels are still numbers. Also `statCalculator.test.ts` → "should calculate every other stat when one formula is broken".)
- [x] No consumer of `CalculatedCharacter` breaks: all callers compile against the new result shape and the suite stays green. (`npx tsc --noEmit` at the documented 4-error baseline with every consumer updated — `useCharacterSheet`, `ReviewStep`, `characterStore`, `combatRoll`, `useCombatRoller`, `StatCard`. Suite 762 → 790 passing, 0 failing, 0 skipped.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill. (Suite 762 → 790 passing, 0 failing, 0 skipped; tsc at the 4-error baseline; `yarn run check` clean. fallow audit on the diff: **0 complexity findings, 0 duplication, 0 new dead code** — splitting the evaluator into `evaluateVariable`/`evaluateCall`/`evaluateNamespacedRef` also cleared the `evaluateFormula` hotspot FORM-03 had flagged. `conventions-reviewer` found the silent-zero regression in the review step (note 2), two knowledge-skill lines still saying "throws", `firstFormulaError` sitting in a component hook when the engine owned the type, a `isFormulaError` brand check that tested the key rather than its value, and two untested new branches — **all fixed here**, with tests added for the brand check, `rollCombatSkill`'s error return, and partial stat seeding. Browser check 2026-08-04: built a character (Speed 6, Stealth 3) whose sheet showed Aptitude 1 and Stealth 6; edited the stored ruleset to give Aptitude the formula `GONE * 5` — both the sheet **and** the creation wizard's review step reported `Stat "Aptitude": Undefined variable: GONE` rather than a silent zero, naming the entity via the new error `source`; restoring the formula brought both back. Console clean apart from the pre-existing TanStack `<link>` noise.)

## Notes

- Do this before the entity tickets multiply `CalculatedCharacter` consumers.
- TICKET-REF-02's force-delete ("references become visible errors") depends on these error values.
