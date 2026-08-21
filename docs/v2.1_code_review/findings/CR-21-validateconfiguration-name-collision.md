# CR-21 — Two exported functions named `validateConfiguration` with different meanings

**Severity:** Low · **Area:** engine + services · **Type:** naming hazard

## Summary

`src/engine/validator.ts:85` and `src/services/importExport.ts:449` both export
`validateConfiguration`, with different signatures and different jobs. Two independent reviews
confirmed they are **complementary, not duplicated** — the service one is a shape validator over
`data: unknown` (types, required fields, retired fields), the engine one is semantic (references
resolve, formulas evaluate, tables readable) — and found no rule checked in both with different
answers. The one overlapping rule (unique stat abbreviations, `importExport.ts:504-510` vs
`validator.ts:421-444`) agrees in effect.

## Evidence

- importExport's doc comments explicitly delegate: "whether the `input` computes … [is]
  `engine/validator.ts`'s report" (`importExport.ts:392-394`).
- The collision already costs something: `src/stores/configStore.test.ts:9-12` has to alias one
  import to use both; `useConfigTransfer.ts` imports one of each and avoids a clash only by not
  needing the second.

## Impact

Easy to import the wrong one (autocomplete offers both), and the seam between them is where the
real bugs hide ([CR-03](CR-03-malformed-import-persisted-before-validation.md),
[CR-17](CR-17-stores-enforce-no-uniqueness.md)). A name that states the split makes the seam
visible.

## Suggested direction

Rename the service export to `validateConfigurationShape` (or `configurationShapeErrors`,
matching its sibling `*ShapeErrors` helpers). Mechanical rename, few call sites.
