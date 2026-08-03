# 07 · Dice Ladder

[← Index](README.md) · [Field model](00-field-model.md) · [Spec](../ttrpg-app-spec.md)

> **Purpose:** turn a single number into a rollable dice pool. This is the system's signature mechanic, and it is entirely configuration.

---

## Why it's data, not code

Most systems hardcode "roll d20, add modifier". This one decomposes a stat into a *pool* — `1D20 + 1D12 + 0D6 + 4` — which is unusual enough that baking it into code would make the app useless for any other ruleset, including a future revision of this one. The die sizes and the decomposition strategy are both fields.

## The mechanic ✅

An ordered list of die sizes, `[20, 12, 6]`. A value is decomposed **greedily**, largest first, with the leftover as a flat bonus.

| Input | Decomposition | Result | Seen on |
|---|---|---|---|
| 10 | 0×20, 0×12, 1×6, +4 | `0D20 + 0D12 + 1D6 + 4` ✅ | character melee (Str 10) |
| 11 | 0×20, 0×12, 1×6, +5 | `0D20 + 0D12 + 1D6 + 5` ✅ | character ranged (Dex 11) |
| 16 | 0×20, 1×12, 0×6, +4 | `0D20 + 1D12 + 0D6 + 4` ✅ | character endure |
| 18 | 0×20, 1×12, 1×6, +0 | `0D20 + 1D12 + 1D6 + 0` ✅ | character evasion |
| 32 | 1×20, 1×12, 0×6, +0 | `1D20 + 1D12 + 0D6 + 0` ✅ | creature melee (Str 32) |
| 39 | 1×20, 1×12, 1×6, +1 | `1D20 + 1D12 + 1D6 + 1` ✅ | creature endure |

Six independent confirmations. The die-size list itself is visible in the *Calculator* as the literal row `20 | 12 | 6` ✅.

## Fields

| Field | Type | Source | Notes |
|---|---|---|---|
| `name` | text | literal | Systems may have more than one ladder |
| `die_sizes` | ordered list of numbers | literal | ✅ Seed `[20, 12, 6]` |
| `decomposition` | enum | literal | `greedy` (seed) / `balanced` / custom formula |
| `max_per_die` | number | literal | Optional cap, e.g. never more than 3×D20 |
| `show_zero_terms` | boolean | literal | ✅ The sheet shows `0D20` — keep or hide |
| `format` | template | template | ✅ Seed: `{n}D{size} + …+ {flat}` |
| `remainder_handling` | enum | literal | `flat_bonus` (seed) / `smallest_die` / `drop` |

## Dice as a first-class type

The [formula engine](../ttrpg-app-spec.md#52-types) treats `dice` as a value type, so ladders compose with everything else:

```
dice + dice     merges pools        1D12 + 1D6  →  1D12 + 1D6
dice + number   adds to flat        1D6 + 4     →  1D6 + 4
n * dice        scales counts       2 * 1D6     →  2D6
2D6             literal
```

This is what lets a [roll definition](08-roll-definition.md) add a weapon's dice to a stat-derived pool without special-casing.

## Links

| Direction | Target | Via |
|---|---|---|
| in | [Roll definition](08-roll-definition.md) | `ladder` ref |
| in | [Spell](13-spell.md) | `damage_roll`, `check_roll` |
| in | [Passive](14-passive.md) | `damage_roll`, `check_roll` |

## Validation

- `die_sizes` must be descending for `greedy` to behave; the editor sorts and warns if you fight it.
- A ladder whose smallest die is large (say `[20, 12]`) leaves big flat remainders — surfaced as information, since it may be intended.
- Preview panel: enter any value, see the decomposition, alongside a min/avg/max of the resulting roll.

## Editing scenarios

| You want to | You do |
|---|---|
| Support high-level play | `die_sizes` → `[100, 20, 12, 6]`. Every roll in the game changes at once. |
| Add d4s for fine granularity | Append `4`. Flat remainders shrink to 0–3. |
| Hide the `0D20` clutter | `show_zero_terms` → false. |
| Cap the swinginess | `max_per_die` → 2, with the excess folding into flat. |

## Open questions

None. This is the best-confirmed mechanic in the ruleset.
