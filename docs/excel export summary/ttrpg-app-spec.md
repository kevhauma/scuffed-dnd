# TTRPG System Builder — Specification

**Status:** Draft v0.1 · 2026-08-03
**Source material:** "Ducklets" homebrew ruleset Google Sheet (16 tabs, ~7,240 formulas, ~980 creatures, 419 spells, ~290 materials, 57 skills)

---

## 1. Purpose

Replace the spreadsheet with an application that does what the spreadsheet does — character creation, derived stats, crafting, spells that scale with the caster, creature/NPC generation — while fixing its structural problems:

| Spreadsheet problem | App answer |
|---|---|
| One file per character (filename = name) | Characters are records under one shared ruleset |
| Rules duplicated into every character copy | Rules live once; characters reference a ruleset version |
| Hardcoded ranges (`$B$4:$ZZQ$13`), copy-paste formula drift | Named references resolved by ID; no positional addressing |
| Regex substring matching on comma-lists (`rat` matches `wererat`) | Explicit typed links and selector rules |
| Silent `IFERROR` → `#N/A` walls | Errors are visible values with provenance |
| Typos fork identity (`halfing`/`halfling`, `skinning`/`Skinning`) | Stable IDs; display names are freely renamable data |
| Google-only functions lock the data in | Portable engine, JSON export |

**The central requirement: nothing about the game system is hardcoded.** Stats, skills, archetypes, races, material tiers, item slots, progression curves, dice notation, currencies — and every formula connecting them — are data, editable in the app by the system owner. The Ducklets ruleset is the *seed content*, not the product. The product is a rules engine plus editors.

## 2. Goals / Non-goals

**Goals**
1. Full parity with the spreadsheet's mechanics (verified — see §12 Golden tests).
2. Every concept, link, tier table, constant, and formula user-editable without code.
3. Multi-character, multi-user: one ruleset serves a whole play group.
4. Safe evolution: editing rules mid-campaign can't silently corrupt characters.
5. Every computed number can explain itself (provenance / audit tree).

**Non-goals (out of scope for this spec)**
- Virtual tabletop features: maps, tokens, initiative automation, fog of war.
- Automating combat resolution. The app produces roll expressions (and can roll them); it does not adjudicate turns.
- Importing arbitrary third-party spreadsheets. One purpose-built importer for the source sheet.
- Content marketplace / public sharing beyond a play group.

## 3. Core architecture: three layers

```
┌────────────────────────────────────────────────────────┐
│ SYSTEM layer (the ruleset — editable by system owner)  │
│ concepts · fields · formulas · links · tiers · curves  │
│ constants · templates · dice rules · currencies        │
├────────────────────────────────────────────────────────┤
│ INSTANCE layer (per campaign — players & GM)           │
│ characters · NPC/creature instances · inventory items  │
│ learned spells · coin · manual overrides               │
├────────────────────────────────────────────────────────┤
│ PLAY layer (thin)                                      │
│ computed sheets · roll buttons · summon calculator     │
└────────────────────────────────────────────────────────┘
```

Everything in the SYSTEM layer is built from **six primitives**. Every spreadsheet tab maps onto them (§11). If a future homebrew idea fits the primitives, it needs no app changes.

### 3.1 The six primitives

1. **Concept** — a collection of entities with typed fields (Stat, Skill, Race, Material, Spell…). Users can add fields to any concept and (Phase 3) define entirely new concepts.
2. **Formula** — a named, sandboxed expression over the data graph (§5). Any numeric/dice/text field may be formula-driven.
3. **Link** — a typed relation between concepts, populated explicitly and/or by selector rule (§6).
4. **Tier / Curve** — lookup tables and generated progressions (§7).
5. **Template** — text with embedded expressions, for scaling effect descriptions (§5.4).
6. **View** — a layout that renders entities as a sheet (character sheet, spellbook, bestiary) (§10).

### 3.2 Identity rules (non-negotiable)

- Every entity has a stable internal ID. **All references — in formulas, links, templates — are stored as IDs**, displayed as current names.
- Renaming anything updates its display everywhere instantly and can never break a reference. (This retroactively fixes `Strenght`, `Equimment`, `Architype`, `Prefomance` — keep or fix the spelling freely.)
- Deleting an entity that is referenced is blocked by default; the UI shows the reference list ("used by 41 formulas, 12 links") with a jump-to-each option. Force-delete converts references to visible errors, never silent zeros.

## 4. System-layer content model

These are the seed concepts the importer creates. All of them are instances of the primitives — none is special-cased in engine code.

**Each concept is specified in full on its own page** under [`concepts/`](concepts/README.md): purpose, why it is data rather than code, complete field table with value sources, derivations verified against the sheet, links, validation rules, seed content, editing scenarios, and open questions.

Read [concepts/00-field-model.md](concepts/00-field-model.md) first — it defines the six value sources, field metadata, and evaluation contexts that every concept page assumes.

| # | Concept | One-line purpose | Page |
|---|---|---|---|
| 00 | Field model | Six value sources, metadata, contexts — the shared foundation | [→](concepts/00-field-model.md) |
| 01 | **Stat** | Atomic numeric axes; everything else modifies or reads one | [→](concepts/01-stat.md) |
| 02 | **Skill** | Competence from weighted stats + investment → level and bonus | [→](concepts/02-skill.md) |
| 03 | **Archetype** | Specialisation; changes the point-buy exchange rate, not stats directly | [→](concepts/03-archetype.md) |
| 04 | **Creature** | Races, monsters, animals, gods — one concept, ~980 records | [→](concepts/04-creature.md) |
| 05 | **Constant** | Named tunable numbers (`points_per_level`, `bonus_divider`, `apt_value`) | [→](concepts/05-constant.md) |
| 06 | **Curve** | Named lookup tables: point-buy, challenge rating, thresholds | [→](concepts/06-curve.md) |
| 07 | **Dice ladder** | Decomposes a value into `aD20 + bD12 + cD6 + flat` | [→](concepts/07-dice-ladder.md) |
| 08 | **Roll definition** | Named rolls (melee, ranged, evasion, endure) with input expressions | [→](concepts/08-roll-definition.md) |
| 09 | **Material family** | Crafting substrate; tiers 1–N with generators and overrides | [→](concepts/09-material-family.md) |
| 10 | **Slot** | Where equipment goes; differs between characters and creatures | [→](concepts/10-slot.md) |
| 11 | **Item template** | What a thing is, vs. what it is made of; instances combine both | [→](concepts/11-item-template.md) |
| 13 | **Spell** | Castable effects that scale with the caster via templates | [→](concepts/13-spell.md) |
| 14 | **Passive** | Always-on traits that scale with the owning creature | [→](concepts/14-passive.md) |
| 15 | **Harvest table** | What a creature's body yields — the bestiary↔crafting bridge | [→](concepts/15-harvest-table.md) |
| 16 | **Currency** | Coin denominations and exchange rates | [→](concepts/16-currency.md) |
| 17 | **Creature type** | humanoid / beast / undead / … — the main selector-rule axis | [→](concepts/17-creature-type.md) |
| 18 | **Size** | tiny … gargantuan; ordered, so `<=` comparisons work | [→](concepts/18-size.md) |
| 19 | **Damage & check type** | Tag vocabularies for spells and passives | [→](concepts/19-damage-and-check-type.md) |
| 20 | **Resource & action** | Mutable pools (mana, health, XP) and the actions that move them | [→](concepts/20-resource-and-action.md) |

Three of these are **instantiable** — instances of them exist at the instance layer (§9): [Creature](concepts/04-creature.md) → NPCs and encounter monsters, [Item template](concepts/11-item-template.md) → item instances in slots and inventories, and [Resource](concepts/20-resource-and-action.md) → the pools a character actually spends.

[Resource & action](concepts/20-resource-and-action.md) is the one concept with **stored, mutable state**. Everything else derives. It was added after reviewing the workbook's Apps Script, which exists solely to fake it — see §11.2.

## 5. Formula engine

The heart of the app. Design constraints: **safe** (no code execution, no I/O), **deterministic** (no randomness inside formulas — rolling happens at the play layer), **inspectable** (every result explains itself), **incremental** (spreadsheet-grade recompute).

### 5.1 Syntax

Infix expression language, deliberately small:

```
skills.persuasion.level * 0.3 + stats.char * 0.1
max(1, round(stats.speed / const.apt_value))
if(stats.str >= curve.dice_thresholds(2), 1, 0)
dice(d12: 1, d6: 1, flat: stats.dex_bonus)
```

- **References** are namespaced dotted paths: `stats.*`, `skills.*`, `const.*`, `curve.*(x)`, `self.*` (the entity owning the formula), `owner.*` (item → its wearer), `caster.*` (spell context), `parts.*` (creature harvesting). Autocompleted in the editor; stored as IDs (§3.2).
- **Context-scoped**: each formula declares (implicitly, by where it's attached) which namespaces exist. A spell template gets `caster`; an item stat formula gets `self` + `owner`; a tier generator gets `family` + `tier`.

### 5.2 Types

`number · boolean · text · dice · entity ref · list`.
Dice algebra: `dice + dice` merges pools; `dice + number` adds flat; `n * dice` scales counts. `2D6` is a literal. This is what lets `melee = curve.melee_dice(stats.str)` produce `0D20 + 1D12 + 1D6 + 4`.

### 5.3 Function library (complete, closed)

Arithmetic: `+ - * / %`, `round roundup rounddown floor ceil`, `min max clamp abs`
Logic: `if(c, a, b)`, comparisons, `and or not`
Aggregation: `sum avg count` over lists (e.g. `sum(equipment.*.stats.str)`)
Tables: `curve.NAME(x)` (step or interpolated — per-curve setting), `lookup(table, key, column)`
Dice: `dice(...)` constructor, literals
Sets: `has_tag(entity, tag)`, `in(entity, link)`
Text: concatenation via templates only (§5.4)

No user-defined functions in v1; named formulas are reusable by reference, which covers the same need with better traceability.

### 5.4 Templates

Text with `{expression}` holes, evaluated in a declared context:

```
Choose up to {caster.skills.healing} creatures within range.
Each target regains {caster.skills.healing}D4 health.
```

Used by spell effects, passive effects, and any description field. Rendered per-viewer: a spell previews with *your* numbers on your sheet and with the creature's numbers on its stat block.

### 5.5 Evaluation semantics

- The engine builds one dependency DAG per (ruleset version × instance). Recompute is incremental — edit a stat, only downstream nodes recalc. Scale target: 1,000 creatures × 419 spells × 57 skills is small; full recompute must stay < 100 ms, incremental < 5 ms.
- **Cycles are rejected at save time** with the path shown (`skills.charm → stats.char → archetype bonus → skills.charm`).
- **Errors are values.** A broken reference or type mismatch produces an error object that propagates with provenance, rendered as a red chip — never a silent 0 and never `#N/A` walls. There is deliberately no `IFERROR`.
- **Explain everything:** clicking any computed value opens its provenance tree — the formula, each input's value, recursively. This replaces the spreadsheet's one transparency advantage (clicking a cell to see its formula) and beats it.

### 5.6 Overrides

Any computed field on an *instance* can be manually overridden (the spreadsheet allows typing over anything; parity requires this). Overrides are visually flagged, list-viewable per character, and one-click revertible. System-layer formulas cannot be overridden per-instance — change the system or add a modifier entity instead.

## 6. Links

Two population modes, combinable on one link type:

1. **Explicit** — checked rows in a picker (e.g. this spell is learnable by *exactly* these 21 races).
2. **Selector rule** — a boolean formula over the target concept: `type = "humanoid" and size <= size.medium and playable`. Evaluated live; adding a qualifying creature later auto-includes it.
3. **Rule + exceptions** — selector with manual include/exclude pins on top.

Seed link types from the sheet:

| Link | Replaces |
|---|---|
| Spell ↔ learnable-by Creature | 1,400 comma-separated name lists |
| Passive ↔ applies-to Creature | `REGEXMATCH` substring hacks |
| Skill ↔ governing Stat (weighted) | Skills-tab weight columns |
| Item template ↔ allowed Material family | implicit convention |
| Item template ↔ allowed Slot | implicit convention |

The link editor shows both directions ("this spell's learners" / "this creature's spells") — the sheet could only render one direction per tab.

## 7. Tiers & curves

**Curve** = named table, one key column, 1+ value columns, step or linear-interpolated, edited as a grid. Seed curves: point-buy (points → stats, 3 columns for non/sub/main-type), attack-dice progression, bonus thresholds.

**Tier generator** = per material family (or any tiered concept), per attribute: either literal per-tier values or a formula in the tier context (`tier`, `family.base_*`):

```
value  = family.base_value * tier            (electrum: 100 × tier)
health = family.base_health + 5 * (tier - 1) (copper mana: 10, 15, 20…)
```

"Regenerate tiers" refills rows from the formulas **preserving flagged manual overrides** (the sheet's adamantine has hand-tuned Dex penalties — those survive regeneration). Changing tier count (10 → 12) extends generated families automatically and flags manual ones for review.

## 8. Editing experience

- **System editor** — one section per concept: grid editing, bulk operations, drag-reorder. Guarded by validation (§8.1).
- **Formula editor** — syntax highlighting, reference autocomplete (names, resolved to IDs), live preview against a chosen sample character/creature, and a dependency inspector (what this formula reads / what reads it).
- **Link editor** — dual-pane explicit picker + selector-rule builder with live match preview and diff ("this rule adds 14, removes 2").
- **Wizard config** — the Setup tab becomes a generated character-creation wizard: its steps (pick race(s) → archetype → starting stats/skills → ability) are derived from system config; step list and starting budgets are editable.

### 8.1 Validation panel

Always-visible health check on the system: dangling references, unused entities, cycle attempts, near-duplicate names (would have caught `skinning`/`Skinning` and `halfing`), selector rules matching zero entities, templates referencing missing context.

## 9. Instance layer

- **Character**: name, portrait, race ref(s), archetype ref, invested points (per stat and per skill), learned spells, equipment (slot → item instance), inventory list, coin pouch, overrides, notes, free-text ability (seed parity: "Glide").
- **Creature/NPC instance**: creature ref + level/point allocation, generated call-sheet (stats, parts, loot, spells, passives — all derived), per-instance overrides. Templates spawn instances ("3 goblins") sharing the definition.
- **Item instance**: template + materials + computed stats + value; lives in a character's slot/inventory or a loot list.
- All instances pin a **ruleset version** (§13).

## 10. Views (Play layer)

MVP ships fixed layouts with per-user show/hide/reorder; a full drag-drop layout editor is Phase 3.

1. **Character sheet** — stat block, derived rolls (melee/ranged/evasion/endure) as tappable roll buttons, skills grid, equipment slots, coin. Parity with *Charactersheet* tab.
2. **Spellbook** — learned/locked lists, effect text rendered with the viewer's numbers, mana tracking, summon calculator (race → adjusted challenge rate).
3. **Bestiary / call sheet** — browse creatures, spawn an instance, see its scaled spells & passives (parity with the three creature tabs, minus the `#N/A`s).
4. **Compendium** — searchable spells / materials / items / passives with live-scaled previews.
5. **System editor** — §8.
6. **Roller** — evaluates any dice value in the app; history log per session. (The only place randomness exists.)

## 11. Tab → primitive mapping (importer contract)

| Sheet tab | Becomes | Concept pages |
|---|---|---|
| Setup | Character-creation wizard config | [04](concepts/04-creature.md), [03](concepts/03-archetype.md) |
| Charactersheet | Character view (layout seed) | [01](concepts/01-stat.md), [02](concepts/02-skill.md), [08](concepts/08-roll-definition.md), [10](concepts/10-slot.md), [16](concepts/16-currency.md) |
| Spellbook | Spellbook view + summon table (creature.summon_rate) | [13](concepts/13-spell.md), [04](concepts/04-creature.md) |
| Components | Material families + tier tables | [09](concepts/09-material-family.md) |
| Equimment | Item templates + slots + currencies | [11](concepts/11-item-template.md), [10](concepts/10-slot.md), [16](concepts/16-currency.md) |
| Creature stats | Creature concept rows (~980) | [04](concepts/04-creature.md), [17](concepts/17-creature-type.md), [18](concepts/18-size.md) |
| creature call sheet | NPC instance view (layout seed) | [04](concepts/04-creature.md), [08](concepts/08-roll-definition.md) |
| Creature background call | Body-part weight tables + creature skill scaling formulas | [15](concepts/15-harvest-table.md), [02](concepts/02-skill.md) |
| creature passives | Passive definitions + applicability links | [14](concepts/14-passive.md) |
| Spell list creatures | Spell↔creature links + creature-context effect templates | [13](concepts/13-spell.md) |
| Calculator | Curves, archetype multipliers, dice progression, item-stat formula, constants | [05](concepts/05-constant.md), [06](concepts/06-curve.md), [07](concepts/07-dice-ladder.md), [03](concepts/03-archetype.md), [11](concepts/11-item-template.md) |
| Spell List | Spell definitions + caster-context effect templates | [13](concepts/13-spell.md), [19](concepts/19-damage-and-check-type.md) |
| Calculator spells | (helper — not imported) | — |
| Architypes & catagorys | Archetypes, creature types, sizes, playable flags. SI-units table: not imported. | [03](concepts/03-archetype.md), [17](concepts/17-creature-type.md), [18](concepts/18-size.md) |
| Skills | Skill definitions + stat-weight links | [02](concepts/02-skill.md), [01](concepts/01-stat.md) |
| `mana.gs`, `exp.gs` | Resource pools + actions | [20](concepts/20-resource-and-action.md) |
| *(unshared `.gs`)* | `getFileName()` → replaced by a plain name field | — |

### 11.1 Import cleanup (must produce a reconciliation report, not silent fixes)

- Merge duplicate skills (`skinning` vs `Skinning`).
- Fuzzy-match name-list variants when converting comma-lists to links: `halfing/halfling`, `plasmmoid/plasmoid`, `aasimar` with trailing space, etc. Each merge is a reviewable suggestion.
- Effect texts import as templates: the importer reverse-engineers the sheet's concatenation formulas (`…"take "&B2+1&"D6"…`) into `{…}` holes — these are visible in the export and mechanical to convert. Static spell texts import verbatim.
- Spelling of display names is imported **as-is** (renames are safe later, §3.2).
- Mana imports as **remaining**, not spent: `current = max − Spellbook!B9`. See §11.2.

### 11.2 Apps Script audit ✅

Two `.gs` files, both existing for one reason: **a spreadsheet cell cannot have a button that changes it.** Every other mechanic in the ruleset is a formula; spending mana is an event. They are the workbook's only mutable state — and the reason [Resource & action](concepts/20-resource-and-action.md) is a concept.

| Script | Reads | Mutates | Becomes |
|---|---|---|---|
| `mana.gs` `lowerMana` / `GainMana` | `Spellbook!B4` | `Spellbook!B9` ± | Spend / Regain actions on the Mana resource |
| `exp.gs` `addFunction` / `subtractFunction` | `Charactersheet!I17` | `Charactersheet!K1` ± | Award / Deduct actions on the Experience resource |

✅ `Spellbook!B9` is a spent-so-far accumulator (`C9 = Charactersheet!J20 − B9` renders remaining). ✅ `Charactersheet!K1` is read by **no formula in the workbook** — a write-only tally.

**Two live bugs**, worth fixing in the sheet regardless of this project:

1. Both files define `onOpen()`. Apps Script shares one global namespace across `.gs` files, so the second definition loaded silently replaces the first — only one `Custom Menu` ever appears.
2. `mana.gs`'s menu registers `addFunction2` / `subtractFunction2`, which **do not exist** (the real functions are `lowerMana` / `GainMana`). If its `onOpen` is the survivor, both items throw and mana tracking is unreachable.

**A third script exists** ❓ — `Setup!D6 = getFileName()` is defined in neither shared file, and its cached export value (`Bickuss Dickuss`) proves it worked. That file needs reviewing before the importer is final. `getFileName()` itself is replaced by a plain name field.

## 12. Golden tests

The xlsx export caches every formula cell's last computed value. The importer captures these as fixtures: after import, the engine must reproduce the cached values for the sample character (Bickuss Dickuss), the sample creature (awakend three), and both rendered spell lists. This verifies formula-translation fidelity mechanically instead of by eyeball. Known-broken sheet cells (the `#N/A` FILTER walls) are asserted to produce *correct* values, documented as intentional deviations.

## 13. Versioning & integrity

- Ruleset editing happens in a **draft**; publishing creates an immutable version.
- Instances pin a version. When a new version publishes, each character shows a **migration preview** (old vs new computed values side-by-side) before its owner accepts the upgrade. No silent mid-campaign stat shifts.
- Full undo history on system edits; audit log (who changed which formula when — since a formula edit can rebalance the whole game).
- Whole-system **export/import as JSON** (backup, sharing a ruleset with another group, version control if desired).

## 14. Users & permissions

| Role | Can |
|---|---|
| System owner (GM) | Edit ruleset, publish versions, manage all instances, invite |
| Player | Create/edit own characters, view compendium, roll |
| Spectator | Read-only |

Assumption: one ruleset + one player group per workspace; multiple campaigns can share the ruleset. (See §17.)

## 15. Non-functional requirements

- **Portability**: no dependence on Google services; runs self-hosted or local.
- **Performance**: see §5.5 recompute budgets; UI interactions < 100 ms.
- **Offline**: at minimum, read + roll from a loaded character while disconnected (nice-to-have for the table; see §17).
- **Data safety**: automatic backups; JSON export always available.

## 16. Suggested stack (non-binding)

TypeScript end-to-end. Server: Node + Postgres (or SQLite for a single-household deployment). Formula DSL: small hand-written Pratt parser + typed evaluator with an incremental dependency graph — do **not** eval JS, and don't adopt a general expression library that can't be locked to the closed function set. Frontend: React. The engine (parser + evaluator + graph) should be a pure, UI-free package — it's what golden tests target and what a future CLI/exporter reuses.

### Phasing

| Phase | Delivers |
|---|---|
| 0 | Importer + engine + golden tests green. No UI beyond a debug viewer. |
| 1 | Character & NPC sheets, wizard, spellbook, roller — values editable, formulas fixed. Playable at the table. |
| 2 | Full system editors: formulas, links, tiers, curves, validation panel, versioning. "Everything configurable" achieved. |
| 3 | Custom concepts, view/layout editor, permissions polish, offline mode. |

## 17. Open questions

### Product

1. **Deployment model** — self-hosted web app for the play group, or local desktop app with file sync? Drives auth and offline design.
2. **Roles** — does GM-edits-rules / players-own-characters match how your table actually works, or do players co-edit the ruleset?
3. **Dice** — roll in-app, or keep physical dice and only display roll strings? (Roller is cheap; question is whether it's Phase 1.)
4. **Multiple rulesets** — is supporting a second, unrelated homebrew system in the same install a real need (affects workspace model), or YAGNI?
5. **The third `.gs` file** — `getFileName()` is defined in neither shared script but demonstrably worked. What else is in there? (§11.2)

### Resolved

| Question | Answer |
|---|---|
| What is **APT**? | ✅ **Attacks Per Turn** — `max(1, round(speed / 30))`, confirmed from `Charactersheet!E9`. Speed drives the action economy. |
| What do the **Apps Scripts** do? | ✅ Fake mutable state for mana and XP. Revealed the missing [Resource & action](concepts/20-resource-and-action.md) concept, plus two live bugs. (§11.2) |
| Is **health tracked**? | ✅ Yes — typed over by hand. Becomes stepper controls, with `current` stored separately from the derived `max`. |
| What is **experience for**? | 🆕 **Decided:** level derives from accumulated XP via a configurable curve — see §4.1. |

### 17.1 Progression loop 🆕

The one deliberate rule change from the sheet. Today level is a hand-typed literal and XP is a tally nothing reads, so the chain has no input:

```
XP  →  level  →  point budget  →  stats  →  skills, APT, rolls, spell scaling
        ↑
    hand-typed today
```

✅ The downstream half already works — `Charactersheet!E17 = E5 × Calculator!Q5 − G17` is `level × points_per_level − points_spent`. Deriving `level = curve.xp_thresholds(experience)` closes the loop, makes awarding XP mechanically meaningful, and turns `points_per_level` into a real balance lever. The curve is fully configurable: thresholds per level, or a generator (`xp_base × level ^ xp_exponent`) with per-row overrides for a hand-tuned early game. See [06 · Curve](concepts/06-curve.md#seed-curve-xp--level-).

### Ruleset

Each is stated in full on its concept page; consolidated in [concepts/README.md](concepts/README.md#consolidated-open-questions).

| Question | Page |
|---|---|
| What are the **XP thresholds**? Needed before the progression loop is real. | [06 · Curve](concepts/06-curve.md#seed-curve-xp--level-) |
| What are the **evasion / endure input expressions**? They produce 18 and 16 — not raw Dex/Con. | [08 · Roll definition](concepts/08-roll-definition.md) |
| How are spells **unlocked**? `Learned`/`Locked` is stored; the condition is not. | [13 · Spell](concepts/13-spell.md) |
| Four **tier/curve anomalies** — deliberate balance or typos? | [06](concepts/06-curve.md), [09](concepts/09-material-family.md) |
| Does a harvested part's **tier** derive from CR, or is it hand-set per creature? | [15 · Harvest table](concepts/15-harvest-table.md) |
| **Damage/check types** — controlled vocabulary or free text? Cheapest to decide before import. | [19](concepts/19-damage-and-check-type.md) |
| Is **coin** one concept or two (denomination vs. metal)? | [16 · Currency](concepts/16-currency.md) |
| Are `Devil` / `demon` / `fiend` three types by design, or drift? | [17 · Creature type](concepts/17-creature-type.md) |
