# TICKET-CRV-01 — Curve entity and lookup engine

- **Area:** Curves configuration (new area)
- **Type:** Feature
- **Traceability:** Concept [06 · Curve](../../excel%20export%20summary/concepts/06-curve.md)

## User story

As a User, I want named lookup tables that formulas call as `curve.name(x)`, so progressions are
data I tune rather than arithmetic scattered through the rules.

## Description

The entity and the lookup semantics. Generators are TICKET-CRV-02, the grid editor and seeds
TICKET-CRV-03. RES-01 (xp_thresholds, reverse) and ARC-02 (point_buy, multi-column) consume this.

## Current situation (as-is)

- No lookup-table entity in [`config.ts`](../../../src/types/config.ts); the nearest analogue
  (`Material.levels`) is a hand-entered array with no lookup callable from a formula.
- FORM-03 parses `curve.name(x)` with nothing behind it.

## Desired result (to-be)

- `Curve` entity: `{ id, name (identifier), displayName, description, keyName, columns:
  [{ id, name }], rows: [{ key, values[] }], interpolation: 'step' | 'linear', outOfRange:
  'clamp' | 'extrapolate' | 'error', lookupDirection: 'forward' | 'reverse' }`, CRUD store
  actions, export/import shape.
- Engine lookup with the spec's semantics: `step` holds the last row ≤ x; `linear` interpolates;
  `outOfRange` applies beyond the ends with `error` producing a FORM-05 error value; `reverse`
  answers "the highest key whose value ≤ x".
- `curve.name(x)` (single-column) and `curve.name(x, column)` evaluate in formulas; unknown
  curve/column are named validation errors; duplicate or unsorted keys are validation errors.

## Acceptance criteria

- [ ] Each lookup mode has its own test: step, linear, clamp, extrapolate, error-out-of-range, forward, reverse — including boundary keys (exactly on a row).
- [ ] Both call forms evaluate from formulas; unknown curve/column errors are named; `error` out-of-range propagates as an error value, not a throw.
- [ ] Key uniqueness/ordering validation reports through the standard validation surface.
- [ ] CRUD round-trips persistence and export/import via store actions.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.

## Notes

- Rows here are plain values; the `overridden` flag arrives with CRV-02's generators — design the
  row type so adding it is additive.
- The `challenge_rating` seed curve belongs to the creature milestone.
