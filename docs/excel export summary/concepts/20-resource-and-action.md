# 20 · Resource & Action

[← Index](README.md) · [Field model](00-field-model.md) · [Spec](../ttrpg-app-spec.md)

> **Purpose:** pools that go up and down during play (mana, health, experience), and the named mutations that move them. Everything else in the system is *derived*; this is the one place where a value is **stored, mutated, and remembered**.

Added after reviewing the sheet's Apps Script. It is the concept the scripts were built to fake.

---

## What the scripts revealed

The workbook has two `.gs` files, and both exist for the same reason: **a spreadsheet cell cannot have a button that changes it.** Every other mechanic in the ruleset is a formula, but spending mana isn't a formula — it's an event.

| Script | Reads | Mutates | Meaning |
|---|---|---|---|
| `mana.gs` → `lowerMana` | `Spellbook!B4` (amount to spend) | `Spellbook!B9 += amount` | Spend mana |
| `mana.gs` → `GainMana` | `Spellbook!B4` | `Spellbook!B9 -= amount` | Regain mana |
| `exp.gs` → `addFunction` | `Charactersheet!I17` (amount) | `Charactersheet!K1 += amount` | Award experience |
| `exp.gs` → `subtractFunction` | `Charactersheet!I17` | `Charactersheet!K1 -= amount` | Deduct experience |

`B9` is a **spent-so-far accumulator**, not a remaining value: ✅ `Spellbook!C9 = Charactersheet!J20 − B9` renders remaining mana (310 − 0 = 310). So `lowerMana` adding to `B9` does correctly lower what the player sees. Confusing, but right.

✅ `Charactersheet!K1` is read by **no formula anywhere in the workbook** — it is a write-only tally. Same for the input cells `Spellbook!B4` and `Charactersheet!I17`. These four cells are the only mutable state in a 7,240-formula system.

## Bugs in the current scripts ⚠️

Worth fixing in the sheet regardless of whether the app gets built.

1. **Two `onOpen()` functions.** Apps Script shares one global namespace across all `.gs` files, so the second definition loaded silently replaces the first. Only one `Custom Menu` ever appears, and which one depends on file order.
2. **`mana.gs`'s menu points at functions that don't exist.** It registers `addFunction2` and `subtractFunction2`; the actual functions are named `lowerMana` and `GainMana`. If mana.gs's `onOpen` is the one that survives (1), both menu items throw *"Script function addFunction2 could not be found"* — and the mana functions are unreachable from any menu.

   Net effect: **at most one of the two features works at a time, and mana is the more likely of the two to be broken.**
3. Both menus are named `Custom Menu`, so even a correct merge would need distinct labels.

**Minimum fix:** delete one `onOpen`, and have the survivor build a single menu with four items pointing at the four real function names.

## A third script exists ❓

`Setup!D6 = getFileName()` — a custom function defined in neither file. Its cached export value is `Bickuss Dickuss`, so it **worked at export time**. There is at least one more `.gs` file that hasn't been shared, and the importer contract depends on knowing what else is in it.

## Resource fields

| Field | Type | Source | Notes |
|---|---|---|---|
| `name` | text | literal | ✅ Seed: Mana, Health, Experience |
| `max` | number | **formula** | ✅ Mana max = `stats.mana` (310); Health max = `stats.health` |
| `current` | number | instance-state | The stored value — the only mutable number |
| `min` | number | literal or formula | Usually 0; negative allowed for death spirals |
| `stat` | ref | link → [Stat](01-stat.md) | Optional backing stat |
| `regen` | number | formula | Per rest / per turn 🔍 |
| `overflow` | enum | literal | `clamp` (seed behaviour) / `allow` / `error` |
| `reset_on` | enum | literal | short rest / long rest / never |
| `display` | enum | literal | bar / number / both |

**`current` is stored, not derived.** This is the deliberate exception to [§0.2 `scope`](00-field-model.md#21-scope) — and the reason it needs its own concept rather than a flag on [Stat](01-stat.md). A derived value recomputes; a resource *remembers*.

### Spent vs. remaining

The sheet stores **spent** and derives **remaining**. The app should store **remaining** directly: `current` is what the player reads, and `max` changing (from a level-up or new equipment) shouldn't silently change what's left in the pool. The importer converts: `current = max − spent`.

## Action fields

| Field | Type | Source | Notes |
|---|---|---|---|
| `name` | text | literal | ✅ Seed: Spend mana, Regain mana, Award XP, Deduct XP |
| `target` | ref | link → Resource | Which pool |
| `operation` | enum | literal | `add` / `subtract` / `set` / `reset_to_max` |
| `amount` | number | literal, **formula**, or prompt | §Amount |
| `condition` | boolean | formula | e.g. block casting when `mana.current < spell.mana_cost` |
| `confirm` | boolean | literal | Ask before applying |
| `applies_to` | enum | literal | character / creature / both |
| `log` | boolean | literal | Whether it writes to the session log |

### Amount

Three sources, and this is where the app materially beats the scripts:

| Source | Example |
|---|---|
| prompt | "How much?" — what both scripts do today, via a scratch cell |
| literal | Long rest → `reset_to_max` |
| **formula** | **Cast → `amount = spell.mana_cost`** |

The formula case is the point. Today, casting Acid Splash means: read that it costs 90, type `90` into `Spellbook!B4`, open the menu, click *Add*. In the app the spell's own **Cast** button spends its own cost, and `condition: mana.current >= spell.mana_cost` stops you casting what you can't afford — a rule the sheet cannot express at all.

## Seed content

| Resource | Max | Current | Tracked by |
|---|---|---|---|
| Mana | `stats.mana` ✅ 310 | `Spellbook!C9` = max − spent | `mana.gs` menu |
| Health | `stats.health` ✅ 7 | the same cell as max | ✅ **typed over by hand** |
| Experience | uncapped | `Charactersheet!K1` | `exp.gs` menu |

**Health is adjusted by typing over the cell.** No script, no accumulator — the player overwrites the number as damage lands and healing arrives. It works at the table, and it is exactly what [controls](#manual-adjustment-controls) replace.

It also carries a hazard the app must not inherit: because the value typed over *is* the derived max, there is no longer a distinction between "how much health do I have" and "how much can I have". Change equipment and the formula either recomputes over the player's tracked value or is already gone. Hence the rule below.

## `current` and `max` are separate fields

Non-negotiable, and the health case is why:

```
max      = stats.health        derived, recomputes freely
current  = 4                   stored, survives every recompute
```

Equipment changes, level-ups and rule edits move `max` without touching `current`. The only interaction is `overflow`: when `max` drops below `current`, either clamp (seed behaviour) or leave it and flag. Never the reverse — a derived max must never silently overwrite what the player is tracking.

## Manual adjustment controls

Every resource gets direct controls, independent of any named [Action](#action-fields):

| Control | Behaviour |
|---|---|
| **− / +** steppers | One click = one unit. Hold to repeat. The common case at the table. |
| **Quick entry** | Type `-7` or `+12` and commit — relative, not absolute, so there is no mental arithmetic. |
| **Set to value** | Absolute assignment, for when the GM just says a number. |
| **Reset to max** | One click after a rest. |

All four log the same way named actions do (actor, timestamp, before/after, reason if given), so "how did I get to 2 health" is answerable. The sheet's overwrite leaves no trace at all.

Controls are the *general* mechanism; named actions are the *specific* one. Health mostly uses controls because damage amounts are arbitrary. Mana mostly uses actions because costs come from the spell. Both resources get both.

### Experience drives level 🆕

**New rule, not in the sheet.** Today XP is a write-only tally and level is a hand-typed literal (`Charactersheet!E5 = 2`), so awarding experience has no mechanical effect. Level now derives:

```
level = curve.xp_thresholds( resources.experience.current )     reverse lookup
```

Experience becomes the only resource that is **purely accumulated** — it has no max, never resets, and is the input to the whole progression chain:

```
XP  →  level  →  point budget  →  stats  →  skills, APT, rolls, spell scaling
```

✅ The downstream half already works — `Charactersheet!E17 = E5 × Calculator!Q5 − G17` is `level × points_per_level − points_spent`. Deriving the level closes the loop.

Curve shape, thresholds and generator: [06 · Curve](06-curve.md#seed-curve-xp--level-). Level itself is a [derived stat](01-stat.md#derived-stats), same pattern as APT.

**Consequence worth flagging:** once level is derived, the Award XP action is no longer bookkeeping — it is the act of levelling someone up. Give it `confirm` and `log`, and surface the level change in the result ("+450 XP → level 3, +3 points to spend").

## Actions beyond resources 🔍

Once actions exist, the natural extensions are cheap and worth designing for even if they ship later:

- **Long rest** — a multi-action macro: reset mana and health to max, restore per-rest passive uses.
- **Harvest** — spawn [items](11-item-template.md) from a creature's [harvest table](15-harvest-table.md) into a character's inventory.
- **Craft** — consume materials, produce an item instance.
- **Level up** — grant points, recompute the point budget.

Each is a record of the same shape: a named, conditioned, logged mutation. None needs new engine code.

## Links

| Direction | Target | Via |
|---|---|---|
| out | [Stat](01-stat.md) | `max` formula, `stat` |
| out | [Spell](13-spell.md) | Cast action's `amount` |
| in | Character / creature instance | `current` values |
| in | Views | resource bars, action buttons |

## Validation

- A resource whose `max` formula returns 0 for every character is flagged.
- An action with `operation: subtract` and no `condition` can drive a pool negative — flagged unless `min` allows it.
- Two actions with the same name on the same resource are flagged (the real-world lesson from the duplicate `onOpen`).
- Every mutation is logged with actor, timestamp, before/after, and the triggering action — so "where did my mana go" is answerable. The scripts leave no trace at all.

## Editing scenarios

| You want to | You do |
|---|---|
| Make casting spend mana automatically | One Cast action with `amount = spell.mana_cost`. |
| Track health without typing over formulas | Nothing — `current`/`max` separation and steppers are the default for every resource. |
| Add a Stamina pool | One resource + its max formula. Bar, steppers and actions appear. |
| Add "long rest" | One action, `reset_to_max`, targeting several resources. |
| Stop over-casting | Add `condition: mana.current >= spell.mana_cost`. |
| Change how fast the party levels | Edit the [XP curve](06-curve.md#seed-curve-xp--level-) — one table, not 12 character sheets. |

## Open questions

- ❓ **What are the XP thresholds?** See [06 · Curve](06-curve.md). Needed before the progression loop is real.
- 🔍 Is XP per-character or shared by the party? Both are one field away; it changes where the resource lives.
- ❓ **What else is in the third `.gs` file** that defines `getFileName()`?
- 🔍 Are there regen or rest rules, or is recovery entirely GM fiat today?
