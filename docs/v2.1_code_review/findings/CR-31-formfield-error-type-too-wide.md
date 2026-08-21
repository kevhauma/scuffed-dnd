# CR-31 — `FormField`'s `error` prop type invites objects it renders as `[object Object]`

**Severity:** Low · **Area:** ui (base components) · **Type:** latent bug (type/render mismatch)

## Summary

`FormField` types its error prop as `string | FieldError | Merge<…>` but renders
`error.toString()`, which yields `[object Object]` for a `FieldError`. All current callers happen
to pass `errors.x?.message` strings, so it's latent — but the type actively invites the broken
usage.

## Evidence

- `src/components/ui/FormField/FormField.tsx:18` (prop type) and `:43` (`error.toString()`).

## Impact

The first caller who passes `errors.x` (natural, and permitted by the type) ships
`[object Object]` to the user.

## Suggested direction

Either narrow the prop to `string`, or handle the object case by reading `.message`. Narrowing is
simpler and matches every existing call site.
