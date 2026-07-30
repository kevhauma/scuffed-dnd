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

- [ ] Every `/config/*` route renders its panel(s) as listed above; no `/config/*` route still shows placeholder copy.
- [ ] Focus-stat configuration is reachable from the UI, and the chosen home (own route vs. dashboard section) is recorded on this ticket.
- [ ] `/config` no longer renders the skills panels, and still shows the initialise-configuration empty state when no configuration exists.
- [ ] Route components contain no store access beyond what the panel needs and no business logic (Req 19.4).
- [ ] Every panel renders without a runtime error against both an empty configuration and a populated one.
- [ ] Any defect found while mounting is fixed or ticketed, with the ticket linked from the Notes here.
- [ ] Unit tests cover: each route's component renders its panel (shallow is fine — the panels have their own tests).
- [ ] Verified via the fallow skill and the react-conventions skill.
- [ ] Verified live in the browser: initialise a configuration, then visit all six config routes plus the focus-stat home and confirm each renders its real panel with working add/edit/delete.

## Notes

- Take this early — it is small, unblocks manual verification of everything §11 built, and every
  later UI ticket is easier once the config side is actually usable.
- The placeholder route files also carry stock-palette classes (`text-gray-600`) — replacing the
  body with a panel removes most of that; whatever page wrapper remains is
  [TICKET-POL-01](./TICKET-POL-01-route-layer-theme-and-composition.md)'s job, so don't gold-plate
  the wrapper here.
- Navigation to these routes doesn't exist yet either — the shell has two links (`/config`,
  `/play`). Per-mode navigation is [TICKET-NAV-01](./TICKET-NAV-01-root-layout-and-mode-switching.md);
  until it lands, the routes are reachable by URL.
