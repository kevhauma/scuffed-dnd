# CR-36 — The one raw hex in the component tree: `Select`'s dropdown-arrow data-URI

**Severity:** Low · **Area:** ui (Select) · **Type:** theme-token violation (technicality)

## Summary

The `Select` primitive's chevron is an inline SVG data-URI with a hardcoded fill
(`fill='%234f4739'`). It is the only raw hex anywhere in `src/` components — everything else is
theme tokens — but it won't follow the theme if the `ink` palette shifts.

## Evidence

- `src/components/ui/Select/Select.style.ts:14`.
- Grep across `src/` found no other raw hex or non-theme color utility.

## Impact

Cosmetic drift risk only; today the value matches `ink-700`'s hue.

## Suggested direction

Note the token it mirrors in a comment (cheapest), or replace the background-image chevron with a
positioned SVG element that can take `text-ink-700` + `fill-current`. Given the base-component
intrinsic-styling rule, the comment may be the right cost/benefit.
