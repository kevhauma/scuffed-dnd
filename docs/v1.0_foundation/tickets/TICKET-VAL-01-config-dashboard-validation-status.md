# TICKET-VAL-01 — Validation status and a "Validate Configuration" action on the config dashboard

- **Area:** Validation
- **Type:** Feature
- **Traceability:** Requirements 18.5, 18.6, 18.1, 18.2, 18.3, 18.4, 21.1-21.5
- **Replaces plan items:** tasks.md §17.2

## User story

As a User, I want to see whether my ruleset is valid and what is wrong with it, so that I can fix
problems before a Player builds a character on it.

## Description

The whole validation engine and a `ValidationReport` display primitive both exist, and nothing in
the app runs one or shows the other. This ticket puts a validation status and a "Validate
Configuration" action on the config dashboard.

## Current situation (as-is)

- [`validateConfiguration(config)`](../../../src/engine/validator.ts) returns a
  `ValidationReport` — `isValid`, `errors[]`, `warnings[]`, `timestamp` — covering formula
  references, circular dependencies, equipment slot types, material categories and currency tiers
  (Req 18.1-18.4). **It has no caller outside its own test.**
- The [`ValidationReport`](../../../src/components/ui/ValidationReport/ValidationReport.tsx) base
  component renders a list of issues grouped by severity with an empty state. **It has no caller
  either.**
- [`useUIStore`](../../../src/stores/uiStore.ts) already holds `validationReport`,
  `setValidationReport(report)` and `clearValidationReport()` — the session slot this belongs in.
  **No callers.**
- [`routes/config/index.tsx`](../../../src/routes/config/index.tsx) is the dashboard: a "no
  configuration" state with an initialise action, then a grid of links to the seven panels. It
  says nothing about whether the ruleset is sound.
- **Why this is still needed after
  [TICKET-FORM-01](./TICKET-FORM-01-block-circular-formulas-on-save.md):** that ticket guards the
  *save dialogs*. An imported configuration never passes through them, and per FORM-01's own
  implementation note a multi-formula cycle can only arrive that way. This is the check that
  catches it.
- The dashboard is currently a route component holding its own logic, which is the opposite of the
  convention everywhere else (`useXManager` hook + presentational component).

## Desired result (to-be)

- The dashboard shows the ruleset's validation status at a glance (Req 18.6) — valid, or the number
  of errors and warnings — without the User having to ask for it.
- A "Validate Configuration" action re-runs `validateConfiguration()` and displays the full report
  through the existing `ValidationReport` primitive (Req 18.5).
- The report is stored in `useUIStore` via `setValidationReport`, so it survives navigation within
  the session and is not recomputed on every render.
- Each issue names the entity it concerns, which the engine already provides.
- The route stays thin: the dashboard's state and handlers move into a
  `useConfigDashboard` hook and the markup into a `ConfigDashboard` feature component, matching
  every other panel in `components/config/`.

## Acceptance criteria

- [x] The config dashboard shows the current validation status whenever a configuration is loaded
      (Req 18.6). (A Validation card above the section grid, fed by `status` — a `useMemo` over `validateConfiguration` that recomputes whenever the ruleset changes. Tests *"should show the validation status without being asked"* ("This ruleset is valid.") and *"should show an error count for an invalid configuration without being asked"* (`1 error(s)`, and the valid message asserted **absent**). Neither test clicks anything.)
- [x] A "Validate Configuration" action runs `validateConfiguration()` and shows the resulting
      report (Req 18.5); the component implements no validation logic of its own. (`handleValidate` in [`useConfigDashboard.ts`](../../../src/components/config/dashboard/useConfigDashboard.ts) calls the engine and hands the result to the store; [`ConfigDashboard.tsx`](../../../src/components/config/dashboard/ConfigDashboard.tsx) only renders. Test *"should display a report when the User asks, even for a clean ruleset"*.)
- [x] The report renders through the existing `components/ui/ValidationReport` primitive rather than
      a second issue list. (`<ValidationReport issues={reportIssues} />`; the hook flattens the engine's `errors[]` + `warnings[]` into the flat list the primitive takes, leaving its contract untouched. The primitive's own "Validation Report" heading is what the test asserts.)
- [x] A valid configuration reports as valid; a configuration with a bad formula reference, a
      circular dependency, an unknown equipment slot type or an unknown material category reports
      the corresponding issue (Req 18.1-18.4) — one test per case, asserting the message reaches
      the screen. (Four tests: *"should report a formula reference to a skill that does not exist"* (`WIS`), *"should report a circular dependency between formulas"* (two speciality skills referencing each other), *"should report an item referencing an equipment slot type that does not exist"* (`feet`), *"should report a material referencing a category that does not exist"* (`ore`). Each asserts the offending name is on screen after validating.)
- [x] The report is held in `useUIStore` through `setValidationReport`, not in component state. (Test *"should store the report in the UI store rather than in component state"* — the store's `validationReport` is `null` before the click and `isValid: true` after. This is `setValidationReport`'s first caller.)
- [x] The dashboard's logic lives in a `useConfigDashboard` hook and its markup in a feature
      component under `components/config/`; the route file only mounts it. ([`routes/config/index.tsx`](../../../src/routes/config/index.tsx) is now four lines of mounting, matching `PlayIndex`. Its exported component was renamed `ConfigDashboard` → `ConfigIndex` to free the name for the feature component; `configRoutes.test.tsx`'s two hydration tests were updated and still pass.)
- [x] The existing dashboard behaviour is preserved: the loading state, the "no configuration"
      state with its initialise action, and the seven section links. (Tests *"should still show the loading state before hydration finishes"*, *"should still offer to initialize when there is no configuration"* (which also asserts the Validate button is **absent** there), and *"should still link to all seven configuration areas"*. The two pre-existing route tests — that the dashboard does not hydrate itself, and that it shows the empty state — still pass against `ConfigIndex`.)
- [x] Feature components compose `components/ui` primitives and own their layout; no base component
      gains layout styling (Req 21.1-21.5). Medieval theme tokens only. (`Card`, `Text`, `Button`, `ValidationReport`; no raw HTML control. No file under `components/ui/` was touched — `ValidationReport` already accepted `className`, which is how the `mt-4` is applied. Colours come from `Text` variants (`success`/`error`/`warning`).)
- [x] Unit tests cover: status shown for a valid configuration; status shown for an invalid one;
      the four issue categories each surfacing; the report landing in `useUIStore`; the
      no-configuration and loading states still render; the route mounts the component. (+11 tests in `ConfigDashboard.test.tsx`. Suite: **610 passing, 0 failing, 0 skipped** (was 599).)
- [x] Verified via the fallow skill and the coding-conventions skill. (`fallow audit --base HEAD` → `"verdict": "pass"`, 0 introduced findings. One was fixed rather than suppressed: `CONFIG_SECTIONS` was exported but imported nowhere, since the hook already exposes it as `sections` — made module-private. `npx tsc --noEmit` at the documented 9; `yarn run lint` at the documented 35 / 23.)
- [ ] Verified live in the browser: open `/config` with a ruleset that has a broken formula, run the
      validation, and read the issue. — **left open at the User's request** (2026-08-01: "don't
      browser check"). All four issue categories are asserted on the rendered screen by the tests
      above.

## Notes

- Validation is cheap and pure, so the *status* can be derived on render while the *report* is only
  written to the store when the User asks for it. Keep the two distinct: Req 18.6 is "view status at
  any time", Req 18.5 is "display a report".
- `ValidationReport`'s props take a flat `issues[]`, while the engine returns `errors[]` and
  `warnings[]` separately — concatenate at the call site; do not change the primitive's contract.
- This ticket does not add a validation gate anywhere. Nothing is blocked from saving or playing on
  an invalid ruleset; the User is told, and decides. Blocking is a separate decision.
- The dashboard refactor is in scope because the ticket has to add logic to that file, and adding it
  to a route component would entrench the exception. It is not a wider route-layer cleanup — that is
  [TICKET-POL-01](./TICKET-POL-01-route-layer-theme-and-composition.md).
