# 05 · Constant

[← Index](README.md) · [Field model](00-field-model.md) · [Spec](../ttrpg-app-spec.md)

> **Purpose:** the ruleset's tunable numbers, named and in one place, referenceable from any formula as `const.name`.

---

## Why it's data, not code

Magic numbers buried in formulas are the main reason a spreadsheet ruleset becomes unbalanceable. The source sheet has `/3` inside passive text, `/5` inside every skill-bonus formula, and `/2` inside the race-blend — each repeated dozens of times. Changing "how big is a bonus" today means a find-and-replace across 7,240 formulas and hoping.

A constant is referenced once and edited once.

## Fields

| Field | Type | Source | Notes |
|---|---|---|---|
| `name` | text | literal | Referenced as `const.<name>` |
| `description` | text | literal | **Required** — a constant nobody understands is worse than a literal |
| `value` | number | literal **or** formula | A constant may derive from other constants |
| `unit` | text | literal | Display suffix |
| `category` | ref | literal | Progression / Combat / Economy / Magic |
| `min` / `max` | number | literal | Guard rails for the editor |

## Seed constants

| Name | Value | Source | Used by |
|---|---|---|---|
| `points_per_level` | 3 | ✅ *Calculator* `Q5`, "Points per level" | Point budget = `level × points_per_level − points_spent` ✅ |
| `bonus_divider` | 5 | ✅ *Calculator* "Bonus divider" | [Skill](02-skill.md) bonus = `round(level / bonus_divider)` ✅ |
| `apt_value` | 30 | ✅ *Calculator* `Q2`, "APT waarde" | **APT** = `max(1, round(stats.speed / apt_value))` ✅ — §APT |
| `str_check_divisor` | 3 | 🔍 extracted from [passive](14-passive.md) text | `round(str / 3)` appears in charge/grapple checks ✅ |
| `race_blend_divisor` | 2 | ✅ from `roundup(a+b)/2` | [Creature](04-creature.md) hybrid blending |
| `material_slots_per_item` | 2 | ✅ | [Item template](11-item-template.md) |
| `material_tier_count` | 10 | ✅ | [Material family](09-material-family.md) default |
| `starting_points` | ❓ | | Character creation wizard |

## Extraction principle

**Any numeric literal that appears in more than one formula, or inside a template, becomes a constant at import time.** The `/ 3` in ~90 passive effect texts is the clearest case: leaving it inline means the ruleset has a balance lever nobody can find.

The importer proposes each extraction with its occurrence count; you approve or decline per constant.

## Links

Constants are referenced by formulas, not by links. The editor shows a reverse index: "`bonus_divider` — used by 3 formulas, affects 57 skills × all characters."

## Validation

- Renaming a constant is safe (references are by ID).
- Deleting a referenced constant is blocked, with the reference list shown.
- A constant whose `value` formula references a constant that references it back is a cycle — rejected at save time with the path displayed.
- Unused constants are surfaced in the validation panel (not an error; often the sign of a half-finished idea).

## Editing scenarios

| You want to | You do |
|---|---|
| Give characters more points | `points_per_level` 3 → 4. |
| Make skill bonuses matter more | `bonus_divider` 5 → 4. |
| Retune every strength check at once | `str_check_divisor` 3 → 4. All ~90 passive texts re-render. |
| Make everyone faster in combat | `apt_value` 30 → 20. Every character and creature gains attacks at a lower Speed. |

## APT — Attacks Per Turn ✅

**Resolved.** APT is how many attacks a character or creature gets per turn, and it derives from **Speed**:

```
apt = max(1, round(stats.speed / const.apt_value))        where apt_value = 30
```

✅ From `Charactersheet!E9`:

```
=IF(ROUND(J21/Calculator!Q2, 0) <= 0, 1, ROUND(J21/Calculator!Q2, 0))
```

`J21` is the character's Speed and `Calculator!Q2` is the cell beside the `APT waarde` label at `P2`. The sample character has Speed 30 → `round(30/30)` = 1 → **APT 1** ✅. The `IF(… <= 0, 1, …)` clause is a floor: nobody gets fewer than one attack, however slow.

So Speed does double duty in this ruleset — movement *and* action economy — and one attack costs 30 Speed. That is a real design decision worth making visible: it means Speed is the most combat-relevant stat past the first breakpoint, and `apt_value` is the single lever that controls how much.

Note this is a **derived [stat](01-stat.md#derived-stats)**, not a constant. `apt_value` is the constant; APT itself is a formula-sourced stat on the character.

## Open questions

- 🔍 Does the same APT formula apply to creatures? The *creature call sheet* also shows `APT | 1`, but its Speed is 22 — `round(22/30)` = 1, which is consistent with both the same formula and a hardcoded 1. Confirm from the live sheet.
- ❓ Is `points_per_level` the only lever on the point budget, or does the [archetype](03-archetype.md) modify it?
