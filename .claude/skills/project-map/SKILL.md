---
name: project-map
description: Map of the Custom DnD Builder codebase — which route, store, engine module, service, or component lives where. Use to locate code before searching the codebase manually.
---

# Project Map

`src/` is layered bottom-up. Each layer may import from the ones above it in this list, never below:

```
types/       pure type definitions, no runtime code
engine/      formula parser/evaluator/validator + the derived-value calculators
services/    LocalStorage persistence, JSON import/export
stores/      Zustand: configStore, characterStore, uiStore
components/  ui/ (base primitives) → config/, play/, shared/ (feature components)
routes/      TanStack Router file-based routes
```

This file is hand-maintained and describes a moving codebase. Where it points at a barrel or a
folder rather than listing contents, follow the pointer — the barrel is the source of truth,
this map is the index.

## Routes

File-based via TanStack Router; `src/routeTree.gen.ts` is **generated — never edit it**.
`src/router.tsx` creates the router, `src/routes/__root.tsx` is the shell (nav + mode switcher).

| Route | File | State |
|---|---|---|
| `/` | `routes/index.tsx` | landing page, feature overview |
| `/config` | `routes/config/index.tsx` | dashboard: initialise-config empty state, then a card index linking the seven sections below |
| `/config/skills` | `routes/config/skills.tsx` | `MainSkillsPanel` + `SpecialitySkillsPanel` + `CombatSkillsPanel` |
| `/config/stats` | `routes/config/stats.tsx` | `StatsConfigPanel` |
| `/config/materials` | `routes/config/materials.tsx` | `MaterialsConfigPanel` |
| `/config/items` | `routes/config/items.tsx` | `ItemsConfigPanel` + `EquipmentSlotsConfigPanel` |
| `/config/races` | `routes/config/races.tsx` | `RacesConfigPanel` |
| `/config/currency` | `routes/config/currency.tsx` | `CurrencyConfigPanel` (which renders `ConversionCalculator` once tiers exist) |
| `/config/focus` | `routes/config/focus.tsx` | `FocusStatConfig` |
| `/play` | `routes/play/index.tsx` | **placeholder** — CharacterList is TICKET-CHAR-01 |
| `/play/create` | `routes/play/create.tsx` | **placeholder** — creation wizard is TICKET-CHAR-02 |
| `/play/character/$id` | `routes/play/character.$id.tsx` | **placeholder** — character sheet is task 12.3 |

Route files stay thin: they render a feature component and pass route params down. Data fetching
is a no-op here — everything comes from the Zustand stores.

**The whole configuration UI is mounted and browsable** as of TICKET-NAV-02 — all eight §11 panels
have a route. Play mode is still all placeholders.

Two things to know about route files here:

- Each page component is **exported by name** (`StatsConfig`, `FocusConfig`, …) so tests can render
  it. Automatic code splitting rewrites `Route.options.component` into a lazy wrapper whose dynamic
  import Vitest cannot resolve, and TanStack Start omits `autoCodeSplitting` from its accepted
  router config, so importing the named export is the only way to test a route component. See
  `routes/config/configRoutes.test.tsx`.
- Colocated route tests work because `vite.config.ts` passes
  `tanstackStart({ router: { routeFileIgnorePattern: '\\.test\\.tsx?$' } })`; without it the route
  generator warns that the test file exports no `Route`.

## Stores (`src/stores/`)

Three plain Zustand stores, each with a colocated `*.test.ts`. They are the only place that
calls the storage service; components and hooks never persist directly.

| Store | Owns | Persists to |
|---|---|---|
| `useConfigStore` | the single `Configuration` — main/speciality/combat skills, stats, materials + categories, items, equipment slots, races, currency tiers, focus-stat bonus level. CRUD action per entity (`addX`/`updateX`/`deleteX`) | `saveConfiguration()` on every mutation |
| `useCharacterStore` | `Character[]`, plus inventory actions (`equipItem`, `unequipItem`, `addMiscItem`, `removeMiscItem`, `moveItemToMisc`, `moveItemToEquipment`) and `updateCurrentStatValue(s)` | `saveCharacters()` on every mutation |
| `useUIStore` | app mode (`config`/`play`), dialog registry, last validation report, session roll history | not persisted |

Read the store's own type block (`ConfigState`, `CharacterState`, `UIState`) for the exact action
list — it changes more often than this table.

## Engine (`src/engine/`)

Pure functions, no React, no storage. Every user-authored number in the app resolves here.

- `formula/parser.ts` — tokenizer + `FormulaParser` class → `parseFormula(src): FormulaAST`.
  Supports `+ - * /`, parentheses, unary negation, numeric literals, and 3-letter variable refs.
- `formula/evaluator.ts` — `evaluateFormula(ast, context)` where context is `{ variables: Record<code, number> }`.
- `formula/validator.ts` — `validateFormula`, `validateFormulaCollection`, `detectCircularDependencies`.
  Returns referenced variables so callers can check them against configured skill codes.
- `calculators/mainSkillCalculator.ts` — `calculateTotalMainSkillLevels` (base + racial modifiers).
- `calculators/statCalculator.ts` — `calculateMaxStatValues` (stat formulas over total main skills).
- `calculators/specialitySkillCalculator.ts` — `calculateSpecialitySkillLevels` (base + formula bonus + focus bonus).
- `calculators/combatSkillCalculator.ts` — `calculateCombatSkillBonuses` (formula + equipment bonuses).
- `calculators/equipmentBonusCalculator.ts` — `calculateEquipmentBonuses` (aggregates equipped items' material bonuses).
- `calculator.ts` — re-exports the calculators, plus `calculateCharacterStats()`, which composes
  **only** main-skill totals → max stat values and returns `Record<statId, number>`.
  **There is no producer of `CalculatedCharacter` yet**, and equipment bonuses currently reach
  combat skills only — that is TICKET-CALC-01. Until it lands, a caller needing speciality totals
  or equipment-aware numbers has to compose the calculators by hand; prefer waiting for the ticket
  over adding a second composition.
- `validator.ts` — `validateConfiguration(config): ValidationReport` (cross-entity referential
  integrity: formula refs, equipment slot types, material categories, circular formulas).

Not built yet: the dice roller (TICKET-ROLL-01) will land in `engine/dice/`.

## Services (`src/services/`)

- `storage.ts` — LocalStorage keys `dnd_builder_config`, `dnd_builder_characters`,
  `dnd_builder_ui_state`; `saveConfiguration`/`loadConfiguration`/`saveCharacters`/`loadCharacters`/
  `clearAllData`/`isStorageAvailable`/`getStorageSize`, plus the `StorageError` /
  `StorageQuotaError` / `StorageParseError` classes. See the **data-model** skill.
- `importExport.ts` — `exportConfiguration` (Blob), `downloadConfiguration`, `validateConfiguration`
  (shape check on untrusted JSON, returns `ValidationResult`), `importConfiguration`.
  Note the name collision: this `validateConfiguration` checks *imported JSON shape*;
  `engine/validator.ts`'s checks *referential integrity of a loaded config*.

## Components (`src/components/`)

**`ui/` — base primitives.** One folder per component holding `Name.tsx`, `Name.style.ts`,
`Name.test.tsx`. Current set: Button, Input, Select, Textarea, Checkbox, Card, Label, Text,
FormField, Dialog, FormulaEditor, ValidationReport — **read `ui/index.ts` for the live list**.
They carry intrinsic styling only (colors, typography, padding, borders, states); margin,
flex/grid, and positioning arrive from the caller's `className`.

**`config/` — configuration-mode features**, one folder per domain
(`skills/{main,speciality,combat,shared}`, `stats/`, `materials/`, `items/`, `races/`,
`currency/`, `focus/`). Each domain repeats the same four-part shape:

- `XConfigPanel.tsx` — layout + composition only
- `XCard.tsx` — one row/entity
- `XFormDialog.tsx` — add/edit form in a `Dialog`
- `useXManager.ts` — the hook holding store selectors, `react-hook-form` state, and handlers

`config/index.ts` re-exports all of it. `skills/shared/BaseSkillPanel.tsx` +
`useSkillDependencies.ts` are shared across the three skill kinds.

**`play/` — empty.** Character list, creation wizard, character sheet, inventory panel, combat
roller, and stat editor are all still open (see `docs/v1.0_foundation/overview.md`).

**`shared/` — empty.** First genuinely cross-mode component goes here.

`components/Header.tsx` sits at the root of `components/`, outside the three folders.

## Docs

`docs/` holds one folder per version/milestone: `overview.md` (the ticket index, in build order)
plus `tickets/`. The two anchors that don't move are
`docs/v1.0_foundation/requirements.md` (the numbered requirements every ticket traces back to)
and `docs/v1.0_foundation/design.md` (architecture, component contracts, theme). `docs/README.md`
explains the folder-naming scheme — read that instead of a version list here, which would go
stale. For "what does the spec say about X", ask the **spec-navigator** subagent.
