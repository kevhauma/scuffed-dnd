# CR-03 — A malformed import is persisted to LocalStorage before it is validated

**Severity:** High · **Area:** services (import/export) + config dashboard · **Type:** correctness bug / data integrity

## Summary

Import shape validation skips `items`, `equipmentSlots`, `currencyTiers`, and
`materialCategories` entries entirely (only `Array.isArray` on the container), so a file like
`{"currencyTiers":[null], …}` passes the shape gate. The import flow then **persists the config
before running the engine validator**, which crashes on the malformed entries — the error is
shown, but the broken configuration is already saved and greets every route on next load.

## Evidence

- `src/services/importExport.ts:470-485` — the shape validator checks `Array.isArray` for these
  four collections but never inspects their entries. Material entries are only checked for
  `levels[].bonuses` shape (not `categoryId`, not `level.value`).
- `src/components/config/dashboard/useConfigTransfer.ts:65-66` —
  `handleConfirmImport` calls `replaceConfig(imported)` (a persisting store action) **before**
  `validateConfiguration(imported)` (engine).
- The engine validator then throws on `t.id` / `level.value.tierId`
  (`src/engine/validator.ts:91-94, 243`). The throw is caught and rendered as an import error —
  but LocalStorage already holds the malformed config.

## Impact

One bad import bricks the stored ruleset: every subsequent page load feeds the malformed config to
routes and calculators. Applying-before-report is a *documented* decision for **referentially**
broken rulesets (import, then show the validation report); the uneven shape coverage lets
**structurally** broken ones through the same door, which was never the intent.

## Suggested direction

Two independent fixes, both worth doing:

1. Close the coverage gap: give `items`, `equipmentSlots`, `currencyTiers`, and
   `materialCategories` entries the same per-field shape checks every other entity gets.
   [CR-22](CR-22-shape-validation-should-be-data-driven.md) proposes making this class of
   omission structurally impossible.
2. Make the persist step crash-safe: run the engine validator (or at least a try/catch dry-run of
   it) on the parsed object *before* `replaceConfig`, so "shape passed but semantics crash" never
   reaches LocalStorage.

## Related

- [CR-22](CR-22-shape-validation-should-be-data-driven.md) — data-driven shape checking.
- [CR-21](CR-21-validateconfiguration-name-collision.md) — the two validators involved here share
  one export name.
