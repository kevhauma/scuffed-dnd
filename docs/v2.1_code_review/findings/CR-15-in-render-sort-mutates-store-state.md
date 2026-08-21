# CR-15 — `MaterialLevelFormDialog` sorts the store's own array in place during render

**Severity:** Medium · **Area:** config components (materials) · **Type:** anti-pattern (store mutation outside action)

## Summary

The dialog calls `.sort()` directly on its `currencyTiers` prop during render. That prop is the
store's own `config.currencyTiers` array, so rendering the dialog reorders Zustand state outside
any action.

## Evidence

- `src/components/config/materials/MaterialLevelFormDialog.tsx:199-200` —
  `currencyTiers.sort((a, b) => a.order - b.order)` (Array.prototype.sort mutates).
- The array is passed through unchanged from the store:
  `src/components/config/materials/useMaterialManager.ts:99` — `config?.currencyTiers || []`.
- The correct idiom exists next door: `src/components/config/currency/useCurrencyManager.ts:39`
  uses `[...tiers].sort(...)`.

## Impact

Usually invisible because the array is already order-sorted, but it violates the store-owns-state
rule: a render pass writes to persisted state, can mask [CR-04](CR-04-currency-tier-order-zero-falsy.md)-style
ordering bugs, and breaks referential-equality assumptions any memoization would rely on.

## Suggested direction

`[...currencyTiers].sort(...)` — one-line fix; while there, check the repo for other in-render
`.sort(`/`.reverse(`/`.splice(` calls on store-derived arrays.
