# CR-22 — Import shape validation is ~500 lines of hand-rolled per-entity checks; should be data-driven

**Severity:** Medium · **Area:** services (import/export) · **Type:** maintainability / structural fix

## Summary

`importExport.ts`'s shape layer is N hand-written per-entity checkers (`curveShapeErrors`,
`diceLadderShapeErrors`, `rollDefinitionShapeErrors`, plus inline blocks for
stat/race/archetype/material/skill/constant) — several of them individually in fallow's
high-complexity list. Roughly 500 lines are mechanical assertions of the form
`{path, type, required?, pattern?, enum?, unique?}`. Hand-rolling each entity is exactly how the
[CR-03](CR-03-malformed-import-persisted-before-validation.md) coverage gap happened: four entity
kinds simply never got a checker, and nothing noticed.

## Evidence

- `src/services/importExport.ts` — `curveShapeErrors` (cyclomatic 18), `diceLadderShapeErrors`
  (12), `rollDefinitionShapeErrors` (11), several anonymous arrow checkers (11-14), plus the
  inline entity blocks.
- Unchecked entities (the CR-03 gap): `items`, `equipmentSlots`, `currencyTiers`,
  `materialCategories` — only `Array.isArray` on the container.

## Impact

Every new persisted entity requires remembering to hand-write a checker; forgetting is silent.
The file is the second-largest complexity concentration in the repo after the engine validator.

## Suggested direction

A declarative field-spec table per entity, walked by one generic checker — making "entity nobody
remembered to check" structurally impossible (a new key in `Configuration` with no spec entry can
itself be a reported error). The genuinely custom rules stay as a handful of custom validators:
row `values` length vs `columnCount`, `overridden` length, cross-entity uniqueness sets,
retired-field messages. No new dependency needed — this is a ~50-line walker, not a schema
library (the app stays browser-only and dependency additions need sign-off anyway).

## Related

- [CR-03](CR-03-malformed-import-persisted-before-validation.md) — the bug this structure would
  have prevented.
