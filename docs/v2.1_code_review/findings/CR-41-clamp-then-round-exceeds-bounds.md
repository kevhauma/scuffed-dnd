# CR-41 — Clamp-then-round can violate fractional stat bounds

**Severity:** Low · **Area:** engine (stat calculator) · **Type:** edge-case correctness

## Summary

The stat pipeline clamps to `min`/`max` and *then* rounds, so a fractional bound can be exceeded
by the rounding step: `max: 10.6`, raw value 12 → clamped to 10.6 → `rounding: 'nearest'` → 11,
which is greater than the configured max.

## Evidence

- `src/engine/calculators/statCalculator.ts:136-151` — clamp precedes round.
- Harmless for integer bounds (the common case); only fractional bounds expose it.

## Impact

A ruleset with fractional bounds gets values outside its own declared range. Unlikely with the
current sheet data, but it is a silent invariant break when it happens.

## Suggested direction

Re-clamp after rounding (round-then-clamp changes semantics for values near the bound; clamp →
round → clamp is the conservative fix), or document the ordering as intended next to the code.
Add a fractional-bound case to the calculator tests either way.
