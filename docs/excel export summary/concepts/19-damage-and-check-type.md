# 19 · Damage Type & Check Type

[← Index](README.md) · [Field model](00-field-model.md) · [Spec](../ttrpg-app-spec.md)

> **Purpose:** the vocabularies [spells](13-spell.md) and [passives](14-passive.md) use to say *what kind* of damage they do and *what kind* of check they call for.

Two concepts, same shape, same open question — so one page.

---

## Why it's data, not code

Both are free text in the sheet, and both have already grown compound values that free text cannot support properly.

## The evidence ⚠️

Sampled from the export:

**Damage type values:** `Acid`, `Slashing`, `no damage`, `no damage, healing`, `Bonus, Slashing`

**Check type values:** `No checks`, `advantage on, perception`

Three things are visible here:

1. **They are tag lists, not single values.** `no damage, healing` and `Bonus, Slashing` are two tags each. Modelling the field as a single ref would force `no damage, healing` to become its own bogus type.
2. **They mix orthogonal axes.** `Bonus` is not a damage *type* — it is a modifier saying the damage is additive. `advantage on` is not a check *type* — it is an outcome modifier, and `perception` is the actual check.
3. **`no damage` is a sentinel**, not a type. An empty tag list says the same thing without a magic string.

## Recommended model

### Damage Type

| Field | Type | Source | Notes |
|---|---|---|---|
| `name` | text | literal | Acid, Slashing, Piercing, Bludgeoning, Fire, … |
| `category` | enum | literal | physical / elemental / magical |
| `is_healing` | boolean | literal | Replaces the `healing` tag |
| `icon`, `colour` | — | literal | |

Spell/passive field becomes `damage_types: list<ref>` — empty list means no damage. The `Bonus` modifier moves to its own boolean on the spell (`is_bonus_damage`), since it describes the *application*, not the type.

### Check Type

| Field | Type | Source | Notes |
|---|---|---|---|
| `name` | text | literal | perception, Strength, Wisdom, grapple, … |
| `governing` | ref | link → [Stat](01-stat.md) or [Skill](02-skill.md) | What the check actually rolls against |
| `default_roll` | dice | formula | So a check can be rolled without being restated per spell |

Spell/passive field becomes `check: {type: ref, advantage: enum}` where advantage is `none / advantage / disadvantage` — which is what `advantage on, perception` is really saying.

## Why this is worth doing at import

Once 419 spells and 90 passives reference free-text strings, retrofitting structure means touching all of them. Deciding now costs one conversation. The importer can do the conversion mechanically — the value set is small (a dozen distinct strings across both fields) and every one is inspectable.

The cheaper alternative is honest too: import both as free text with a controlled-vocabulary list behind them, accept that compound values stay strings, and revisit later. That is a legitimate choice if you want to play sooner. It just gets more expensive the longer it waits.

## Links

| Direction | Target | Via |
|---|---|---|
| in | [Spell](13-spell.md) | `damage_type`, `check_type` |
| in | [Passive](14-passive.md) | `damage_type`, `check_type` |
| out | [Stat](01-stat.md) / [Skill](02-skill.md) | `governing` |

## Validation

- Unused types flagged.
- A check type with no `governing` reference cannot produce a default roll — flagged.
- Near-duplicate names flagged.

## Editing scenarios

| You want to | You do |
|---|---|
| Add "Necrotic" damage | One record. Available to all 419 spells. |
| Make a creature immune to fire | Resistances become a creature field referencing damage types — a natural extension once these are records. |
| Change what a perception check rolls | Edit `governing` / `default_roll` once. |

## Open questions

- ❓ **Controlled vocabulary or free text?** Recommendation above is controlled, modelled as tag lists. This is the decision that most benefits from being made before import rather than after.
- 🔍 Confirm the full set of distinct values across all 419 spells and 90 passives — the export sample above is partial.
