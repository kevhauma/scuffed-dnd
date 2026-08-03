# 03 · Archetype

[← Index](README.md) · [Field model](00-field-model.md) · [Spec](../ttrpg-app-spec.md)

> **Purpose:** the character's specialisation. It does not grant stats directly — it changes the **exchange rate** between points spent and stats gained.

---

## Why it's data, not code

This is the clearest case in the whole ruleset where the spreadsheet forced structure into formulas. The *Calculator* tab holds a stat × archetype matrix, but the archetype's effect is applied through hand-placed column references — adding a seventh archetype means widening the matrix *and* rewiring the lookups that read it.

Here it is a record with a tagging map. Adding an archetype is one row plus nine tags, with no formula edits anywhere.

## Fields

| Field | Type | Source | Notes |
|---|---|---|---|
| `name` | text | literal | ✅ Strong, Sneaky, Smart, Wise, Tanky, Funny |
| `description` | text | literal | ✅ Seeded verbatim |
| `stat_affinity` | map stat → enum | literal | ✅ `main` / `sub` / `non` per stat |
| `skill_affinity` | map skill → enum | literal | 🔍 Optional; the sheet may not use it |
| `starting_bonus` | list | formula or literal | Free picks granted at creation |
| `unlock_condition` | boolean | formula | For prestige archetypes later |
| `icon`, `art` | image | literal | |

## How it works ✅

Each archetype tags every [stat](01-stat.md) as **main**, **sub**, or **non**-type. Points spent on a stat are converted through whichever column of the point-buy [curve](06-curve.md) that tag selects:

```
stat_gain = curve.point_buy( points_spent_on_stat )[ archetype.affinity[stat] ]
```

At 15 points spent, that is 5 for a non-type stat, 7 for a sub-type, and 12 for a main-type — a 2.4× spread. The sample character is *Funny*, whose main-type stat is Char, which is how Char reaches **39** while every other stat sits near 10 ✅.

## Seed content ✅

| Archetype | Description (verbatim) | Main stat 🔍 |
|---|---|---|
| Strong | "Strenght above all bulky en not easy to take down" | Str |
| Sneaky | "stealing and murder they will never know it was you" | Dex |
| Smart | "magic and science is where you excel" | Int |
| Wise | "nature and advice is where your heart lays" | Wis |
| Tanky | "taking hits en locking things down the tank is the shield for the weak" | Con |
| Funny | "want to fuck and charm your way trough live" | Char |

The main-stat column is inferred from the *Calculator*'s live 0.75 multipliers, which sit on exactly one stat per archetype. The sub/non split for the remaining eight stats needs confirming from the live matrix during import.

## Links

| Direction | Target | Via |
|---|---|---|
| out | [Stat](01-stat.md) | `stat_affinity` |
| out | [Skill](02-skill.md) | `skill_affinity` (optional) |
| out | [Curve](06-curve.md) | selects the column |
| in | Character | one archetype per character |

## Validation

- Every stat must have an affinity; unassigned defaults to `non` with a warning.
- An archetype with no `main` stat is legal but flagged — it makes every point purchase equally inefficient.
- The point-buy curve must have one column per affinity value. Adding a fourth tier (`hyper`?) requires adding a curve column first; the editor enforces the order.

## Editing scenarios

| You want to | You do |
|---|---|
| Add a "Lucky" archetype | One record, tag nine stats. Done. |
| Give Tanky two main stats | Change Health from `sub` to `main`. |
| Make specialisation harsher | Widen the gap between curve columns — affects all six archetypes at once. |
| Rebalance one archetype only | Give it its own curve reference (add a `curve` field to the archetype). |

## Open questions

- 🔍 Confirm the full `stat_affinity` matrix from the live *Calculator* tab. Only the main-stat column is currently provable from the export.
- ❓ Does the sheet apply archetype affinity to **skill** point purchases as well as stats, or only stats?
