---
name: data-model
description: Persistence and data-shape reference for Custom DnD Builder — the Configuration and Character types, LocalStorage keys, derived vs. stored values, import/export validation, and the rules for changing a persisted shape. Use when adding or changing an entity, writing a store action, or planning a data migration.
---

# Data Model (TypeScript types + LocalStorage)

There is no database and no backend. Two JSON blobs in LocalStorage hold everything, and the
type definitions in [src/types/](../../../src/types/) are the schema. Read
[config.ts](../../../src/types/config.ts) and [character.ts](../../../src/types/character.ts)
directly — this skill covers the rules, not a copy of the fields.

## Storage

| Key | Holds | Written by |
|---|---|---|
| `dnd_builder_config` | one `Configuration` object | `saveConfiguration()` ← `useConfigStore` |
| `dnd_builder_characters` | `Character[]` | `saveCharacters()` ← `useCharacterStore` |
| `dnd_builder_ui_state` | reserved; `useUIStore` is currently in-memory only | — |

All access goes through [src/services/storage.ts](../../../src/services/storage.ts). It wraps
`JSON.stringify`/`parse` and normalizes failures into `StorageError`, `StorageQuotaError`, and
`StorageParseError`. **Components, hooks, and engine code never touch `localStorage` directly,
and never call the storage service directly either** — they go through the store, which persists
as part of the action. That is the equivalent of a repository layer here.

## Configuration (the ruleset)

One `Configuration` per browser: id, name, version, **`schemaVersion: 7`**, timestamps,
`focusStatBonusLevel`, plus the entity arrays — `stats`, `skills`,
`combatSkills`, `materials`, `materialCategories`, `items`, `equipmentSlots`, `races`,
`currencyTiers`, the optional `constants` (TICKET-CST-01), and the optional `curves`
(TICKET-CRV-01).

**`Skill` is the sheet's Skill since TICKET-SKL-02**: `{ id, name, description, statWeights:
[{ statId, weight }], category? }`. It replaced v1's `SpecialitySkill` outright — no `code`, no
`maxBaseLevel`, no `bonusFormula`. The arithmetic is not per-skill any more: `level = Σ(weight ×
stat value) + invested` and `bonus = round(level / const.bonus_divider)` live once, in
[skillCalculator.ts](../../../src/engine/calculators/skillCalculator.ts), so a global rebalance is
one constant rather than 48 formula edits. A weight row names a stat by **id**, so a rename cannot
orphan it, and a formula reaches a skill as `skills.<name-slug>` (`.bonus` for the integer).

`constants?: Constant[]` is the worked example of an optional field done right, and the pattern to
copy: **absent means none and stays absent**, so a ruleset written before TICKET-CST-01 round-trips
without growing an empty array; every reader writes `config.constants ?? []`.

**A field that is retired is refused, not ignored** (TICKET-RES-02). `RETIRED_FIELDS` in
[importExport.ts](../../../src/services/importExport.ts) maps each removed key to what replaced it,
and `validateConfiguration()` errors when an imported file still carries one — importing a ruleset
that plays differently from the one the User exported is worse than refusing it. Add to that map
when you delete a persisted field, and bump `SUPPORTED_SCHEMA_VERSION` in the same change.

The same rule applies inside an entity. `updateStat` merges through `mergeClearingAbsent`
(TICKET-STAT-02), so a patch setting `min`, `max` or `formula` to `undefined` **deletes** the key
rather than leaving it present-and-empty — a User who clears a bound gets an unbounded stat, not
a phantom one. Copy that when an update action can clear an optional field.

**`Stat.order` is written by `reorderStats(orderedIds)`, never by hand.** It rewrites the stored
array *and* renumbers `order` from each position, so the two can never disagree for anything the
store wrote. Reordering changes no value; references are by id (Concept 01).

**Nothing outside the store guarantees that, though**, so the display hooks sort defensively:
`useStatManager`, `useCharacterSheet` and `useCharacterCreation` each read
`[...stats].sort((a, b) => a.order - b.order)` and hand the result down (TICKET-STAT-03). An
imported JSON file only has to satisfy the shape check — `order` must be a number, not a number
agreeing with its array position — so `order` is the field that decides, and a hand-edited export
displays the way it reads rather than the way it happens to be stored. **Sort in the hook, never in
a component**: the two consumers of the ordered list (`SkillAllocationStep`, `ReviewStep`) take it
as a prop.

**`Archetype` is what a character is good at growing** (Concept 03, TICKET-ARC-01):
`{ id, name, description, statAffinity: Record<statId, 'main' | 'sub' | 'non'> }` on the optional
`Configuration.archetypes`, with `Character.archetypeId?` pointing at one. The three affinity values
are not a scale the app interprets — they are **column names in the `point_buy` curve**, which is
what makes "flatten the archetype advantage" a table edit. Two rules, both load-bearing:

- **`non` is absence.** A tagging is stored **sparsely** and a stat missing from the record reads
  `non`. A stored `non` would count as a reference and make `deleteStat` refuse for every stat every
  archetype had ever been saved over — the trap `Race.statValues` avoids by pruning zeros. The
  validator *reports* the defaulting as a warning rather than letting it happen silently.
- **Every affinity in use needs a `point_buy` column**, `non` always included (a stat added later
  defaults to it). A missing one is a config-level **error**: without the column there is nothing to
  route a spent point through.

**Adding a purely optional field does not need a `SUPPORTED_SCHEMA_VERSION` bump.** RACE-01's
"bump on every reshape" is about a build *crashing on a field that moved*; an additive optional key
is readable by both builds, so `archetypes?` and `archetypeId?` shipped at version 7. Bump when a
field moves or is removed.

**`Race` is a stat block, not a bag of bonuses** (TICKET-RACE-01):
`{ id, name, description, statValues: Record<statId, number> }`, holding the **absolute** value a
member of that race has, like the sheet's creature rows. Two rules follow, and both are load-bearing:

- **Keyed by stat *id*, not abbreviation.** So a stat block needs no display↔stored translation at
  all — `references.ts` has no `races` branch, and a rename passes straight through it. The
  guarded-delete walker matches it by id too (`raceStatBlockReferences` in `dependencies.ts`).
  A material tier's modifiers are keyed the same way since TICKET-MAT-01
  (`materialBonusReferences`), so **no persisted modifier names a spelling any more**.
- **A stat absent from the record reads 0.** Adding a stat to the ruleset therefore costs nothing:
  every existing race is already defined over it. Keep that when reading a block —
  `race.statValues[stat.id] ?? 0`, never a bare index — and let the editor be the thing that
  writes a complete block (`useRaceManager`'s `handleSave` normalises against the ruleset as it
  stands at save time).

Race blocks are the composition's **`base` term** and they **blend, never stack** (TICKET-RACE-02):
one race is its own block, two are `roundup((a + b) / const.race_blend_divisor)` per stat, and a
stat one block omits is a real 0 in that average. `Character.raceIds` therefore holds **at most 2**
— `createCharacter` returns `null` and `updateCharacter` no-ops past that, and `MAX_RACE_COUNT` in
[statCalculator.ts](../../../src/engine/calculators/statCalculator.ts) is the one place the number
is written. Never re-derive a race contribution in a component: call `calculateRaceStatBases`, the
same function the composition calls.

**`schemaVersion` is the clean break** (TICKET-STAT-01, TICKET-IO-03). v1 files have no such key,
which is exactly how they are recognised. The number itself lives in
[types/config.ts](../../../src/types/config.ts) as `SUPPORTED_SCHEMA_VERSION` — not in either
service, so both gate on the same value and `createFreshConfiguration` writes it rather than a
literal. v1's focus stat, spend-derived level and speciality base levels have no faithful mapping
into v2, so a conversion would invent a ruleset nobody authored.

**Bump it on every reshape for the rest of the v2.0 milestone** (User decision, 2026-08-09,
recorded on TICKET-RACE-01). The persisted shape is not stable until v2.0 lands, so a ticket that
changes an entity's shape raises `SUPPORTED_SCHEMA_VERSION` in the same commit — otherwise stored
data from a day earlier crashes on the field that moved instead of meeting IO-03's notice. It is
one line plus a `schemaVersion: N` sweep over the test fixtures, `scripts/build-sheet-import.mjs`
**and `examples/demo-ruleset.json`**. The last two have their own guards — `sheetImport.test.ts`
and `exampleRuleset.test.ts` — so forgetting them fails the suite rather than shipping a corpus the
app refuses to import; that is what caught them on TICKET-RES-01.
There is deliberately **no migration path**: the ruleset is regenerable from
[`docs/imports/`](../../../docs/imports/README.md), and the notice offers a backup before anything
is cleared.

The refusal has three surfaces, and they behave differently on purpose:

| Path | What happens |
|---|---|
| **Load** (`loadConfiguration()`) | throws `StorageSchemaError`; **nothing is loaded and nothing is deleted**. `useAppHydration` turns it into `incompatibleData`, and `RootLayout` renders `IncompatibleDataNotice` *instead of* the routes — so no route can mint a fresh ruleset and save it over the old data. |
| **Backup** | `downloadStoredBackup()` in `importExport.ts` reads `readStoredSnapshot()` and splices both raw strings into one envelope by concatenation, so the file's bytes are the stored bytes; a blob that does not parse is embedded as a JSON string instead. |
| **Start fresh** | `useConfigStore.discardStoredData()` — the **only** path that calls `clearAllData()`. It clears both keys, empties both stores, and writes no replacement. |
| **Import** (`importConfiguration()`) | throws `SchemaVersionError` *before* `validateConfiguration()` runs, so a v1 file gets one version sentence rather than a field-by-field report. |

`loadCharacters()` separately drops any character with no `investedStatPoints`. **Known gap**: that
filter is silent when `loadConfiguration()` did not throw — a v1 characters key beside an absent or
v2 config gets no notice and no backup offer (TICKET-IO-03 implementation note 5).

**`Stat` is the one numeric axis** (Concept 01, TICKET-STAT-01) — `MainSkill` is gone. Flags say
what a stat does: no `formula` means **invested**; `isResource` additionally means the value is a
*maximum* the character spends against; a `formula` makes it **derived** and it accepts no
investment. It also carries `abbreviation`, `order`, `countsTowardTotal`, optional `min`/`max`,
and `rounding` (`none` | `nearest` | `up` | `down`, applied after the clamp).

Identity rules that the rest of the app depends on:

- **Every referenceable entity carries a stable `id`.** Since TICKET-REF-01 that includes stats
  and both skill kinds, whose `abbreviation` / `code` is renamable display data rather than the
  identity. **`updateSkill`/`deleteSkill` take the id** (TICKET-SKL-02 — a `Skill` has no code to
  address it by); the combat actions still *address* by code (`updateCombatSkill('MEL', …)`),
  which is a lookup argument, not the key, until ROLL-05/06. `EquipmentSlot` is still keyed by
  `type`.
- **A stat's `abbreviation` is an uppercase identifier and unique across the one flat formula
  space** it shares with the combat codes (TICKET-STAT-01; the speciality half of that space left
  with the code in TICKET-SKL-02). Enforced in both places the rule needs:
  `validateConfiguration()` for import, `useStatManager`'s save path for User input. Renaming one
  is safe — the stored formula holds the stat's id — and there is **no character half left to
  carry**: `investedStatPoints` and `investedSkillPoints` are both keyed by id, which is why
  `renameSkillCode` and `useSkillCodeRename` were deleted. One field still escapes it —
  `focusStatCode` holds an abbreviation, so a rename orphans it, and nothing chases it. Left for
  TICKET-ARC-03, which retires the focus stat; recorded on TICKET-SKL-02.
- **A constant's `name` is a lowercase identifier (`^[a-z][a-z0-9_]*$`) and unique.** It is what a
  formula spells as `const.<name>`, and a duplicate splits identity from value — the stored formula
  points at one constant's id while `constantsNamespace` reads the other's number. Enforced in two
  places, both required: `validateConfiguration()` for untrusted import, and `useConstantManager`'s
  save path for User input (TICKET-CST-02).
- **A curve's `name` follows the same identifier rule as a constant's**, and so does each of its
  **column names**, which are formula segments (`curve.point_buy.main_type(3)`). Its `rows` must
  carry unique keys sorted ascending with one value per column, and a `reverse` curve's value
  column must not decrease — `engine/validator.ts` reports each as an error, and a `step` curve
  with a gap wider than its average step as a warning (TICKET-CRV-01). Both rules are enforced in
  two places: `validateConfiguration()` for import and `useCurveManager`'s save paths for User
  input (TICKET-CRV-03). **A column name is rename-safe too** — the one property segment that is
  id-resolved, because it is the one the User named. `references.ts` keys it by
  `curveId + columnName` (spellings are unique only within a curve) and the stored form is
  `curve.[curveId].[columnId](x)`; a column is a `curve-column` delete target, so removing one a
  formula reads is refused like any other guarded delete.
- **A curve column may be generated.** `CurveColumn.generator` is a formula evaluated once per row
  with the key bound as `key` (plus `const.*` — its own `curve-generator` row in
  `engine/formula/scoping.ts`), and `CurveRow.overridden` is a positional flag array marking cells
  a User hand-tuned. Both are optional and absent means the pre-TICKET-CRV-02 state: no generator
  = hand-entered column, no flags = nothing overridden. `engine/curveGenerator.ts` owns the
  regenerate/edit/clear semantics; an all-`false` flag array is normalised back to absent so a
  curve round-trips unchanged. **`columns`, `rows[].values` and `rows[].overridden` are three
  arrays on one index** — structural edits go through `engine/curveTable.ts` (and the store's
  `addCurveColumn`/`deleteCurveColumn`/`addCurveRow`/`deleteCurveRow`), never through a
  hand-assembled `updateCurve` patch.
- **A fresh ruleset seeds two curves** (TICKET-CRV-03): `point_buy` (`non`/`sub` hand-entered
  from Concept 06, including its `4.642857142857` anomaly; `main` generated `0.75 * (key + 1)`)
  and `xp_thresholds` (shape only — reverse/step/extrapolate, one row, real numbers still open).
- **Codes must stay unique across skill kinds.** One formula namespace serves all three, and the
  display form of a formula would be ambiguous otherwise. (TICKET-REF-01's to-be floated
  downgrading this to a warning; it is deliberately *not* done — see that ticket's divergence
  note.)
- **A persisted formula is id-resolved.** What the User writes and what is stored are two forms
  of the same expression: `STR + DEX` in display form, `[id-str] + [id-dex]` in stored form. The
  translation lives in [engine/formula/references.ts](../../../src/engine/formula/references.ts)
  and is applied at exactly two places — `services/storage.ts` and `services/importExport.ts`, so
  everything above them (stores, engine, components) works in display form only. **Formula strings
  are the only reference-carrying fields left**: a race's stat block (TICKET-RACE-01) and a
  material tier's modifiers (TICKET-MAT-01) hold stat ids, so `references.ts` translates neither.
  A rename is `toStoredConfiguration` → patch →
  `toDisplayConfiguration`, which `configStore`'s `applyRenameSafely` does for you; the reference
  index is **derived on every call and never persisted**.
  A `stats.*` member is a slug of the stat's name (`Max Health` → `stats.max_health`) until
  TICKET-STAT-01 gives stats a real code.
- **Formulas are strings** on `Stat.formula`, `CombatSkill.bonusFormula`, and
  `CurveColumn.generator`. **A `Skill` carries none** — weight rows replaced the string in
  TICKET-SKL-02, which is also why there is no `skill` attachment point in `scoping.ts` and why a
  skill cannot be a node in the dependency graph. They are parsed by the formula engine, never `eval`'d, and a bare
  variable is only valid if it resolves to a configured skill code. Since TICKET-FORM-03 a formula
  may also carry **dotted namespaced references** (`stats.speed`, `const.bonus_divider`) and
  **namespaced calls** (`curve.xp_thresholds(x)`, `curve.point_buy.main_type(x)` — the third
  segment selects a value column); which of those a formula may use depends on its attachment
  point, per the tables in
  `engine/formula/scoping.ts` (TICKET-FORM-04). The save-time guard refuses out-of-scope
  namespaces and unknown members, so a persisted formula's references are in scope — but it can
  still fail to *evaluate*: `const.*` and `curve.*` resolve wherever they are in scope
  (TICKET-CST-01, TICKET-CRV-01), but `stats.*` and `skills.*` wait on STAT-01. Since
  TICKET-FORM-05 that failure is an **error value on that one entry**, not a throw.
- **Deletion is reference-checked in the store action** (TICKET-REF-02). Every `deleteX` returns
  `EntityReference[]`: non-empty means it refused and that is what points at the entity; empty
  means it deleted. `{ force: true }` overrides. The walker is
  [engine/dependencies.ts](../../../src/engine/dependencies.ts) — pure over `(target, config,
  characters)`, so characters count as references (`raceIds`, inventories, allocations, current
  stat values). Panels render the returned list via `config/shared/BlockedDeleteDialog`; **no
  component derives references to decide whether a delete is safe** — that judgement is the store
  action's. Calling `findReferences` for *display* is fine and TICKET-CST-02 does it:
  `useConstantManager` builds a usage index so each constant's card can show its blast radius.
  A forced delete leaves the dependents dangling on purpose:
  the ruleset alone defines the main-skill namespace, so a formula naming the deleted code
  reports `Undefined variable` rather than reading a leftover allocation as a number.
  `engine/validator.ts` stays as the after-the-fact report for what an import brings in.

## Character (the play-mode data)

`Character` stores only what the player chose: `raceIds`, `investedStatPoints` (**keyed by stat
id**, so a rename cannot orphan an allocation),
`investedSkillPoints` (**keyed by skill id**, same reason — TICKET-SKL-02 replaced v1's
code-keyed `specialitySkillBaseLevels`), `focusStatCode`, `archetypeId`, `currentResourceValues`,
`experience`,
and an `Inventory` (`equippedItems: Record<slotType, itemId>` + `miscItems: itemId[]`). It carries
`configurationId` so a character is always read against the ruleset it was built on.

**`investedStatPoints` holds points *spent*, not levels gained** (TICKET-ARC-02). The `point_buy`
curve is the exchange rate between the two, selected by the archetype's affinity for that stat —
15 points buy 12 on a main-type stat and 5 on a non-type one. Nothing about the stored shape
changed; what changed is what the number means, so never read an entry as a stat's value. Ask
`statGain` (or read `validateStatAllocation(...).gains`) instead.

**Derived values are never persisted.** Composed stat values, the stat total, skill levels and
bonuses, combat bonuses, and equipment bonuses are computed on demand from
`src/engine/`. `calculateCharacter(character, config)` in
[calculator.ts](../../../src/engine/calculator.ts) is the single entry point that produces a
`CalculatedCharacter` with every derived field populated; `calculateCharacterStats()` is a thin
wrapper over it for callers that only want the stat values. **A derived value's *explanation* is
derived too** — TICKET-SKL-03 added `skillContributions`, one already-multiplied
`SkillStatContribution` per weight row, so the sheet can label a breakdown without a component
redoing the arithmetic. When a surface needs to show how a number was reached, widen the calculator's
return rather than recomputing the terms at the render site. If you find yourself wanting to store a
computed number on `Character`, the answer is a recalculation call at read time instead. There are
exactly **two** deliberate exceptions. `currentResourceValues` — the player's *current* HP/mana,
which is state, not derivation (its maximum is derived; its current value is not). **Only `isResource` stats appear
there**, and the store action enforces it: a stat you cannot spend has no current distinct from
its value, which is what v1 got wrong by giving every stat one.

And `experience` (TICKET-RES-01) — stored because nothing else in the app knows it: XP is awarded
at the table. **`level` derives *from* it**, through a reverse lookup on the `xp_thresholds` curve
in [characterSummary.ts](../../../src/engine/characterSummary.ts), which is the single definition
every screen reads. This inverts v1.0, where level was the sum of points spent; the chain now runs
`XP → level → budget → spend`. `calculateCharacterLevel(character, config)` returns a
`FormulaResult`, because the curve is User data that can be deleted or set to refuse out-of-range
input — a level that cannot be read chips rather than showing a confident 1. Only
`awardExperience`/`deductExperience` write it; a deduction below 0 is **refused**, not clamped.

**The point budget closes that chain** (TICKET-RES-02): `validateStatAllocation(character, config)`
in [skillAllocation.ts](../../../src/engine/skillAllocation.ts) prices the pool as
`level × const.points_per_level` — derived, never stored — and `Configuration.mainSkillPointBudget`
is gone with its "absent means unlimited". Both money numbers are `FormulaResult`s, so a level that
cannot be read makes the allocation *invalid* rather than unlimited. Spending post-creation goes
through `characterStore.setInvestedStatPoints`, which **refuses** an unaffordable spend rather than
clamping it — a partial investment would read as one that landed.

**Since TICKET-CALC-02, every *configured* stat has a value; absence is not a state.**
`calculateStatValues` seeds every stat in `config.stats` before applying investment, racial
modifiers, equipment and the focus bonus, so `statValues` is the configured namespace in full and
a stat the character never invested in reads as `0` rather than as an undefined variable in every
formula naming it. `Undefined variable` is reserved for stats the configuration genuinely does not
define. Seed in the calculator — never default in a component or back-fill
`Character.investedStatPoints` on save.

**Derived stats resolve in passes**, because one may read another (`stats.apt` over `stats.speed`).
When a pass resolves nothing new, what is left is a cycle and each stat in it gets its own error
value — the composition terminates rather than reporting a cycle the validator is what properly
names.

**Since TICKET-FORM-05 the formula-derived maps hold `FormulaResult` — a number *or* a
`FormulaError`** (`statValues`, `skillLevels`, `skillBonuses`, `combatSkillBonuses`; `statTotal` is
a plain number, and a stat that failed contributes nothing to it rather than poisoning it).
`calculateCharacter` **always returns**: a broken formula poisons its own entry and nothing else
(Concept 00 §7). Read entries with `numberOr(result, fallback)` or `asNumber(result)` from
[engine/formula/errors.ts](../../../src/engine/formula/errors.ts) — never `?? 0`, which cannot
tell an error from a missing key. Errors carry `source` (the owning stat/skill) and `cause` (the
upstream error), so `describeFormulaError` can render a chain. **Never `numberOr` an error into a
number the user then sees as authoritative** — surface it, or let the caller show the error.

Because the maximum *is* derived,
`updateCurrentStatValue(characterId, statId, value, config)` and its plural sibling both take the
`Configuration` and clamp to `calculateCharacter().statValues` inside the action (Req 14.3);
negatives pass through (Req 14.4). A stat with no calculated maximum — an unknown id, or one whose
formula produced an error — is written unclamped. Don't clamp in a component; the rule lives in the
store so no caller can bypass it. `adjustCurrentStatValue(…, delta, config)` and
`resetCurrentStatValueToMax(…, config)` (TICKET-RES-03) are the other two writers: a delta applies
to what is **stored**, not to a clamped reading of it, and a reset leaves the pool alone when the
maximum cannot be calculated rather than writing 0.

**A derived maximum never silently overwrites a stored current** (Concept 20, TICKET-RES-03). When a
maximum falls below the value a Player is tracking — an item unequipped, a formula edited — the
current is **kept** and flagged (`StatBreakdown.isOverMax`), never rewritten. Write-clamping is what
resolves it, the next time the Player touches the pool. Nothing in the app may reconcile the two
behind their back.

The same holds for equipment: `equipItem(characterId, slotType, itemId, config)` and
`moveItemToEquipment(characterId, itemId, slotType, config)` take the `Configuration` and refuse
any item whose `Item.equipmentSlotType` does not equal the target slot — including an item with no
slot type and one the ruleset does not define (Req 12.3). All six inventory actions go through one
`patchInventory(set, get, characterId, update)` helper; returning the inventory unchanged is how an
action declines. Equipping triggers no recalculation — derived values read `equippedItems` at read
time.

## Changing a persisted shape

There is no schema version and no migration runner. That makes compatibility a hand-checked
concern, so:

- **Prefer additive, optional fields** (`newThing?: X`). Existing stored JSON must still parse
  and render.
- If a change cannot be additive, it needs an explicit migration step in `storage.ts`'s load path
  (read old shape → transform → return new shape) plus a test that feeds it the old shape.
  Bumping `Configuration.version` alone changes nothing — nothing reads it yet; if you start
  relying on it, wire it into the load path in the same change.
- **Import/export is a public boundary.** `importConfiguration()` gates on `schemaVersion` first
  (`SchemaVersionError`), then `validateConfiguration()` inspects untrusted JSON before it is
  applied; any new required field must be added to that check, or a file exported by an older
  build will be accepted and then break at render time.
  Import validates **twice**, and the two are not interchangeable: `importExport.ts` checks
  *structure* and refuses to apply a file that fails, while `engine/validator.ts` checks
  *references* (formula codes, slot types, categories, cycles) and only reports — a
  referentially-broken ruleset is still applied, so the User can repair it in the app.
  `useConfigStore.replaceConfig(config)` is what applying an import means (the app holds one
  configuration, so it replaces rather than appends); `renameConfig(name)` renames it.
- Round-trip test: export → import must reproduce an equivalent configuration.
- **The sheet-import corpus moves with the shape.** `docs/imports/` holds one JSON fragment per
  built feature carrying that feature's real data from the source spreadsheet, merged into
  `docs/imports/ducklets.json` by `yarn run sheet:import` and validated by
  `src/services/sheetImport.test.ts`. A changed entity shape means updating that entity's fragment
  and regenerating in the same change — see [docs/imports/README.md](../../../docs/imports/README.md).

## Data flow

0. **App start** — `RootLayout` calls `useAppHydration()` (`components/shared/`), which probes
   `isStorageAvailable()` and then restores both stores once per page load. Nothing else reads
   storage at start-up, and each store's `isLoaded` guard keeps it to one read.
1. **Config edit** — panel hook calls a `useConfigStore` action → state patched → `saveConfiguration()`.
2. **Character edit** — component calls a `useCharacterStore` action → state patched → `saveCharacters()`.
   `createCharacter(data, config)` takes the whole `Configuration`, not just its id: it seeds
   `currentResourceValues` to the calculated maxima — resources only — so a new character starts
   at full health. That is the one place a derived number is written onto a `Character`, and it is
   player state from then on — see the `currentResourceValues` exception above.
3. **Anything displayed as a number** — component reads `calculateCharacter(character, config)`;
   the engine parses the relevant formulas and returns the `CalculatedCharacter`.
4. **Equipment change** — inventory action updates `Inventory` → next `calculateCharacter()` call
   picks up the changed bonuses on main, speciality *and* combat skills (wiring this to the sheet
   is task 14.1).
5. **Import** — file → `validateConfiguration()` → `importConfiguration()` → store replaces config
   → persisted. Invalid files are rejected before anything is overwritten.
