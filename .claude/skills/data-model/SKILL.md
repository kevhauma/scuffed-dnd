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

- **Every referenceable entity carries a stable `id`.** Since TICKET-REF-01 that includes main,
  speciality and combat skills, whose `code` is now renamable display data rather than the
  identity. The store actions still *address* a skill by code (`updateMainSkill('STR', …)`) —
  that is a lookup argument, not the key. `EquipmentSlot` is still keyed by `type`.
- **Codes must stay unique across skill kinds.** One formula namespace serves all three, and the
  display form of a formula would be ambiguous otherwise. (TICKET-REF-01's to-be floated
  downgrading this to a warning; it is deliberately *not* done — see that ticket's divergence
  note.)
- **A persisted formula is id-resolved.** What the User writes and what is stored are two forms
  of the same expression: `STR + DEX` in display form, `[id-str] + [id-dex]` in stored form. The
  translation lives in [engine/formula/references.ts](../../../src/engine/formula/references.ts)
  and is applied at exactly two places — `services/storage.ts` and `services/importExport.ts`, so
  everything above them (stores, engine, components) works in display form only. Same for the
  `skillCode` on every race and material modifier. A rename is `toStoredConfiguration` → patch →
  `toDisplayConfiguration`, which `configStore`'s `applyRenameSafely` does for you; the reference
  index is **derived on every call and never persisted**.
  A `stats.*` member is a slug of the stat's name (`Max Health` → `stats.max_health`) until
  TICKET-STAT-01 gives stats a real code.
- **Formulas are strings** on `Stat.formula`, `SpecialitySkill.bonusFormula`, and
  `CombatSkill.bonusFormula`. They are parsed by the formula engine, never `eval`'d, and a bare
  variable is only valid if it resolves to a configured skill code. Since TICKET-FORM-03 a formula
  may also carry **dotted namespaced references** (`stats.speed`, `const.bonus_divider`); which of
  those a formula may use depends on its attachment point, per the tables in
  `engine/formula/scoping.ts` (TICKET-FORM-04). The save-time guard refuses out-of-scope
  namespaces and unknown members, so a persisted formula's references are in scope — but it can
  still fail to *evaluate*, because no calculator supplies namespace resolvers until
  CST-01/CRV-01/STAT-01. Since TICKET-FORM-05 that failure is an **error value on that one entry**,
  not a throw.
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
(its maximum is derived; its current value is not).

**Since TICKET-CALC-02, every *configured* code has a value; absence is not a state.**
`calculateTotalMainSkillLevels` seeds every code in `config.mainSkills` to 0 before applying
allocations, racial modifiers, equipment and the focus bonus, so `totalMainSkillLevels` is the
configured namespace in full and a main skill the character never allocated reads as `0` rather
than as an undefined variable in every formula naming it. `Undefined variable` is reserved for
codes the configuration genuinely does not define. Seed in the calculator — never default in a
component or back-fill `Character.mainSkillLevels` on save.

**Since TICKET-FORM-05 the three formula-derived maps hold `FormulaResult` — a number *or* a
`FormulaError`** (`maxStatValues`, `specialitySkillTotalLevels`, `combatSkillBonuses`;
`totalMainSkillLevels` stays plain numbers, since nothing there comes from a user formula).
`calculateCharacter` **always returns**: a broken formula poisons its own entry and nothing else
(Concept 00 §7). Read entries with `numberOr(result, fallback)` or `asNumber(result)` from
[engine/formula/errors.ts](../../../src/engine/formula/errors.ts) — never `?? 0`, which cannot
tell an error from a missing key. Errors carry `source` (the owning stat/skill) and `cause` (the
upstream error), so `describeFormulaError` can render a chain. **Never `numberOr` an error into a
number the user then sees as authoritative** — surface it, or let the caller show the error.

Because the maximum *is* derived,
`updateCurrentStatValue(characterId, statId, value, config)` and its plural sibling both take the
`Configuration` and clamp to `calculateCharacter().maxStatValues` inside the action (Req 14.3);
negatives pass through (Req 14.4). A stat with no calculated maximum — an unknown id, or one whose
formula produced an error — is written unclamped. Don't clamp in a component; the rule lives in the
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
