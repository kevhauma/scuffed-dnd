# 15 · Harvest Table

[← Index](README.md) · [Field model](00-field-model.md) · [Spec](../ttrpg-app-spec.md)

> **Purpose:** what a creature's body yields when butchered. The bridge between the bestiary and the crafting economy — it is where [materials](09-material-family.md) come from.

---

## Why it's data, not code

This is the loop that makes the crafting system matter: kill a creature → harvest tiered materials → craft [items](11-item-template.md) → get better at killing creatures. The sheet implements it across two tabs (*creature call sheet* body parts and *Creature background call* stat weights) with the mapping hardcoded per creature.

## Fields

| Field | Type | Source | Notes |
|---|---|---|---|
| `name` | text | literal | |
| `applies_to` | ref or selector | link | One creature, or a rule so "all bears" share a table |
| `parts` | list | — | One row per body part |

### Part row fields

| Field | Type | Source | Notes |
|---|---|---|---|
| `slot` | ref | link → [Slot](10-slot.md) | ✅ head, torso, legs, boots, weapon one, weapon two, trinket 1/2, loot ×6 |
| `materials` | list of tier refs | link or **formula** | ✅ `leather 4`, `meat 4`, `tanden 2`, `Claw 2` |
| `tier` | number | **formula** | 🔍 Scales with the creature's stats or CR |
| `quantity` | number | literal or formula | |
| `stat_weights` | map stat → number | literal | ✅ §Stat weights |
| `item_template` | ref | link | ✅ `basic Leather`, `basic tanden`, `basic claw` |
| `chance` | number | literal or formula | 🔍 Not visible in the export — may not exist |

## Seed content ✅

From the sample creature ("awakend three"):

| Part | Material 1 | Material 2 | Template | Resulting item |
|---|---|---|---|---|
| head | leather 4 | meat 4 | basic Leather | `leather 4 meat 4 basic Leather` |
| torso | leather 4 | meat 4 | basic Leather | same |
| legs | leather 4 | meat 4 | basic Leather | same |
| boots | leather 4 | meat 4 | basic Leather | same |
| weapon one | tanden 2 (teeth) | empty | basic tanden | `tanden 2 empty basic tanden` |
| weapon two | Claw 2 | empty | basic claw | `Claw 2 empty basic claw` |
| trinket 1/2 | empty | empty | empty | — |
| loot ×6 | empty | empty | empty | — |

Body armour parts all yield tier-4 leather + meat; natural weapons yield tier-2 teeth and claws. That asymmetry (4 vs 2) is presumably a balance decision worth preserving as a formula rather than a literal.

## Stat weights ✅

Each part carries a per-stat weight vector, from *Creature background call*:

| Part | Str | Con | Dex | Int | Wis | Char | Health | Mana | Speed | value |
|---|---|---|---|---|---|---|---|---|---|---|
| head | 0.4 | 6 | 3 | 4 | 2 | 6 | 2 | 0 | 0.5 | 0 |
| torso | 0.4 | 6 | 3 | 4 | 2 | 6 | 2 | 0 | 0.5 | 0 |
| legs | 0.4 | 6 | 3 | 4 | 2 | 6 | 2 | 0 | 0.5 | 0 |
| boots | 0.4 | 6 | 3 | 4 | 2 | 6 | 2 | 0 | 0.5 | 0 |
| weapon one | 4 | 2 | 2 | 0 | 2 | 2 | 1 | 0 | 0 | 0 |
| weapon two | 4 | 2 | 2 | 0 | 2 | 2 | 0 | 0 | 0.3 | 0 |
| trinket 1/2 | 0 | … | 0 | | | | | | | |
| loot ×6 | 0 | … | 0 | | | | | | | |

The four armour parts share one vector; the two natural weapons share another (weighted toward Str). Trinkets and loot contribute nothing — consistent with [Slot](10-slot.md)`.contributes_stats = false`.

## Why the weights matter

They let a harvested part carry a share of the creature's power into the item made from it — tier-4 leather from a dire wolf should not equal tier-4 leather from a rat. 🔍 The exact application formula (how a weight combines with the creature's stat to produce the yielded material's tier or mods) needs confirming against the live sheet; the structure is unambiguous from the export.

## Links

| Direction | Target | Via |
|---|---|---|
| out | [Creature](04-creature.md) | `applies_to` |
| out | [Slot](10-slot.md) | `parts[].slot` |
| out | [Material family](09-material-family.md) | `parts[].materials` |
| out | [Item template](11-item-template.md) | `parts[].item_template` |
| out | [Stat](01-stat.md) | `parts[].stat_weights` |

## Validation

- A creature with no harvest table yields nothing — legal, flagged for non-playable creatures.
- A part referencing a material family that no item template accepts produces unusable loot — flagged.
- A selector-based table overlapping an explicit one: explicit wins, and the conflict is listed.

## Editing scenarios

| You want to | You do |
|---|---|
| Give all bears the same drops | One table with `applies_to = target.name contains "bear"`, or better, a `bear` tag. |
| Make harvest tier scale with CR | Set `parts[].tier` to `roundup(creature.challenge_rating / 2)`. Applies everywhere. |
| Add a "horn" part | One row; it needs a [slot](10-slot.md) if it should be equippable. |
| Add drop chances | Add the `chance` field and a roll at harvest time. |

## Open questions

- 🔍 **Does a part's tier derive from the creature's CR/stat total, or is it hand-set per creature?** The sample creature's uniform tier 4 / tier 2 could be either. This determines whether ~980 creatures need hand-authored tables or one formula.
- 🔍 How exactly do `stat_weights` apply — do they scale the yielded material's tier, its stat mods, or its value?
- ❓ Is there a harvest skill check (the ruleset has `butchering` and `skinning` skills)?
