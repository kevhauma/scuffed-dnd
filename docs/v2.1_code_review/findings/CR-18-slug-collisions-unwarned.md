# CR-18 — Slug collisions are the collisions that matter, and nothing warns about them

**Severity:** Medium · **Area:** engine (validator + formula references) · **Type:** missing validation

## Summary

The near-duplicate skill warning compares `trim().toLowerCase()`, but formula resolution compares
`memberSlug`. Names that differ under the first comparison can collide under the second — and
formulas then silently resolve first-wins with no warning anywhere. Stats have first-wins slug
resolution too, and no near-duplicate check at all.

## Evidence

- `nearDuplicateSkillNameWarnings` (`src/engine/validator.ts:485-519`) — lowercase comparison.
- Slug resolution: `src/engine/formula/references.ts:110-117` (`memberSlug`);
  `skills.fire_making` answers the first match, `src/engine/formula/skills.ts:45-49`.
- Example: `Fire making` vs `Fire-making` — different lowercased strings (no warning), identical
  slug `fire_making`.
- Stats: same first-wins (`src/engine/formula/stats.ts:39-43`, `buildReferenceIndex`) with no
  near-duplicate check at all.
- Note: intentional duplicate skill spellings exist in the real sheet (`skinning`/`Skinning`,
  per CLAUDE.md) — first-wins is the *documented* contract; the gap is that nothing tells the
  User when a collision forms.

## Impact

A User renames a skill and a formula elsewhere silently switches to answering a different skill —
no error chip, since resolution succeeds. Wrong numbers with no signal.

## Suggested direction

Warn on **slug** collisions, not lowercase collisions: compute `memberSlug` for each skill/stat
name and report groups that collide, naming which entity wins. Keep first-wins behavior (it's
documented and the sheet depends on it); the deliverable is visibility, not refusal.
