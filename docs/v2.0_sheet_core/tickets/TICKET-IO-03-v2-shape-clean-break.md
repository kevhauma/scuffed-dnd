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

- [ ] Three load branches tested; the v1 branch leaves LocalStorage byte-identical after hydration and rendering.
- [ ] Backup downloads the untouched blob; start-fresh requires confirmation and goes through a store action.
- [ ] Import rejection: v1 file (version message), corrupt file (generic), valid v2 file (applies) — three distinct tests.
- [ ] No code path persists a v2 default over unconfirmed v1 data (test).
- [ ] Notice UI composes `ui/` primitives via the existing hydration surface, theme tokens only.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.
- [ ] Verified live in the browser: plant v1 data, reload, take both notice paths. (Ask the User first per CLAUDE.md.)

## Notes

- Immediately after STAT-01, so no intermediate build misloads old data. Later v2 tickets keep
  evolving the shape within `schemaVersion: 2` — don't mint per-ticket versions.
- `Configuration.version` stays as the ruleset's own display version; `schemaVersion` is the
  machine one.
