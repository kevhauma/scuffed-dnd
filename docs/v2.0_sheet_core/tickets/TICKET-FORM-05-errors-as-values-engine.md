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

## Acceptance criteria

- [ ] Each data-error kind returns an error value (tests per kind); programmer errors still throw (test).
- [ ] Provenance chains across two formulas (A reads broken B → A's error names B).
- [ ] `calculateCharacter` with one broken stat formula returns every other stat, skill, and bonus computed (test).
- [ ] No consumer of `CalculatedCharacter` breaks: all callers compile against the new result shape and the suite stays green.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.

## Notes

- Do this before the entity tickets multiply `CalculatedCharacter` consumers.
- TICKET-REF-02's force-delete ("references become visible errors") depends on these error values.
