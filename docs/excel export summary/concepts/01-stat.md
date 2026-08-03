# 01 · Stat

[← Index](README.md) · [Field model](00-field-model.md) · [Spec](../ttrpg-app-spec.md)

> **Purpose:** the atomic numeric axes a character or creature is measured on. Everything else in the system either modifies a stat or reads one.

---

## Why it's data, not code

The sheet hardcodes nine stats as nine rows, referenced by **position**: `HLOOKUP(E12,'Creature stats'!$B$4:$ZZQ$13, 2, false)` — row 2 *is* Strength. Every table that touches stats (races, materials, archetypes, body parts) repeats that positional assumption. Adding a tenth stat means editing every one of them, and inserting one in the middle silently shifts every lookup.

Here, adding a stat adds a column to those editors automatically, because they link to stat IDs rather than row numbers.

## Fields

| Field | Type | Source | Notes |
|---|---|---|---|
| `name` | text | literal | ✅ Seed: Strength, Con, Dex, Int, Wis, Char, Health, Mana, Speed |
| `abbreviation` | text | literal | For tight layouts |
| `description` | text | literal | Hover text on the sheet |
| `order` | number | literal | Drag-to-reorder; drives display everywhere |
| `default_base` | number | literal | Value before race/archetype. Seed: `0` — [races](04-creature.md) supply the base |
| `min` / `max` | number | literal or formula | Optional clamp; empty = unbounded |
| `counts_toward_total` | boolean | literal | ✅ **Critical.** Str/Dex/Con/Int/Wis/Char = true; Health/Mana/Speed = false |
| `is_resource` | boolean | literal | Health and Mana back a [Resource](20-resource-and-action.md) pool with a *current* value |
| `rounding` | enum | literal | none / round / floor / ceil — applied on display |

## Derived stats

A stat's value normally comes from race base + investment + equipment. But [§0.1](00-field-model.md#1-value-sources) applies here like anywhere else: a stat may instead have `source: formula`, making it purely derived. No separate "derived attribute" concept is needed.

Two seed examples, both with `counts_toward_total = false`:

✅ **APT (Attacks Per Turn)**

```
apt = max(1, round(stats.speed / const.apt_value))        apt_value = 30
```

Confirmed from `Charactersheet!E9`. The sample character has Speed 30 → APT 1. Full derivation on [05 · Constant](05-constant.md#apt--attacks-per-turn-). This makes Speed do double duty — movement *and* action economy — worth knowing before you rebalance it.

🆕 **Level**

```
level = curve.xp_thresholds( resources.experience.current )
```

Hand-typed in the sheet (`Charactersheet!E5`); now derived from accumulated XP through a configurable curve. See [06 · Curve](06-curve.md#seed-curve-xp--level-) and [20 · Resource & action](20-resource-and-action.md#experience-drives-level-).

## Where a character's stat value comes from

A stat value is a **sum of contributions**, each traceable in the provenance tree:

```
race base            ← Creature.stats, blended if two races      ✅
+ invested points    ← via archetype-weighted point-buy curve    ✅
+ equipment          ← Σ material tier mods over equipped items  ✅
+ passive/temp mods  ← from passives, buffs, conditions          🔍
+ manual override    ← instance layer                            ✅
```

The composition formula is itself editable. If you later want equipment to be capped rather than summed, that is a formula edit, not a code change.

## `counts_toward_total` — confirmed derivation ✅

The sheet computes a stat total that drives [challenge rating](04-creature.md#challenge-rating). Verified: it is the sum of the **six core stats only**, excluding Health, Mana and Speed.

| Creature | Str | Dex | Con | Int | Wis | Char | Total |
|---|---|---|---|---|---|---|---|
| human | 10 | 10 | 10 | 10 | 10 | 10 | **60** ✅ |
| elf | 9 | 12 | 12 | 10 | 12 | 9 | **64** ✅ |
| dwarf | 14 | 3 | 15 | 10 | 8 | 10 | **60** ✅ |
| Raccoon | 7 | 16 | 7 | 7 | 7 | 15 | **59** ✅ |
| Demon | 15 | 15 | 15 | 15 | 15 | 15 | **90** ✅ |
| Monolith | 300 | 300 | 300 | 300 | 300 | 300 | **1800** ✅ |
| Gods | 320 | 320 | 320 | 320 | 320 | 320 | **1920** ✅ |

Six independent confirmations. Without this flag as data, adding a tenth stat would silently inflate every challenge rating in the bestiary.

## Sample values ✅

The sample character (Bickuss Dickuss, Ducklets, *Funny*): Str 10, Con 12, Dex 11, Int 8, Wis 15, **Char 39**, Health 7, Mana 310, Speed 30. The Char outlier is the archetype's point-buy multiplier at work — see [Archetype](03-archetype.md).

## Links

| Direction | Target | Via |
|---|---|---|
| in | [Skill](02-skill.md) | weighted `stat_weights` |
| in | [Archetype](03-archetype.md) | `stat_affinity` map |
| in | [Creature](04-creature.md) | `stats` map |
| in | [Material tier](09-material-family.md) | `mods` map |
| in | [Harvest table](15-harvest-table.md) | `stat_weights` per body part |
| in | [Roll definition](08-roll-definition.md) | `input` expression |

## Validation

- Deleting a stat is blocked while any skill weight, material tier, creature row, harvest weight, or formula references it. The block dialog lists every reference.
- Reordering never affects values — references are by ID.
- `is_resource` without a max-value formula is a warning: a pool with no ceiling can't render a bar.

## Editing scenarios

| You want to | You do |
|---|---|
| Add a `Sanity` stat | One record. Every creature row, material tier and archetype editor grows a column, defaulted to 0. |
| Rename `Strenght` → `Strength` | Rename. Nothing breaks — 4,244 references are by ID. |
| Stop Speed inflating CRs | It already doesn't — but toggling `counts_toward_total` is the switch. |
| Cap Dex at 30 | Set `max`. |

## Open questions

None.
