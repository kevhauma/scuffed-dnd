# CR-32 — ui primitive prop-API gaps: error states, size scales, and `Text` swallowing rest props

**Severity:** Low · **Area:** ui (base components) · **Type:** inconsistent API / missing capability

## Summary

The primitives share the `variant` naming convention (good) but diverge on capability:

1. `Input` has an `error` boolean; `Select` and `Textarea` have none — an invalid select in the
   config dialogs **cannot** show error styling.
2. Only `Button` has a `size` scale.
3. `Text` (`src/components/ui/Text/Text.tsx:21-42`) uniquely does not spread rest props, so no
   `id`, `aria-*`, or `data-*` can reach it — a hard wall for accessibility work and testing
   hooks.

## Evidence

Compared prop surfaces of `Input`, `Select`, `Textarea`, `Button`, `Text` in
`src/components/ui/*/`.

## Impact

Feature code either lives without error styling on selects (current state) or will eventually
hand-roll it, violating the "no raw elements / intrinsic styling in primitives" rules. `Text`'s
missing rest-spread blocks aria fixes like the ones
[CR-13](CR-13-dialog-lacks-focus-management.md) and
[CR-35](CR-35-field-array-selects-unlabeled.md) need.

## Suggested direction

Add `error` to `Select`/`Textarea` mirroring `Input`; add rest-prop spreading to `Text`. Treat a
`size` scale for other primitives as not-needed until a feature asks.
