# TICKET-IO-02 — Export, import and rename the configuration from config mode

- **Area:** Import/export
- **Type:** Feature
- **Traceability:** Requirements 1.4, 1.5, 1.6, 1.1, 18.5, 21.1-21.5
- **Replaces plan items:** tasks.md §15.1, §15.2

## User story

As a User, I want to export my ruleset to a file, import one back, and give it a name I chose, so
that I can move a ruleset between browsers and keep spares without the app holding more than one.

## Description

Import and export are the app's answer to "more than one ruleset" — the settled decision is that
the Application holds exactly one at a time and files on disk are how you keep others. The whole
service exists and no button calls it. This ticket puts export, import and rename on the config
dashboard.

## Current situation (as-is)

- [`services/importExport.ts`](../../../src/services/importExport.ts) is complete and tested:
  `exportConfiguration(config): Blob`, `downloadConfiguration(config, filename?)`,
  `validateConfiguration(data): ValidationResult`, `importConfiguration(json)` and
  `importConfigurationFromFile(file)`, with `ImportExportError` / `ValidationError` carrying the
  reasons. **Nothing in `src/components/` or `src/routes/` calls any of it.**
- [`useConfigStore`](../../../src/stores/configStore.ts) has `initializeConfig(name)` and
  `loadConfig()`, and a CRUD action per entity — but **no action that replaces the whole
  configuration**, which is what applying an import means, and **no action that renames one**.
  `config.name` is set once at initialisation and hardcoded to `'My Custom Game System'` by
  [`ConfigDashboard`](../../../src/components/config/dashboard/ConfigDashboard.tsx).
- The dashboard now has a Validation card and a `useConfigDashboard` hook
  ([TICKET-VAL-01](./TICKET-VAL-01-config-dashboard-validation-status.md)), which is the surface
  these three actions belong beside.
- `importConfiguration` validates **structure** (required fields and types), while
  `engine/validator.ts` validates **references** (formula codes, slot types, categories, cycles).
  They are different checks and both matter on import — the second is what catches a cycle that no
  save dialog could.

## Desired result (to-be)

- Config mode offers **Export**, which downloads the current configuration as JSON via
  `downloadConfiguration()` (Req 1.4).
- Config mode offers **Import**, which reads a chosen `.json` file, validates it, and applies it
  (Req 1.5, 1.6). A file that fails validation is **not** applied and every reason is shown.
- Importing replaces the configuration through a new store action, so persistence stays in the
  store.
- Importing shows a confirmation first, because it discards the current ruleset.
- After a successful import, the reference validation from `engine/validator.ts` runs so an
  imported ruleset that parses but does not hang together is reported immediately.
- The configuration can be **renamed**, replacing the hardcoded `'My Custom Game System'` as the
  only name a ruleset can ever have (Req 1.1, and the export filename derives from it).

## Acceptance criteria

- [x] An Export action downloads the current configuration as JSON through
      `downloadConfiguration()` (Req 1.4); the component builds no Blob and touches no URL API
      itself. ([`ConfigTransferPanel.tsx`](../../../src/components/config/dashboard/ConfigTransferPanel.tsx) → `handleExport` in [`useConfigTransfer.ts`](../../../src/components/config/dashboard/useConfigTransfer.ts), one call to the service. Test *"should export the current configuration through the service"* asserts it was called exactly once with the ruleset named `Test Config`; `grep` finds no `Blob`/`createObjectURL` in `src/components/`.)
- [x] An Import action accepts a `.json` file and applies a valid configuration (Req 1.5). (Test *"should apply a valid file to the store on confirmation"* — after choosing and confirming, the store holds `Imported Ruleset`.)
- [x] An invalid file is rejected with every validation error shown, and the existing configuration
      is left untouched (Req 1.6) — asserted for malformed JSON and for structurally-invalid JSON. (Tests *"should reject malformed JSON without touching the current ruleset"* and *"should reject a structurally invalid file and list every reason"*. Both assert the store still holds `Test Config`; the second asserts **more than one** `listitem`, so a single-error shortcut would fail it.)
- [x] Importing goes through a new `useConfigStore` action that replaces and persists the
      configuration; no component calls `saveConfiguration()` or `localStorage`. (New `replaceConfig(config)` in [`configStore.ts`](../../../src/stores/configStore.ts), persisting via the existing `autoSave`. Store test *"should replace the whole configuration and persist it"*. `grep -rn "saveConfiguration\|localStorage" src/components/` finds nothing outside `vi.mock` blocks.)
- [x] Import asks for confirmation before discarding the current ruleset, and cancelling leaves it
      in place. (A `Dialog` naming both the incoming file and the ruleset it replaces. Tests *"should ask before replacing the current ruleset"* (the store is unchanged while the dialog is open) and *"should leave the ruleset untouched when the import is cancelled"*.)
- [x] After a successful import the reference validation runs and its report is shown, so a cycle
      or a dangling reference that arrived by file is reported at once (Req 18.5). (`handleConfirmImport` runs `engine/validator.ts`'s `validateConfiguration` on what it just applied. Tests *"should report reference problems in an imported ruleset without refusing it"* (a stat formula naming `WIS`: the ruleset **is** applied and `WIS` is named on screen) and *"should confirm a clean import found no issues"*.)
- [x] The configuration can be renamed, and the new name is persisted through a store action and
      used by the export filename (Req 1.1). (New `renameConfig(name)` store action. Tests *"should rename the configuration through the store"* (`Grimdark Hollow` lands in the store) and *"should refuse to rename to an empty name"* (the button is disabled and nothing changes), plus store tests *"should rename the configuration without touching anything else"* and *"should ignore a rename when there is no configuration"*. The filename follows because `downloadConfiguration` already derives it from `config.name`.)
- [x] Feature components compose `components/ui` primitives and own their layout; no base component
      gains layout styling (Req 21.1-21.5). Medieval theme tokens only. (`Card`, `Button`, `Dialog`, `FormField`, `Text`, `ValidationReport`. **One deliberate exception**, documented in the component's JSDoc: `<input type="file">` cannot be styled and has no primitive, so it is `sr-only` and driven from a `Button` — every control the User sees is still a base component. No file under `components/ui/` was touched.)
- [x] Unit tests cover: export calls the service with the current configuration; a valid file is
      applied to the store; malformed JSON is reported and applies nothing; a structurally invalid
      file is reported and applies nothing; cancelling the confirmation applies nothing; the
      post-import reference report is shown; rename persists through the store. (+14 tests: `ConfigTransferPanel.test.tsx` (11) and 3 in `configStore.test.ts`. Suite: **624 passing, 0 failing, 0 skipped** (was 610).)
- [x] Verified via the fallow skill and the coding-conventions skill. (`fallow audit --base HEAD` → `"verdict": "pass"`, 0 introduced findings of every kind. Lint initially showed 26 warnings against the documented 23 — three `noNonNullAssertion` from `!` in the new store tests. Fixed at the source (an explicit throw, and optional chaining in the assertions) rather than rebaselined; `yarn run lint` is back to 35 errors / 23 warnings and `npx tsc --noEmit` to the documented 9.)
- [ ] Verified live in the browser: export a ruleset, edit it, import the file back, and see the
      original restored. — **left open at the User's request** (2026-08-01: "don't browser check").
      **This is the one ticket where that gap has real weight:** `downloadConfiguration` uses
      `URL.createObjectURL` and a synthetic click, which jsdom does not implement, so the tests stop
      at "the service was called with the right ruleset". That a file actually lands on disk is
      unverified.

## Notes

- **This closes the "one configuration at a time" decision** recorded in
  [overview.md](../overview.md#spec-decisions-answered-2026-07-30): no picker, no configuration
  list. The rename field is the part of that decision that was explicitly deferred to this work.
- A file input cannot be styled and has no base-component equivalent. Keep the raw `<input
  type="file">` **visually hidden** and drive it from a `Button` via a ref, so the visible control
  is still a base component. Note it in the component's JSDoc — it is the one raw control in the
  feature layer and it is deliberate.
- `downloadConfiguration` uses `document.createElement`, `URL.createObjectURL` and a click. In
  jsdom `URL.createObjectURL` is not implemented, so the export test should assert **the service
  was called with the current configuration**, mocking the service — not that a file appeared.
- Import validation is two-stage on purpose: structural (`services/importExport.ts`, blocking) then
  referential (`engine/validator.ts`, reported). A referentially-broken ruleset is still applied —
  it is the User's ruleset to fix, and refusing it would leave them unable to repair a file in the
  app. Structurally invalid data is refused outright, because it cannot be rendered at all.
