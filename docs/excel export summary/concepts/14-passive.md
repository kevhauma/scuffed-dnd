# 14 · Passive

[← Index](README.md) · [Field model](00-field-model.md) · [Spec](../ttrpg-app-spec.md)

> **Purpose:** always-on creature traits. Structurally a [spell](13-spell.md) without a mana cost, and it scales the same way.

---

## Why it's data, not code

Same argument as spells, plus one of its own: the sheet's passive→creature matching uses `REGEXMATCH` against comma-separated name lists, which is substring matching with no word boundaries. A passive listed for `rat` silently applies to `wererat`, `giant rat`, and `dire rat`.

## Fields

| Field | Type | Source | Notes |
|---|---|---|---|
| `name` | text | literal | ✅ ~90 seeded |
| `effect` | **template** | template | Scales on the owning creature |
| `damage_type` | ref | link → [Damage type](19-damage-and-check-type.md) | ✅ incl. compound values like `Bonus, Slashing` |
| `damage_roll` | dice | formula | |
| `check_type` | ref | link | ✅ e.g. `advantage on, perception` |
| `check_roll` | dice | formula | |
| `applies_to` | link/selector | link | Same machinery as [Spell §learnable_by](13-spell.md#learnable_by--) |
| `trigger` | enum | literal | 🔍 passive / on-hit / on-move / per-rest — the sheet encodes this only in prose |
| `uses_per_rest` | number | formula | ✅ Derived — see below |
| `description` | text | literal | |

## Seed content ✅

~90 passives: Echolocation, Keen hearing, keen smell, charge, Relentless, grapple, Hold breath, pack tactics, amphibious, standing leap, Keen sight, Spider climb, web sense, web walker, and more.

## Scaling ✅

Passive effect text pulls derived values from the **owning creature**, exactly like spells:

> **charge** — "If the creature moves at least 20 feet straight toward a creature right before hitting it with a melee attack, the target takes an extra **16** slashing damage and must succeed on a Strength check of **11D6** or be knocked prone."

Confirmed derivations for the sample creature (Str 32, Con 46):

| Value | Formula | Check |
|---|---|---|
| Strength check `11` | `round(stats.str / 3)` | round(32/3) = round(10.67) = **11** ✅ |
| Constitution check `8` | 🔍 a Con-derived expression | Con 46 |
| grapple check `9` | 🔍 | |
| Relentless "uses per long rest is **9**" | 🔍 | |
| Relentless damage threshold `46` | = Con ✅ | |

As a template:

```
…the target takes an extra {self.damage_roll} slashing damage and must
succeed on a Strength check of {round(caster.stats.str / const.str_check_divisor)}D6
or be knocked prone.
```

### Extract the divisors ⚠️

The `/ 3` appears inline across ~90 passive texts. It **must** become a named [constant](05-constant.md) (`str_check_divisor`) at import, or the ruleset has a major balance lever buried in prose that no editor can find. The importer proposes the extraction with its occurrence count.

## applies_to ⚠️

Replaces the regex matching with a selector plus exceptions. The seed lists are large and clearly hand-maintained:

> `Black Bear, brown bear, cat, Dire Wolf, Lion, Mastiff, panther, pseudodragon, Rat, tiger, Wolf, carrion crawler` → **keen smell**

Most of these are expressible as rules — `target.type = beast and has_tag(target, "predator")` — which is both shorter and self-maintaining when a new beast is added. Import brings them in as explicit lists (safe, lossless), and the editor offers "convert to rule" with a live diff showing what the rule would add or remove.

## Import note ⚠️

The *Creature spell and passives* tab is a wall of `#N/A` **in the xlsx export only**. Those cells use `FILTER`/`REGEXMATCH`, which Excel cannot represent, so the export stores `__xludf.DUMMYFUNCTION` wrappers with a cached `"#N/A"`. They very likely work in the live sheet.

**The importer must read the live formulas, not the cached export values.**

## Links

| Direction | Target | Via |
|---|---|---|
| out | [Creature](04-creature.md) | `applies_to` |
| out | [Damage/check type](19-damage-and-check-type.md) | |
| out | [Constant](05-constant.md) | via extracted divisors |
| in | Creature stat block | rendered per creature |

## Validation

- A passive matching zero creatures is flagged.
- A template referencing `caster.stats.x` for a stat that does not exist errors at save time.
- Preview-against-creature is mandatory before saving a template.

## Editing scenarios

| You want to | You do |
|---|---|
| Retune every strength check | `const.str_check_divisor` 3 → 4. All ~90 texts re-render. |
| Add a passive to all dragons | One selector rule, not 40 names. |
| Add a new passive | One record + a rule. Applies to matching creatures instantly. |
| Stop `rat` matching `wererat` | Already fixed — links are by ID, not substring. |

## Open questions

- 🔍 Confirm the derivations for the Constitution check (8), grapple check (9), and Relentless uses-per-rest (9). Str is confirmed; the others follow the same shape but the exact divisors are unverified.
- 🔍 Is `trigger` recoverable from the prose, or does each passive need hand-tagging during import? Roughly 90 records — a couple of hours of work, worth doing.
