# CR-06 — "Clear History" on one character's sheet wipes every character's roll history

**Severity:** High · **Area:** play (rolls) + uiStore · **Type:** correctness bug

## Summary

The rolls panel displays history filtered to the current character, but its "Clear History"
button calls a store action that empties the whole session history for every character.

## Evidence

- `src/components/play/rolls/useRoller.ts:92-95` — `history` is filtered by `characterId`
  (line 92), but `handleClearHistory` binds `uiStore.clearRollHistory`.
- `src/stores/uiStore.ts:137-139` — `clearRollHistory` does `set({ rollHistory: [] })` with no
  character scoping.

## Impact

A player clearing their own clutter silently destroys other characters' session history. Low data
value (session-only), but it's a scoping lie: the button acts on more than the panel shows.

## Suggested direction

Give `clearRollHistory` an optional `characterId` parameter (filter instead of replace-with-empty)
and pass the current character from `useRoller`. Keep the unscoped variant only if a global "clear
all" affordance actually exists somewhere.
