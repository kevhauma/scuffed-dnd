# CR-14 — The creation wizard runs the full engine on every keystroke of every step

**Severity:** Medium · **Area:** play (character creation) · **Type:** performance / missed pattern

## Summary

`useCharacterCreation` subscribes to the whole form with an unmasked `form.watch()` and calls
`validateStatAllocation` and `calculateCharacter` unmemoized on every render — so typing the
character's *name* on step 0 recomputes all derived stats, the allocation budget, and the preview.

## Evidence

- `src/components/play/creation/useCharacterCreation.ts:114` — `form.watch()` with no field mask
  re-renders on any field change.
- `:174` — `validateStatAllocation` runs on each render.
- `:229` — `calculateCharacter` called inside an unmemoized IIFE.
- Contrast `src/components/play/sheet/useCharacterSheet.ts:389`, which wraps the same
  `calculateCharacter` call in `useMemo` — the codebase already knows the right pattern.

## Impact

No user-visible breakage today (the engine is fast at current ruleset sizes), but it scales with
ruleset complexity — every stat formula, curve lookup, and skill computation per keystroke — and
it is a divergence between two sibling hooks doing the same job.

## Suggested direction

Mask the watch to the fields each computation actually reads (`form.watch(['stats', …])` or
`useWatch` per field group), and wrap `calculateCharacter`/`validateStatAllocation` in `useMemo`
keyed on their inputs, matching `useCharacterSheet`.
