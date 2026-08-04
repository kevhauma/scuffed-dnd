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

One `Configuration` per browser: id, name, version, timestamps, `focusStatBonusLevel`, the optional
`mainSkillPointBudget`, plus the entity arrays — `mainSkills`, `stats`, `specialitySkills`,
`combatSkills`, `materials`, `materialCategories`, `items`, `equipmentSlots`, `races`,
`currencyTiers`.

`mainSkillPointBudget?: number` is the worked example of an optional field done right, and the
pattern to copy: **absent means unlimited**, so rulesets saved before it existed stay valid;
`validateConfiguration()` in `importExport.ts` accepts `undefined` and only type-checks a present
value; `setMainSkillPointBudget(undefined)` deletes the key rather than storing `undefined`; and
`validateMainSkillAllocation()` in `src/engine/skillAllocation.ts` reads it as `null` = no limit.

Identity rules that the rest of the app depends on:

- **Skills are keyed by a unique 3-letter `code`** (`STR`, `WIS`, `MEL`), not an id — main,
  speciality, and combat skills all use it, and it is also the variable name a formula references.
  Codes must be unique *across* skill kinds, since one formula namespace serves all of them.
- **Everything else is keyed by `id`** (string), except `EquipmentSlot`, which is keyed by `type`.
- **Formulas are strings** on `Stat.formula`, `SpecialitySkill.bonusFormula`, and
  `CombatSkill.bonusFormula`. They are parsed by the formula engine, never `eval`'d, and a bare
  variable is only valid if it resolves to a configured skill code. Since TICKET-FORM-03 a formula
  may also carry **dotted namespaced references** (`stats.speed`, `const.bonus_divider`), which are
  *not* checked against skill codes — scoping is TICKET-FORM-04 and no namespace resolver is wired
  yet, so such a formula saves but throws at calculation time. Persisted formula strings are
  therefore not yet guaranteed evaluable; treat that as temporary, closing with FORM-04/FORM-05.
- **Deletion is reference-checked**: a skill/material/slot/category referenced elsewhere must not
  be deletable without warning the user — that's what `engine/validator.ts` and the panels'
  dependency checks exist for.

## Character (the play-mode data)

`Character` stores only what the player chose: `raceIds`, `mainSkillLevels`,
`specialitySkillBaseLevels`, `focusStatCode`, `currentStatValues`, and an `Inventory`
(`equippedItems: Record<slotType, itemId>` + `miscItems: itemId[]`). It carries
`configurationId` so a character is always read against the ruleset it was built on.

**Derived values are never persisted.** Total main-skill levels (with racial bonuses), max stat
values, speciality totals, combat bonuses, and equipment bonuses are computed on demand from
`src/engine/`. `calculateCharacter(character, config)` in
[calculator.ts](../../../src/engine/calculator.ts) is the single entry point that produces a
`CalculatedCharacter` with all five derived fields populated; `calculateCharacterStats()` is a thin
wrapper over it for callers that only want the stat values. If you find yourself wanting to store a
computed number on `Character`, the answer is a recalculation call at read time instead. The one deliberate
exception is `currentStatValues` — the player's *current* HP/mana, which is state, not derivation
(its maximum is derived; its current value is not). Because the maximum *is* derived,
`updateCurrentStatValue(characterId, statId, value, config)` and its plural sibling both take the
`Configuration` and clamp to `calculateCharacter().maxStatValues` inside the action (Req 14.3);
negatives pass through (Req 14.4). A stat with no calculated maximum — an unknown id, or a ruleset
whose formulas throw — is written unclamped. Don't clamp in a component; the rule lives in the
store so no caller can bypass it.

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
- **Import/export is a public boundary.** `importExport.ts`'s `validateConfiguration()` inspects
  untrusted JSON before it is applied; any new required field must be added to that check, or a
  file exported by an older build will be accepted and then break at render time.
  Import validates **twice**, and the two are not interchangeable: `importExport.ts` checks
  *structure* and refuses to apply a file that fails, while `engine/validator.ts` checks
  *references* (formula codes, slot types, categories, cycles) and only reports — a
  referentially-broken ruleset is still applied, so the User can repair it in the app.
  `useConfigStore.replaceConfig(config)` is what applying an import means (the app holds one
  configuration, so it replaces rather than appends); `renameConfig(name)` renames it.
- Round-trip test: export → import must reproduce an equivalent configuration.

## Data flow

0. **App start** — `RootLayout` calls `useAppHydration()` (`components/shared/`), which probes
   `isStorageAvailable()` and then restores both stores once per page load. Nothing else reads
   storage at start-up, and each store's `isLoaded` guard keeps it to one read.
1. **Config edit** — panel hook calls a `useConfigStore` action → state patched → `saveConfiguration()`.
2. **Character edit** — component calls a `useCharacterStore` action → state patched → `saveCharacters()`.
   `createCharacter(data, config)` takes the whole `Configuration`, not just its id: it seeds
   `currentStatValues` to the calculated maxima so a new character starts at full health. That is
   the one place a derived number is written onto a `Character`, and it is player state from then
   on — see the `currentStatValues` exception above.
3. **Anything displayed as a number** — component reads `calculateCharacter(character, config)`;
   the engine parses the relevant formulas and returns the `CalculatedCharacter`.
4. **Equipment change** — inventory action updates `Inventory` → next `calculateCharacter()` call
   picks up the changed bonuses on main, speciality *and* combat skills (wiring this to the sheet
   is task 14.1).
5. **Import** — file → `validateConfiguration()` → `importConfiguration()` → store replaces config
   → persisted. Invalid files are rejected before anything is overwritten.
