# 18 · Size

[← Index](README.md) · [Field model](00-field-model.md) · [Spec](../ttrpg-app-spec.md)

> **Purpose:** the size category of a [creature](04-creature.md). The smallest concept in the system, with one requirement that makes it worth its own record: **it must be ordered**.

---

## Why it's data, not code

Free text in the sheet, which means `target.size <= medium` — a natural way to write a summoning or spell restriction — is not expressible at all. Selector rules need a comparable ordering, and that means size is a record with an `order`, not a string.

## Fields

| Field | Type | Source | Notes |
|---|---|---|---|
| `name` | text | literal | ✅ tiny, small, medium, large, huge, gargantuan |
| `order` | number | literal | **Required.** What makes `<=` comparisons work |
| `description` | text | literal | |
| `space` | number | literal | Grid footprint in feet — not in the sheet, recommended |
| `reach` | number | literal | Not in the sheet, recommended |
| `carry_multiplier` | number | literal or formula | Not in the sheet; a natural hook if encumbrance is ever added |
| `harvest_multiplier` | number | formula | 🔍 A gargantuan creature plausibly yields more materials |

## Seed content ✅

tiny, small, medium, large, huge, gargantuan (`guargantian` in the source ⚠️).

Distribution in the bestiary is wide — `Hamster` is tiny, `Monolith` is gargantuan, most humanoids are medium.

## The ordering requirement

Without `order`, none of these are writable:

```
target.size <= size.medium                  common summon restriction
caster.size > target.size                   grapple advantage
size.order * const.carry_base               encumbrance
curve.harvest_yield(target.size.order)      bigger creature, more leather
```

The sheet cannot express any of them, which is likely why size is currently decorative — it is displayed on the bestiary and used nowhere else.

## Links

| Direction | Target | Via |
|---|---|---|
| in | [Creature](04-creature.md) | `size` |
| in | Selector rules | comparisons on `order` |
| in | [Harvest table](15-harvest-table.md) | potential yield scaling 🔍 |

## Validation

- `order` must be unique and gapless; the editor renumbers on reorder.
- Deleting a size used by any creature is blocked.

## Editing scenarios

| You want to | You do |
|---|---|
| Fix `guargantian` → `gargantuan` | Rename. |
| Add "colossal" | One record at order 7. Every `<=` rule keeps working. |
| Make size affect carry weight | Add `carry_multiplier` and reference it. |
| Restrict a spell to small-or-smaller targets | `target.size <= size.small` in the selector. |

## Open questions

- 🔍 Should size scale [harvest](15-harvest-table.md) yields? Not in the current rules, but it is the obvious hook and cheap to add.
