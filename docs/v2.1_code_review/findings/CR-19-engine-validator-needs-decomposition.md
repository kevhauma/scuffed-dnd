# CR-19 — `engine/validator.ts` `validateConfiguration` is one 392-line function (cyclomatic 62)

**Severity:** Medium · **Area:** engine (validator) · **Type:** maintainability
**Static signal:** worst complexity hotspot in the repo (cyclomatic 62, cognitive 109, fallow "critical")

## Summary

`validateConfiguration` spans `src/engine/validator.ts:85-476` as a single function. The newer
half already demonstrates the right shape — extracted helpers returning `ValidationIssue[]` —
while the older half is still inline. The fix is mechanical and behavior-preserving.

## Evidence

- Already-extracted helpers (the pattern to follow): `curveTableErrors`, `generatorErrors`,
  `reverseColumnErrors`, `diceLadderErrors`, `rollDefinitionErrors`,
  `nearDuplicateSkillNameWarnings`.
- Still inline: stat formulas (102-118), skills (122-168), materials (198-254), items (257-299),
  races (303-316), archetypes (319-391), currency tiers (394-416), abbreviation uniqueness
  (421-444).

## Impact

Every new entity type grows the function; reviewing a change to one entity's rules means paging
through all of them. The complexity score also masks real bugs living inside it
([CR-01](CR-01-circular-formula-detection-dead-in-production.md) sat in this file).

## Suggested direction

Extract each inline block to the same `(config) => ValidationIssue[]` helper signature and reduce
`validateConfiguration` to concatenation. No behavior change; the existing validator tests are the
safety net. Good first candidate for a small DX ticket since it touches nothing user-visible.

## Related

- [CR-38](CR-38-stale-combat-skill-copy.md) — the abbreviation-uniqueness block carries a stale
  "Duplicate skill code" message; fix while extracting.
