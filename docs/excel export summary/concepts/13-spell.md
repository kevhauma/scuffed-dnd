# 13 · Spell

[← Index](README.md) · [Field model](00-field-model.md) · [Spec](../ttrpg-app-spec.md)

> **Purpose:** castable effects whose numbers scale with the caster. This is the mechanic that makes the ruleset interesting, and the one most worth getting right.

---

## Why it's data, not code

The scaling is real and already works — the sheet builds effect text by string concatenation around the caster's spell-casting level. But because a spreadsheet row renders one way for one reader, the sheet needs **two complete copies of every spell**: the 989-row *Spell List* for players and the 791-row *Spell list creatures* for monsters, with the same 419 spells and different embedded numbers.

Every spell edit has to be made twice, and they have already drifted (the player copy of *Animate object* says 4 objects, the creature copy says 7).

## Fields

| Field | Type | Source | Notes |
|---|---|---|---|
| `name` | text | literal | ✅ 419 seeded |
| `mana_cost` | number | literal or **formula** | ✅ 90 / 120 / 150 / 180 / 210 / 300 — tiered, so a generator is viable |
| `range_time` | text | literal | ✅ `60f`, `30f`, `0f`, `self/focus`, `Focus`, `Monitor Crystal`, `4h`, `24h` |
| `effect` | **template** | template | §Scaling |
| `damage_type` | ref | link → [Damage type](19-damage-and-check-type.md) | ✅ Acid, Slashing, "no damage", "no damage, healing" |
| `damage_roll` | dice | **formula** | ✅ e.g. `dice(d6: caster.skills.spellcasting + 1)` |
| `check_type` | ref | link | ✅ `No checks`, `advantage on, perception` |
| `check_roll` | dice | **formula** | |
| `learnable_by` | link/selector | link | §learnable_by |
| `learn_cost` | number | literal or formula | ❓ Not visible in the export |
| `concentration` | boolean | literal | 🔍 Implied by the `Focus` range values |
| `description`, `art` | — | literal | |

## Scaling effect templates ✅

The sheet does this:

```
="You hurl a bubble of acid… they take "&B2+1&"D6 acid damage"
```

where `B2` is the caster's spell-casting level. The app stores one template:

```
You hurl a bubble of acid. Choose one or two creatures you can see within
range. If you choose two, they must be within 5 feet of each other, they
take {caster.skills.spellcasting + 1}D6 acid damage
```

| Rendered for | spell casting | Result |
|---|---|---|
| Sample character | 2 | **3D6** ✅ |
| Sample creature | 5 | **6D6** ✅ |

Confirmed on several more:

| Spell | Template holes | Character | Creature |
|---|---|---|---|
| Aid | `up to {spellcasting} creatures`, `{healing}D4 health` | 2 creatures, 5D4 ✅ | 5 creatures, 13D4 ✅ |
| Alarm | `up to {spellcasting + 1} creatures` | 3 ✅ | 6 ✅ |
| Alter self | `for {spellcasting} hour` | 2 hours ✅ | 5 hours ✅ |
| Animate object | `up to {spellcasting × 2} objects` 🔍 | 4 ✅ | 7 ⚠️ drift |
| Arcane Eye | `up to {spellcasting} eyes` | 2 ✅ | 5 ✅ |

**One record replaces both tables**, and rendering happens per viewer: your spellbook shows your numbers, a monster's stat block shows its numbers, and the compendium shows a preview against whichever caster you pick.

The *Animate object* discrepancy (4 vs 7 where the pattern predicts 4 vs 10) is exactly the kind of drift two hand-maintained copies produce. Import will surface every such mismatch for a decision.

## learnable_by ✅ ⚠️

The sheet stores this as a comma-separated string, repeated on ~1,400 rows:

> `human, elf, Hamster, dwarf, Raccoon, halfling, dragonborn, gnome, aasimar , firbolg, goliath, kenku, tabaxi, triton, tortle, crab folk, autognome, dohwar, hadozee, plasmoid, musteval,`

matched with `REGEXMATCH`. Two failure modes, both live today:

1. **Substring matching.** A creature named `rat` matches `wererat`, `giant rat`, and any list containing those strings. There is no word-boundary anchoring.
2. **Typos fork a race out of existence.** `halfing` (row 8) vs `halfling` (every other row), `plasmmoid` vs `plasmoid`, `aasimar ` with a trailing space. Each variant silently excludes that race from that spell.

The app replaces the string with a **selector rule plus explicit exceptions**:

```
target.playable = true                    → the 21-race common list
target.type = creature_type.demon         → demon-only spells
```

plus pins for one-offs — ✅ `cambion` is appended to *Alter self*, and `Deva`/`planetar` to *Animate Dead*.

The link editor shows both directions, so "which spells can a Deva learn?" becomes answerable, which it currently is not.

## Per-character state

| Field | Notes |
|---|---|
| `status` | ✅ `Learned` / `Locked` |
| `prepared` | 🔍 If the system has preparation |
| `uses_remaining` | For limited-use spells |

✅ Mana tracking is `max_mana − spent` (the sample character: 310 max, 90 spent on Acid Splash).

The sheet's *Spellbook* has 50 fixed spell slots, 49 of them showing `empty | 0 | 0f | 0`. That is a spreadsheet limitation, not a rule — the app uses a list.

## Links

| Direction | Target | Via |
|---|---|---|
| out | [Creature](04-creature.md) | `learnable_by` |
| out | [Damage/check type](19-damage-and-check-type.md) | `damage_type`, `check_type` |
| in | Character | learned spells |

## Validation

- A template referencing a skill that does not exist is an error at save time, with the offending hole highlighted.
- A `learnable_by` selector matching zero creatures is flagged.
- Preview-against-caster is mandatory in the editor: you cannot save a template without seeing it render for at least one caster.

## Editing scenarios

| You want to | You do |
|---|---|
| Rebalance every damage spell | Edit the damage generator, or bulk-edit `damage_roll` across a filtered set. |
| Make a spell scale harder | Change `{spellcasting + 1}` to `{spellcasting × 2}` in one place. |
| Give a new race the common spell list | Set `playable = true` on the creature. Every selector-based spell picks it up. |
| Add a spell | One record. It renders correctly for all ~980 creatures immediately. |

## Open questions

- ❓ **How are spells unlocked?** `Learned`/`Locked` is stored per character, but the condition (level? skill level? points? GM grant?) is not in the export.
- 🔍 Confirm the *Animate object* scaling (4 vs 7) and any other drift between the two spell tables — the importer will list them all.
- 🔍 Is `mana_cost` hand-set per spell or derived from a tier? The six distinct values across 419 spells strongly suggest a tier.
