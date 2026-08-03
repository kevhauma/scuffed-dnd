# 17 · Creature Type

[← Index](README.md) · [Field model](00-field-model.md) · [Spec](../ttrpg-app-spec.md)

> **Purpose:** the taxonomic tag on a [creature](04-creature.md) — humanoid, beast, undead, and so on. Small concept, but it is the main axis that [spell](13-spell.md) and [passive](14-passive.md) selector rules filter on.

---

## Why it's data, not code

In the sheet it is a free-text row. Nothing prevents `humaniod` and `humanoid` coexisting — and in fact the sheet spells it `humaniod` throughout, consistently enough to work but only by luck. Any spell restricted to a type is one typo away from applying to nothing.

## Fields

| Field | Type | Source | Notes |
|---|---|---|---|
| `name` | text | literal | ✅ §Seed content |
| `description` | text | literal | |
| `order` | number | literal | |
| `is_summonable` | boolean | literal | 🔍 The *Spellbook* summon table lists only humanoids |
| `default_passives` | link | link | Optional: every undead gets X |
| `icon`, `colour` | — | literal | For bestiary filtering |

## Seed content ✅

humanoid (`humaniod` in the source), undead, celestial, construct, beast, Devil, dragon, demon, fey, aberration, monstrosity, elemental, plant, fiend, giant (`gaint` in the source), Ooze, swarm.

⚠️ Note both `Devil` and `fiend` and `demon` exist as separate types, which may be deliberate (this ruleset distinguishes them) or may be drift. Worth a decision at import.

⚠️ `humaniod` and `gaint` are misspelled in the source. Since [renaming is always safe](00-field-model.md#6-identity-rules), fix them freely after import — the ~980 creature references are by ID.

## Where it's used

| Consumer | How |
|---|---|
| [Spell](13-spell.md) `learnable_by` | `target.type = creature_type.demon` |
| [Passive](14-passive.md) `applies_to` | `target.type = creature_type.beast` |
| Summon calculator | ✅ The *Spellbook* summon table is humanoid-only |
| Bestiary | grouping and filtering |

## Links

| Direction | Target | Via |
|---|---|---|
| in | [Creature](04-creature.md) | `type` |
| out | [Passive](14-passive.md) | `default_passives` |

## Validation

- Deleting a type used by any creature or selector rule is blocked.
- A type with zero creatures is flagged as unused.
- Near-duplicate names flagged (this is precisely the concept where that check earns its keep).

## Editing scenarios

| You want to | You do |
|---|---|
| Fix `humaniod` → `humanoid` | Rename. 900+ references keep working. |
| Merge `Devil` into `fiend` | Bulk-reassign creatures, then delete. The block dialog shows exactly what still references it. |
| Add "aberrant undead" | One record. |
| Give all undead a shared passive | `default_passives`, or a passive with `applies_to = target.type = undead`. |

## Open questions

- ⚠️ Are `Devil`, `demon` and `fiend` three distinct types by design, or drift to be merged?
