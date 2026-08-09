# TICKET-IO-03 — Clean break: detect and reject v1 data with a clear notice

- **Area:** Import/export & storage
- **Type:** Feature (executes the milestone's clean-break decision)
- **Traceability:** v2.0 overview decision "Clean break on persisted data" (2026-08-03)

## User story

As a User opening the app after the v2 upgrade, I want to be told plainly that my old saved data
can't be loaded — with a backup offer — rather than a crash, a blank app, or a silent misload.

## Description

STAT-01 makes the persisted shapes incompatible with v1 and the User chose a clean break over a
converter. A clean break still has UX: old data must be recognized and refused with options,
never misparsed or silently overwritten.

## Current situation (as-is)

- [`storage.ts`](../../../src/services/storage.ts) parses whatever is stored and returns it;
  nothing checks shape or version (`Configuration.version` has never been read).
- [`importExport.ts`](../../../src/services/importExport.ts)'s validation knows only the v1
  structure; [`useAppHydration`](../../../src/components/shared/useAppHydration.ts)'s only failure
  surface is storage being *unavailable*.

## Desired result (to-be)

- **Load path branches on `schemaVersion`:** v2 loads; recognizably-v1 data is **not loaded and
  not deleted** — a notice explains what was found and offers a raw-JSON backup download and an
  explicit, confirmed start-fresh (only that confirmation clears the keys; until then the default
  config lives in memory without persisting over the old data). Corrupt data keeps the existing
  `StorageParseError` path.
- **Importing a v1 JSON file is refused before anything applies**, with a version-specific
  message distinct from the generic invalid-file rejection; characters follow the configuration's
  verdict.
- **Export writes the v2 shape** including `schemaVersion`; the export → import round-trip test
  is updated, not weakened.

## Acceptance criteria

- [x] Three load branches tested; the v1 branch leaves LocalStorage byte-identical after hydration and rendering. (`useAppHydration.test.tsx` → "the three load branches (TICKET-IO-03)": current data loads, older data is refused with no `loadCharacters` call and no `clearAllData`, corrupt data keeps `storageError` with `incompatibleData` null. Byte-identity at the storage layer: `storage.test.ts` → "leaves the refused ruleset byte-identical in storage (TICKET-IO-03)". Nothing renders above the notice — `__root.test.tsx` → "should replace the routed content when the stored data cannot be opened" asserts no `<Outlet />`.)
- [x] Backup downloads the untouched blob; start-fresh requires confirmation and goes through a store action. (`importExport.test.ts` → "downloadStoredBackup (TICKET-IO-03)" reads the blob back and finds the stored strings spliced in verbatim, ugly spacing and all; the confirm step is `IncompatibleDataNotice.test.tsx` → "should not delete anything until the User confirms"; the deletion is `configStore.discardStoredData`, tested in `configStore.test.ts` → "discardStoredData (TICKET-IO-03)". The hook calls the action, never `clearAllData`.)
- [x] Import rejection: v1 file (version message), corrupt file (generic), valid v2 file (applies) — three distinct tests. (`importExport.test.ts` → "the clean break on imported files (TICKET-IO-03)": five tests covering the three cases plus a future `schemaVersion` and the export round-trip. Panel level: `ConfigTransferPanel.test.tsx` → "should refuse a file from the old app with one version message (TICKET-IO-03)" — exactly one list item, versus the structurally-invalid file's many.)
- [x] No code path persists a v2 default over unconfirmed v1 data (test). (`useAppHydration.test.tsx` → "never persists a fresh configuration over unconfirmed older data": `saveConfiguration` uncalled, `isLoaded` still false. Structurally guaranteed too — `RootLayout` returns the notice *instead of* `<Outlet />`, so `initializeConfig`'s only caller, `useConfigDashboard`, cannot mount.)
- [x] Notice UI composes `ui/` primitives via the existing hydration surface, theme tokens only. (`IncompatibleDataNotice.tsx` composes `Card`/`Text`/`Button` and owns its own layout classes; no raw hex or stock palette — `yarn run lint` and the conventions review are clean on it.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill. (verifier: 1141 passing / 0 failing / 0 skipped, tsc at the documented 2-error baseline, lint clean. `fallow review` findings acted on — `downloadBlob` made module-private; the remaining clone group is the pre-existing speciality/combat validation pair that SKL-02 and ROLL-05 retire. conventions-reviewer's five findings all applied: backup assembly moved into `services/importExport.ts`, corrupt-blob guard added, `INCOMPATIBLE_DATA_MESSAGE` made private, `createFreshConfiguration` reads `SUPPORTED_SCHEMA_VERSION`, redundant `p-6` dropped.)
- [ ] Verified live in the browser: plant v1 data, reload, take both notice paths. — **not run**: the User asked for no browser verification on this run. Left open rather than ticked.

## Notes

- Immediately after STAT-01, so no intermediate build misloads old data. Later v2 tickets keep
  evolving the shape within `schemaVersion: 2` — don't mint per-ticket versions.
- `Configuration.version` stays as the ruleset's own display version; `schemaVersion` is the
  machine one.

## Implementation notes

1. **`SUPPORTED_SCHEMA_VERSION` lives in `types/config.ts`**, not in either service. Both
   `storage.ts` and `importExport.ts` gate on it, and putting it in one service would have made
   the other import it — which means a test mocking the first silently changes what the second
   considers current. `createFreshConfiguration` reads it too, so the number is written once.
2. **The backup file is assembled by string concatenation, not `JSON.stringify`.** Each stored
   value is spliced in verbatim, so the User's bytes are the file's bytes; a value that does not
   parse is embedded as a JSON string instead, because the one file the User is told to keep must
   itself parse. That corrupt case is reachable — the refusal branch validates the configuration
   and never looks at the characters.
3. **A v1 import is a `SchemaVersionError`, not a `ValidationError`.** Thrown before
   `validateConfiguration` runs, so the User gets one sentence about the file being from the old
   app rather than thirty missing-field complaints that read like a corrupt export.
4. **Sheet-import fragment: nothing to land.** No persisted shape changed —
   `schemaVersion: 2` has been in `docs/imports/ducklets.json` and in
   `scripts/build-sheet-import.mjs` since STAT-01, so the corpus already passes the new gate
   (`src/services/sheetImport.test.ts` green).
5. **Left out of scope, worth a later ticket:** `loadCharacters` still drops v1-shaped characters
   silently when `loadConfiguration` did *not* throw — an absent config key, or a v2 config beside
   a v1 characters key. Those Users get no notice and no backup offer. That filter is STAT-01
   behaviour and the fix wants its own ticket; naming it here so it is not mistaken for covered.
