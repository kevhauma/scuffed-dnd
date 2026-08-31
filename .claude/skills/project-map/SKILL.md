---
name: project-map
description: Map of the Custom DnD Builder codebase — which route, store, engine module, service, or component lives where. Use to locate code before searching the codebase manually.
---

# Project Map

`src/` has exactly **three roots** (TICKET-DX-07, v3.0 D14). `client/` and `server/` may each
import `shared/` and nothing of each other; `shared/` imports neither:

```
src/
  shared/    the Kernel — types/, engine/, and the pure half of services/. Pure.
  client/    components/, routes/, stores/, the browser half of services/, styles.css
  server/    the backend — entry.ts, env.ts, http/, routes/. See its README.
```

A crossing is spelled with its alias — `#shared/…`, `#client/…`, `#server/…`, never `../../` —
and `.dependency-cruiser.mjs` refuses the rest in `yarn run check` and the pre-commit hook.
`architecture/boundaries.test.ts` proves each rule against a module that breaks it.

**Within** a root the layering is unchanged and still bottom-up — each layer may import from the
ones above it in this list, never below:

```
shared/types/       pure type definitions, no runtime code — including `api.ts`, the HTTP wire
                    contract (`ERROR_CODE`, `ErrorBody`, `RulesetSummary`) both roots name, and
                    `validation.ts`, where `ValidationReport` moved when IO-04 put one on the wire
                    (`engine/validator.ts` still re-exports it, and still builds one)
shared/engine/      formula parser/evaluator/validator + the derived-value calculators
shared/services/    shape validation, import semantics, serialisation — no browser APIs
client/services/    LocalStorage persistence, Blob/File download and upload
client/stores/      Zustand: configStore, characterStore, uiStore
client/components/  ui/ (base primitives) → config/, play/, shared/ (feature components)
client/routes/      TanStack Router file-based routes
server/env.ts       the only reader of process.env
server/db/          the SQLite connection, the Drizzle schema, the migration runner
server/repositories/ the only code that issues queries — one module per aggregate
server/http/        AppError, the request pipeline, the API route table
server/routes/      one module per API route — plain handlers, no framework coupling
server/entry.ts     the server entry: /api/* to the router, everything else to SSR
```

This file is hand-maintained and describes a moving codebase. Where it points at a barrel or a
folder rather than listing contents, follow the pointer — the barrel is the source of truth,
this map is the index.

## Routes

File-based via TanStack Router; `src/client/routeTree.gen.ts` is **generated — never edit it**.
`src/client/router.tsx` creates the router, `src/client/routes/__root.tsx` is the shell (nav + mode switcher).
`RootLayout` there is **the app's only hydration point** — it calls `useAppHydration()`
(`components/shared/`), which restores both persisted stores once per page load. It renders
**instead of** the `<Outlet />` in two cases: `StorageNotice` when LocalStorage is unavailable,
and `IncompatibleDataNotice` when the stored data predates the current `schemaVersion`
(TICKET-IO-03) — the second replaces the routes so nothing downstream can save a fresh ruleset
over data the User has not agreed to lose. Route components never call
`loadConfig`/`loadCharacters` themselves. It renders everything inside
**`AppShell`** (`components/shared/`), which owns the medieval frame, the mode switcher, and the
per-mode navigation; `useAppMode` keeps `useUIStore.mode` in step with the route and **redirects
`/config/*` to `/play` while in play mode** (Req 19.6 — see TICKET-NAV-01 for why a redirect
rather than a read-only config UI).

| Route | File | State |
|---|---|---|
| `/` | `routes/index.tsx` | landing page, feature overview |
| `/rulesets` | `routes/rulesets.tsx` | `RulesetsPanel` (components/rulesets/) — **Configuration mode's entry point** since TICKET-RUL-01: the two homes a ruleset can live in, *this browser* and *your account*, never merged (v3 Req 36.8). **Deliberately not protected** — signed out it is the local row plus a sign-in prompt (v3 Req 36.1) |
| `/config` | `routes/config/index.tsx` | `ConfigDashboard` (components/config/dashboard/) — validation status, the "Validate Configuration" action, the `ConfigTransferPanel` (rename/export/import), and a card index of the `/config/*` sections below |
| `/config/skills` | `routes/config/skills.tsx` | `SkillsPanel` alone (main skills merged into stats — TICKET-STAT-01; the speciality panel became the weighted `SkillsPanel` — TICKET-SKL-02; the combat panel moved to `/config/rolls` as roll definitions — TICKET-ROLL-06) |
| `/config/stats` | `routes/config/stats.tsx` | `StatsConfigPanel` — the unified Stat: invested, resource and derived alike, every field in one editor with drag/arrow reordering (TICKET-STAT-02). The flat point-budget field is gone — TICKET-RES-02 derives it |
| `/config/materials` | `routes/config/materials.tsx` | `MaterialsConfigPanel` |
| `/config/inlays` | `routes/config/inlays.tsx` | `InlaysConfigPanel` (TICKET-INL-01) — the gem families a composed item can be socketed with, each a ladder of `{statId, modifier}` tiers. `MaterialsConfigPanel`'s shape over the other crafting ingredient, so it sits beside it in the nav; families are listed under the headings their own `group` names |
| `/config/items` | `routes/config/items.tsx` | `ItemsConfigPanel` + `EquipmentSlotsConfigPanel`. Since TICKET-ITEM-01 a template carries its own per-skill bonus vector and the shop that sells it, and the panel lists templates under the shop headings the ruleset's own words name — no `/config/shops` route, and a ruleset naming no shops keeps the flat grid it always had |
| `/config/races` | `routes/config/races.tsx` | `RacesConfigPanel` — and, in its `headerExtra`, the ruleset's two **creature reference lists** (sizes and types) through `ReferenceListEditor` (TICKET-RACE-03). They live on this route rather than one of their own because they exist for the pickers on the race form; there is no `/config/creatures` and adding one would be a page with two word lists on it |
| `/config/archetypes` | `routes/config/archetypes.tsx` | `ArchetypesConfigPanel` — what a character is good at growing: `main`/`sub`/`non` per stat, which selects a `point_buy` column (TICKET-ARC-01) |
| `/config/rolls` | `routes/config/rolls.tsx` | `RollsConfigPanel` + `DiceLaddersConfigPanel` (TICKET-ROLL-05) — a roll is an input formula fed down a ladder; the two are separate entities, so two panels, like `/config/items` and `/config/skills` |
| `/config/spells` | `routes/config/spells.tsx` | `SpellsConfigPanel` (TICKET-SPL-01) — the compendium: name, mana cost, range/time and raw effect text per spell. **The only config panel that narrows before it draws**, because the source workbook has 418 of them: `useSpellManager` filters by a name search and then slices one page of 25, and the header counts the whole match rather than the page. Copy that pair rather than a bespoke list the day another entity arrives in the hundreds |
| `/config/currency` | `routes/config/currency.tsx` | `CurrencyConfigPanel` (which renders `ConversionCalculator` once tiers exist) |
| `/config/constants` | `routes/config/constants.tsx` | `ConstantsConfigPanel` — named tunables (`const.*`), each card listing the formulas that name it |
| `/config/curves` | `routes/config/curves.tsx` | `CurvesConfigPanel` — progressions as editable tables (`curve.*(x)`), with per-cell override highlighting and a regenerate action (TICKET-CRV-03) |
| `/play` | `routes/play/index.tsx` | `CharacterList` — the play-mode entry point |
| `/play/create` | `routes/play/create.tsx` | `CharacterCreationWizard` — the five-step wizard |
| `/play/character/$id` | `routes/play/character.$id.tsx` | `CharacterSheet` — takes the route param as `characterId`. **Serves both homes since TICKET-PLY-01**: a character in this browser, or one at a game session, which `useOpenTableCharacter` reads from the server along with its table's Snapshot. Deliberately **not** protected — the local half is play mode, and the server refuses the read anyway |
| `/signin` | `routes/signin.tsx` | `AuthForm` in sign-in mode (TICKET-AUTH-01). A page rather than a dialog because TICKET-AUTH-03 sends an unauthenticated visitor here and returns them |
| `/signup` | `routes/signup.tsx` | `AuthForm` in sign-up mode — carries the "there is no password reset" warning (v3 Req 30.10). **Honours `?redirect=` since TICKET-GAM-02**, which it never did: an invitee without an account is the common case for an invitation, and they used to create one and land on the home page with the invitation gone |
| `/account` | `routes/account.tsx` | `LinkedIdentities` (TICKET-AUTH-02) + `ActiveSessions` (AUTH-04) — how to get back into this Account, and who else is already in it. **The milestone's first protected route** (AUTH-03): it composes `RequireAccount` |
| `/sessions` | `routes/sessions.tsx` | `SessionsPanel` (components/sessions/, TICKET-GAM-02) — start a table from a ruleset you own, the games you are in, and for a DM the invitation. Since GAM-03 it also carries **the invitations waiting for *this Account*** (`PendingInvitations`), which is the only Account-scoped thing on the page. **Deliberately not the lobby**: nothing here shows other people, which is GAM-04's. Protected |
| `/join/$code` | `routes/join.$code.tsx` | `JoinSessionPanel` (TICKET-GAM-02) — what an invite link opens. Previews before it joins, so clicking a link seats nobody; joining is an explicit action. Protected, which is what routes a signed-out invitee through sign-in and back |

Route files stay thin: they render a feature component and pass route params down. Data fetching
is a no-op here — everything comes from the Zustand stores. **The three auth routes are the
exception and are meant to be**: they read a server fact, not a store (see `components/auth/`).

**Every route above except `/account`, `/sessions` and `/join/$code` is open to a signed-out
visitor**, which is D6 rather than an oversight — the whole configuration UI and the whole play
surface are local mode. Protection is an **explicit list** in `components/auth/protectedRoutes.ts`,
so a future route is open unless somebody says otherwise, and `protectedRoutes.test.ts` enumerates
`routeTree.gen.ts` to prove three things: that the protected subset is exactly that list, that each
listed route's module really composes `<RequireAccount>`, and — since GAM-02 — that **no listed
prefix protects nothing**, because a typo'd entry used to read as a route being guarded when no such
route existed.

**The whole configuration UI is mounted and browsable** as of TICKET-NAV-02 — all eight §11 panels
have a route. Play mode's three routes are all real: `/play` (TICKET-CHAR-01), `/play/create`
(TICKET-CHAR-02) and `/play/character/$id` (TICKET-CHAR-03).

Two things to know about route files here:

- Each page component is **exported by name** (`StatsConfig`, `ArchetypesConfig`, …) so tests can render
  it. Automatic code splitting rewrites `Route.options.component` into a lazy wrapper whose dynamic
  import Vitest cannot resolve, and TanStack Start omits `autoCodeSplitting` from its accepted
  router config, so importing the named export is the only way to test a route component. See
  `routes/config/configRoutes.test.tsx`.
- `vite.config.ts` passes
  `tanstackStart({ srcDirectory: 'src/client', router: { routeFileIgnorePattern: '\\.test\\.tsx?$' } })`.
  **`srcDirectory` is the client root, not `src/`** (TICKET-DX-07) — it is what moves the router
  entry, the routes directory and the generated tree together, and what keeps `src/server/` out of
  the generator's reach by construction. `routeFileIgnorePattern` is why colocated route tests
  work; without it the generator warns that the test file exports no `Route`.
- `.fallowrc.jsonc` re-declares the same three paths as fallow entry points, because fallow's
  TanStack Router plugin finds routes by the *default* convention and would otherwise call the
  whole route tree dead.

## Stores (`src/client/stores/`)

Three plain Zustand stores, each with a colocated `*.test.ts`. They are the only place that
persists; components and hooks never persist directly.

**Since TICKET-RUL-02 `useConfigStore` has two destinations**, and the branch is *not* in the store:
`source` says which home the open ruleset lives in and `services/rulesetSync.ts` decides where a
save goes. Every CRUD action kept its signature and still calls one `autoSave`. The local path is
byte-for-byte v2.0's; the account path is a debounced `PUT` guarded by `revision`, and a refusal
becomes `useUIStore.saveConflict` **without rolling the edit back** — the opposite of the
LocalStorage path, deliberately, because there the change cannot be kept and here somebody else's
change also exists (v3 Req 33.8).

| Store | Owns | Persists to |
|---|---|---|
| `useConfigStore` | the single `Configuration` — stats (the unified invested/resource/derived axis), skills, roll definitions, dice ladders, materials + categories, **inlays** (TICKET-INL-01 — gem families, whose tiers are written through `updateInlay` with the whole ladder, like a material's levels), **spells** (TICKET-SPL-01 — the compendium; `updateSpell` clears the optional `description` and `manaCost` through `mergeClearingAbsent`), items, equipment slots, races, archetypes, currency tiers, constants, curves. CRUD action per entity (`addX`/`updateX`/`deleteX`), `reorderStats(orderedIds)` (TICKET-STAT-02 — rewrites the array *and* `order` from one sequence), plus the curve grid actions (`addCurveColumn`/`deleteCurveColumn`/`addCurveRow`/`deleteCurveRow`/`setCurveCell`/`clearCurveOverride`/`regenerateCurve`) | `saveConfiguration()` on every mutation |
| `useConfigStore` (cont.) | `discardStoredData()` — the **only** action that calls `clearAllData()`; the confirmed start-fresh behind `IncompatibleDataNotice` (TICKET-IO-03) | clears both keys, writes nothing |
| `useCharacterStore` (cont.) | `tableCharacter` + `tableSessionId` + `tableCharacterOwnerId` + `isActing` + `actionError`, and `openTableCharacter` / `closeTableCharacter` / `dismissActionError` (TICKET-PLY-01; `tableSessionId` is ROLL-07's, read by the session-scoped roll log; `tableCharacterOwnerId` is DM-01's, and is how the sheet tells the DM's view from the Player's without a second request) — **the one character open at a game session**, held apart from `characters` because that list is LocalStorage's and a session character must never land in it (v3 Req 36.2). Every existing write action keeps its signature and gains one line: `toTable(...)` sends the named intent to the server when the id is this one's, otherwise the Kernel rule runs locally. `selectCharacter(state, id)` is the exported reader both the sheet and the inventory panel use | server, via `services/characterSync.ts` |
| `useCharacterStore` | `Character[]`, plus inventory actions (`equipItem`, `unequipItem`, `buildItem`, `discardItem` — four since TICKET-INV-06, where the derived Backpack collapsed `addMiscItem`/`removeMiscItem`/`moveItemToMisc`/`moveItemToEquipment` into them), `updateCurrentStatValue(s)`, `adjustCurrentStatValue` / `resetCurrentStatValueToMax` (Concept 20's quick entry and "regain to full", TICKET-RES-03), `awardExperience`/`deductExperience` (the rule is the Kernel's `dmActions.ts` since TICKET-DM-01, not this store's), `setInvestedStatPoints(characterId, statId, points, config)` — the level-up spend, which **refuses** anything the derived budget cannot pay for rather than clamping (TICKET-RES-02) — `setFocusSkills(characterId, focusSkillIds, config)` (TICKET-SKL-05 — the whole list of picks at once, refusing more than three or a skill the ruleset has not got, and *reporting* the refusal because the picker has nothing standing in front of it) — `learnSpell(characterId, spellId, config)` / `unlearnSpell(characterId, spellId)` / `castSpell(characterId, spellId, statId, config)` (TICKET-SPL-02 — all three *report* their refusals, `unlearnSpell` takes no ruleset so a force-deleted spell stays clearable, and a cast is a mana spend that ends in the ordinary resource action) — and the DM's six, `dmAwardExperience` / `dmDeductExperience` / `dmSetLevel` / `dmSetGrantedPoints` / `dmSetResource` / `dmSetDreamLevel` (TICKET-DM-01, TICKET-RES-04), which are **table-only** and named apart from the Player's own so no call site has to decide which act it is — `updateDreamLevel` is the local half of the last one, refused at a table exactly as `awardExperience` and `setPurse` are. `createCharacter` applies the same affordability refusal | `saveCharacters()` on every mutation |
| `useConfigStore` (cont.) | `source` + `openAccountRuleset(id)` / `openLocalRuleset()` (TICKET-RUL-02) — which home is open, and the two ways to change it. Opening one home reads nothing from the other | via `services/rulesetSync.ts` |
| `useUIStore` | app mode (`config`/`play`), dialog registry, last validation report, session roll history, `storageFailure` and `saveConflict` (TICKET-RUL-02 — a *server* refusal, with the edit still on screen) | not persisted |

Read the store's own type block (`ConfigState`, `CharacterState`, `UIState`) for the exact action
list — it changes more often than this table.

## Engine (`src/shared/engine/`)

Pure functions, no React, no storage. Every user-authored number in the app resolves here.

- `formula/parser.ts` — tokenizer + an internal `FormulaParser` class behind
  `parseFormula(src): FormulaAST`, the module's whole surface (CR-39 un-exported the class).
  Supports `+ - * / ^` (`^` binds tighter than `*` and looser than unary minus, so `-2 ^ 2` is 4
  as in Excel; it is **right**-associative, so `2 ^ 3 ^ 2` is 512, where Excel would say 64 —
  a deliberate split, TICKET-FORM-07), parentheses, unary negation, numeric literals,
  function calls `name(arg, …)`, dotted namespaced references (`stats.speed`, `skills.healing.level`,
  `curve.cr(x)`), bracketed id references (`[b1f0…]`, `stats.[b1f0…]` — the persisted form,
  TICKET-REF-01), and bare variable refs (**deprecated** — the flat space holds stat
  abbreviations and **nothing else** since TICKET-ROLL-06 — SKL-02 took the speciality half out and the combat codes went with the entity; a roll is in no namespace at all).
  Identifiers are `[A-Za-z][A-Za-z0-9_]*`. **Full grammar lives in the module JSDoc** — read it
  there rather than restating it. Also exports `tokenizeFormula(src)` — the lexer alone, for
  rewriting reference tokens in place.
- `formula/references.ts` — **the display↔stored translation** (TICKET-REF-01):
  `buildReferenceIndex`, `toStoredFormula`/`toDisplayFormula`,
  `toStoredConfiguration`/`toDisplayConfiguration`, `ensureReferenceIds`, `statMemberName`, plus
  `buildReferenceResolver(config)` — the same spelling→id lookup for callers that want the *entity*
  rather than the rewritten text, which is how the cycle detector keys its graph. A
  formula is written and validated in *display* form (codes and name-slugs) and persisted in
  *stored* form (ids), which is what makes a rename harmless. Only `services/storage.ts` and
  `services/importExport.ts` cross that boundary; `configStore`'s `applyRenameSafely` uses the
  same pair to make an edit rename-safe. The index is derived, never persisted.
- `formula/functions.ts` — the closed function library (`round`/`roundup`/`rounddown`/`floor`/
  `ceil`/`min`/`max`/`clamp`/`abs`), lowercase reserved names matched case-sensitively; `round` is
  Excel half-away-from-zero (TICKET-FORM-02). Two are **exported for system arithmetic to share**
  rather than re-spell — `roundHalfAwayFromZero` (`ROUND`) and `roundAwayFromZero` (`ROUNDUP`) — so a
  calculator and a User formula cannot answer differently; `roundAwayFromZero` **settles binary noise
  to 15 significant digits before rounding**, Excel's own rule (TICKET-SKL-04), and its JSDoc records
  why `rounddown`/`floor`/`ceil` are deliberately left literal.
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
  resolves at the `roll-input` owner (TICKET-SKL-02) and **nowhere else** — a derived stat is
  computed before any skill has a value, so it is out of scope there rather than merely
  unresolved (CR-02).
- `formula/constants.ts` — `constantsNamespace(constants)` → the `const.*` resolver
  (TICKET-CST-01). **The exemplar `NamespaceResolver` to copy**: resolution is by
  display name, the stored formula holds the id, and an unknown member or a property access comes
  back as a distinct error value rather than a zero. Also `namedConstant(constants, name, fallback,
  accepts)` (CR-26) — **the one way the engine reads its own numbers** (`race_blend_divisor`,
  `bonus_divider`, `points_per_level`): it routes through the resolver above, so a duplicate name
  means the same constant here as in a formula, and falls back to the seed when the value is
  absent or unusable. Never a bare `constants.find(...)`. Since TICKET-SKL-05 it is
  `optionalConstant(constants, name, accepts) ?? fallback` — reach for the optional one when *unset*
  has to be told from *set to what the fallback would have been* (the focus dials, where absent means
  the ruleset does not play with focus at all).
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
  column is a property segment, checked at evaluation rather than here. The owners are `stat`,
  `curve-generator` and `roll-input` (TICKET-ROLL-05 — a roll sees what a derived stat sees
  **plus `skills`**, because it is computed after them). **A `stat` may not name `skills.*`**
  (CR-02): skills are computed *from* the finished stat values, so `calculateStatValues` has no
  skill resolver and a stat reading one is a cycle across the pipeline, not a wiring gap. A row
  only lists what its calculator can actually resolve — anything else produces formulas that
  validate, preview and save, and then error on every sheet.
- `formula/validator.ts` — `validateFormula(formula, availableCodes?, scope?)`,
  `validateFormulaCollection`, `detectCircularDependencies`, `dependencyKeysOf`,
  `toFormulaDependency`, plus a private `walkFormula(ast, visit)` that is the single place knowing
  the AST union's shape — **extend that when adding a node type**, not each analysis pass.
  Passing a `scope` turns on the three scoping errors (unknown namespace / not available here /
  unknown member). **Use `toFormulaDependency(node, resolve)` to build cycle-graph entries** — it is
  what makes `stats.health` and bare `HEALTH` land on the same node. The graph is keyed by **entity
  id**, so both take a `ReferenceResolver` from `buildReferenceResolver(config)`
  (`formula/references.ts`) that turns a display spelling into the id it names; keying edges by
  spelling is what made the detector dead in production before CR-01. A node carries a `label`
  (the entity's name) because a chain of UUIDs is unreadable.
- `formula/formulaChange.ts` — `validateFormulaChange(config, change)`, the **save-time guard** the
  formula-owning `useXManager` hooks call before writing to the store. It validates the
  configuration *as it would be after the save* (syntax → cycles → undefined codes) and reuses the
  validator's detector rather than adding a second one. Reference scope per attachment point is
  the table in `scoping.ts`, not a branch here. **A `Skill` is neither an attachment point nor a
  graph node** (TICKET-SKL-02): it holds weight rows rather than a formula, so it cannot be part
  of a cycle, and `skills.*` is a leaf. A stat may name another stat, so that graph is no longer a
  DAG by construction — `calculateStatValues` resolves in passes and reports a cycle as error values.
- `calculators/statCalculator.ts` — **the composition calculator** (TICKET-STAT-01):
  `calculateStatValues(stats, character, options)` answers "what is this stat worth" for all three
  kinds — invested (`race stat block + points + equipment`), resource (the same sum, read as a
  maximum) and derived (its formula) — then clamps to `min`/`max`, rounds, and clamps again so a
  **fractional** bound cannot be rounded past (CR-41). Plus
  `calculateStatTotal`, `statVariables` (the flat map keyed by abbreviation, for the downstream
  formulas), `calculateRaceStatBases` (the races' **blended** stat block on its own, keyed by stat
  **id**, for display — TICKET-RACE-01/02, plus TICKET-RACE-03's `withBlendFloor`: the sheet's
  `MAX(1, …)`, so a pairing that supplies nothing supplies 1). It blends the ruleset's own
  `const.race_count` blocks and divides by `const.race_blend_divisor`, which **defaults to that
  count** (TICKET-RACE-04) — the number itself lives in `engine/races.ts`, not here.
- `races.ts` — **how many races a character has, and which** (TICKET-RACE-04). `raceCount(constants)`
  reads `const.race_count` (absent means the sheet's 2); `racesRequired(config)` is the creation
  rule's number, which is that count except that a ruleset offering no races requires none;
  `resolveRaces(config, raceIds)` turns picks into blocks in **pick order, duplicates kept, capped at
  the count**, so a pure-blood picked twice is two blocks and a character stored at a higher count is
  named and blended over one list. The one place the count is written — `MAX_RACE_COUNT` is
  gone, and `races.test.ts` fails if a former call site spells the number again.
- `calculators/skillCalculator.ts` — `calculateSkills(config, statValues, character, gearBonuses)` → `{ levels, bonuses, contributions }`, all keyed by skill id (TICKET-SKL-02; `contributions` added by TICKET-SKL-03 — one `SkillStatContribution` per weight row with `weight × statValue` **already multiplied**, so the sheet labels terms it never recomputes; empty for a level that failed). `level = ceil(Σ(weight × stat)) + invested`, `bonus = ceil(level / const.bonus_divider) + Σ gear` — **both halves round up** since TICKET-SKL-04, through `roundAwayFromZero` — the formula library's Excel `ROUNDUP`, which settles binary noise to 15 significant digits before rounding so a duo skill's `3.0000000000000004` cannot buy a whole level (the settle lives in that shared function, so a User formula spelling the same arithmetic agrees). Invested points are added **after** the level's round-up, so a bought point stays whole; the rounding is an engine rule rather than a ruleset dial (the ticket records why), while the divider is still read **by name** and falls back to Concept 05's seeded 5. TICKET-SKL-05's focus multiplier multiplies the weighted sum *inside* the round-up. A weight naming a stat that no longer exists contributes nothing; a stat whose own formula failed yields an `upstream` error naming it, with the original as `cause`. The invested term is 1:1 and **provisional** — TICKET-ARC-02 routes it through the point-buy curve. **`gearBonuses` is a required fourth parameter** (TICKET-ITEM-01, on `statGain`'s precedent): the equipped templates' per-skill vector, already totalled by `equipmentBonusCalculator`, added to the **bonus** *outside* the round-up — put inside the divide it would be worth a fifth of itself, and put on the level it would be multiplied by focus picks it has nothing to do with. A caller with no gear passes a named empty map rather than relying on a default.
- `calculators/rollCalculator.ts` — `calculateRollInputs(config, statValues, skills)` → `Record<rollId, FormulaResult>` (TICKET-ROLL-06). Each roll definition's input expression over the composed numbers — the value fed to the ladder. Replaced `combatSkillCalculator`, and the swap is the entity's argument: that produced a *bonus* added to a hand-typed pool, this produces the *input* a pool is derived from. Keyed by roll **id**; no equipment term (TICKET-MAT-02).
- `calculators/equipmentBonusCalculator.ts` — what equipped gear is worth, on **both** axes. `calculateEquipmentBonuses` aggregates each worn build's **material tier row plus its inlay tier row** into one `StatModifier[]`, keyed by stat **id** (TICKET-INV-05 added the inlay half; the workbook puts Mana and Speed on the gem table alone, though nothing here knows that — it adds whatever rows each tier has); `indexStatModifiers(modifiers)` → `Record<statId, number>` turns any `StatModifier[]` into a per-stat lookup, for showing a stat's equipment contribution on its own. Since TICKET-ITEM-01 `calculateEquipmentSkillBonuses` does the same for the *template's own* per-skill vector → `Record<skillId, number>`, walking **`config.equipmentSlots`** so the slot count is the ruleset's (TICKET-INV-04). **The two terms cannot double-count**: a tier names a stat and a template names a skill, so no shape lets one modifier be both. **Both read one private `equippedCompositions` walk over `config.equipmentSlots`** (`equippedTemplates` until INV-05), which is what stops them disagreeing about what is worn: the stat term walked `Object.values(equippedItems)` until ITEM-01, and a slot force-deleted through `useGuardedDelete`'s *Delete anyway* left the same item granting its material's stats and none of its skill vector. A retired slot equips nothing on either axis now, and neither does a build whose *template* the ruleset has dropped — a build whose **tier** is missing keeps its skill vector and loses only that tier's stat rows. `materialTierOf` / `inlayTierOf` look a rung up by its **number**, never by array position: `Inlay.tiers` is insertion-ordered and a family may skip a rung.
- `calculator.ts` — re-exports the calculators, plus **`calculateCharacter(character, config):
  CalculatedCharacter`**, the single composed entry point (equipment → stats → skills →
  roll inputs, in that order). Call it for any derived number; don't compose the calculators by hand.
  `calculateCharacterStats()` remains as a thin documented wrapper returning just `.statValues`.
  **Equipment applies exactly once, at the stat composition** (TICKET-MAT-02): a tier modifier
  names a stat, so the skill steps have no equipment term to claim a second share with — they read
  stats the bonus has already moved, which makes double-counting structurally impossible rather
  than merely avoided.
- `dependencies.ts` — **the reference walker** (TICKET-REF-02): `findReferences(target, config,
  characters)` → `EntityReference[]`. **A `Record<ReferenceTargetKind, walker>` since
  TICKET-SPL-01**, where it was a fifteen-arm `switch` with a `never` default before: each arm is a
  named module-level function taking `(id, config, characters)`, `REFERENCE_WALKERS` maps the kind to
  it, and `findReferences` is a lookup and a call. **Add a kind by adding a row** — the `Record` makes
  a missing one *and* an invented one a compile error naming the key, where the `never` default caught
  only the first and only at the bottom of a function. Pure over
  both stores' data; `configStore`'s delete actions call it. Answers "what points at this?"; the
  formula half goes through `validateFormula`, never substring matching. Since TICKET-INL-01 the
  `stat` arm also walks **inlay tier grants** (`inlayBonusReferences`, beside
  `materialBonusReferences`). Since TICKET-INV-05 the `item`, `material` and `inlay` arms are one
  walk — `composedItemReferences(characters, field, names)` — because all three are pointed at from
  the same place by the same kind of reference: a `ComposedItem` in somebody's inventory naming its
  parts by id. That arm also filled the `inlay` kind INL-01 shipped deliberately empty, and
  `shared/engine/referenceArms.test.ts` is what makes leaving one empty a **failure**: the table's
  exhaustiveness catches a missing *kind* and says nothing about a new *referrer* to an existing one,
  so that file scans the source per (kind, field) pair and asserts the implication. **Its `spell` row
  is the first that has ever fired**: SPL-01 wrote it vacuous against `learnedSpellIds`, a spelling
  read out of `systems/13-spells.md` rather than off a type, and SPL-02 adding the field turned the
  file red on that same run — before the arm was written. Both rows are load-bearing now. Since TICKET-ITEM-01 the `skill` arm walks **item
  templates' bonus vectors**
  (`itemSkillBonusReferences`) — a config→config reference, so deleting a skill that templates grant
  is refused and names them. **A new field on
  `Character` that names a config entity by id belongs in a case here**, beside `raceIds`,
  `archetypeId` and (since TICKET-SKL-05) `focusSkillIds` — and so does a new **config** field naming
  another config entity. The walker is what makes a delete
  *guarded* rather than merely survivable, and a reference it cannot see is one a User is never
  warned about.
- `validator.ts` — `validateConfiguration(config): ValidationReport` (cross-entity referential
  integrity: formula refs, equipment slot types, material categories, circular formulas). It is
  the *after the fact* report — `dependencies.ts` is the *before the fact* guard, and both stay:
  the validator still catches what an import brings in. **Three severities since TICKET-SKL-03**:
  `error` (fails `isValid`), `warning`, and `information` for an observation that is not a defect —
  Concept 02's weight-sum balance rule is the first. A new rule picks `information` when the User
  may well have meant it; anything reported as a warning should be something they would want to
  change. The report has one array per severity, and a consumer flattening it for the
  `ui/ValidationReport` primitive must include all three.
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
  highest tier where the amount is still ≥ 1 — what Req 10.4's "appropriate tier" means here),
  `formatCurrency(value, tiers)`, and TICKET-CUR-02's pair: `baseTier(tiers)` (the least valuable —
  what a `Character.purse` is measured in) and `formatPurse(purse, tiers)`, which is base →
  normalize → format and falls back to a bare number for a ruleset with no currency at all. Conversion is arithmetic over a configured rate, **not** a
  user-authored expression, so it does not go through the formula engine. Unknown tiers and
  non-positive rates degrade rather than producing `NaN`/`Infinity`.
- `dreamLevel.ts` (TICKET-RES-04) — `dreamLevelOf(character)` and `DEFAULT_DREAM_LEVEL`. **The one
  reader of `Character.dreamLevel`**, which is optional and **absent means 1**: the neutral default
  belongs here rather than to a backfill or to a `?? 1` at a call site, so the sheet's identity
  block, the DM's before/after and TICKET-ARC-04's gain term (main × dream, sub + dream) cannot
  disagree about what an untouched character is. A stored number comes back as it stands — only
  `dmActions.setDreamLevel` writes the field, and it refuses below the floor rather than clamping.
- `focusSkills.ts` (TICKET-SKL-05) — the three **focus picks** that multiply a skill's growth.
  `focusDials(constants)` reads `const.focus_chosen` / `const.focus_other` and reports whether either
  was `stated`; `focusMultiplier(skillId, picks, dials)` sums one factor per slot (0.9 unchosen, 2.1
  chosen once, **3.3 chosen twice** at the sheet's 1.5 / 0.3 — duplicates stack, which is why the
  picks are a list); `focusPicksOf(character)` is **the one reader of `Character.focusSkillIds`**
  (absent means none, `dreamLevel.ts`'s pattern); `toFocusSlots(picks)` pads to `FOCUS_SLOT_COUNT`
  for a picker; `focusPickRefusal(picks, config)` is **the one rule both writes share** — at most
  three, every one a skill the ruleset has — and `focusPicksField(picks)` is the one spelling of
  *none*, returning `{}` for an empty list so a character who cleared their last pick and one who
  never made any are the same document (a caller **replacing** picks drops the old key first).
  **Absent dials are neutral by arithmetic rather than by a
  branch**: each defaults to `1 / FOCUS_SLOT_COUNT`, so a ruleset that states neither multiplies by
  exactly 1. Three slots is an engine constant, not yet a dial (the ticket says when it becomes one).
- `formula/template.ts` (TICKET-SPL-03) — **prose with formulas in it**, which is what a spell
  effect is (v4 D4). The grammar is the whole module: `{` opens a placeholder, the next `}` closes
  it, everything else is text kept byte-for-byte, and **three states are text rather than syntax** —
  no braces, an unclosed `{`, an empty `{}` (braces kept). `parseTemplate` splits;
  `templateFormulas` lists the sources (for the validator and the delete guard);
  `mapTemplateFormulas` rewrites the placeholders and leaves the prose alone (which is how
  `references.ts` translates a template without learning the grammar); `resolveTemplate` evaluates
  each one against a `FormulaContext`. **There is no arithmetic in it** — not a `+`, not a
  `Number()` — and its one engine call is `evaluateFormulaString`, which is what makes *no second
  evaluator* checkable rather than intended. `parseTemplate` carries **two cursors**, one for where
  the prose run began and one for where to search: a single cursor silently deleted everything
  before a `{}`, which is why that function has a test rather than an obvious implementation. The
  transcriber's page is
  [`docs/v4.0_sheet_parity/spell-template-grammar.md`](../../../docs/v4.0_sheet_parity/spell-template-grammar.md).
- `spellbook.ts` (TICKET-SPL-02) — the **read side of `Character.learnedSpellIds`**:
  `learnedSpellIdsOf(character)` is the one reader of the optional field (absent means none,
  `focusPicksOf`'s and `dreamLevelOf`'s pattern, and it never de-duplicates or trims — every write
  refuses a duplicate, so a repeat came from a hand-edited file), and `spellbookOf(character, config)`
  is the **sheet's own `FILTER`**: the learned subset in **compendium order** (so a book reads the
  same way down every page and a spell does not move when another is learned), with any id the
  ruleset has lost appended after it as a `SpellbookEntry` whose `spell` is `null`. **Nothing is
  pruned on read** — the guard in `dependencies.ts` refuses the delete that would create such an id,
  and drawing the leftover is what lets a Player clear one that was forced through. There is no
  `learnedSpellsField` counterpart to `focusPicksField`: only `removeLearnedSpell` can empty the
  list, so *none has one spelling* is stated at that one write.
- `composedItems.ts` (TICKET-INV-06) — the **read side of a `ComposedItem`**: `materialTierOf` /
  `inlayTierOf` (a rung is found **by its number**, never by array position — neither ladder is kept
  dense or sorted), `composedItemLabel` (the derived display phrase, the sheet's own
  `material & " " & item & " with " & inlay & " inlay"`, minus its double-space quirk),
  `wornBuildIds` and **`backpackOf`** — everything built and not worn, which is the whole of what the
  Backpack is. Nothing here is stored: rename a material and every build made of it is relabelled on
  the next render, and there is no carried list to keep in step with the slots.
  `equipmentBonusCalculator.ts` walks `wornBuildIds` too, so what the sheet counts and what the bag
  shows cannot disagree.
- `characterSummary.ts` — `calculateCharacterLevel(character, config)` and
  `toCharacterSummary(character, config)`. **The single definition of "level"**, and since
  TICKET-RES-01 it is a **reverse lookup on the `xp_thresholds` curve** — accumulated XP in, level
  out — not the sum of `investedStatPoints` that v1.0 used. Returns a `FormulaResult`: the curve is
  User data that can be deleted or set to refuse out-of-range input, so a level that cannot be read
  chips rather than claiming 1. The curve is found **by name**, like `const.bonus_divider` and
  `const.race_blend_divisor`, so renaming it breaks the link rather than following it. Every screen
  showing a level reads it from here.
- `calculators/pointBuy.ts` — `statGain(pointsSpent, affinity, curve, dreamLevel)` → what a spent
  point *buys* (TICKET-ARC-02, TICKET-ARC-04), plus `archetypeOf` / `affinityFor` / `pointBuyCurve`.
  The character's archetype tags a stat `main`/`sub`/`non`; that names a **column** of the
  `point_buy` curve, and the points are the key — 15 points buy 12/7/5 off the table. The tag then
  names how **Dream level** enters: `main × dreamLevel`, `sub + dreamLevel`, `non` untouched. The
  shape is hard-wired (the sheet hard-wires it) and the level is a **required fourth parameter**, so
  this module adds no second absent-means-1 rule — callers read `dreamLevelOf(character)` and pass
  the number. Three rules live here rather than in the table: a **negative** spend gains zero (zero
  itself does not — `main(0)` is the seed generator's fractional 0.75, and a sub stat gains the dream
  level flat with nothing spent, which is what superseded ARC-02's *spending nothing gains nothing*),
  a missing curve falls back to 1:1 (amplified all the same, since the term is the formula and not
  the table), and a lookup the table refuses is an **error value** — never a 1:1 fallback, which
  would out-buy the main column, and never amplified. Read by the composition and by
  `skillAllocation.ts`; never re-derive a gain.
- `skillAllocation.ts` — `validateStatAllocation(character, config)` → points spent/remaining,
  per-stat violations (`negative-points`, `derived-stat`), per-skill `skillViolations`, verdict.
  Keyed by stat id and by skill id. The pool is **derived** since TICKET-RES-02:
  `level × const.points_per_level`, so it takes the whole character (the level comes from their
  experience) and both money numbers are `FormulaResult`s that carry the level's error rather than
  substituting a number. An unpriceable pool is `isValid: false`, not unlimited. **`pointsSpent` sums
  the stat boxes *and* the skill boxes since TICKET-RES-05** — the sheet's one `Points Spend`
  (`level × 3 − Points to Use`), so skill investment is no longer free; only skills the ruleset
  actually defines are charged, and a negative one is a `skillViolation` rather than a refund. The
  three collectors behind it (`collectStatSpend`, `collectSkillSpend`, `derivePointBudget`) are
  module-private; the validator is the orchestrator. The creation wizard, the sheet, both
  `characterStore.setInvested*Points` actions, `dmActions.setGrantedPoints` and the server's two
  invest routes all read this; none of them re-sums anything. **The name is inherited** — it prices
  both spends and is on TICKET-DX-09's list to rename. Since TICKET-ARC-02 it also returns `gains` — one row per
  investable stat with its affinity, its points and what they bought — so a surface renders
  "7 points in Char → +9" without touching the curve, and refuses an `unpriceable-gain` rather than
  letting a spend the table cannot value be saved.

- `dice/diceLadder.ts` — `decomposeValue(value, ladder)` → `{ counts: [{ size, count }], flat }`
  (TICKET-ROLL-03): Concept 07's signature mechanic, turning one number into a dice pool by walking
  a configured `DiceLadder`'s `dieSizes` greedily, largest first, with the leftover flat —
  `39` over `[20, 12, 6]` is `1D20 + 1D12 + 1D6 + 1`. **Total**: a negative value, a `NaN` or an
  infinity out of a broken formula, a rungless ladder and a nonsensical `maxPerDie` all come back
  flat-only rather than throwing, with `engine/validator.ts` reporting the ruleset problem. A
  **fractional** value walks like any other and its fraction lands in the flat, which is
  `ROUND`ed the sheet's way — `roundHalfAwayFromZero`, so `.5` breaks away from zero on both sides
  (TICKET-ROLL-08): `22.4 → 1D20 + 0D12 + 0D6 + 2`. Rounding is the last step and nothing re-walks
  after it, so `5.6` is a flat `6` rather than a D6. `flat + Σ(size × count)` is therefore the input
  for a whole value and the **rounded** input for a fractional one. Every
  rung is an entry even at zero — `showZeroTerms` is a *display* choice, so the walk never makes it.
  Also `rollDecomposition(decomposition, rng?)` and `formatLadderNotation(decomposition, ladder)`
  (TICKET-ROLL-04). The roller takes a **decomposition**, not a value and a ladder, so a roll cannot
  disagree with what the sheet displayed, and it reuses `rollDie`/`RandomSource` from
  `diceSimulator.ts` rather than redefining them. The formatter is the single notation definition
  for ladder pools — `0D20 + 0D12 + 1D6 + 4`, descending, uppercase `D`, flat always rendered —
  which is the opposite of `formatDiceNotation` on every count; both live until ROLL-06 deletes the
  older one. It never sorts: a misordered ladder is the validator's error to report.
- `dice/diceSimulator.ts` — `rollDie(sides, rng?)` and the `RandomSource` type, and **nothing
  else**. `rollDice`, `DIE_SIDES`, `DIE_TYPES` and `formatDiceNotation` all keyed off `DiceConfig`'s
  fixed six-die record and went with it in TICKET-ROLL-06.
- `dice/rollDefinition.ts` — `rollRollDefinition(roll, calculatedCharacter, config, rng?,
  timestamp?)` → `RollOutcome | FormulaError` (TICKET-ROLL-06). Runs one roll end to end: read the
  input, decompose down its ladder, roll the pool. **It reads `character.rollInputs` rather than
  re-evaluating the formula** — that is what makes "a roll can never disagree with the sheet"
  structural, since the button label comes from the same map. Injectable `RandomSource` defaulting
  to `Math.random`; production callers pass nothing. Barrelled by `dice/index.ts`.

`RollOutcome` (`types/formula.ts`) is the **only** dice-result shape — `useUIStore`'s `RollResult`
extends it and adds `id`/`characterId`/`characterName`. It carries the whole chain (input, pool,
per-die results, flat, total, notation) because the point of the ladder is that the chain is
visible. `DieRollResult` lives there too, keyed by **size**: `types/` cannot import from `engine/`,
and a d100 is data. Don't reintroduce a second one.

### The parity gate (TICKET-DX-04), across two roots since DX-07

Every ✅-confirmed derivation from the concept pages, as citation-carrying data, run through the
real engine over the real `docs/imports/` corpus. Read
[its README](../../../src/shared/engine/golden/README.md) before touching it — especially the rule
that a failing fixture is never fixed by editing the fixture.

- `shared/engine/golden/fixtures.ts` — the rows (`GoldenFixture` + one interface per group,
  `describeCitation`). **Imports types only**, deliberately, so it stays inside the layering and
  inside the Kernel.
- `client/integration/golden.test.ts` — the suite, **plus the sample ruleset/character builder**.
  It lives in `client/` because it drives both Zustand stores, and the Kernel may not import its
  callers; before DX-07 the same fact was a comment in its header. Adding a coverage group is a new
  array in `fixtures.ts` and one `describe`.
- `client/integration/integration.test.ts` — the other nothing-mocked suite: real stores, real
  storage, real `localStorage`, real engine.

## Services — split across two roots (TICKET-DX-07)

All three modules are the **reference-form boundary** (TICKET-REF-01): what they write holds
id-resolved references, what they hand back holds the ruleset's current spellings. The seam
between the roots is exactly *"does this touch a browser API"*.

**`src/shared/services/` — pure, and the server reuses it verbatim:**

- `importExport.ts` — `serializeConfiguration` (Configuration → JSON text),
  `validateConfigurationShape` (shape check on untrusted JSON, returns `ValidationResult`),
  `importConfiguration` (parse → version gate → validate → display form), plus the
  `ImportExportError` / `ValidationError` / `SchemaVersionError` classes and the retired-field
  table. The `Shape` suffix (CR-21) separates it from `engine/validator.ts`'s
  `validateConfiguration`, which checks *referential integrity of a loaded config*. Complementary,
  both run on an import.
  `importExport.ts` also exports `assertSupportedSchemaVersion` (TICKET-RUL-01) — the version gate
  pulled out of `importConfiguration` so the server refuses a stale document with the *same*
  sentence the Import button produces, rather than a second copy of it — and
  **`importParsedConfiguration`** (TICKET-IO-04), which is the whole import chain with the
  `JSON.parse` taken off the front, so `POST /api/rulesets/import` runs the browser's three gates in
  the browser's order rather than a second chain beside it.
- `characterShape.ts` — `isReadableCharacter` (moved out of `client/services/storage.ts`, which now
  imports it) and `uploadedCharacterErrors` (TICKET-IO-04). *Can this build read this stored
  character?* is a question both roots ask about the same records — the browser on load, the server
  on upload — and two answers to it is how a browser that refuses a roster and a server that happily
  stores it end up in one app. Deliberately **not** `validateConfigurationShape`'s counterpart: it
  checks the three strings a row is stored under plus the four sanctioned pieces of player state,
  and nothing derived, because nothing derived is accepted.
- `copyConfiguration.ts` — `copyConfiguration(source, options)` and `copyName(name)`
  (TICKET-RUL-03). The **only** deep copy of a `Configuration` in the tree, and deliberately so:
  GAM-01's Snapshot is the same operation with a different destination and must not reach for its
  own. Entity ids are **kept** — they only have to be unique within a document, and regenerating
  them would mean re-implementing `references.ts`; what is replaced is the ruleset's own id, which
  is the one identity that leaves the document.
- `formula/scoping.ts` — which references a formula may use, as data. **`FormulaOwner` is a const
  object since TICKET-SPL-03** (`FORMULA_OWNER.STAT` / `.CURVE_GENERATOR` / `.ROLL_INPUT` /
  `.SPELL_EFFECT`) — the *no bare string-union types* rule paid on a union this ticket added a member
  to. `spell-effect` sees exactly what `roll-input` sees (`stats`, `skills` including `.bonus`,
  `const`, `curve`, plus stat abbreviations), read off the xlsx's own effect formulas; `skills` is
  safe there where it is a cycle on `stat`, because an effect is read at **display** time after both
  calculator passes and nothing in a ruleset can reference a spell.
- `playerActions.ts` — **every rule behind a write a Player makes to their own sheet**
  (TICKET-PLY-01): `investInStat`, `investInSkill` (both budgeted against the one pool since
  TICKET-RES-05, through one shared `affordabilityRefusal` that **names the overspend** and lets any
  change *lowering* the total spend through, so an over-budget sheet can always be refunded),
  `chooseFocusSkills` (TICKET-SKL-05 — the **whole list** of picks rather than one slot, because the
  multiplier is a sum over the slots and a slot-addressed write would need an empty-slot sentinel
  stored on the character; what may be in it is `focusSkills.focusPickRefusal`, the same call
  `characterCreationErrors` makes), `setResourceValue`, `adjustResourceValue`,
  `resetResourceToMax`, `equipToSlot`, `unequipSlot`, `composeBuild`, `discardBuild`,
  `addLearnedSpell` / `removeLearnedSpell` / `spendSpellCost` (TICKET-SPL-02 — the last is a **mana
  spend, not a roll**: it ends in `adjustResourceValue(…, -manaCost)`, so there is no second
  arithmetic path, and the pool comes from the request because no ruleset field says which resource
  casting draws on. It refuses four things, each with its own sentence — a spell the ruleset has not
  got, one not in the book, one the ruleset does not **price** (`mighty fortress`'s swapped columns:
  a 0 would be an invented number), and one the pool cannot pay for, **named to the point**. That
  last one deliberately parts from `setResourceValue`, which stays open at the bottom for Req 14.4;
  `removeLearnedSpell` takes no ruleset at all, so a force-deleted spell is still clearable).
  `poolFor(config, statId)` is the shared *is this a pool* lookup behind the three resource actions
  and the cast, returning the `Stat` or the sentence — a `Stat | string` union `typeof` narrows,
  which is what lets a refusal name the pool without looking it up twice. **The four
  inventory actions speak `ComposedItem.id`s since TICKET-INV-05**, `composeBuild` excepted — it takes
  the whole record to make, identity included, and checks all three picks (a template the ruleset
  has, a material at a rung its family actually holds, and a gem the same or no gem at all), refusing
  rather than clamping. **They went from six to four in TICKET-INV-06**: with the Backpack derived
  (`backpackOf`), *wear* and *equip* are one act and *stow* and *unequip* are one act, so
  `moveItemToMisc` / `moveItemToEquipment` / `emptySlot` / `addToPack` / `removeFromPack` collapse
  into these. Taking a thing off keeps it (it is in the bag by not being worn); `discardBuild` is the
  only one that destroys, and it refuses a build being worn. Each takes a `Character` (and the ruleset where the rule needs
  one) and answers `PlayerActionResult` — either the new character **plus what the value was and
  became**, or a `refusal` sentence. Moved out of `characterStore` so the server could call the same
  rules rather than a second copy (D5); the store's actions are now three lines each. **The names
  here describe the document and `PLAYER_ACTION`'s describe the act** — `equipToSlot` is the rule,
  `equip-item` is the route, and keeping them apart is what stopped `fallow` reporting six duplicate
  exports. Before/after is produced here because only this module knows what each action moved.
- `dmActions.ts` — **every rule behind a write the *Dungeon Master* makes to a character**
  (TICKET-DM-01): `addExperience`, `removeExperience`, `setLevelExperience`, `setGrantedPoints`, and
  `setDreamLevel` (TICKET-RES-04 — the User ruled that the DM raises the dream level, on the surface
  that already awards experience; below 1 is refused with the floor named, and the before comes from
  `dreamLevelOf` so a character who never had one reports 1).
  `playerActions.ts`'s counterpart, with the same `PlayerActionResult` shape and the same
  names-describe-the-document rule (`DM_ACTION`'s values describe the act). **The local sheet calls
  it too** — signed out there is no DM, and the person awarding their own experience is the same act
  with one person playing both parts, so `characterStore.awardExperience` runs
  `addExperience` rather than the arithmetic it used to own. A DM *setting a pool* is deliberately
  **not** here: that obeys the Player's own rule, so `routes/dm/dmSetResource.ts` imports
  `setResourceValue` from `playerActions.ts` unchanged.
- `freshConfiguration.ts` — `createFreshConfiguration(name)` (TICKET-RUL-01). What a brand-new
  ruleset arrives holding: Concept 05's seed constants, Concept 06's seed curves and Concept 07/08's
  ladder and four rolls. **Moved here from `configStore` rather than copied**, because v3 Req 33.3
  asks that a server-created ruleset and a browser-created one be the same ruleset — so
  `useConfigStore.initializeConfig` and `POST /api/rulesets` call one function.
- `importExport.fixtures.ts` — `makeValidConfiguration()`, the one ruleset both halves' tests are
  written against.

**`src/client/services/` — browser-only:**

- `storage.ts` — LocalStorage keys `dnd_builder_config` and `dnd_builder_characters` (the
  never-written `dnd_builder_ui_state` went in CR-39);
  `saveConfiguration`/`loadConfiguration`/`saveCharacters`/`loadCharacters`/
  `clearAllData`/`isStorageAvailable`/`getStorageSize`, plus `readStoredSnapshot()` — the one read
  that works on data this build cannot open (TICKET-IO-03) — and the `StorageError` /
  `StorageQuotaError` / `StorageParseError` / `StorageSchemaError` classes.
  See the **data-model** skill.
- `api.ts` — `apiRequest` / `apiSend` / `ApiError` (TICKET-RUL-01), the client's way of calling
  `/api/*`. **A relative path with no configurable base**, because the backend is this server (D1).
  `ApiError.code` is typed against `#shared/types/api`'s `ERROR_CODE`, so a caller branching on a
  refusal writes `ERROR_CODE.CONFLICT` and a renamed code breaks both roots at once; `ApiError.body`
  carries the details a route attached (a conflict's `currentRevision`, a shape refusal's `fields`).
  Better Auth keeps its own client for `/api/auth/*`; local mode never calls this at all.
- `rulesetSync.ts` — **the one place a ruleset edit's destination is decided** (TICKET-RUL-02).
  `persistRuleset(source, config)`: the browser home writes LocalStorage synchronously, exactly as
  v2.0 did down to letting `storage.ts`'s throw out; the account home debounces (800 ms), coalesces
  a burst into one `PUT` carrying the last state, and keeps at most one write in flight per ruleset.
  It also owns `RULESET_HOME` and `RulesetSource` — which home is open is a *destination* before it
  is a badge, so the set is declared here and `RulesetCard` renders it.
- `configFiles.ts` — `exportConfiguration` (Blob), `downloadConfiguration`,
  `downloadStoredBackup` (the raw-bytes backup behind `IncompatibleDataNotice`),
  `importConfigurationFromFile` and `readConfigurationDocument` (IO-04 — the same read stopping one
  step short of the gates, for the path where the *server* runs them). Thin: every one of them calls
  the shared half for the actual reasoning and only owns the `Blob`, the anchor and the `File`.
- `rulesetUpload.ts` — **D6's bridge between the two homes, and it only ever goes one way**
  (TICKET-IO-04). `readBrowserUpload()` reads LocalStorage through `loadConfiguration` /
  `loadCharacters` — so unreadable stored data throws the *same* `StorageSchemaError`
  `IncompatibleDataNotice` is built around rather than getting a second message (v3 Req 36.7) — and
  hands back the document in **stored** form beside the characters built on it. `importToAccount()`
  posts it; `claimUploadPrompt()` takes the once-per-Account offer. **Nothing here writes**: the
  module imports only the loading half of `storage.ts`, which is what makes "an upload copies"
  structural rather than careful.

## Server (`src/server/`)

The backend, filled by TICKET-SRV-01. Read
[its README](../../../src/server/README.md) for the rule it is filled under and the table of what
each later ticket adds.

- `entry.ts` — **every request arrives here.** `/api/*` goes to `http/apiRouter.ts`; everything
  else falls through to TanStack Start's SSR handler. `vite.config.ts` points
  `tanstackStart({ server: { entry } })` at it, and the dev server and the production build call
  the same module — one process, one origin, in both (D1). It is also *why* API route files are not
  in `client/routes/`: they never have to be, so D14's boundary needs no exception.
- `env.ts` — the **only** reader of `process.env` in `src/`, asserted by a test that walks the
  tree (a *test* may assign to it to arrange an environment; nothing may read one). `ENV_VARIABLES`
  is the table; `.env.example` is checked against it; required variables are eager and a missing one
  names *every* missing key at once. `DATABASE_URL` and `BETTER_AUTH_SECRET` are the two required
  ones. **Two refusals are conditional rather than table-driven** (TICKET-AUTH-02), both failing
  closed: half an OAuth credential pair names the missing half, and a configured provider with no
  `AUTH_ALLOWED_HOSTS` refuses to start.
- `http/AppError.ts` — the one error a handler throws on purpose: status + `ERROR_CODE` + a
  sentence. `notFound()` is deliberately the answer to both "missing" and "not yours" (v3 Req 32.5).
- `http/pipeline.ts` — `defineHandler`. A handler **returns data and throws refusals**; it never
  builds a `Response`, picks a status, or catches its own errors. An `AppError` becomes its status
  and code; anything else is a bug, logged server-side and answered with a bare 500.
  `RequestContext.account` is `null` until TICKET-AUTH-03 resolves it.
- `http/apiRouter.ts` — the route tables, keyed `METHOD /path`, and the prefix test that decides
  whether a request is API traffic at all. **Two tables since TICKET-RUL-01**: `ROUTES` is exact and
  is a map lookup; `PATTERN_ROUTES` holds the paths carrying a `:parameter` and is matched by
  segment shape, only when the exact table misses. A matched parameter is **not** handed to the
  handler — the handler reads it off `context.url`, because the alternative was widening
  `RequestScope`, which `pipeline.test.ts` guards as the *who is asking* seam.
- `routes/health.ts` — `GET /api/health`. The dullest route on purpose: every later one copies it.
  Reports database reachability and the applied migration hash (v3 Req 47.5) by asking
  `db/health.ts` — a route never opens a connection.
- `routes/authProviders.ts` — `GET /api/auth-providers` (TICKET-AUTH-02). Which social providers the
  operator configured, **names only**, so the client knows which buttons it can draw. Public: the
  person who needs the answer is by definition not signed in. Spelled with a hyphen because
  `/api/auth` is delegated to Better Auth *whole*, before the route table is consulted.
- `routes/rulesets/` (TICKET-RUL-01) — `/api/rulesets`: `listRulesets` (GET, scoped by
  `requireAccount`, and the payload carries **no `data` document**), `createRuleset` (POST, seeded
  through the Kernel's `createFreshConfiguration`), `renameRuleset` (PATCH — writes the column *and*
  the document, so an export cannot carry a stale name) and `deleteRuleset` (DELETE — refused with a
  409 while a Game_Session was created from it, `?confirm=true` to go ahead, and the session stays
  playable on its Snapshot), plus `getRuleset` / `saveRuleset` (RUL-02 — the document in display
  form, and the revision-guarded `PUT`) and `copyRuleset` (RUL-03 — `POST /api/rulesets/:id/copy`,
  the first path with an *action* segment after the id). `rulesetPayloads.ts` holds what they share:
  the wire summary, the name check, the `:id` reader and the two schema-version gates — a **409**
  for a stored row this build cannot read, a **400** for a submitted document that says the wrong
  version, because those have different remedies. **One module per route on purpose** —
  `routeGuards.test.ts` scans a *module* for a guard call, so several handlers in one file would let
  one `requireOwner` stand for all of them.
  **IO-04 adds `importRuleset` — `POST /api/rulesets/import`, and it is one route serving two client
  paths.** *Import a file* and *upload this browser's ruleset* differ only in where the bytes came
  from; the server runs the Kernel's own `importParsedConfiguration` gates, mints a fresh ruleset id
  through `copyConfiguration`, and creates one character per entry in the request's optional
  `characters` array — each with a new id, a rewritten `configurationId`, and **no session**. The
  referential report rides back on the response rather than refusing the write (v3 Req 35.3). Its
  path is a **literal** in `ROUTES` rather than a pattern, because `POST /api/rulesets/:id` is not a
  route and a pattern-only lookup would answer it 405.
- `routes/uploadPrompt.ts` (TICKET-IO-04) — `POST /api/account/upload-prompt`. The one unprompted
  offer to upload, **claimed rather than read**: an `INSERT … ON CONFLICT DO NOTHING` whose answer is
  whether it inserted, so two tabs restoring one session cannot both be told yes (v3 Req 36.6).
- `routes/sessions/` (TICKET-GAM-01) — `/api/sessions`, the **second owned resource** and the room
  everything after it is scoped to: `createSession` (POST — copies the Ruleset into a **Snapshot**,
  which is D7, and seats the creator as DM in the same transaction), `listSessions` (GET, joined on
  membership and carrying no Snapshot), `readSession` (GET one — **named `readSession`, not
  `getSession`**, because `pipeline.test.ts` asserts exactly one module names that word and it is
  `auth/currentAccount.ts`), `archiveSession` and `refreshSnapshot`. `sessionPayloads.ts` holds the
  shared translation plus **`requireActive`**, which is the whole of *an archived session accepts no
  writes* — a **409**, called by every write and by none of the reads. `snapshotConflicts.ts` is the
  ticket's real content: which characters a refresh would invalidate, decided by
  `validateStatAllocation` rather than by a second notion of validity, and named from the **old**
  Snapshot because a removed stat has no name in the new one.
- `routes/entityName.ts` (TICKET-GAM-01) — `requiredName(body, subject)`. The name rule every
  aggregate's `nameFrom` wraps; extracted at the **second** caller because `fallow` measured the
  ruleset and session copies as a 25-line clone.
- `routes/invites/` (TICKET-GAM-02) — `GET`/`POST /api/invites/:code`, **the only two routes in the
  milestone reached without a membership**: you are not a Member yet, which is the point. What
  stands in for a guard is the code itself, the limiter, and four distinguishable refusals.
  `inviteCode.ts` mints one — `crypto.getRandomValues` over ten characters of Crockford's Base32
  (≈50 bits), and `normalizeInviteCode` reads `O` as `0` and `I`/`L` as `1` so hearing a code wrong
  is not a failure. `redemptionLimit.ts` is a per-Account **and** per-code bucket, in memory.
  `invitePayloads.ts` is the module to read first: **`resolveInviteFor` is the only door**, and the
  `resolveInvite` beneath it is deliberately not exported — the GAM-02 review found `GET` bypassing
  the limiter, which made an unmetered oracle of the preview route and the whole "fifty bits is
  expensive to guess" argument false. `previewInvite` answers an archived table **200 with
  `isJoinable: false`** while `redeemInvite` refuses it 409, which is the one asymmetry: *this game
  has ended* is a sentence to read, not an error to decode.
  **`redeemInvite` never spells `sessionId`** — `seatSessionMember` takes the loaded session row —
  because `routeGuards.test.ts` reads a handler naming one as *this route had better call a resource
  guard*, and this is the act that cannot. Same trade as IO-04's `insertUnseatedCharacter`.
  Beside them, `routes/sessions/issueInvite.ts` and `revokeInvite.ts` are the DM's half; **archived
  refuses issuing but allows revoking**, because a DM who archived first must still be able to
  invalidate a link they posted publicly.
  **GAM-04 closed the membership half**: `GET /api/sessions/:id/members` is the lobby (every Member
  reads it, not just the DM); `DELETE /api/sessions/:id/members/:accountId` is **remove and leave in
  one route**, because they are one act with two actors and who may ask is three comparisons rather
  than a second file; `POST /api/sessions/:id/dm` transfers the role, in one transaction that
  demotes before it promotes because `session_member_one_dm` is a partial unique index. The DM's own
  seat is refused (v3 Req 39.6) and the refusal names the way out.
  **CHAR-04 added the characters half**: `POST /api/sessions/:id/characters` builds one against the
  **Snapshot** through the Kernel's `buildCharacter` and `characterCreationErrors` — the same two
  functions the browser's store calls — and `GET /api/sessions/:id/characters` is every Member's,
  because a game is played out loud. `routes/characters/characterPayloads.ts` holds the rule the
  ticket exists for: a body carrying a **derived** field is refused *by name* rather than stripped.
- `routes/characters/` (TICKET-CHAR-04) — the Account-scoped half of a character: `GET /api/characters`
  is the ones that sit at **no table** (IO-04's uploads, which had no surface at all until now) and
  `DELETE /api/characters/:id` removes one. A character *at* a table is refused with a 409 — GAM-04
  settled that a departing player's are retained, so deleting one is its own ticket.
  **PLY-01 added `readCharacter`** — `GET /api/characters/:id`, which is what makes a session
  character's sheet a page rather than a moment: the document carries its `sessionId`, so a reload or
  a pasted link can open the right Snapshot before calculating anything.
- `routes/rolls/` (TICKET-ROLL-07) — **the dice move to the server**: `POST /api/characters/:id/roll`
  recomputes the character against the Snapshot, calls the Kernel's own `rollRollDefinition` with the
  server's RNG, appends the whole `RollOutcome` as an Event and answers with it — and
  `GET /api/sessions/:id/rolls` reads the table's log back, every Member's to see. A body carrying
  `total`, `dice` or `input` is refused **by name**: a stat value a client invents is a claim anybody
  can redo, and a die a client invents is a claim nobody can check. The RNG seam is a **factory**
  (`rollDiceHandler(rng)`), so no test spies on `Math.random`. **Beside `routes/play/` rather than
  inside it**, because a roll's rule is the dice engine and that folder's scan forbids reaching one.
  The log is the first read of the `event` table, keyed `(session, seq)` — the index LIVE-03 replays
  from, so that ticket adds no schema.
- `routes/play/` (TICKET-PLY-01) — **the writes a Player makes at a table**, thirteen of them since
  TICKET-SPL-02's `learn-spell` / `unlearn-spell` / `cast-spell`,
  one module each, all `POST /api/characters/:id/<action>` where `<action>` **is** the `PLAYER_ACTION`
  value. That one string is the path, the Event's `type` and the client's call, which is what keeps
  a route, a log entry and a store action from drifting into three names for one act. Each module is
  a guard, a body read and one Kernel call; everything they share is `playPayloads.ts` —
  `applyPlayerAction`, which reads the rules from the session's **Snapshot** (never a Ruleset),
  refuses a character at no table and an archived one with a **409**, and on acceptance writes the
  character and its Event in **one transaction** (`characterRepository.recordPlayerAction`). The
  guard is **`requireCharacterPlayer`**, not `requireCharacterWriter`: a DM editing a player's sheet
  is `routes/dm/`'s, with its own Event types. `playerRules.test.ts` is the provenance check — every
  handler here imports the Kernel's rules and **none** imports `#shared/engine/` directly, because
  that is where a second implementation starts.
- `routes/dm/` (TICKET-DM-01) — **what the DM does to a character they do not own**, six writes and
  one read. Same shape as `routes/play/` with a different guard: `POST /api/characters/:id/<action>`
  where `<action>` is a `DM_ACTION` value — `dm-award-experience`, `dm-deduct-experience`,
  `dm-set-level`, `dm-grant-points`, `dm-set-resource`, `dm-set-dream-level` (TICKET-RES-04, the
  sixth: the one `dm-set-*` whose body *is* what gets stored, because nothing derives a dream level). The **`dm-` prefix is load-bearing**: both
  kinds of Event share the `type` column, so a DM's *set-resource* and a Player's have to be tellable
  apart by a reader six months later. They reuse `playPayloads.applyPlayerAction` whole rather than
  growing a second pipeline — it is the same operation, and the guard is the difference. The guard is
  **`requireCharacterDM`**, which is `requireCharacterWriter` minus the *owner* exactly as
  `requireCharacterPlayer` is that guard minus the DM. `dm-set-level` is the one route whose body
  names a level and it stores **none**: the server prices it off the Snapshot's `xp_thresholds` curve
  and writes *experience* (D9). `GET /api/characters/:id/adjustments` reads the history back for the
  owner and the DM alike (v3 Req 42.7), narrowed to that character **in the query** so a busy table
  cannot drop somebody's own log off the cap. `dmRules.test.ts` is the provenance check, plus the one
  `routeGuards.test.ts` cannot make: that every write is behind the *DM* guard rather than the writer
  guard a Player also passes.
- `routes/invitations/` (TICKET-GAM-03) — the **addressed** invitation, and the first collection in
  the app scoped to an **Account** rather than to a ruleset or a session: an invitee is not a Member
  of the table that wrote to them, so there is no session id they could put in the path.
  `GET /api/invitations` is what is waiting for you, `POST /api/invitations/:id/accept` and
  `/decline`, `DELETE /api/invitations/:id` is the DM taking one back. `invitationPayloads.ts` holds
  `inviteStateOf` — the five states are **derived from four timestamps** rather than stored, and
  `settledRefusal` turns each into its own sentence (v3 Req 38.4). The DM's half lives next door as
  `routes/sessions/inviteByEmail.ts` and `listSessionInvites.ts`, because that half really is about
  *this table*. **No mail is sent, ever** (D12), and since GAM-03 that is a dependency-cruiser rule
  — `the-server-sends-no-mail` — rather than a paragraph.
- `auth/` (TICKET-AUTH-01, TICKET-AUTH-02) — identity, and **only** identity; authorization is
  AUTH-03's and lives outside it. `authServer.ts` configures Better Auth (what is switched off and
  why is in its header); `authRoutes.ts` delegates the `/api/auth` subtree and adds the per-address
  sign-in limit `signInRateLimit.ts` owns; `currentAccount.ts` resolves the cookie to an Account or
  to nobody, once per request. AUTH-02 adds `socialProviders.ts` (env credentials → the library's
  config block, each provider independently optional) and **`identityRules.ts`** — the one
  provider-agnostic rule path v3 Req 31.7 asks for, reached through Better Auth's single
  `user.validateUserInfo` gate, refusing a provider profile with no email or an unverified one.
  **AUTH-03 adds [`guards.ts`](../../../src/server/auth/guards.ts), and it is the only module that
  decides *may they*** — `requireAccount`, `requireOwner`, `requireMember`, `requireDM`,
  `requireCharacterWriter`, and GAM-03's **`requireInvitee`**, the odd one: an invitee owns nothing
  and sits at no table, so what stands in for ownership is that the invitation's `email` matches the
  one their Account registered. **GAM-04 changed `requireCharacterWriter`**: it asks whether the
  **owner** still holds a seat before it asks anything about the caller, so a departed Member's
  Characters are read-only for everybody — the DM included — which is what retention means
  (v3 Req 39.3). Two refusals and the line between them is the design: **401 before any
  lookup** (so it says nothing about the resource, and the client can offer sign-in), **404 for
  everything after** — wrong Account, non-member, player-asking-for-DM and missing id are one
  answer, which is v3 Req 32.5. Each guard returns the loaded row so a handler does not fetch
  twice. `routes/routeGuards.test.ts` walks every module containing `defineHandler(` and fails on
  one that reads an owned identifier without calling a guard.
  **AUTH-04 adds `sessionLifetime.ts`** — the idle window, the absolute ceiling and identifier
  rotation, as pure functions so they can be tested by driving a clock. The trick the whole design
  rests on: renewal writes `min(now + idle, createdAt + absolute)`, which makes the ceiling an
  *ordinary expiry* the library already refuses everywhere.
- `db/` (TICKET-DB-01) — `client.ts` owns the `better-sqlite3` connection (`foreign_keys = ON`,
  WAL) and `createDatabase(':memory:')` is what every test opens; `schema.ts` is the Drizzle schema
  and the place the document-vs-table decision (D4) and each cascade rule are written down;
  `migrate.ts` applies `migrations/` at start-up, forward-only, each file in a transaction.
  `yarn run db:generate` writes a new migration after a schema edit.
  **`authAdapter.ts` is a wrapper, not a pass-through, since AUTH-04.** It applies the session rules
  `authServer.ts` hands it to four adapter operations — `create`, `findOne`, `findMany`, `update`
  and `delete` — because the adapter is the only seam with the stored row and the pending write in
  hand at once. `findMany` and `delete` are both needed for one thing: Better Auth signs out by the
  token the **cookie** carried, and looks the row up with `findMany` before deleting it.
- `repositories/` — **the only code that issues queries.** Handlers call repositories; they never
  build SQL or touch Drizzle, and TICKET-DX-08 makes that a dependency-cruiser rule. DB-01 landed
  `rulesetRepository` (including the revision guard: the check and the increment are one statement,
  so the loser of a race updates zero rows) and `eventRepository` (append-only, `seq` unique per
  session by constraint); AUTH-03 added `gameSessionRepository` (membership by session + account)
  and `characterRepository`, both read-only until GAM-01 and CHAR-04. Each later ticket adds its own
  aggregate. **RUL-01 added the four a handler actually calls**: `listRulesetsByOwner` (which does
  not select `data`), `renameRuleset`, `deleteRuleset`, and `countSessionsFromRuleset` on the
  session side, which is the whole of Req 33.7's delete guard.
  **IO-04 added `insertUnseatedCharacter`** (a character owned by an Account and at **no** table —
  `session_id` became nullable in migration 0003) and `accountPromptRepository.claimUploadPrompt`.
  **GAM-01 filled out `gameSessionRepository`**, which had held one read since AUTH-03:
  `insertGameSession` (the session and its DM's `session_member` row in **one transaction** — a
  session whose membership row failed is a table its own DM is locked out of, because `requireDM`
  reads that table and not `dm_account_id`), `findGameSession`, `listSessionsForAccount` (joined on
  membership, `snapshot` deliberately unselected), `updateSessionSnapshot`, `archiveGameSession` and
  `charactersInSession`.
  **GAM-02 added `sessionInviteRepository`** (`issueSessionInvite` — revoke-then-insert in one
  transaction, so reissuing is what retires the previous code; `findInviteByCode`;
  `activeInviteForSession`; `revokeSessionInvites`) and `gameSessionRepository.seatSessionMember`,
  which is **idempotent by constraint**: `ON CONFLICT DO NOTHING` plus a read-back returning
  `{ membership, joined }`, so a double-clicked invite link cannot race itself into a second row.
  **GAM-03 split `session_invite` into two kinds of row and every query says which it means**:
  a *shared door* has a `code` and `email IS NULL`; an *addressed letter* has an `email` and
  `code IS NULL` (nullable since migration 0004), so there is no second way to redeem one. The two
  places `email IS NULL` is load-bearing are `activeInviteForSession` and `revokeSessionInvites` —
  reissuing the code must not withdraw four letters, and the DM's code panel must not show one.
  `findInviteByCode` needs no such clause: an addressed row's `code` is `NULL` and `= ?` never
  matches it. It also added `insertAddressedInvite`, `findSessionInvite`,
  `pendingInviteFor`, `listAddressedInvites`, `listPendingInvitationsFor` (keyed on the **address**,
  which is what makes an invitation sent before the Account existed surface the moment it does) and
  the three settle writes, plus **`accountRepository`** — an address book over Better Auth's `user`
  table, read-only, because identity is the library's to write.
  **GAM-04 added the membership writes**: `listSessionMembers` (left-joined on the Account, so a
  seat outlives a missing profile), `departedCharactersInSession`, `removeSessionMember` — which
  touches **only** `session_member`, and that *is* the retention rule rather than a `WHERE` somebody
  has to remember — and `transferDungeonMaster`, one transaction over three rows, demoting before
  promoting because the partial unique index allows one `dm` per session.
  **Every function takes its connection as a defaulted *last* parameter** — `findRuleset(id)` in
  production, `findRuleset(id, database)` in a test. That is not style: the same rule that keeps
  queries here forbids a handler from importing `db/client`, so a connection-first signature is one
  no route can call. AUTH-03 converted DB-01's two to match.

Server tests call handlers directly with a `Request` and **never boot Nitro** —
`vitest.config.ts` still omits `tanstackStart()`, for the reason its own header records.

## Scripts (`scripts/`)

Node-only tooling, outside the app bundle. `build-sheet-import.mjs` (plus a hand-written
`.d.mts` so the test can import it under `tsc`) merges the per-feature fragments in `docs/imports/`
into `docs/imports/ducklets.json` — `yarn run sheet:import`.
`src/shared/services/sheetImport.test.ts` re-runs that merge in the suite and fails on drift. See
[docs/imports/README.md](../../../docs/imports/README.md).

## Components (`src/client/components/`)

**`ui/` — base primitives.** One folder per component holding `Name.tsx`, `Name.style.ts`,
`Name.test.tsx`. Current set: Button, Input, Select, Textarea, Checkbox, Card, Label, Text,
FormField, Dialog, FormulaEditor, ValidationReport, ErrorChip — **read `ui/index.ts` for the live
list**. They carry intrinsic styling only (colors, typography, padding, borders, states); margin,
flex/grid, and positioning arrive from the caller's `className`.
`libraryConventions.test.ts` enforces all of that by walking the folder, so a new primitive is
covered without editing the test.

`ErrorChip` (TICKET-FORM-06) is the standard stand-in for a value that could not be calculated.
It takes plain `label`/`detail` strings, never a `FormulaError` — the caller turns an error into
words with `describeFormulaError`. That interpreting happens once, in
**`play/derivedValue.ts`** (`DerivedValue` = `{ value, error }`, `toDerivedValue(result)` —
TICKET-STAT-03), so both the sheet and the creation wizard hand their components a rendered
value and neither imports the engine to decide what to draw. Use it rather than reading a
`FormulaResult` in a component.

**`config/` — configuration-mode features**, one folder per domain
(`skills/{skill,shared}`, `stats/`, `materials/`, `items/`, `races/`,
`currency/`, `constants/`, `curves/`, `archetypes/`, `rolls/`). Each domain repeats the same
four-part shape:

- `XConfigPanel.tsx` — layout + composition only
- `XCard.tsx` — one row/entity
- `XFormDialog.tsx` — add/edit form in a `Dialog`
- `useXManager.ts` — the hook holding store selectors, `react-hook-form` state, and handlers

**A panel's frame comes from `ConfigPanelShell`** (`config/shared/`, TICKET-DX-05) — the header
card with its title, description and `actions`, the amber `prerequisites` notes, and the
`BlockedDeleteDialog`. All thirteen config components compose it, so a new section is
`if (!config) return <NoConfigurationNotice />` plus one `<ConfigPanelShell>` — never a
hand-written header. **Two entities on one route means two panels composed at the route**
(`/config/items`, `/config/skills`, `/config/rolls`), each with its own shell and its own
blocked-delete dialog — not one panel with two managers, which forces the second entity's header to
be hand-written at a different heading level than the shell emits. **And one entity means one
manager**: `useItemManager` carried a whole second copy of slot CRUD beside
`useEquipmentSlotManager` while the route mounted both panels, so the page showed two Add buttons,
two dialogs and two lists for one entity (CR-20). A panel that only *reads* another entity — an
item names a slot — reads it from the config and points at the panel that owns it. Its siblings are
`ConfigEmptyState` (the "No X configured yet" card, next to
a list rather than a shell prop, because a section can have more than one list) and
`NoConfigurationNotice`. Panel-specific content goes in `headerExtra` or `children`; **don't add a
prop per panel.**

`config/index.ts` re-exports all of it. **`skills/shared/` is gone** (CR-37): there is one kind of
skill left, so `BaseSkillPanel.tsx` — a one-caller render-prop wrapper over `ConfigPanelShell` —
was inlined into `SkillsPanel.tsx`, and `SkillFormFields.tsx`, unreachable since TICKET-SKL-02
retired the `code` field it still registered, was deleted with it. `skills/skill/` is the whole
folder now.

**`config/shared/` also holds `FormulaPreview`** (TICKET-FORM-08) — the one preview for any
User-authored formula field: editable sample values plus a fixed 1–50 level ladder, taking the
formula, its `FormulaOwner` and the `Configuration` so it scopes and resolves exactly as the saved
formula will. Every formula field renders it; never a bare `FormulaEditor` (CLAUDE.md).

**And `TemplatePreview` beside it** (TICKET-SPL-03), for a field that is prose with `{placeholders}`
in it rather than one formula — it shows one resolved **sentence** instead of one number and a
ladder, validates **per placeholder**, and is what the spells panel's *Effect* box renders. The two
are siblings rather than one component with a flag, because they draw different things; what they
share lives in **`formulaSamples.ts`** (`previewInputs`, `useFormulaSamples` — the boxes, the skill
derivation and the one evaluation) and **`SampleInputs.tsx`** (the boxes themselves), so neither can
disagree with the other or with the value at play time. The resolved sentence is drawn by
`components/shared/ResolvedTemplate`, which a Player's Spellbook renders too.

**`config/shared/StatRowsField`** (TICKET-ARC-01) is the "one row per configured stat" block, with
the empty state for a ruleset that has none. A race's stat block and an archetype's affinity table
both render it, passing their own control as a render prop — the shape exists because the ruleset's
stats decide what an entity has an opinion about, so there is no add/remove control anywhere.

**`components/shared/` holds `affinityGroups.ts`** (TICKET-ARC-03) — an archetype's stats grouped by
affinity, most favoured first, with the words each group is listed under. Both surfaces that show an
archetype render it (the config card and the wizard step), and it calls the engine's `affinityFor`
rather than re-deriving "absent means `non`".

**…and `readableMoment.ts`** (TICKET-GAM-03, moved here by DM-01) — the **only** way this app writes
a moment down: epoch milliseconds in, the reader's own locale out. It lived in `sessions/` while
every caller was a session surface; the adjustment log is the first one that is not, and a shared
rule parked in a folder its callers should not import from is a rule the next component quietly
re-implements — which is exactly what the DM-01 review caught. Six callers.

**`config/shared/` also holds `StatRowsField`** (TICKET-ARC-01) — a titled "one row per configured
stat" block with the no-stats empty state, taking the row's control as a render prop. Both the race
stat block and the archetype affinity table are that shape, because the ruleset's stats decide what
an entity has an opinion about. Reuse it for any future per-stat editor rather than copying the rows.

**…and `ValueRowsField`** (CR-23, generalised by TICKET-ITEM-01) — its **sparse** sibling: rows the
User adds, each naming something and a number. Four callers — a skill's governing weights, a material
tier's modifiers, an inlay tier's grants, and an item template's per-skill vector — so it takes plain
`options: RowOption[]` plus a `targetLabel` rather than `Stat[]`, with `statRowOptions(stats)`
exported beside it so the three stat callers spell a stat one way. The two `register` calls belong to
the caller, because the field-array path is part of the caller's form type. Reach for this for any
future "add a row naming an entity and a number" editor.

**`config/shared/` is cross-domain** (TICKET-REF-02): `useGuardedDelete` holds a delete the store
refused, and `BlockedDeleteDialog` renders the reference list with a "Delete Anyway" force button.
**Every config panel's delete goes through that pair** — a panel never derives references or
decides whether a delete is safe; `configStore`'s delete actions return the reference list
(empty = deleted) and take `{ force: true }`. The advisory `useSkillDependencies` hook and the
`alert()`/`confirm()` guards it sat beside are gone.

**`play/`** — barrelled by `play/index.ts`, mirroring `config/`'s domain-folder shape.
`shared/` is play mode's cross-domain folder, the counterpart to `config/shared/`: `derivedValue.ts`
(above) and `SkillBreakdownRow.tsx`, the "total plus its labelled contributions" row that both the
sheet and the wizard's derived-stat preview render — reuse it rather than re-deriving a breakdown
layout. Its optional `secondary` prop carries a **second** labelled number before the total, for a
row that has two (a skill's level beside its bonus); it is dropped when it carries an error, leaving
the total's chip to explain the one cause once. `pointBudgetView.ts` +
`PointBudgetSummary.tsx` (TICKET-RES-02) are the third: `toPointBudgetView(allocation)` turns the
engine's verdict into display numbers — a pure mapper in its own module, like `derivedValue.ts`, so a
hook does not import a component to get a function — and the component states the source sheet's own
pair, `13/15 Points spent · 2 Points to use` (`Character Sheet` K1:L3, named on both halves since
TICKET-RES-05), chipping instead when the pool cannot be priced. The wizard and the sheet both render
it, so they cannot drift on what "remaining" means — and since RES-05 that one pool covers the skill
boxes too, which is why the wizard states it once on the Stats card rather than a second time over
the Skills one. `useNumericDraft.ts` (TICKET-RES-03) is the
fourth: hold a half-typed number, **commit on blur or Enter**, never per keystroke, with opt-in
`allowRelative` for Concept 20's `+12` / `-7` quick entry. Every editable number on a play surface
goes through it — reach for it rather than re-rolling a draft `useState`.
`characters/` holds `CharacterList` + `CharacterCard` + `useCharacterListManager`.
`creation/` holds the five-step wizard: `CharacterCreationWizard` dispatches on a step index and
the five step components (`IdentityStep`, `ArchetypeStep`, `SkillAllocationStep`, `FocusStep`,
`ReviewStep` — the archetype before allocation since TICKET-ARC-03 because it decides what a point
buys, and `FocusStep` after it since TICKET-SKL-05 because what a focus pick multiplies is the
weighted stat total the Player has just arranged)
are pure props — all state, validation and the submit live in `useCharacterCreation`. That is the
multi-step pattern to copy. `IdentityStep` renders **one `Select` per race slot** since
TICKET-RACE-04 — as many as `racesRequired(config)` says, numbered rather than captioned, each
fillable with a race another slot already holds — because a checkbox list cannot express the
pure-blood that replaced `Empty`. `SkillAllocationStep` takes points for the **invested** stats and the
ruleset's skills — one budget over both cards since TICKET-RES-05 — and previews the derived stats
read-only off the same `calculateCharacter` result the review step uses. `FocusStep` renders **one
`Select` per focus slot** (TICKET-SKL-05), `IdentityStep`'s shape and for its reason — the same skill
may fill every slot, and duplicates are what stack. It keeps `Select`'s disabled placeholder, where
the sheet's own picker offers an explicit *No focus*: an empty slot is a step error during creation
and a choice afterwards.
`sheet/` holds the character sheet: `CharacterSheet` (composition only since **DM-01**, which moved
the six dead-end notices to **`SheetStatusNotice`** and the refusal banner to
**`SheetRefusalBanner`** — `fallow` measured the DM panel and the adjustment log pushing that
component past the complexity threshold, and neither of those subjects is laying a sheet out) and
`useCharacterSheet` (status resolution and the one `calculateCharacter` call), with two hooks beside
it since **PLY-01**: **`useSheetActions`** — every handler the sheet's controls call, split out
because *what the sheet shows* and *what a Player can do to it* are two subjects (the
`useCharacterSubmit` precedent, and the split that took the hook back under the complexity
threshold) — and **`useOpenTableCharacter`**, which reads a character that lives on the server and
then its table's Snapshot, in that order, reporting while it does so the sheet waits rather than
rendering *Different Ruleset Loaded* in between. **It asks the server nothing while nobody is signed
in** (D6). The sheet renders a dismissible refusal banner from `actionError`, and at a table it draws
**neither** the experience controls nor the purse nor the dream-level box — those are the DM's (D9
and the v4 ruling), and an absent control says *not yours* where a disabled one says *not now*.
`SheetHeader` is the identity block the workbook's `Character Sheet` A1:B6 prints: name, level,
**dream level**, XP, races and archetype through `CharacterSummaryLine`, plus the two write controls
above.

**The sections `CharacterSheet` composes, in the order it draws them**, begin
with `SheetHeader`, `RaceStatBlockSection` (the races' combined block, stated in absolutes —
TICKET-RACE-01), `StatsSection` (one `SkillBreakdownRow` per stat in
`order`, **plus** a `StatEditor` for each `isResource` stat and an `InvestedPointsEditor` for each
non-derived one — the breakdown row owns the value and its error chip, the editor owns the current
value, the points editor spends the level-derived pool; TICKET-STAT-03, TICKET-RES-02),
**`shared/labelledGroups.ts` + `StatGroupColumns`** (TICKET-STAT-04, shared by TICKET-ITEM-01 — the
sheet's *Physical* / *Mental* / *Vitals* columns: the pure mapper decides what the columns **are**
from the distinct `Stat.group` values present, in the stats' own order, and the render-prop container
**draws** them. Both `StatsSection` and `ResourcesSection` use the pair, so a group spanning the
pool/stat split draws a column on each side; a ruleset naming no groups is one unlabelled column,
which is the flat list the sheet has always shown. The mapper itself moved to `components/shared/`
when the items panel became its third caller — reach for `groupByLabel` rather than re-deriving a
column set, and `StatGroup` here is just `LabelledGroup<StatBreakdown>`),
**`investedContribution.ts`** (TICKET-ARC-04 — the *"invested 6 → +5.25"* breakdown term, shared by
`StatsSection` and `ResourcesSection` for the same reason the pair above is. Since ARC-04 a gain is
**not** a function of the spend — a main-tagged stat gains `0.75 × dream` and a sub-tagged one
`+dream` with nothing invested — so the label branches: the arrow follows the *gain*, and the bare
`invested` is kept only for nothing-spent-and-nothing-gained. Never re-spell this row inline),
`SkillsSection` (one row per
skill carrying **both** of Concept 02's numbers since TICKET-SKL-03 — the bonus as the row's total,
the level in `SkillBreakdownRow`'s `secondary` slot — over a breakdown of `STR × 0.2 +2` terms plus
the points invested. It takes the sheet's `budget` since TICKET-RES-05 and carries `StatsSection`'s
`canSpend`, because the points spent here come out of the very same pool. There is no `canAdjust`
beside it any more: RES-05's refund rule means the Kernel honours a `−` in every state, so a
disabled one was the UI refusing what the rule allows. **It rounds nothing** — its `ceilLevel` helper
went with TICKET-SKL-04, which moved the level's ceiling into `skillCalculator`, so a level arrives
whole and a term keeps its fraction. Since TICKET-SKL-05 a breakdown can carry a `focus × 2.1 +5.7`
term — the multiplier **and what it contributed**, both from `CalculatedCharacter.skillFocus`, so the
terms still sum to the number the level rounds up from; omitted entirely for a ruleset with no focus
dials), **`FocusSkillsSection`** (TICKET-SKL-05 — the sheet's half of the workbook's Setup form:
three `Select`s, each showing the multiplier its skill comes to, so two slots naming one skill both
read `× 3.3` and the stacking is visible rather than stated. Every write goes through
`characterStore.setFocusSkills`) and `RollsSection` as pure props. **`RollsSection`** (TICKET-ROLL-06) groups
by `category` and labels each button with the **pool** rather than a bonus — `Roll 1D20 + 1D12 +
1D6 + 1` — which is the whole ticket in one line: raise a stat and the label changes, because the
dice are derived from the character.
**`PurseSection`** (TICKET-CUR-02) sits in the same rail as the inventory, as the source sheet's
`Q18:S23` does. One box editing **one** stored amount in the base tier, with `formatPurse`'s reading
above it — so retuning the ruleset's rates relabels it and rewrites nothing. It replaced a per-tier
`WalletSection`/`CoinRow` pair, and that replacement is the ticket's whole argument. Relative entry
through `useNumericDraft`'s `allowRelative`, so `+340` earns and `-12` spends; below zero is the
store's refusal, never a clamp. **Not drawn at a table** — a purse there is the DM's (D9), and
TICKET-DM-02 is what gives them the control.

`dm/` (TICKET-DM-01) holds the DM's half of a sheet, in its own folder because it is read by a
different person: **`DmControlsPanel`** — experience, *set level to N*, the point grant, the dream
level (TICKET-RES-04) and each resource pool, composed from **`shared/AdjustmentField`** (one number
and one button; four kinds of caller now, and `isBusy` is optional because the Player's own header
borrows it where nothing is on a wire — **which is why it lives in `shared/` rather than here**: the
moment `SheetHeader` needed it, `dm/` and `sheet/` would have imported each other) and
the Player's own `ExperienceControl`, which is the same act with a different store action behind it.
**`useDmControls`** answers *is this reader the DM* with a **comparison, not a request**: the server
opens a character only to its owner or to its table's DM, so *at a table and not mine* has exactly
one meaning, and `characterStore.tableCharacterOwnerId` is what it reads. **`AdjustmentLog`** is
what v3 Req 42.7's second half asks for — the Events that changed this sheet, read by the Player
*and* the DM, fetched by **`useCharacterAdjustments(character, atTable)`** (keyed on the character's
id *and* its `updatedAt`, so an adjustment appears under the number it moved, and so a *pre*-
adjustment answer landing last is dropped rather than showing a log an entry short) and spelled by **`describeAdjustment`**, where a
`dm-set-level` reads as the **experience** it wrote and never as a level.

`inventory/` holds `InventoryPanel` (mounted by the sheet, taking only a `characterId`) with
`EquipmentDoll`, `EquipmentSlotTile`, `ItemBuilder` + `PartPicker`, `BackpackRow` and
`useInventoryManager`. Equipping needs no recalculation call: `calculateCharacter` reads
`inventory.equippedItems` at render time. Since TICKET-INV-05 those ids name the character's
**builds**, so the hook resolves each one to a `CarriedBuild` (`{ build, item, label }`) — the id an
equip or a discard names, the template the row is slot-matched by, and the **derived display phrase**
`composedItemLabel` spells (*Iron Ore 10 Battleaxe with Diamond 4 inlay*). **`ItemBuilder` is the
sheet's three-column Item selecter** (TICKET-INV-06): a template, a material family + rung, an
optional gem family + rung, previewed by the same phrase and written by one store action. Its two
part columns are `PartPicker` used twice — which is where *offer only the rungs a family actually
has* lives, sorted by rung number because neither ladder is stored sorted. **The Backpack is derived,
not stored**: `backpackOf` is everything built and not worn, so equipping takes a row out of the bag
and unequipping puts it back without either control touching a list (`MiscItemRow` was renamed
`BackpackRow` here, and `Inventory.miscItems` deleted).

`spells/` holds `SpellbookPanel` (TICKET-SPL-02 — mounted by the sheet beside the inventory, taking
only a `characterId`) with `SpellbookRow`, `SpellLearner` and `useSpellbook`. **Each row's effect is
resolved for the caster** (TICKET-SPL-03): `useSpellbookRows` runs `calculateCharacter` once and
evaluates every learned spell's placeholders through `resolveTemplate` at the `spell-effect` owner,
handing `SpellbookRow` segments rather than a string — drawn by `ResolvedTemplate`, the same
component the config panel's preview uses, so an author and a Player read one sentence. It supplies
**`statVariables` as well as the namespaces**, because `scoping.ts` puts stat abbreviations in scope
there and a code the scope allows but the context cannot resolve is CR-02's bug. **The book is the
sheet's own `FILTER`**, derived by `spellbookOf` rather than read, so learning a spell puts it in the
book and takes it out of the picker with neither control touching the other — `InventoryPanel`'s
Backpack one entity over. Three things worth knowing before touching it:

- **The panel draws on `hasSpells`, a compendium *or* a book** — not on the compendium alone. A
  ruleset with no magic draws nothing, but force-deleting the last spell a Player had learned empties
  the compendium *and* leaves them an id, and gating on the compendium made that leftover
  unclearable. The browser check found it; `SpellbookPanel.test.tsx` pins it.
- **A row whose spell the ruleset has lost is drawn, not dropped** — *"A spell this ruleset no longer
  has"*, with *Cast* gone and *Unlearn* kept. `CarriedBuild.item`'s precedent for a dangling link.
- **The pool selector is per panel, not per row**, and appears only when the ruleset has more than
  one resource: *which pool am I casting out of* is a fact about the session rather than about one
  spell, and no ruleset field answers it (the User's ruling — the Player names it at cast time).
  `SpellLearner` searches rather than pages, unlike `useSpellManager` over the same 418 rows,
  because a Player already knows the spell's name; the match cap is **stated** rather than silent.
`rolls/` holds `useRoller`, `RollBreakdown` and `RollHistoryPanel`.
The roll button and the last result live in `RollsSection`; the history is its own panel.
**`useRoller` branches on where the character lives** (TICKET-ROLL-07). A **local** character rolls
in the browser through `rollRollDefinition`, with randomness injectable via
`useRoller(id, calculated, { rng })` — never spy on `Math.random` — and its history in `useUIStore`,
in memory, gone on reload by design (D6: solo play needs no account and no server). A character **at
a table** does not roll at all: it posts `{ rollId }` and adopts the server's `RollOutcome`, with no
preview, because a previewed roll that differed from the recorded one is the exact failure v3 Req
45.2 prevents. Its history is a projection of the session's Event log, so it survives a reload — and
`RollHistoryPanel`'s `onClear` is **withheld** there, because an Event log is append-only and a
*Clear* button would be one that lies. That same absence is what picks the empty state's wording.

**`shared/`** — cross-mode components and hooks, barrelled by `shared/index.ts`:
`AppShell.tsx` (the medieval frame + mode switcher + per-mode nav), `useAppMode.ts` (route↔mode
sync and the play-mode config lock), `useAppHydration.ts` (the app-wide LocalStorage restore,
called only by `RootLayout`), `StorageNotice.tsx` (the storage-unavailable message it drives) and
`IncompatibleDataNotice.tsx` (the pre-v2-data refusal, with the backup offer and the two-step
start-fresh — TICKET-IO-03), `StatModifierBadges.tsx` (a material or inlay tier's modifiers as
forest/crimson chips; it takes the ruleset's stats too, because a modifier names its target by
**id** and resolving that to an abbreviation belongs in one place — TICKET-MAT-01) and its sibling
`SkillBonusBadges.tsx` (an item template's skill vector, over the ruleset's skills — TICKET-ITEM-01).
**Two components, one style module** (`modifierBadges.style.ts`): the two persisted rows name
different entities, so one generic `{ targetId, modifier }` would let a material tier point at a
skill — but a `+2` must not *look* different depending on which it is.

**…and `labelledGroups.ts`** (TICKET-ITEM-01) — `groupByLabel(entries, labelOf)` +
`hasNamedGroups`: splitting a list into the headings the **ruleset's own words** name, in
first-appearance order, with a blank label reading as ungrouped. Three callers, which is why it is
here: the sheet's stat columns (`Stat.group`), the inlay panel's gem headings (`Inlay.group`) and the
items panel's shops (`Item.shop`). Generic over the member with the label read by a caller-supplied
function, because those are three different fields. **A heading is a distinct value that is present,
never a list the app knows** — reach for this rather than writing a fourth `Map` walk.

**`auth/`** — signing in, barrelled by `auth/index.ts` (TICKET-AUTH-01, TICKET-AUTH-02). The one
folder in `components/` with **no Zustand store behind it**, deliberately: a signed-in Account is a
*server* fact held in an `HttpOnly` cookie this code cannot read, so a second copy in a store would
be a second thing to get wrong. `authClient.ts` is Better Auth's browser half (it lives here rather
than in `services/` because `createAuthClient` makes `useSession` a React hook); `useAuth.ts` wraps
it — **`isPending` is a real third state and callers must handle it**, or the shell flashes *Sign
in* at somebody who is already signed in. `AuthForm.tsx` + `useAuthForm.ts` are both surfaces,
`AccountBadge.tsx` is the beam control, and AUTH-02 adds `useSocialProviders.ts` (asks
`/api/auth-providers` which buttons are drawable), `SocialSignInButtons.tsx`, `LinkedIdentities.tsx`
+ `useLinkedIdentities.ts`, and `providerLabel.ts` (the display names — the ids themselves are in
`#shared/types/socialProvider`, because both roots name them). **AUTH-03 adds the protection
mechanism**: `protectedRoutes.ts` (the explicit list), `RequireAccount.tsx` (pending → nothing,
signed in → children, signed out → a redirect carrying where to come back to) and
`signInDestination.ts` — the open-redirect guard, which normalises tab/LF/CR *before* judging a
destination's shape because the URL parser strips them first, and which `/signin` applies again on
the way out. **AUTH-04 adds `ActiveSessions.tsx` + `useActiveSessions.ts`** — where this Account is
signed in, and the two ways to end a session (v3 Req 48.7) — and the `expired` marker
`RequireAccount` sets when a session goes away *mid-use*, which `/signin` turns into wording rather
than into a second redirect.
**`AuthAlert.tsx` is the folder's refusal box** — reach for it rather than writing another
`role="alert"` div — and the folder's shared class strings live in **`authSurfaces.style.ts`**
rather than in any one component's `.style.ts`, which is what four modules importing the same
tones actually means.
**GAM-02 made the destination survive the sign-in ↔ sign-up switch.** `signInDestination.ts` gained
`destinationSearch(search)` — one `validateSearch` both auth routes use, so the open-redirect refusal
is written once rather than twice — and `AuthForm` gained `switchSearch`, which is what the *Create
one* / *Sign in instead* link carries. Before that, following an invite link signed out reached
`/signin?redirect=…` correctly and then lost it the moment the visitor did the thing an invitee
without an account has to do.

**`rulesets/`** — the two homes a ruleset can live in, barrelled by `rulesets/index.ts`
(TICKET-RUL-01). `RulesetsPanel.tsx` is configuration mode's entry point at `/rulesets`;
`RulesetCard.tsx` is one row, and **the home badge is a prop rather than something inferred from
which callbacks were passed**, because v3 Req 36.8 asks for it at *all* times and a row with no
actions is exactly the row local mode is made of. `RulesetFormDialog.tsx` names a ruleset on
create, rename **and copy** — one dialog, one set of name rules, its title and verb from a
`RULESET_DIALOG` mode rather than from a boolean (RUL-03 arriving as one extra row in that table is
the evidence the shape was right) — and reuses `config/shared/FormDialogActions` across the
feature-folder line rather than copying it. `useRulesetManager.ts` composes three hooks and holds
almost nothing itself: `useAccountRulesets` (the listing and the writes), `useRulesetDeletion` (a
delete plus the confirmation the server asked for) and `useRulesetDialog` (the three naming modes).
The local half comes from `useConfigStore.localSummary` — **not `config`**, which since RUL-02 holds
whichever ruleset is *open*. **No request is made at all while nobody is signed in** (D6), which the
test asserts with `fetch` stubbed to throw. `useRulesetDialog`'s state is a discriminated union
rather than `{ mode, ruleset? }`: the optional form made *rename with no ruleset* representable, and
the only answer to that was to create one nobody asked for.
**TICKET-IO-04 adds a fourth composed hook and two components.** `useRulesetTransfer.ts` owns both
ways of putting a document on the Account — a file the User picked, and a copy of this browser's —
because they are one request with two sources, and it delegates the once-per-Account offer to
`useUploadPrompt.ts`. `UploadToAccountDialog.tsx` is the question that stands between the click and
the copy: it names the ruleset, counts the characters, states that they will sit at **no table**,
offers `downloadStoredBackup` first (v3 Req 36.4) and says in words that the browser's copy stays.
`RulesetTransferResult.tsx` reports what landed and renders the referential report through the
`ValidationReport` primitive — the wording distinguishes *"it was kept as it is, and here is what is
wrong with it"* from a refusal, because v3 Req 35.3 makes that report advisory. The *upload* button
reaches the row through `RulesetCard`'s `openAction` slot rather than a new prop named after its one
caller.

**`sessions/`** — the connected-play surfaces, barrelled by `sessions/index.ts` (TICKET-GAM-02) and
**deliberately the smallest thing that makes invitations real**, not the lobby. `SessionsPanel.tsx`
is `/sessions`, composing `StartSessionForm` (pick a ruleset you own, name the table),
`SessionList` (the games you are in, with a role badge from a `ROLE_BADGE` table) and, per row for a
DM, `InviteCodePanel`. `JoinSessionPanel.tsx` is `/join/$code`, driven by `useJoinSession(code)`,
which **previews before it joins** — mounting the hook seats nobody, which is what makes an invite
link safe to click — and reports *already a member* as an outcome rather than an error (v3 Req 38.7),
because somebody clicking their own paste into the group chat is not doing anything wrong.
`InviteCodePanel` is the one surface in the app that renders a **credential**, and it earns a test
file of its own for it: the code and the link are shown as selectable text and not only behind a
*Copy* button (`navigator.clipboard` needs a secure context and a permission), and a code the server
still sends but which has **expired** says so — the server keeps sending it deliberately, since a DM
shown nothing would read that as *I never issued one*. `useSessionInvite` holds a `showing` ref so a
slow response cannot overwrite a code issued since. Wording for a refusal is the **server's**
sentence rendered, never a summary: v3 Req 38.4 asks for four distinct messages and a surface that
flattened them would be inventing a fifth nobody decided on.

**CHAR-04 gave a character a second home, and the branch is one line in one place.**
`services/characterSync.ts` is to a character what `rulesetSync.ts` is to a ruleset — the only module
that decides where a new one goes, and since **PLY-01** the only module that knows how a *write*
reaches one: `sendPlayerAction(characterId, action, body)` posts a named intent and `fetchCharacter`
reads one back. Send, wait, adopt — optimistic updates are deliberately out of scope, and a refusal
carries the **server's own sentence** rather than a summary. **DM-01 widened `action` to
`SheetAction` and added nothing else**: a DM's adjustment is the same request with a different guard
on the far end, and a second function would have been a second copy of the error handling.
`fetchCharacterAdjustments(characterId)` is the one read it added.
`characterStore.createCharacterHere(source, data, config)` is what the wizard calls. **The source is passed in rather than read**, because `configStore` already
imports `characterStore` and reaching back would be a cycle `no-circular` refuses. `RULESET_HOME`
grew a third value, `SESSION`: a game's pinned Snapshot, which `persistRuleset` **refuses** to write
to, so a configuration panel opened against one cannot edit a game in progress. `SessionCharacters`
(driven by `useSessionCharacters`) sits under the lobby in an expanded row and its button opens that
Snapshot before sending the Player to the same four creation steps they get signed out. **Since
PLY-01 it also opens a sheet — your own, and since **DM-01** anybody's if you are the DM**, whose
controls live on that sheet. A *Player* still cannot open somebody else's: `requireCharacterPlayer`
refuses their writes, and a page of controls that could not save is not worth opening. A roster that
acts on characters without opening them is still TICKET-DM-04's.

**GAM-04 added `SessionLobby`, and it is the first surface in the app that shows other people.** It
sits at the top of an expanded row — **every** row now, not just a DM's, because a table is other
people and a player who could not see who else was at theirs would be playing alone with extra
steps. Driven by `useSessionMembers(sessionId)`, the third hook on that keyed-on-the-open-row
skeleton. Three things about it are decisions rather than details: the connection column says
**Unknown** because the app genuinely cannot tell until LIVE-03 and *Offline* would be a claim it
cannot support; all three actions confirm through `ui/Dialog` and each sentence says **nothing is
deleted**, because *removed* reads like *deleted* and here it is not; and a DM's own row offers
neither *Leave* nor *Remove*, which is v3 Req 39.6 drawn rather than guessed. **TICKET-DM-04 grows
this into the DM's roster** — it is the session's one member list, not a page that needs a sibling.
`useAuth` gained `accountId` for it, so the lobby can tell which row is yours without the server
sending a per-caller flag.

**GAM-03 added the other kind of invitation, on both sides of it.** For the DM, `AddressedInvitePanel`
sits under `InviteCodePanel` in an expanded row, driven by `useSessionInvitations(sessionId)` — a
second hook rather than a second concern inside `useSessionInvite`, because a table has exactly one
code and an unbounded number of letters. For the invitee, `PendingInvitations` sits **above** the
games list on `/sessions`, driven by `useInvitations()`, and **renders nothing at all when nothing is
waiting**: it is a notification area rather than a section of the page. That hook is the whole
delivery mechanism (D12) — it reads on mount and **on `window` focus**, because nothing is pushed
and an invitee is by definition not in any LIVE-01 room yet, so an invitation arrives by the tab
coming back to the front and asking.

`components/Header.tsx` sits at the root of `components/`, outside every feature folder.

## Docs

`docs/` holds one folder per version/milestone: `overview.md` (the ticket index, in build order)
plus `tickets/`. The two anchors that don't move are
`docs/v1.0_foundation/requirements.md` (the numbered requirements every ticket traces back to)
and `docs/v1.0_foundation/design.md` (architecture, component contracts, theme). `docs/README.md`
explains the folder-naming scheme — read that instead of a version list here, which would go
stale. For "what does the spec say about X", ask the **spec-navigator** subagent.
