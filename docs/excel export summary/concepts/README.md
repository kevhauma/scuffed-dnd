# System-Layer Concepts — Index

**Companion to** [ttrpg-app-spec.md](../ttrpg-app-spec.md) §4 · Draft v0.1 · 2026-08-03

One page per concept. Each page covers: purpose, why it is data rather than code, full field table, where each value derives from, links, validation, seed content from the Ducklets sheet, editing scenarios, and open questions.

**Read [00-field-model.md](00-field-model.md) first** — it defines the six value sources, field metadata, and evaluation contexts that every other page assumes.

## Pages

| # | Concept | Purpose | Instantiable |
|---|---|---|---|
| 00 | [Field model](00-field-model.md) | Shared foundation — not a concept | — |
| 01 | [Stat](01-stat.md) | Atomic numeric axes | no |
| 02 | [Skill](02-skill.md) | Competence derived from stats + investment | no |
| 03 | [Archetype](03-archetype.md) | Specialisation; changes point-buy exchange rate | no |
| 04 | [Creature](04-creature.md) | Races, monsters, animals, gods — one concept | **yes** |
| 05 | [Constant](05-constant.md) | Named tunable numbers | no |
| 06 | [Curve](06-curve.md) | Named lookup tables and progressions | no |
| 07 | [Dice ladder](07-dice-ladder.md) | Turns a value into a dice pool | no |
| 08 | [Roll definition](08-roll-definition.md) | Named rolls on a sheet (melee, evasion…) | no |
| 09 | [Material family](09-material-family.md) | Crafting substrate, tiers 1–N | no |
| 10 | [Slot](10-slot.md) | Where equipment goes | no |
| 11 | [Item template](11-item-template.md) | What a thing is, vs. what it is made of | **yes** |
| 13 | [Spell](13-spell.md) | Castable effects that scale with the caster | no |
| 14 | [Passive](14-passive.md) | Always-on traits that scale with the owner | no |
| 15 | [Harvest table](15-harvest-table.md) | What a creature's body yields | no |
| 16 | [Currency](16-currency.md) | Coin denominations | no |
| 17 | [Creature type](17-creature-type.md) | humanoid / beast / undead / … | no |
| 18 | [Size](18-size.md) | tiny … gargantuan | no |
| 19 | [Damage & check type](19-damage-and-check-type.md) | Tag vocabularies for spells and passives | no |
| 20 | [Resource & action](20-resource-and-action.md) | Mutable pools (mana, health, XP) and the actions that move them | **yes** |

## Confidence markers

Used consistently across all pages:

- ✅ **Confirmed** — read directly from the sheet's formulas or cached values.
- 🔍 **Inferred** — consistent with the data but not proven; verify during import.
- ❓ **Unknown** — needs a look at the live sheet or a decision from you.
- ⚠️ **Anomaly** — something in the source data that looks wrong or needs a call.

## Concept map

```
                    ┌──────────┐
                    │   STAT   │◄──────────────┐
                    └────┬─────┘               │
        weighted by      │                     │ per-stat modifiers
     ┌───────────────────┼───────────────┬─────┴────────┐
     │                   │               │              │
┌────▼─────┐      ┌──────▼─────┐   ┌─────▼──────┐  ┌────▼─────────┐
│  SKILL   │      │ ARCHETYPE  │   │  CREATURE  │  │ MATERIAL     │
└────┬─────┘      └──────┬─────┘   └──┬──┬──┬───┘  │  FAMILY→TIER │
     │                   │            │  │  │      └────┬─────────┘
     │ scales            │ cost mult  │  │  │           │
     │                   │            │  │  │      ┌────▼─────────┐
     │                   │            │  │  │      │ ITEM TEMPLATE│
     │                   │            │  │  │      └────┬─────────┘
     │                   │            │  │  │           │ occupies
┌────▼─────┐        ┌────▼────────────▼┐ │  │      ┌────▼─────────┐
│  SPELL   │◄───────┤    CHARACTER     │ │  │      │     SLOT     │
└──────────┘learnable└──────────────────┘ │  │      └──────────────┘
┌──────────┐  applies-to                  │  │      ┌──────────────┐
│ PASSIVE  │◄─────────────────────────────┘  │      │   CURRENCY   │
└──────────┘                                 │      └──────────────┘
┌──────────┐  yields                         │      ┌──────────────┐
│ HARVEST  │◄────────────────────────────────┘      │ CONST / CURVE│
│  TABLE   │                                        │  DICE LADDER │
└──────────┘                                        └──────────────┘
```

## Resolved

| Question | Answer | Page |
|---|---|---|
| What is **APT**? | ✅ **Attacks Per Turn** — `max(1, round(speed / 30))`, confirmed from `Charactersheet!E9`. Speed drives the action economy. | [05](05-constant.md#apt--attacks-per-turn-), [01](01-stat.md#derived-stats) |
| What do the **Apps Scripts** do? | ✅ Two files, both faking mutable state: mana spend/regain and XP add/subtract. Revealed the missing [Resource & action](20-resource-and-action.md) concept — and two live bugs. | [20](20-resource-and-action.md) |
| Is **health tracked**? | ✅ Yes — typed over by hand, no script. Becomes stepper controls, with `current` stored separately from the derived `max`. | [20](20-resource-and-action.md#manual-adjustment-controls) |
| What is **experience for**? | 🆕 **Decided:** level derives from accumulated XP via a configurable curve, closing the progression loop the sheet leaves open. | [06](06-curve.md#seed-curve-xp--level-), [20](20-resource-and-action.md#experience-drives-level-) |

## Consolidated open questions

Each is also stated on its own page.

| # | Question | Page |
|---|---|---|
| 1 | What are the **evasion / endure input expressions**? They produce 18 and 16 for the sample character — not raw Dex/Con. | [08](08-roll-definition.md) |
| 2 | How are spells **unlocked**? `Learned`/`Locked` is stored, the condition is not. | [13](13-spell.md) |
| 3 | Four **tier/curve anomalies** — deliberate balance or typos? | [06](06-curve.md), [09](09-material-family.md) |
| 4 | Does a harvested part's **tier** derive from the creature's CR/stat total, or is it hand-set? | [15](15-harvest-table.md) |
| 5 | **Damage/check types** — controlled vocabulary or free text? | [19](19-damage-and-check-type.md) |
| 6 | Is **coin** one concept or two (currency denomination vs. metal material)? | [16](16-currency.md) |
| 7 | Are `Devil` / `demon` / `fiend` three types by design, or drift? | [17](17-creature-type.md) |
| 8 | What are the **XP thresholds**? Level now derives from XP, so the curve's shape and level-2 value are needed. | [06](06-curve.md#seed-curve-xp--level-) |
| 9 | What is in the **third `.gs` file** that defines `getFileName()`? Not among the two shared. | [20](20-resource-and-action.md) |
