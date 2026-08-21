# CR-05 — Characters can be silently and permanently deleted on load

**Severity:** High · **Area:** services (storage) + character store · **Type:** data-loss bug

## Summary

`loadCharacters` silently drops any stored character missing `investedStatPoints`,
`currentResourceValues`, or a finite `experience`. The very next `autoSave` persists the filtered
array, permanently deleting those characters — no notice, no backup offer. This is the exact
asymmetry the configuration path was explicitly built to avoid.

## Evidence

- `src/services/storage.ts:205-210` — the load-time filter that drops characters.
- `src/stores/characterStore.ts:366-369` — `autoSave` persists whatever is in memory, so the first
  action after load writes the filtered array back.
- Contrast the config path: `StorageSchemaError` **refuses** to load unrecognized data, offers a
  byte-exact backup via `downloadStoredBackup`, and clears only on confirmed `discardStoredData`.
- The code's own comment admits the `schemaVersion` gate "does not cover" the
  characters-beside-a-fresh-config case — which is precisely the case where this silent wipe
  fires.

## Impact

Any schema drift in the characters payload (a future field added without a default, a manual
LocalStorage edit, a partial write) destroys player characters irreversibly on the next session.
Characters are the user's most expensive-to-recreate data.

## Suggested direction

Give characters the same refusal discipline the configuration already has: on unrecognized
character shapes, refuse to load (or quarantine the raw payload), surface the problem, and offer
the backup download before anything overwrites the stored bytes. Filtering is only acceptable if
the dropped originals are preserved somewhere recoverable.

## Related

- [CR-11](CR-11-storage-errors-thrown-but-never-caught.md) — the storage error classes that exist
  for exactly this kind of surfacing are currently dead weight.
