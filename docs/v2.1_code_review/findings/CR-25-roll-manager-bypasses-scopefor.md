# CR-25 — `useRollManager` hand-builds autocomplete codes instead of using `scopeFor`

**Severity:** Medium · **Area:** config components (rolls) · **Type:** divergent implementations of one purpose

## Summary

The roll editor builds its formula-autocomplete list via
`config.stats.map((stat) => stat.abbreviation.toUpperCase())` instead of
`scopeFor(config, 'roll-input')` — the exact divergence `useStatManager` documents as its reason
for using `scopeFor`. A new row in the scoping table would update the preview and validator but
not this editor's completions.

## Evidence

- `src/components/config/rolls/useRollManager.ts:57-59` — the hand-built list.
- `src/components/config/stats/useStatManager.ts:114-117` — documents why scope must come from
  `scopeFor`, not be derived by hand.
- `'roll-input'` already exists in `src/engine/formula/scoping.ts:71`.

## Impact

Autocomplete silently drifts from what the validator accepts: the editor suggests a subset (or
wrong set) of what formulas may legally reference, precisely the class of preview/engine mismatch
that [CR-02](CR-02-stat-formulas-accept-skills-they-cannot-evaluate.md) shows is dangerous.

## Suggested direction

Replace the map with `scopeFor(config, 'roll-input')`. One-line fix; consider a lint-style grep
in review for any other hand-derived scope lists.
