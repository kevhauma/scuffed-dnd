# 02 · Skill

[← Index](README.md) · [Field model](00-field-model.md) · [Spec](../ttrpg-app-spec.md)

> **Purpose:** a competence derived from [stats](01-stat.md) plus deliberate investment, producing a *level* (fine-grained) and a *bonus* (the integer you actually add to a roll).

---

## Why it's data, not code

The sheet stores the stat→skill weights in one place (the *Skills* tab) but re-implements the level and bonus arithmetic in three others — *Charactersheet*, *creature call sheet*, and *Creature background call* — each with its own copied formulas. Changing the bonus divider means finding all three. Here there is one formula, referenced everywhere.

## Fields

| Field | Type | Source | Notes |
|---|---|---|---|
| `name` | text | literal | ✅ 57 seeded |
| `description` | text | literal | |
| `stat_weights` | list of (stat ref, weight) | link | ✅ 1 or 2 entries per skill |
| `category` | ref | literal | Optional grouping (craft / social / physical / lore). The sheet has none — recommended addition |
| `level` | number | **formula** (derived) | §Derivation |
| `bonus` | number | **formula** (derived) | §Derivation |
| `invested` | number | instance-state | Points the character spent |
| `unlock_condition` | boolean | formula | Optional: hide or lock a skill until met |

## Derivation ✅

```
level = Σ (weight × character.stats[stat])  +  invested_contribution
bonus = round(level / const.bonus_divider)          where bonus_divider = 5
```

Verified against the sample character (Char 39, Wis 15, Str 10, Int 8):

| Skill | Weights | Computed | Sheet | Bonus |
|---|---|---|---|---|
| Charm | Char × 0.3 | 39 × 0.3 = 11.7 | 11.7 ✅ | round(2.34) = **2** ✅ |
| Trading | Char × 0.3 | 11.7 | 11.7 ✅ | **2** ✅ |
| Brewing | Wis × 0.3 | 15 × 0.3 = 4.5 | 4.5 ✅ | round(0.9) = **1** ✅ |
| Black smithing | Str × 0.2 | 10 × 0.2 = 2.0 | 2 ✅ | round(0.4) = **0** ✅ |
| alchemy | Int × 0.2 | 8 × 0.2 = 1.6 | 1.6 ✅ | round(0.32) = **0** ✅ |
| Persuasion | Char × 0.3 + invested | 11.7 + 1.5 | 13.2 ✅ | round(2.64) = **3** ✅ |

**Rounding is half-up** ✅ — `perception` at level 7.5 yields bonus 2, not 1.

The invested contribution (`+1.5` for one starting pick 🔍) routes through the same point-buy [curve](06-curve.md) as stats, using the character's [archetype](03-archetype.md) affinity for the governing stat.

## Seed weights ✅

Single-stat skills use 0.2 or 0.3; two-stat skills split 0.2 + 0.1.

| Skill | Weights |
|---|---|
| alchemy | Int 0.2 |
| assassination | Dex 0.2 |
| Black smithing | Str 0.2 |
| Brewing | Wis 0.3 |
| butchering | Str 0.2 |
| Charm | Char 0.3 |
| construction | Str 0.2 |
| Cooking | Wis 0.2 + Dex 0.1 |
| Dancing | Dex 0.2 |
| foraging | Wis 0.2 + Dex 0.1 |
| Handeling | Wis 0.2 + Dex 0.1 |
| Healing | Wis 0.2 |
| Hiding | Dex 0.3 |
| history | Wis 0.2 + Int 0.1 |
| intimidation | Str 0.2 + Char 0.1 |
| Lock picking | Dex 0.3 |
| Medician | Wis 0.2 + Int 0.1 |

…and 40 more. Full list imports from the *Skills* tab.

## Links

| Direction | Target | Via |
|---|---|---|
| out | [Stat](01-stat.md) | `stat_weights` (weighted, 1–N) |
| in | [Archetype](03-archetype.md) | optional `skill_affinity` |

## Validation

- A skill with zero weights and no invested points is always level 0 — warn.
- Total weight far above ~0.5 is a balance smell, not an error — surface it in the validation panel as information.
- Near-duplicate names are flagged (see below).

## Import note ⚠️

`skinning` and `Skinning` both exist as skills in the sheet, with different levels (3.3 and 3.7) — so they are genuinely two records today, not a display artifact. The importer proposes a merge; you approve, or keep both deliberately.

## Editing scenarios

| You want to | You do |
|---|---|
| Make bonuses grow faster | Change `const.bonus_divider` from 5 to 4. Every skill on every character and creature recomputes, with a version diff before anyone's sheet changes. |
| Add a third governing stat to a skill | Add a row to `stat_weights`. No formula edits. |
| Add diminishing returns | Edit the `level` formula once. |
| Add a whole new skill | One record + its weights. It appears on every sheet. |

## Open questions

- 🔍 The exact conversion from *invested points* to *level contribution* (the `+1.5` above) needs pinning down against import fixtures. It is a formula edit either way.
