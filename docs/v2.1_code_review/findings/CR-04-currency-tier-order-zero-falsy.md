# CR-04 — Editing the lowest currency tier moves it to the end of the list

**Severity:** High · **Area:** config components (currency) · **Type:** correctness bug

## Summary

`useCurrencyManager` recovers the edited tier's `order` with `|| currentTiers.length`. The lowest
tier has `order: 0`, which is falsy, so saving *any* edit to it reassigns it the highest order and
it jumps to the end of the list.

## Evidence

`src/components/config/currency/useCurrencyManager.ts:74-76`:

```ts
currentTiers.find((t) => t.id === editingTierId)?.order || currentTiers.length
```

`order: 0` falls through `||` to `currentTiers.length`. Sibling managers use the correct idiom —
`src/components/config/stats/useStatManager.ts:275`: `existing?.order ?? currentStats.length`.

## Impact

User-visible reordering on every edit of the first tier; because tier order is meaningful
(currency conversion is a ladder), this silently changes the ruleset's semantics, not just its
display.

## Suggested direction

Replace `||` with `??`. Add a regression test that edits the `order: 0` tier and asserts the
order survives. Worth a quick grep for other `.order ||` / falsy-zero recoveries while in there.
