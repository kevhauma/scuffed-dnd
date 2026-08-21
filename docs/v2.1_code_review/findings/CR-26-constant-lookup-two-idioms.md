# CR-26 — Three constant-by-name readers, two idioms

**Severity:** Low · **Area:** engine (calculators) · **Type:** divergent implementations of one purpose

## Summary

Three places read a named constant with a default. One deliberately routes through
`constantsNamespace` so duplicate names resolve identically to formulas; the other two use bare
`.find`. Behaviorally identical today (both are first-wins), but the idioms can drift if
resolution rules ever change.

## Evidence

- `raceBlendDivisor` — `src/engine/calculators/statCalculator.ts:81-87` — via
  `constantsNamespace` (with a comment explaining why).
- `bonusDivider` — `src/engine/calculators/skillCalculator.ts:60-66` — bare `.find`.
- `pointsPerLevel` — `src/engine/skillAllocation.ts:82-90` — bare `.find`.

## Impact

Small today; becomes a real bug the day constant resolution gains a rule (e.g. a uniqueness fix
from [CR-17](CR-17-stores-enforce-no-uniqueness.md) or a warning from
[CR-18](CR-18-slug-collisions-unwarned.md)) that only one idiom picks up.

## Suggested direction

A small shared `namedConstant(constants, name, defaultValue)` helper that routes through the same
resolution the formula engine uses; collapse all three call sites onto it.
