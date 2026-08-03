# 11 · Item Template (and Item Instance)

[← Index](README.md) · [Field model](00-field-model.md) · [Spec](../ttrpg-app-spec.md)

> **Purpose:** separate *what a thing is* (a rapier) from *what it is made of* (iron, tier 1). The sheet already does this — `iron 1 + empty + rapier` — and it is why ~290 [materials](09-material-family.md) × ~60 templates yields thousands of distinct items without thousands of rows.

**Instantiable: yes.** Item instances live in a character's [slots](10-slot.md) or inventory.

---

## Why it's data, not code

The template/material split is the sheet's best idea, and it is implemented as a naming convention plus a formula that concatenates three cells. Nothing enforces that a "meat" material can't be used for a breastplate, and the stat-combination rule is copy-pasted per row.

## Item Template fields

| Field | Type | Source | Notes |
|---|---|---|---|
| `name` | text | literal | ✅ ~60 seeded |
| `category` | ref | link | ✅ Armor, Melee weapons, Ranged weapons, Miscellaneous, Ammo, Magic weapons, Reliques, Money |
| `slots` | list | link → [Slot](10-slot.md) | Which slots it can occupy |
| `material_count` | number | literal | ✅ Seed 2 (primary + secondary; `empty` is allowed) |
| `allowed_families` | link/selector | link | e.g. armour accepts metals and hides, not meat |
| `base_value` | number | literal | ✅ In gold |
| `base_mods` | map stat → number | literal | The template's own contribution — mostly 0 in the seed |
| `damage_roll` | dice | formula | For weapons 🔍 |
| `is_stackable` | boolean | literal | ✅ Ammo is priced per 20 |
| `two_handed` | boolean | literal | 🔍 Occupies both hand slots |
| `description`, `art` | text / image | literal | |

## Seed content ✅

| Category | Templates | Sample values |
|---|---|---|
| Armor | breastplate, chain pants, chain shirt, helmet, leg plate, ring mail chest, ring mail legs | breastplate 10000, chain 9000, leg plate 7500, helmet 5000 |
| Melee weapons | battleaxe, club, dagger, flail, glaive, greataxe, greatclub, greatsword, halberd, handaxe, javelin, lance, light hammer, longsword, mace, maul, morningstar, pike, quarterstaff, rapier, scimitar, shortsword, sicle, spear, trident, warhammer, warpick, whip | dagger 1000, most one-handed 1500, two-handed 3000 |
| Ranged weapons | hand crossbow, heavy crossbow, long bow, short bow, sling | |
| Miscellaneous | shield | |
| Ammo per 20 | blowgun needles, crossbow bolts, sling bullets | |
| Magic weapons | rod, staff, wand | |
| Reliques | emblem, reliquary | |
| Money | coin | see [Currency](16-currency.md) |

The value ladder is clean and legible: dagger 1000 < one-handed 1500 < two-handed 3000, helmet 5000 < leg plate 7500 < breastplate 10000. Worth preserving as a generator on the category rather than 60 literals.

## Item Instance fields

| Field | Type | Source |
|---|---|---|
| `template` | ref | link |
| `materials` | list of tier refs | link ✅ `iron 1` + `empty` |
| `display_name` | text | **formula** ✅ `"{material_1} {material_2} {template}"` → `iron 1 empty rapier` |
| `stats` | map stat → number | **formula** ✅ `Σ material.mods + template.base_mods` |
| `value` | number | **formula** ✅ |
| `quantity` | number | instance-state |
| `equipped_in` | ref | link → [Slot](10-slot.md) |
| `custom_name` | text | instance-state — for named/magic items |

## Confirmed instances ✅

From the sample character:

| Item | Str | Con | Dex | Int | Wis | Char | Health | Mana | Speed | Value |
|---|---|---|---|---|---|---|---|---|---|---|
| `fur 1 empty shirt` | 0 | 1 | 1 | 0.1 | 1 | 11 | 1 | 50 | 0.1 | 800 |
| `feather 1 empty pants` | 0 | 1 | 11 | 0.1 | 1 | 1 | 0 | 0 | 0.1 | 600 |
| `fur 1 empty boots` | 0 | 1 | 1 | 0.1 | 1 | 11 | 1 | 50 | 10.1 | 800 |
| `iron 1 empty rapier` | 1 | 1 | −10 | 0 | 0 | 1 | 2 | 0 | 0 | 1600 |

Note the boots' Speed 10.1 vs the shirt's 0.1 — the [slot](10-slot.md) or template contributes, not just the material. And `iron 1` carries a **−10 Dex** penalty, which is why the character's evasion is low.

## The combination formula

```
instance.stats[s] = Σ(material.mods[s] for each material) + template.base_mods[s]
instance.value    = Σ(material.value)                     + template.base_value
```

A **single editable expression**. Want the second material to contribute half? One edit, applied to every item in the world:

```
material_1.mods[s] + material_2.mods[s] * 0.5 + template.base_mods[s]
```

## Links

| Direction | Target | Via |
|---|---|---|
| out | [Slot](10-slot.md) | `slots` |
| out | [Material family](09-material-family.md) | `allowed_families` |
| out | [Stat](01-stat.md) | `base_mods` |
| in | Character / creature | equipped or in inventory |
| in | [Harvest table](15-harvest-table.md) | yields reference templates |

## Validation

- `material_count` must be ≥ 1; templates with 0 materials should use `base_mods` only and are flagged.
- An `allowed_families` selector matching zero families makes the template uncraftable — flagged.
- Deleting a template is blocked while instances exist.

## Editing scenarios

| You want to | You do |
|---|---|
| Add a "gauntlets" template | One record: category Armor, slot hands, value, allowed families. Every material combination becomes available instantly. |
| Allow 3 materials | `material_count` → 3 and extend the combination formula. |
| Make weapons scale with material tier non-linearly | Edit the combination formula. |
| Price all armour 20% higher | Edit the category's value generator. |

## Open questions

- 🔍 Do weapon templates carry their own `damage_roll`, or is weapon damage entirely derived from the wielder's [roll definitions](08-roll-definition.md)? The export suggests the latter, which would be unusual.
- 🔍 Confirm the Speed 10.1 on boots — template contribution, slot contribution, or a data entry artifact.
