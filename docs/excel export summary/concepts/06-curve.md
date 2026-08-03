# 06 · Curve

[← Index](README.md) · [Field model](00-field-model.md) · [Spec](../ttrpg-app-spec.md)

> **Purpose:** named lookup tables and progressions. Anything that maps an input number to one or more output numbers — point-buy, challenge rating, thresholds — is a curve rather than a chain of nested `IF`s.

---

## Why it's data, not code

Progressions in the sheet are 15–50 row blocks of literal numbers with a formula filled down beside them. There is no distinction between "this cell follows the pattern" and "this cell was deliberately changed", which is how the anomalies below survived unnoticed.

A curve makes the pattern explicit (a generator) and the exceptions explicit (flagged overrides), and lets you see both at once.

## Fields

| Field | Type | Source | Notes |
|---|---|---|---|
| `name` | text | literal | Referenced as `curve.<name>(input)` |
| `description` | text | literal | |
| `key_column` | field def | literal | The input axis |
| `value_columns` | list of field defs | literal | ✅ Point-buy has three |
| `rows` | grid | literal **or** generator formula, per cell | With per-cell override flags |
| `interpolation` | enum | literal | `step` (nearest lower key) or `linear` |
| `out_of_range` | enum | literal | `clamp` / `extrapolate` / `error` |
| `lookup_direction` | enum | literal | `forward` (key → value, the default) or `reverse` — §Reverse lookup |
| `generator` | map column → formula | formula | Context: `key`, `const` |

### Reverse lookup

Some curves are naturally authored one way and read the other. The XP table below is the case: you want to *write* "level 5 requires 3,000 XP" but *read* "given 3,412 XP, what level am I?"

`lookup_direction: reverse` returns the **highest key whose value is ≤ the input**. Authoring stays readable, and the threshold semantics ("you stay level 4 until you cross 3,000") fall out of `step` interpolation rather than needing a separate rule.

## Seed curve: point-buy ✅

Input: points spent on a stat. Output column selected by the character's [archetype](03-archetype.md) affinity for that stat.

| Points | non-type | sub-type | main-type |
|---|---|---|---|
| 0 | 0 | 0 | 0.75 |
| 1 | 1 | 1 | 1.5 |
| 2 | 1 | 1 | 2.25 |
| 3 | 1 | 2 | 3.0 |
| 4 | 2 | 2 | 3.75 |
| 5 | 2 | 3 | 4.5 |
| 6 | 2 | 3 | 5.25 |
| 7 | 3 | 4 | 6.0 |
| 8 | 3 | 4 | 6.75 |
| 9 | 3 | **4.642857142857** ⚠️ | 7.5 |
| 10 | 4 | 5 | 8.25 |
| 11 | 4 | 5 | 9.0 |
| 12 | 4 | 6 | 9.75 |
| 13 | 4 | 6 | 10.5 |
| 14 | 5 | 7 | 11.25 |
| 15 | 5 | 7 | 12.0 |

**Main-type is exactly `0.75 × (points + 1)`** ✅ — a clean generator.
**Non-type and sub-type are near-linear with rounding**, and sub-type produces `4.642857142857` (= 65/14) at 9 points ⚠️. That is almost certainly an accidental formula in one cell — every neighbour is an integer.

Import behaviour: bring the column in as-is with the cell **flagged**, then decide whether to replace the column with a generator and keep or drop that one override. The app will not silently round it away.

## Seed curve: challenge rating ✅

Input: [creature](04-creature.md) `stat_total`. Output: CR.

| stat_total | 19 | 26 | 40 | 43 | 49 | 54 | 65 | 73 | 74 | 156 | 171 | 230 | 280 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CR | −4 | −4 | −2 | −2 | −1 | −1 | 1 | 1 | 1 | 10 | 10 | 16 | 21 |

`step` interpolation. Ten creatures override it (see [Creature](04-creature.md#challenge-rating)).

## Seed curve: XP → level 🆕

**New rule, not in the sheet.** Character level is currently a hand-typed literal (`Charactersheet!E5 = 2`) and experience is a tally nothing reads. Level now derives from XP through a configurable curve.

```
name              xp_thresholds
key_column        level
value_columns     [xp_required]        cumulative, not per-level
lookup_direction  reverse
interpolation     step
out_of_range      extrapolate          XP is unbounded; levels must keep coming
```

| level | 1 | 2 | 3 | 4 | 5 | 6 | … |
|---|---|---|---|---|---|---|---|
| xp_required | 0 | 300 | 900 | 2700 | 6500 | 14000 | … |

Placeholder values — ❓ **the real thresholds are yours to set**, and they are the single most campaign-defining number in the ruleset. A generator makes the shape editable in one place rather than row by row:

```
xp_required = round(const.xp_base * level ^ const.xp_exponent)
```

with per-row overrides for a hand-tuned early game, exactly as with [material tiers](09-material-family.md).

### Why this matters more than it looks

It closes the progression loop, which is currently open:

```
XP  →  level  →  point budget  →  stats  →  skills, APT, rolls
        ↑
    hand-typed today, so nothing upstream of it has any effect
```

✅ The downstream half already works: `Charactersheet!E17 = E5 × Calculator!Q5 − G17` is `level × points_per_level − points_spent`. Level already drives the point budget. It just has no input. Deriving it from XP means awarding experience actually does something, and `points_per_level` becomes a real balance lever instead of a number attached to a manual entry.

## Seed curve: dice thresholds

Consumed by the [dice ladder](07-dice-ladder.md). May be expressible as pure arithmetic rather than a table — decide at import.

## Links

| Direction | Target | Via |
|---|---|---|
| in | [Archetype](03-archetype.md) | selects a `value_column` |
| in | [Creature](04-creature.md) | `challenge_rating` |
| in | [Skill](02-skill.md) | invested-point conversion |
| in | Any formula | `curve.name(x)` |

## Validation

- Keys must be unique and sorted; the editor sorts automatically.
- A gap wider than the average step is flagged when `interpolation = step` — it means a wide input band silently collapses to one output.
- `out_of_range = error` is the default for new curves. Silent clamping is how a level-50 character ends up with a level-15 stat gain and nobody notices.
- Cells that differ from the generator are highlighted, always, in the editor. This is the feature that would have caught all four seed anomalies.

## Editing scenarios

| You want to | You do |
|---|---|
| Make levelling slower | Raise `xp_base` or `xp_exponent`. Every character's level recomputes, with a diff preview before anyone's sheet changes. |
| Hand-tune the first five levels | Override those rows; the generator keeps producing 6+. |
| Extend point-buy to 40 points | Change the row count; generated columns fill in, hand-authored ones are flagged for review. |
| Flatten the archetype advantage | Edit the main-type generator from `0.75 × (points+1)` to `0.5 × (points+1)`. |
| Add a fourth affinity tier | Add a `value_column`, then add the tag to [Archetype](03-archetype.md). |
| Fix the 4.642857 cell | Clear the override. The generator refills it. |

## Open questions

- ❓ **What are the XP thresholds?** The table above is placeholder. Needed: the value for level 2, the shape (exponential? flattening?), and the level cap if any.
- ⚠️ **Is the sub-type value at 9 points (`4.642857142857`) deliberate?** Nearly certainly not, but it is your ruleset — it needs an explicit decision at import, not a silent fix.
- 🔍 Confirm the full point-buy table beyond 15 points (the export shows the first ~50 rows; the tail was not sampled).
- 🔍 Do creatures level from XP too, or is their level set directly when an encounter is built?
