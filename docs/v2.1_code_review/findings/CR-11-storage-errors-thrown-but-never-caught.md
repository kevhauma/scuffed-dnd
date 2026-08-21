# CR-11 — Storage quota/write errors are thrown but never caught anywhere

**Severity:** Medium · **Area:** services (storage) + all stores · **Type:** missing error handling

## Summary

`saveConfiguration`/`saveCharacters` throw `StorageQuotaError`/`StorageError` on failure, but no
non-test app code catches them. Every store action calls `autoSave` unguarded, so on quota
exhaustion the exception escapes the Zustand action into the React event handler: the edit
silently doesn't land and the user gets no feedback.

## Evidence

- `src/services/storage.ts:69,172` — the throw sites.
- Grep across `src/` confirms zero non-test `catch` consumers of either error class.
- Store actions (e.g. throughout `src/stores/configStore.ts` and
  `src/stores/characterStore.ts`) call `autoSave` with no guard.
- One thing done right: the throw happens **before** `set`, so memory and disk stay consistent —
  the action fails atomically. Only the *surfacing* is missing.

## Impact

On a full LocalStorage (large rulesets, many characters), every edit silently vanishes. The error
classes built for Requirement 17.x are dead weight. Ordinary users have no path to discover why
their changes don't stick.

## Suggested direction

Catch storage errors at one choke point (the `autoSave` helpers in each store), route them to a
visible surface (the uiStore already exists for exactly this kind of session state — a dismissible
"changes are not being saved: storage full" banner), and keep the throw-before-`set` ordering.

## Related

- [CR-05](CR-05-characters-silently-deleted-on-load.md) — the other half of storage-failure
  surfacing.
