# TICKET-NAV-02 — Mount the configuration panels on their routes

- **Area:** Navigation and layout
- **Type:** Bug fix
- **Traceability:** Requirements 19.4, 3.1, 6.1, 7.1, 8.1, 9.1, 10.1
- **Replaces plan items:** tasks.md §13.2

## User story

As a User, I want each configuration section to open on its own page, so that I can actually reach
the stats, materials, items, races, currency, and focus-stat tools that exist.

## Description

Task §11 is checked off and shipped eight configuration panels — and six of them are unreachable in
the running app. Every `/config/*` route except the dashboard is still the scaffold placeholder, so
`StatsConfigPanel`, `MaterialsConfigPanel`, `ItemsConfigPanel`, `EquipmentSlotsConfigPanel`,
`RacesConfigPanel`, `CurrencyConfigPanel`, and `FocusStatConfig` render nowhere. This is the
cheapest ticket in the backlog and it turns roughly a third of the codebase from dead code into a
usable app.

## Current situation (as-is)

- [`/config/index.tsx`](../../../src/routes/config/index.tsx) is the only wired route. It hydrates
  the store, offers "Initialize New Configuration", and renders `MainSkillsPanel`,
  `SpecialitySkillsPanel`, and `CombatSkillsPanel` — i.e. the **skills** panels live on the
  dashboard, not on `/config/skills`.
- [`/config/skills.tsx`](../../../src/routes/config/skills.tsx),
  [`stats.tsx`](../../../src/routes/config/stats.tsx),
  [`materials.tsx`](../../../src/routes/config/materials.tsx),
  [`items.tsx`](../../../src/routes/config/items.tsx),
  [`races.tsx`](../../../src/routes/config/races.tsx), and
  [`currency.tsx`](../../../src/routes/config/currency.tsx) each render a heading and a
  "will appear here" paragraph. None imports a component.
- `FocusStatConfig` and `ConversionCalculator` have no route at all — no `/config/focus` exists,
  and the plan never assigned focus-stat configuration a page (§13.2 lists six routes).
- Consequence: the 48 failing tests aside, the panels have **never been exercised in a browser**,
  so this ticket is likely to surface real defects in code that is currently marked done.

## Desired result (to-be)

- Each `/config/*` route renders its panel(s):
  - `/config/skills` → `MainSkillsPanel` + `SpecialitySkillsPanel` + `CombatSkillsPanel`
  - `/config/stats` → `StatsConfigPanel`
  - `/config/materials` → `MaterialsConfigPanel`
  - `/config/items` → `ItemsConfigPanel` + `EquipmentSlotsConfigPanel`
  - `/config/races` → `RacesConfigPanel`
  - `/config/currency` → `CurrencyConfigPanel`
- Focus-stat configuration gets a home — either its own `/config/focus` route or a section of the
  dashboard. Decide and record which; it must be reachable from navigation either way.
- `/config` becomes a dashboard again rather than the skills page: it keeps the
  "no configuration yet" empty state and the initialise action, and stops rendering the three
  skills panels (they now live on `/config/skills`).
- Route components stay thin — mount the panel, nothing else. No store logic, no layout beyond a
  page wrapper.
- Any defect surfaced by a panel finally rendering is either fixed here if trivial, or captured as
  its own ticket with a link from this one. Don't silently leave a broken panel mounted.

## Acceptance criteria

- [x] Every `/config/*` route renders its panel(s) as listed above; no `/config/*` route still shows placeholder copy. (All six placeholder route files rewritten to thin mounts — [skills.tsx](../../../src/routes/config/skills.tsx), [stats.tsx](../../../src/routes/config/stats.tsx), [materials.tsx](../../../src/routes/config/materials.tsx), [items.tsx](../../../src/routes/config/items.tsx), [races.tsx](../../../src/routes/config/races.tsx), [currency.tsx](../../../src/routes/config/currency.tsx). Test `no config route renders the scaffold placeholder copy` in [configRoutes.test.tsx](../../../src/routes/config/configRoutes.test.tsx) asserts the old copy is gone.)
- [x] Focus-stat configuration is reachable from the UI, and the chosen home (own route vs. dashboard section) is recorded on this ticket. (**Decision: its own `/config/focus` route** — see Notes. New [focus.tsx](../../../src/routes/config/focus.tsx); reachable from the `/config` dashboard's "Focus Stat" card. Browser: clicking that card lands on `/config/focus` rendering `FocusStatConfig`.)
- [x] `/config` no longer renders the skills panels, and still shows the initialise-configuration empty state when no configuration exists. ([index.tsx](../../../src/routes/config/index.tsx) — the three `*SkillsPanel` imports are gone, replaced by a seven-card section index. Browser: with LocalStorage empty, `/config` rendered "No Configuration Found" + "Initialize New Configuration"; after clicking it, the dashboard listed the seven section links and no skills panel.)
- [x] Route components contain no store access beyond what the panel needs and no business logic (Req 19.4). (All seven panel routes are a wrapper `div` + panel imports only — no `useConfigStore`, no handlers. **Exception, by design:** `/config/index.tsx` keeps `loadConfig`/`initializeConfig`, which the ticket's to-be explicitly requires it to keep; the `loadConfig` hydration effect predates this ticket and belongs to [TICKET-IO-01](./TICKET-IO-01-restore-state-on-app-start.md).)
- [x] Every panel renders without a runtime error against both an empty configuration and a populated one. (Browser, empty config: all seven routes rendered their panels' empty states. Populated: added main skill STR/Might, stat `Health = STR * 10` (preview computed 100), race Elf with STR +2, material category Metals → material Iron, equipment slot Main Hand, item Iron Sword, currency tiers Copper/Silver, focus bonus 7. `read_console_messages` reported zero errors across the whole session.)
- [x] Any defect found while mounting is fixed or ticketed, with the ticket linked from the Notes here. (Two defects found and fixed here — see Notes. Both were real render-time bugs masked by the documented hooks-dispatcher test failures.)
- [x] Unit tests cover: each route's component renders its panel (shallow is fine — the panels have their own tests). ([configRoutes.test.tsx](../../../src/routes/config/configRoutes.test.tsx), 8 tests, all passing — one per route plus the placeholder-copy sweep. Panels are `vi.mock`ed; each page component is imported by name because automatic code splitting replaces `Route.options.component` with a lazy wrapper Vitest cannot resolve.)
- [x] Verified via the fallow skill and the react-conventions skill. (`fallow audit --base HEAD`: 0 dead code introduced, 0 complexity introduced after removing a needless `export` on `ConfigDashboard`; the one "introduced" duplication group is entirely inside the generated `src/routeTree.gen.ts`. `conventions-reviewer` found no hard-rule violations; its actionable findings — missing JSDoc header on `focus.tsx`, missing focus/hover affordance on the dashboard cards, redundant `p-6` on `Card`, half-closed barrel — were all applied.)
- [x] Verified live in the browser: initialise a configuration, then visit all six config routes plus the focus-stat home and confirm each renders its real panel with working add/edit/delete. (Dev server on :5173. Initialised a configuration, visited all seven routes. Add verified on skills/stats/races/materials/items/currency; edit verified on the main skill Strength→Might and on the focus bonus 0→7 (persisted to LocalStorage as `focusStatBonusLevel: 7`); delete verified by removing the Silver currency tier. No console errors. Screenshots were unavailable — the Browser pane was not displayed, so the page never composited frames — so the evidence is accessibility-tree and DOM-text reads rather than images.)

## Notes

### Focus-stat home: its own `/config/focus` route (decided 2026-07-31)

Not a dashboard section. Every other configuration area has its own page, so a seventh page is the
consistent shape; [TICKET-NAV-01](./TICKET-NAV-01-root-layout-and-mode-switching.md) can give it a
nav link alongside the rest; and the dashboard is slated to become validation status
(plan §17.2), which a settings form sitting in it would muddy.

### Defects found while mounting — both fixed here

Both were genuine render-time bugs, both invisible until now because the panels had never rendered
in a browser and their tests abort on the documented React 19 hooks-dispatcher failure before
reaching a render. Both also showed up as `tsc` errors that no one was measuring — see the
typecheck note below.

1. **`ConversionCalculator` crashed `/config/currency` whenever tiers existed.**
   [ConversionCalculator.tsx:80](../../../src/components/config/currency/ConversionCalculator.tsx)
   passed `<option>` children to `Select`, but
   [Select.tsx:41](../../../src/components/ui/Select/Select.tsx) only renders `options.map(...)`
   and ignores `children` — so `options` was `undefined` and `.map` threw. Fixed by passing
   `options={tiers.map(tier => ({ value: tier.id, label: tier.name }))}`. Verified live: with
   Copper and Silver configured, the calculator renders and converts (1 Copper = 0.01 Silver).
2. **`FocusStatConfig`'s bonus-level input stored the event object.**
   [FocusStatConfig.tsx:86](../../../src/components/config/focus/FocusStatConfig.tsx) wired a
   `(value: string) => void` handler straight to `Input`'s `onChange`, which forwards the native
   `ChangeEvent`, so `localValue` held an event and `Number.parseInt` on it was always `NaN`.
   Fixed with `onChange={(e) => handleChange(e.target.value)}`. Verified live: typing `7` updates
   the controlled input, the example preview reads "10 base + 7 focus bonus", and Save persists.

### Undocumented typecheck drift (not this ticket's to fix)

`npx tsc --noEmit` was **not** clean at `d92ca15` — it reported 16 errors, which
[TEST_STATUS.md](../../../TEST_STATUS.md) does not record and
[TICKET-DX-02](./TICKET-DX-02-reconcile-biome-with-the-codebase.md) assumes away. The two fixes
above cleared two of them, leaving **14**, all in files this ticket did not touch
(`BaseSkillPanel.tsx`, `evaluator.ts`, `ValidationReport.*`, and four test files missing jest-dom
matcher types). `TEST_STATUS.md` should gain a typecheck baseline so future tickets have a delta
to measure against.

### Incidental change: `routeFileIgnorePattern`

Colocating `configRoutes.test.tsx` under `src/routes/` made the TanStack route generator warn that
the file exports no `Route`. [vite.config.ts](../../../vite.config.ts) now passes
`tanstackStart({ router: { routeFileIgnorePattern: '\\.test\\.tsx?$' } })`, which covers every
future `src/routes/**/*.test.tsx` too.

- Take this early — it is small, unblocks manual verification of everything §11 built, and every
  later UI ticket is easier once the config side is actually usable.
- The placeholder route files also carry stock-palette classes (`text-gray-600`) — replacing the
  body with a panel removes most of that; whatever page wrapper remains is
  [TICKET-POL-01](./TICKET-POL-01-route-layer-theme-and-composition.md)'s job, so don't gold-plate
  the wrapper here.
- Navigation to these routes doesn't exist yet either — the shell has two links (`/config`,
  `/play`). Per-mode navigation is [TICKET-NAV-01](./TICKET-NAV-01-root-layout-and-mode-switching.md);
  until it lands, the routes are reachable by URL.
