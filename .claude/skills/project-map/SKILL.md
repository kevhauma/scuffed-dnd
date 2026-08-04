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
`RootLayout` there is **the app's only hydration point** — it calls `useAppHydration()`
(`components/shared/`), which restores both persisted stores once per page load and renders
`StorageNotice` instead of the `<Outlet />` when LocalStorage is unavailable. Route components
never call `loadConfig`/`loadCharacters` themselves. It renders everything inside
**`AppShell`** (`components/shared/`), which owns the medieval frame, the mode switcher, and the
per-mode navigation; `useAppMode` keeps `useUIStore.mode` in step with the route and **redirects
`/config/*` to `/play` while in play mode** (Req 19.6 — see TICKET-NAV-01 for why a redirect
rather than a read-only config UI).

| Route | File | State |
|---|---|---|
| `/` | `routes/index.tsx` | landing page, feature overview |
| `/config` | `routes/config/index.tsx` | `ConfigDashboard` (components/config/dashboard/) — validation status, the "Validate Configuration" action, the `ConfigTransferPanel` (rename/export/import), and a card index of the seven sections below |
| `/config/skills` | `routes/config/skills.tsx` | `MainSkillsPanel` + `SpecialitySkillsPanel` + `CombatSkillsPanel` |
| `/config/stats` | `routes/config/stats.tsx` | `StatsConfigPanel` |
| `/config/materials` | `routes/config/materials.tsx` | `MaterialsConfigPanel` |
| `/config/items` | `routes/config/items.tsx` | `ItemsConfigPanel` + `EquipmentSlotsConfigPanel` |
| `/config/races` | `routes/config/races.tsx` | `RacesConfigPanel` |
| `/config/currency` | `routes/config/currency.tsx` | `CurrencyConfigPanel` (which renders `ConversionCalculator` once tiers exist) |
| `/config/focus` | `routes/config/focus.tsx` | `FocusStatConfig` |
| `/play` | `routes/play/index.tsx` | `CharacterList` — the play-mode entry point |
| `/play/create` | `routes/play/create.tsx` | `CharacterCreationWizard` — the four-step wizard |
| `/play/character/$id` | `routes/play/character.$id.tsx` | `CharacterSheet` — takes the route param as `characterId` |

Route files stay thin: they render a feature component and pass route params down. Data fetching
is a no-op here — everything comes from the Zustand stores.

**The whole configuration UI is mounted and browsable** as of TICKET-NAV-02 — all eight §11 panels
have a route. Play mode's three routes are all real: `/play` (TICKET-CHAR-01), `/play/create`
(TICKET-CHAR-02) and `/play/character/$id` (TICKET-CHAR-03).

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
  Supports `+ - * /`, parentheses, unary negation, numeric literals, function calls
  `name(arg, …)`, dotted namespaced references (`stats.speed`, `skills.healing.level`,
  `curve.cr(x)`), and bare variable refs (**deprecated**, removed by TICKET-STAT-01).
  Identifiers are `[A-Za-z][A-Za-z0-9_]*`. **Full grammar lives in the module JSDoc** — read it
  there rather than restating it.
- `formula/functions.ts` — the closed function library (`round`/`roundup`/`rounddown`/`floor`/
  `ceil`/`min`/`max`/`clamp`/`abs`), lowercase reserved names matched case-sensitively; `round` is
  Excel half-away-from-zero (TICKET-FORM-02).
- `formula/evaluator.ts` — `evaluateFormula(ast, context)`. Context is
  `{ variables: Record<code, number>; namespaces?: Record<string, NamespaceResolver> }` — the flat
  map serves legacy bare codes, the resolvers serve dotted references. **No calculator builds a
  `namespaces` map yet** (TICKET-FORM-03 defined the shape; CST-01/CRV-01/STAT-01 populate it), so
  a saved namespaced formula currently throws `Unknown namespace: …` at calculation time.
  Namespaced calls (`curve.cr(x)`) parse but throw until TICKET-CRV-01.
- `formula/validator.ts` — `validateFormula`, `validateFormulaCollection`, `detectCircularDependencies`,
  plus a private `walkFormula(ast, visit)` that is the single place knowing the AST union's shape —
  **extend that when adding a node type**, not each analysis pass. Returns referenced variables
  (legacy bare codes only) so callers can check them against configured skill codes; namespace
  scoping is TICKET-FORM-04.
- `formula/formulaChange.ts` — `validateFormulaChange(config, change)`, the **save-time guard** the
  three formula-owning `useXManager` hooks call before writing to the store. It validates the
  configuration *as it would be after the save* (syntax → cycles → undefined codes) and reuses the
  validator's detector rather than adding a second one. Reference scope per kind lives here:
  stats and speciality skills may name main skill codes, combat skills may also name speciality
  codes — which makes the graph a DAG and means a multi-formula cycle can only arrive by import.
- `calculators/mainSkillCalculator.ts` — `calculateTotalMainSkillLevels` (base + racial + equipment
  + focus, the last three via an options argument) and `calculateRacialSkillModifiers` (the racial
  contribution on its own, for display).
- `calculators/statCalculator.ts` — `calculateMaxStatValues` (stat formulas over total main skills).
- `calculators/specialitySkillCalculator.ts` — `calculateSpecialitySkillLevels` (base + formula bonus + equipment + focus bonus).
- `calculators/combatSkillCalculator.ts` — `calculateCombatSkillBonuses` (formula + equipment bonuses).
- `calculators/equipmentBonusCalculator.ts` — `calculateEquipmentBonuses` (aggregates equipped items' material bonuses) and `indexSkillModifiers(modifiers)` → `Record<skillCode, number>` (any `SkillModifier[]` as a per-code lookup, for showing a skill's equipment contribution on its own).
- `calculator.ts` — re-exports the calculators, plus **`calculateCharacter(character, config):
  CalculatedCharacter`**, the single composed entry point (equipment → main skills → stats →
  speciality → combat, in that order). Call it for any derived number; don't compose the
  calculators by hand. `calculateCharacterStats()` remains as a thin documented wrapper returning
  just `.maxStatValues`. Each equipment bonus is claimed by exactly one step, since skill codes are
  unique across main/speciality/combat.
- `validator.ts` — `validateConfiguration(config): ValidationReport` (cross-entity referential
  integrity: formula refs, equipment slot types, material categories, circular formulas).
- `currency.ts` — `convertCurrency(value, toTierId, tiers)`, `normalizeCurrency(value, tiers)` (the
  highest tier where the amount is still ≥ 1 — what Req 10.4's "appropriate tier" means here) and
  `formatCurrency(value, tiers)`. Conversion is arithmetic over a configured rate, **not** a
  user-authored expression, so it does not go through the formula engine. Unknown tiers and
  non-positive rates degrade rather than producing `NaN`/`Infinity`.
- `characterSummary.ts` — `calculateCharacterLevel(character)` and `toCharacterSummary(character)`.
  **The single definition of "level"**: the sum of allocated `mainSkillLevels`, deliberately
  excluding racial/equipment/focus modifiers. Every screen showing a level reads it from here.
- `skillAllocation.ts` — `validateMainSkillAllocation(levels, config)` → points spent/remaining,
  per-skill violations, verdict. The single global point pool (`Configuration.mainSkillPointBudget`,
  absent = unlimited). The creation wizard reads this; it never re-sums levels itself.

- `dice/diceSimulator.ts` — `rollDice(diceConfig, rng?)` → `DiceRollResult[]` (one entry per die
  type with a count above zero, carrying every individual roll), plus `rollDie`, `sumDiceResults`,
  `DIE_SIDES`, `DIE_TYPES`, and `formatDiceNotation(dice)` → `"2d6 + 1d20"` (the one definition of
  dice notation — the sheet and the roller share it).
- `dice/combatRoll.ts` — `rollCombatSkill(skill, calculatedCharacter, config, rng?, timestamp?)` →
  `CombatRollResult`. Takes its bonus from `calculateCombatSkillBonuses()`, so a roll can never
  disagree with the sheet. Both take an injectable `RandomSource`, defaulting to `Math.random`;
  production callers pass nothing. Barrelled by `dice/index.ts`.

`CombatRollResult` (`types/formula.ts`) is the **only** dice-result shape — `useUIStore`'s
`RollResult` extends it and adds `id`/`characterId`/`characterName`. Don't reintroduce a second one.

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

**`play/`** — barrelled by `play/index.ts`, mirroring `config/`'s domain-folder shape.
`characters/` holds `CharacterList` + `CharacterCard` + `useCharacterListManager`.
`creation/` holds the four-step wizard: `CharacterCreationWizard` dispatches on a step index and
the four step components (`IdentityStep`, `SkillAllocationStep`, `FocusStatStep`, `ReviewStep`)
are pure props — all state, validation and the submit live in `useCharacterCreation`. That is the
multi-step pattern to copy.
`sheet/` holds the character sheet: `CharacterSheet` (composition + the four dead-end notices) and
`useCharacterSheet` (status resolution, the one `calculateCharacter` call, and the stat handler),
with `SheetHeader`, `RacialModifiersSection`, `MainSkillsSection`, `StatsSection` (rendering a
`StatEditor` per stat), `SpecialitySkillsSection` and `CombatSkillsSection` as pure props.
`SkillBreakdownRow` is the shared "total plus its labelled contributions" row — reuse it rather
than re-deriving a breakdown layout.
`inventory/` holds `InventoryPanel` (mounted by the sheet, taking only a `characterId`) with
`EquipmentSlotRow`, `MiscItemRow` and `useInventoryManager`. Equipping needs no recalculation call:
`calculateCharacter` reads `inventory.equippedItems` at render time.
`rolls/` holds `useCombatRoller` (the one caller of `rollCombatSkill`, taking the sheet's
`CalculatedCharacter` so the roll is not calculated twice), `RollBreakdown` and `RollHistoryPanel`.
The roll button and the last result live in `CombatSkillsSection`; the history is its own panel.
Randomness is injectable via `useCombatRoller(id, calculated, { rng })` — never spy on
`Math.random`.

**`shared/`** — cross-mode components and hooks, barrelled by `shared/index.ts`:
`AppShell.tsx` (the medieval frame + mode switcher + per-mode nav), `useAppMode.ts` (route↔mode
sync and the play-mode config lock), `useAppHydration.ts` (the app-wide LocalStorage restore,
called only by `RootLayout`) and `StorageNotice.tsx` (the storage-unavailable message it drives).

`components/Header.tsx` sits at the root of `components/`, outside the three folders.

## Docs

`docs/` holds one folder per version/milestone: `overview.md` (the ticket index, in build order)
plus `tickets/`. The two anchors that don't move are
`docs/v1.0_foundation/requirements.md` (the numbered requirements every ticket traces back to)
and `docs/v1.0_foundation/design.md` (architecture, component contracts, theme). `docs/README.md`
explains the folder-naming scheme — read that instead of a version list here, which would go
stale. For "what does the spec say about X", ask the **spec-navigator** subagent.
