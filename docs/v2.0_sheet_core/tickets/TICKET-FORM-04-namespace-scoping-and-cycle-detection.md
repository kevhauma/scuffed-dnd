# TICKET-FORM-04 — Namespace scoping and cycle detection

- **Area:** Formula engine
- **Type:** Feature
- **Traceability:** Concept [00 · Field model §5](../../excel%20export%20summary/concepts/00-field-model.md); v1.0 Req 16.5/16.6 (cycle blocking, preserved)

## User story

As a User, I want each formula to see exactly the namespaces its attachment point provides — and
circular formulas still blocked at save — so the reference rules are data the app enforces, not
folklore per entity kind.

## Description

Which references a formula may use is hardcoded per owner kind today. The spec declares context
by attachment point. This ticket makes that a data table, gives scoping its own validation
errors, and teaches FORM-01's cycle detection to follow namespaced references.

## Current situation (as-is)

- `availableCodesFor` in [`formulaChange.ts`](../../../src/engine/formula/formulaChange.ts)
  hardcodes scope per owner: main codes for stats/speciality, main + speciality for combat.
- [`validator.ts`](../../../src/engine/formula/validator.ts)'s `detectCircularDependencies` walks
  bare-code references only; FORM-03's namespaced nodes would be invisible to it.

## Desired result (to-be)

- A **per-attachment-point namespace table as data** (the Concept 00 §5 table, this milestone's
  slice), consumed by `validateFormula`/`validateFormulaChange`; `availableCodesFor`'s branches
  are replaced, not extended.
- Three distinct, named validation errors: unknown namespace, unknown member, namespace not
  available in this context.
- `detectCircularDependencies` treats namespaced references as graph edges, so save-time cycle
  blocking (FORM-01 behaviour) holds across the new syntax.

## Acceptance criteria

- [ ] The scoping table is data; no `switch` on owner kind remains for reference scope.
- [ ] Each of the three error kinds is produced and named in tests; the save-time guard refuses an out-of-scope namespace.
- [ ] A two-formula cycle written in namespaced syntax is blocked at save with the path shown (FORM-01 parity test).
- [ ] Existing bare-code scoping behaviour is unchanged until STAT-01 (regression tests).
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.

## Notes

- Pairs with TICKET-FORM-03 (syntax/resolution); build directly after it.
- New attachment points added by later tickets (constants-as-formulas, curve generators, roll
  inputs) each add a *row* to the table — that being cheap is this ticket's success measure.
