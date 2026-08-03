# TICKET-CRV-02 — Curve generators with preserved overrides

- **Area:** Curves configuration
- **Type:** Feature
- **Traceability:** Concept [06 · Curve](../../excel%20export%20summary/concepts/06-curve.md); Concept [00 · Field model §1.1](../../excel%20export%20summary/concepts/00-field-model.md) (generated + overridden)

## User story

As a User, I want curve columns filled by a formula but with my hand-tuned cells kept and
highlighted, so regenerating a progression never silently rebalances the game.

## Description

The spec's central editing idea — generate, overlay overrides, show both — implemented on
TICKET-CRV-01's entity. This is the machinery the sheet's four confirmed hand-tuned anomalies
need, and the pattern material tier generators reuse in a later milestone.

## Current situation (as-is)

- CRV-01's rows are hand-entered values only; no generator, no override flag, no regeneration —
  the state the whole app is in today for every tabular value.

## Desired result (to-be)

- A column may carry a **generator formula** evaluated in the row context (`key`, `const.*` —
  a FORM-04 scoping-table row).
- **Regenerate** refills computed cells, **preserves every cell flagged `overridden`**, and
  returns a report (cells written, overrides kept); extending the key range generates the new
  rows.
- Hand-editing a generated cell flags it `overridden`; clearing the flag reverts it to the
  generated value.

## Acceptance criteria

- [ ] Generator evaluation per row is tested, including `const.*` references.
- [ ] Regeneration preserves overrides — including the "generator changed under an override" case — and the report matches what happened.
- [ ] Flag lifecycle tested: edit flags, clear reverts, regenerate respects.
- [ ] Row-shape change is additive: CRV-01 configs without flags still load and validate.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.

## Notes

- Pure entity/engine work — the editor visuals for the flag land with TICKET-CRV-03.
- The point-buy sub-column's `4.642857…` anomaly (open question #3) is exactly what the flag is
  for; either answer is a data edit once this exists.
