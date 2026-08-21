# CR-12 — `characterStore.updateCharacter` accepts an arbitrary unguarded `Partial<Character>`

**Severity:** Medium · **Area:** character store · **Type:** anti-pattern / latent bug

## Summary

`updateCharacter` merges any `Partial<Character>` into a character with no guard on `experience`
(which the interface's own comment forbids other writers for), no `validateStatAllocation` on
`investedStatPoints` patches, and no protection of `id`/`configurationId`/`createdAt`. It
currently has zero non-test callers, so it is an unguarded loaded gun rather than an active bug.

## Evidence

- `src/stores/characterStore.ts:417-426` — the action.
- `Character` interface line 121: "level derives from this, so nothing else may write it"
  (about `experience`) — `updateCharacter` can write it freely.
- The allocation budget refusal is enforced in `setInvestedStatPoints`
  (`characterStore.ts:603`) and `createCharacter` (`:408`), whose comments claim the rule "has
  one home" — `updateCharacter` bypasses that home.
- Grep confirms zero non-test call sites.

## Impact

The first future caller (a rename feature, a notes field) gets a footgun that can corrupt
identity fields, break the XP invariant, or bypass the stat-budget refusal — all while looking
like the obvious API to use.

## Suggested direction

Either delete it until needed, or narrow it: accept only the safely-patchable fields
(`Pick<Character, 'name' | …>`), and route `experience`/`investedStatPoints` writes through their
guarded actions. Deleting is cheapest; the store's other actions cover every current need.
