# CR-17 — Store actions enforce no uniqueness, so a bypassed UI check breaks export→import round-trips

**Severity:** Medium · **Area:** config store + engine validator · **Type:** invariant gap

## Summary

The store accepts duplicate stat `abbreviation`s, duplicate constant/curve `name`s, and even
duplicate entity **ids** (checked by neither validator). The UI managers do enforce name and
abbreviation uniqueness, but that is exactly the "advisory check in the UI … that can be bypassed"
which the store's own `guardedDelete` docstring rejects as insufficient for deletes. The
consequence when bypassed: the app saves and engine-validates a ruleset that its own **import**
then refuses — an export that can't round-trip.

## Evidence

- `src/stores/configStore.ts:607-616` (`addStat` and siblings) — no uniqueness checks.
- UI-side advisory checks: `useStatManager.ts:237`, `useConstantManager.ts:122`,
  `useCurveManager.ts:139`.
- The store's own standard for invariants: `configStore.ts:478` (`guardedDelete` docstring).
- Engine validator checks abbreviation duplicates but **not** constant/curve name duplicates
  (`src/engine/validator.ts:421-444`); neither validator checks id duplicates.
- Import *does* enforce uniqueness (`src/services/importExport.ts:504-510`), creating the
  round-trip asymmetry.

## Impact

Any non-dialog write path (a future bulk action, a test, direct store use) can persist a ruleset
that exports fine and then refuses to import. Duplicate names also interact with first-wins
formula resolution ([CR-18](CR-18-slug-collisions-unwarned.md)) to make formulas silently bind to
the "wrong" entity.

## Suggested direction

Move the uniqueness invariants into the store actions (the project's stated home for invariants),
mirroring `guardedDelete`'s pattern: action refuses with a typed result, UI renders the refusal.
Align the engine validator to check the same set (constant/curve names, ids), so store, engine,
and import agree on what a valid ruleset is.
