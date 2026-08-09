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
| `/config` | `routes/config/index.tsx` | `ConfigDashboard` (components/config/dashboard/) — validation status, the "Validate Configuration" action, the `ConfigTransferPanel` (rename/export/import), and a card index of the nine sections below |
| `/config/skills` | `routes/config/skills.tsx` | `SpecialitySkillsPanel` + `CombatSkillsPanel` (main skills merged into stats — TICKET-STAT-01) |
| `/config/stats` | `routes/config/stats.tsx` | `StatsConfigPanel` — the unified Stat: invested, resource and derived alike, plus `StatPointBudget` |
| `/config/materials` | `routes/config/materials.tsx` | `MaterialsConfigPanel` |
| `/config/items` | `routes/config/items.tsx` | `ItemsConfigPanel` + `EquipmentSlotsConfigPanel` |
| `/config/races` | `routes/config/races.tsx` | `RacesConfigPanel` |
| `/config/currency` | `routes/config/currency.tsx` | `CurrencyConfigPanel` (which renders `ConversionCalculator` once tiers exist) |
| `/config/constants` | `routes/config/constants.tsx` | `ConstantsConfigPanel` — named tunables (`const.*`), each card listing the formulas that name it |
| `/config/curves` | `routes/config/curves.tsx` | `CurvesConfigPanel` — progressions as editable tables (`curve.*(x)`), with per-cell override highlighting and a regenerate action (TICKET-CRV-03) |
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
| `useConfigStore` | the single `Configuration` — stats (the unified invested/resource/derived axis), speciality and combat skills, materials + categories, items, equipment slots, races, currency tiers, constants, curves, focus-stat bonus level. CRUD action per entity (`addX`/`updateX`/`deleteX`), plus the curve grid actions (`addCurveColumn`/`deleteCurveColumn`/`addCurveRow`/`deleteCurveRow`/`setCurveCell`/`clearCurveOverride`/`regenerateCurve`) | `saveConfiguration()` on every mutation |
| `useCharacterStore` | `Character[]`, plus inventory actions (`equipItem`, `unequipItem`, `addMiscItem`, `removeMiscItem`, `moveItemToMisc`, `moveItemToEquipment`) and `updateCurrentStatValue(s)` | `saveCharacters()` on every mutation |
| `useUIStore` | app mode (`config`/`play`), dialog registry, last validation report, session roll history | not persisted |

Read the store's own type block (`ConfigState`, `CharacterState`, `UIState`) for the exact action
list — it changes more often than this table.

## Engine (`src/engine/`)

Pure functions, no React, no storage. Every user-authored number in the app resolves here.

- `formula/parser.ts` — tokenizer + `FormulaParser` class → `parseFormula(src): FormulaAST`.
  Supports `+ - * / ^` (`^` binds tighter than `*` and looser than unary minus, so `-2 ^ 2` is 4
  as in Excel; it is **right**-associative, so `2 ^ 3 ^ 2` is 512, where Excel would say 64 —
  a deliberate split, TICKET-FORM-07), parentheses, unary negation, numeric literals,
  function calls `name(arg, …)`, dotted namespaced references (`stats.speed`, `skills.healing.level`,
  `curve.cr(x)`), bracketed id references (`[b1f0…]`, `stats.[b1f0…]` — the persisted form,
  TICKET-REF-01), and bare variable refs (**deprecated** — the flat space now holds stat
  abbreviations plus speciality and combat codes; TICKET-SKL-02/ROLL-05 move the last callers off it).
  Identifiers are `[A-Za-z][A-Za-z0-9_]*`. **Full grammar lives in the module JSDoc** — read it
  there rather than restating it. Also exports `tokenizeFormula(src)` — the lexer alone, for
  rewriting reference tokens in place.
- `formula/references.ts` — **the display↔stored translation** (TICKET-REF-01):
  `buildReferenceIndex`, `toStoredFormula`/`toDisplayFormula`,
  `toStoredConfiguration`/`toDisplayConfiguration`, `ensureReferenceIds`, `statMemberName`. A
  formula is written and validated in *display* form (codes and name-slugs) and persisted in
  *stored* form (ids), which is what makes a rename harmless. Only `services/storage.ts` and
  `services/importExport.ts` cross that boundary; `configStore`'s `applyRenameSafely` uses the
  same pair to make an edit rename-safe. The index is derived, never persisted.
- `formula/functions.ts` — the closed function library (`round`/`roundup`/`rounddown`/`floor`/
  `ceil`/`min`/`max`/`clamp`/`abs`), lowercase reserved names matched case-sensitively; `round` is
  Excel half-away-from-zero (TICKET-FORM-02).
- `formula/errors.ts` — **error values** (TICKET-FORM-05): `formulaError`, `isFormulaError`,
  `asNumber`, `numberOr`, `withSource`, `describeFormulaError`, `rootCause`. Evaluation returns
  `number | FormulaError` and never throws for a ruleset problem, so a broken formula poisons only
  its own value. Use `numberOr`/`asNumber` to read a derived map — never `?? 0`.
- `formula/evaluator.ts` — `evaluateFormula(ast, context)` and `evaluateFormulaString(src, context)`
  (parse + evaluate, syntax errors included as values — **this is what calculators call**). Context is
  `{ variables: Record<code, FormulaResult>; namespaces?: Record<string, NamespaceResolver> }` —
  the flat map serves legacy bare codes, the resolvers serve dotted references. **Callers build
  that map with `namespacesFor(config, owner)`** (TICKET-CRV-01) rather than by hand, so
  `const.*`, `curve.*(x)` and `stats.*` resolve wherever `scoping.ts` allows them. `stats.*` needs
  composed values passed in (`{ stats, statValues }`), since a stat's worth is a property of a
  character rather than of the ruleset; without them the namespace is simply absent. `skills.*`
  still evaluates to an `unknown-namespace` error value until TICKET-SKL-02 wires it — a value,
  not a throw (TICKET-FORM-05).
- `formula/constants.ts` — `constantsNamespace(constants)` → the `const.*` resolver
  (TICKET-CST-01). **The exemplar `NamespaceResolver` to copy**: resolution is by
  display name, the stored formula holds the id, and an unknown member or a property access comes
  back as a distinct error value rather than a zero.
- `formula/stats.ts` — `statsNamespace(stats, values)` → the `stats.*` resolver (TICKET-STAT-01).
  Resolution is by the stat's **name slug**, not its abbreviation; a stat with no value *yet* comes
  back as a `not-evaluable` error rather than as absent, which is what lets the composition decide
  whether another pass is worth running.
- `formula/curves.ts` — `lookupCurve(curve, input, column?)` and `curvesNamespace(curves)` → the
  `curve.*(x)` resolver (TICKET-CRV-01). The **callable** resolver exemplar: `NamespaceResolver`
  has an optional `call(member, args, property)`, and a curve is callable-only (reading one
  without parentheses is its own error). Every lookup mode reduces to `(input, output)` pairs, so
  `reverse` is `step` over the inverted table rather than a second code path.
- `formula/namespaces.ts` — `namespacesFor(source, owner)`: the resolvers a formula at that
  attachment point may use, driven by `scoping.ts`'s table so what a formula *may* reference and
  what it *can* resolve cannot drift apart. Every evaluation site calls this — three calculators
  and `StatCard`'s preview.
- `formula/scoping.ts` — **the reference-scope tables as data** (TICKET-FORM-04):
  `NAMESPACE_SCOPES` and `LEGACY_CODE_SCOPES` keyed by `FormulaOwner` (the attachment point),
  `KNOWN_NAMESPACES`, and `scopeFor(config, owner)`. A new attachment point is a **new row here**,
  never a branch — there is no `switch` on owner kind in the engine, and a test enforces that
  every owner has a row. `curve`'s members are the ruleset's curve names (TICKET-CRV-01); a
  column is a property segment, checked at evaluation rather than here.
- `formula/validator.ts` — `validateFormula(formula, availableCodes?, scope?)`,
  `validateFormulaCollection`, `detectCircularDependencies`, `dependencyKeysOf`,
  `toFormulaDependency`, plus a private `walkFormula(ast, visit)` that is the single place knowing
  the AST union's shape — **extend that when adding a node type**, not each analysis pass.
  Passing a `scope` turns on the three scoping errors (unknown namespace / not available here /
  unknown member). **Use `toFormulaDependency` to build cycle-graph entries** — it is what makes
  `stats.health` and bare `HEALTH` land on the same node.
- `formula/formulaChange.ts` — `validateFormulaChange(config, change)`, the **save-time guard** the
  three formula-owning `useXManager` hooks call before writing to the store. It validates the
  configuration *as it would be after the save* (syntax → cycles → undefined codes) and reuses the
  validator's detector rather than adding a second one. Reference scope per kind lives here:
  stats and speciality skills may name stat abbreviations, combat skills may also name speciality
  codes. A stat may now name another stat, so that graph is no longer a DAG by construction —
  `calculateStatValues` resolves in passes and reports a cycle as error values.
- `calculators/statCalculator.ts` — **the composition calculator** (TICKET-STAT-01):
  `calculateStatValues(stats, character, options)` answers "what is this stat worth" for all three
  kinds — invested (`race base + points + racial + equipment`), resource (the same sum, read as a
  maximum) and derived (its formula) — then clamps to `min`/`max` and rounds. Plus
  `calculateStatTotal`, `statVariables` (the flat map keyed by abbreviation, for the downstream
  formulas) and `calculateRacialSkillModifiers` (the racial contribution on its own, for display).
- `calculators/specialitySkillCalculator.ts` — `calculateSpecialitySkillLevels` (base + formula bonus + equipment + focus bonus).
- `calculators/combatSkillCalculator.ts` — `calculateCombatSkillBonuses` (formula + equipment bonuses).
- `calculators/equipmentBonusCalculator.ts` — `calculateEquipmentBonuses` (aggregates equipped items' material bonuses) and `indexSkillModifiers(modifiers)` → `Record<skillCode, number>` (any `SkillModifier[]` as a per-code lookup, for showing a skill's equipment contribution on its own).
- `calculator.ts` — re-exports the calculators, plus **`calculateCharacter(character, config):
  CalculatedCharacter`**, the single composed entry point (equipment → stats → speciality →
  combat, in that order). Call it for any derived number; don't compose the calculators by hand.
  `calculateCharacterStats()` remains as a thin documented wrapper returning just `.statValues`.
  Each equipment bonus is claimed by exactly one step, since a stat abbreviation is unique against
  the speciality and combat code spaces.
- `dependencies.ts` — **the reference walker** (TICKET-REF-02): `findReferences(target, config,
  characters)` → `EntityReference[]`, one case per guarded-delete `ReferenceTargetKind`. Pure over
  both stores' data; `configStore`'s delete actions call it. Answers "what points at this?"; the
  formula half goes through `validateFormula`, never substring matching.
- `validator.ts` — `validateConfiguration(config): ValidationReport` (cross-entity referential
  integrity: formula refs, equipment slot types, material categories, circular formulas). It is
  the *after the fact* report — `dependencies.ts` is the *before the fact* guard, and both stay:
  the validator still catches what an import brings in.
- `curveGenerator.ts` — **generate, overlay overrides, show both** (TICKET-CRV-02):
  `regenerateCurve(curve, source)` → `{ curve, report }`, plus `setCurveCell` and
  `clearCurveOverride`. A column may carry a `generator` formula evaluated per row with the row's
  key bound as `key`; a cell flagged `overridden` is kept and counted rather than refilled, which
  is what stops a regeneration from quietly rebalancing the ruleset. Pure — `configStore`'s
  `regenerateCurve(id)` action is what persists the result. `flagColumnAsOverridden(curve,
  columnId)` is what "give a hand-entered column a generator" calls first, so the numbers already
  in it are kept rather than overwritten on the next regeneration.
- `curveTable.ts` — a curve's **structure**: `addCurveColumn` / `removeCurveColumn` /
  `addCurveRow` / `removeCurveRow` (TICKET-CRV-03). They exist because `columns`, `rows[].values`
  and `rows[].overridden` are three arrays on one index; splicing one alone moves every override
  flag onto the wrong cell. The store's column and row actions are the only callers.
- `currency.ts` — `convertCurrency(value, toTierId, tiers)`, `normalizeCurrency(value, tiers)` (the
  highest tier where the amount is still ≥ 1 — what Req 10.4's "appropriate tier" means here) and
  `formatCurrency(value, tiers)`. Conversion is arithmetic over a configured rate, **not** a
  user-authored expression, so it does not go through the formula engine. Unknown tiers and
  non-positive rates degrade rather than producing `NaN`/`Infinity`.
- `characterSummary.ts` — `calculateCharacterLevel(character)` and `toCharacterSummary(character)`.
  **The single definition of "level"**: the sum of `investedStatPoints`, deliberately
  excluding racial/equipment/focus modifiers. Every screen showing a level reads it from here.
- `skillAllocation.ts` — `validateStatAllocation(investedStatPoints, config)` → points
  spent/remaining, per-stat violations (`negative-points`, `derived-stat`), verdict. Keyed by stat
  id. The single global point pool (`Configuration.mainSkillPointBudget`,
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

Both service modules are the **reference-form boundary** (TICKET-REF-01): what they write holds
id-resolved references, what they hand back holds the ruleset's current spellings.

- `storage.ts` — LocalStorage keys `dnd_builder_config`, `dnd_builder_characters`,
  `dnd_builder_ui_state`; `saveConfiguration`/`loadConfiguration`/`saveCharacters`/`loadCharacters`/
  `clearAllData`/`isStorageAvailable`/`getStorageSize`, plus the `StorageError` /
  `StorageQuotaError` / `StorageParseError` classes. See the **data-model** skill.
- `importExport.ts` — `exportConfiguration` (Blob), `downloadConfiguration`, `validateConfiguration`
  (shape check on untrusted JSON, returns `ValidationResult`), `importConfiguration`.
  Note the name collision: this `validateConfiguration` checks *imported JSON shape*;
  `engine/validator.ts`'s checks *referential integrity of a loaded config*.

## Scripts (`scripts/`)

Node-only tooling, outside the app bundle. `build-sheet-import.mjs` (plus a hand-written
`.d.mts` so the test can import it under `tsc`) merges the per-feature fragments in `docs/imports/`
into `docs/imports/ducklets.json` — `yarn run sheet:import`.
`src/services/sheetImport.test.ts` re-runs that merge in the suite and fails on drift. See
[docs/imports/README.md](../../../docs/imports/README.md).

## Components (`src/components/`)

**`ui/` — base primitives.** One folder per component holding `Name.tsx`, `Name.style.ts`,
`Name.test.tsx`. Current set: Button, Input, Select, Textarea, Checkbox, Card, Label, Text,
FormField, Dialog, FormulaEditor, ValidationReport, ErrorChip — **read `ui/index.ts` for the live
list**. They carry intrinsic styling only (colors, typography, padding, borders, states); margin,
flex/grid, and positioning arrive from the caller's `className`.
`libraryConventions.test.ts` enforces all of that by walking the folder, so a new primitive is
covered without editing the test.

`ErrorChip` (TICKET-FORM-06) is the standard stand-in for a value that could not be calculated.
It takes plain `label`/`detail` strings, never a `FormulaError` — the caller turns an error into
words with `describeFormulaError`. On the character sheet the interpreting happens once in
`useCharacterSheet`, which hands sections a `DerivedValue` (`{ value, error }`) so they never
import the engine to decide what to draw.

**`config/` — configuration-mode features**, one folder per domain
(`skills/{speciality,combat,shared}`, `stats/`, `materials/`, `items/`, `races/`,
`currency/`, `constants/`, `curves/`, `focus/`). Each domain repeats the same four-part shape:

- `XConfigPanel.tsx` — layout + composition only
- `XCard.tsx` — one row/entity
- `XFormDialog.tsx` — add/edit form in a `Dialog`
- `useXManager.ts` — the hook holding store selectors, `react-hook-form` state, and handlers

`config/index.ts` re-exports all of it. `skills/shared/` holds what the three skill kinds share:
`BaseSkillPanel.tsx`, `SkillFormFields.tsx` and `skillIdentity.ts` (`resolveSkillId`,
`useSkillCodeRename` — TICKET-REF-01).

**`config/shared/` is cross-domain** (TICKET-REF-02): `useGuardedDelete` holds a delete the store
refused, and `BlockedDeleteDialog` renders the reference list with a "Delete Anyway" force button.
**Every config panel's delete goes through that pair** — a panel never derives references or
decides whether a delete is safe; `configStore`'s delete actions return the reference list
(empty = deleted) and take `{ force: true }`. The advisory `useSkillDependencies` hook and the
`alert()`/`confirm()` guards it sat beside are gone.

**`play/`** — barrelled by `play/index.ts`, mirroring `config/`'s domain-folder shape.
`characters/` holds `CharacterList` + `CharacterCard` + `useCharacterListManager`.
`creation/` holds the four-step wizard: `CharacterCreationWizard` dispatches on a step index and
the four step components (`IdentityStep`, `SkillAllocationStep`, `FocusStatStep`, `ReviewStep`)
are pure props — all state, validation and the submit live in `useCharacterCreation`. That is the
multi-step pattern to copy.
`sheet/` holds the character sheet: `CharacterSheet` (composition + the four dead-end notices) and
`useCharacterSheet` (status resolution, the one `calculateCharacter` call, and the stat handler),
with `SheetHeader`, `RacialModifiersSection`, `StatsSection` (a `StatEditor` per **resource**, a
`SkillBreakdownRow` for every other stat, plus the stat total), `SpecialitySkillsSection` and
`CombatSkillsSection` as pure props.
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
