# 04 · Creature

[← Index](README.md) · [Field model](00-field-model.md) · [Spec](../ttrpg-app-spec.md)

> **Purpose:** one concept covering playable races, monsters, animals and gods. The sheet already treats them uniformly — ~980 columns in a single table — so the app makes that explicit rather than splitting them.

**Instantiable: yes.** NPCs and encounter monsters are instances of a Creature.

---

## Why it's data, not code

The *Creature stats* tab is ~980 creatures laid out as **columns**, read by `HLOOKUP` into the hardcoded range `$B$4:$ZZQ$13` where the row index encodes which stat you want. Inserting a creature anywhere but the far right shifts nothing (columns are keyed by name) but inserting a **stat row** breaks all 39 lookups at once. And the range literal `$ZZQ$13` is a hard ceiling someone will eventually hit.

Rows with IDs remove both problems.

## Fields

| Field | Type | Source | Notes |
|---|---|---|---|
| `name` | text | literal | ✅ ~980 seeded |
| `stats` | map stat → number | literal | ✅ One value per [Stat](01-stat.md) |
| `type` | ref | link → [Creature type](17-creature-type.md) | ✅ |
| `size` | ref | link → [Size](18-size.md) | ✅ |
| `playable` | boolean | literal | ✅ Replaces the separate playable-races list on *Architypes & catagorys* |
| `stat_total` | number | **formula** | ✅ `sum(stats where counts_toward_total)` |
| `challenge_rating` | number | **curve + override** | ✅ §Challenge rating |
| `summon_rate` | number | literal | ✅ Difficulty modifier when summoned |
| `harvest_table` | ref | link → [Harvest table](15-harvest-table.md) | |
| `passives` | list | link (inbound from [Passive](14-passive.md)) | |
| `spells` | list | link (inbound from [Spell](13-spell.md)) | |
| `default_equipment` | list | link | For instancing armed NPCs |
| `description`, `art` | text / image | literal | |

## Stat total ✅

`sum(stats where stat.counts_toward_total)` — the six core stats, excluding Health, Mana, Speed. Confirmed on six creatures; see [Stat](01-stat.md#counts_toward_total--confirmed-derivation).

## Challenge rating

Generated from `stat_total` via a [curve](06-curve.md), **with per-row overrides**. ✅ Sampled from the sheet:

| stat_total | 19 | 26 | 40 | 49 | 54 | 65 | 74 | 156 | 230 | 280 |
|---|---|---|---|---|---|---|---|---|---|---|
| CR | −4 | −4 | −2 | −1 | −1 | 1 | 1 | 10 | 16 | 21 |

The ten seed races have **hand-set** CRs instead — `human 0, elf 0, Hamster 0, dwarf 0, Raccoon 0, Demon 1, Demur 1, Empty 0, Monolith 20, Gods 30` ✅. A Hamster's stat total of 20 would derive to −4; it keeps 0 because someone decided playable races start at 0.

This is the canonical example of [generated + overridden](00-field-model.md#11-generated--overridden). The exception is visible and intentional rather than looking like a formula somebody forgot to fill down.

## Hybrid races ✅

A character may reference **two** creatures. The blend is a system formula:

```
stat = roundup(race_a.stat + race_b.stat) / 2
```

The sample character is `Ducklets × Ducklets` — the wizard defaults both dropdowns to the same race, so a single-race character is just a degenerate blend. Editable: a 70/30 split or "take the higher of each" is one expression.

## Summon rate ✅

A per-creature difficulty modifier used by the summoning calculator on the *Spellbook* tab. Range in the seed data: **−3** (kobold, merfolk, xvart, jermlaine) to **+18** (the lord of blades), with most playable races at 0.

The sheet splits this into two tables ("lower of equal" / "Higher"); that split is presentation, not data — one field covers both.

## Seed content ✅

~980 creatures. The first ten are the campaign's own races (human, elf, Hamster, dwarf, Raccoon, Demon, Demur, Empty, Monolith, Gods); the rest is an imported bestiary (bat, Black Bear, Boar, brown bear, cat, constrictor Snake, Crocodile, Dire Wolf, Frog, giant eagle, giant spider, hawk, imp, Lion, Mastiff, mule, owl, panther, poisonous snake, pseudodragon…). `Ducklets` appears in the summon table at rate 0 ✅.

`Empty` is a null-creature with all zeros — a spreadsheet sentinel. Import it as a real record (it is referenced) but flag it; the app has proper empty states.

## Instantiation

Creature is `instantiable`. An instance (NPC / encounter monster) carries:

- creature ref + level + point allocation
- generated call sheet: stats, [rolls](08-roll-definition.md), skills, spells, passives — all derived
- equipment in [slots](10-slot.md), harvested-loot state
- per-instance overrides ("this goblin is wounded")

Templates spawn multiple instances ("3 goblins") sharing one definition.

## Links

| Direction | Target | Via |
|---|---|---|
| out | [Stat](01-stat.md) | `stats` |
| out | [Creature type](17-creature-type.md), [Size](18-size.md) | `type`, `size` |
| out | [Harvest table](15-harvest-table.md) | `harvest_table` |
| in | [Spell](13-spell.md) | `learnable_by` |
| in | [Passive](14-passive.md) | `applies_to` |
| in | Character | `race` (1–2 refs) |

## Validation

- Deleting a creature referenced by a spell link, passive link, or live character is blocked.
- Near-duplicate names flagged: ✅ `kenku` appears **twice** in the summon table, and the spell lists contain `halfing`/`halfling`, `plasmmoid`/`plasmoid`, and `aasimar ` with a trailing space.
- A `playable` creature with no harvest table is fine; a non-playable one without is a warning.

## Import notes ⚠️

- The positional `HLOOKUP` machinery disappears entirely.
- Name variants across the comma-separated learnable-by lists are reconciled during [link conversion](13-spell.md#learnable_by), each as a reviewable suggestion — not a silent fix.
- The ten hand-set CRs must import as **overrides**, not as literals, or regenerating the CR curve later would quietly change them.

## Editing scenarios

| You want to | You do |
|---|---|
| Add a creature | One row. It inherits every spell/passive whose selector matches. |
| Rebalance all CRs | Edit the curve. Overridden rows keep their values and are listed. |
| Make a monster playable | Toggle `playable`. It appears in the creation wizard. |
| Support 3-race hybrids | Change the blend formula and the wizard's race-picker count. |

## Open questions

None specific to this concept — but note it depends on [06 · Curve](06-curve.md) open questions.
