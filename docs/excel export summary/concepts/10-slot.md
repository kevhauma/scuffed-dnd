# 10 · Slot

[← Index](README.md) · [Field model](00-field-model.md) · [Spec](../ttrpg-app-spec.md)

> **Purpose:** the named places equipment goes. A small concept, but making it data is what lets characters and creatures use different body plans without two hardcoded layouts.

---

## Why it's data, not code

The sheet has two incompatible slot sets — the *Charactersheet*'s humanoid layout and the *creature call sheet*'s creature layout — each drawn as fixed cells. A four-armed monster or a mounted character cannot be represented without redrawing a tab.

## Fields

| Field | Type | Source | Notes |
|---|---|---|---|
| `name` | text | literal | ✅ §Seed content |
| `applies_to` | enum | literal | character / creature / both |
| `count` | number | literal | How many of this slot exist ✅ accessory ×2, loot ×6 |
| `accepts` | link/selector | link | Which item categories may be equipped here |
| `order` | number | literal | Layout order in views |
| `contributes_stats` | boolean | literal | Whether items here feed the wearer's stats — a loot slot should not |
| `required_by` | selector | link | Optional: a [creature type](17-creature-type.md) may require or forbid a slot |

## Seed content ✅

**Character slots** (*Charactersheet*): Head, chest, Legs, Feet, main hand, Off hand, accessory ×2, plus `backpack` as an inventory container.

**Creature slots** (*creature call sheet*): head, torso, legs, boots, weapon one, weapon two, trinket 1, trinket 2, loot ×6.

Note that the creature slots double as [harvest](15-harvest-table.md) body parts — a creature's "head" slot is both where a helmet goes and what you skin for leather. That overlap is real in the source data and worth preserving deliberately rather than by accident.

## `contributes_stats`

The creature layout's six `loot` slots hold items the creature carries but does not benefit from. Without this flag, a monster's treasure would inflate its stat block. ✅ The sheet handles this by simply not referencing loot cells in the stat sums — an invisible convention that the flag makes explicit.

## Links

| Direction | Target | Via |
|---|---|---|
| out | [Item template](11-item-template.md) | `accepts` (by category) |
| in | Item instance | equipped-in |
| in | [Harvest table](15-harvest-table.md) | body-part rows reference slots |

## Validation

- A slot with `count = 0` is hidden rather than broken.
- If no item template targets a slot, the validation panel flags it as unreachable.
- Changing `count` downward while instances occupy the removed slots is blocked; the affected characters are listed.

## Editing scenarios

| You want to | You do |
|---|---|
| Add a "cloak" slot | One record, set `accepts`. It appears on every character sheet. |
| Support four-armed creatures | `count = 4` on a creature-scoped hand slot, or a new slot with `required_by` a creature type. |
| Give a mount its own slots | New records with `applies_to = creature`. |
| Stop rings stacking | `count = 1` on accessory. |

## Open questions

- 🔍 Confirm whether the character sheet's `accessory` is genuinely ×2 or whether the second cell is something else.
