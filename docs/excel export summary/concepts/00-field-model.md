# 00 · The Universal Field Model

[← Index](README.md) · [Spec](../ttrpg-app-spec.md)

Not a concept — the shared foundation every concept page assumes. This is what makes "everything is configurable" a property of the engine rather than 200 special cases.

---

## 1. Value sources

Any field's value comes from exactly one of six sources. **The source is itself editable** — switching a field from literal to formula is a normal user action, not a migration.

| Source | Meaning | Example |
|---|---|---|
| `literal` | A value typed by a user | Spell mana cost `90` |
| `formula` | Expression over the data graph, recomputed on change | `skill.level = Σ(weight × stat) + invested` |
| `curve` | Lookup into a named table, with an input expression | `challenge_rating = curve.cr(self.stat_total)` |
| `aggregate` | Roll-up over a link | `character.equipment_str = sum(equipped.*.stats.str)` |
| `inherited` | Value flows from a parent record | Tier row inherits `family.base_value` |
| `override` | Instance-level manual value shadowing any of the above | GM sets this one goblin's Health to 3 |

### 1.1 Generated + overridden

Two sources can co-exist on one field: a **generated value with per-row overrides**. This is not a nicety. The source sheet is full of generated columns with hand-tuned exceptions:

- [Creature](04-creature.md) challenge ratings — derived from stat total for ~970 monsters, hand-set for the 10 seed races.
- [Material tiers](09-material-family.md) — clean formulas with four confirmed exceptions.
- [Curves](06-curve.md) — the point-buy sub-type column has one anomalous cell.

Any design that regenerates from a formula *without* preserving flagged cells would silently rebalance the game. So: **generate, overlay overrides, and show both in the editor.**

## 2. Field metadata

Every field definition carries:

```
id            stable, never changes            (referenced by formulas)
name          display label, freely renamable
type          number | text | dice | boolean | ref | list | template
unit          optional display suffix ("f" for feet, "h" for hours)
source        one of §1, plus the expression/curve/link it uses
default       value for new records
required      blocks save when empty
scope         system-definition | instance-state | derived
visibility    which views show it, and to which roles
help          hover text shown in editors
```

### 2.1 `scope`

- **system-definition** — part of the ruleset (a spell's mana cost).
- **instance-state** — per character/NPC (whether *you* have learned it).
- **derived** — computed, never stored as truth.

Getting this wrong is the most common way a rules app rots: storing a derived value as truth means it goes stale the moment anything upstream changes.

## 3. Concept metadata

```
id, name, plural name, icon
fields[]              §2
links[]               §4
identity fields       which fields must be unique (usually name)
default sort/group    for grids and pickers
instantiable?         can instances exist at the instance layer?
                      (Creature: yes → NPCs. Stat: no.)
```

## 4. Links

Two population modes, combinable on one link:

1. **Explicit** — checked rows in a picker.
2. **Selector rule** — a boolean formula over the target concept: `target.type = "humanoid" and target.size <= size.medium and target.playable`. Evaluated live, so a qualifying creature added later is auto-included.
3. **Rule + exceptions** — selector with manual include/exclude pins on top.

Link editors always show **both directions** ("this spell's learners" / "this creature's spells"). The sheet could only render one direction per tab, which is why the same data is duplicated across two spell tabs.

## 5. Evaluation contexts

A formula can only reference namespaces its context provides. Context is determined by where the formula is attached — never declared manually.

| Context | Available namespaces |
|---|---|
| Creature/character derived field | `self`, `stats`, `skills`, `const`, `curve`, `equipment`, `archetype`, `race` |
| Skill level | `stats`, `self` (the skill def), `character`, `const` |
| Item instance stat | `self`, `template`, `materials[]`, `owner`, `const` |
| Tier row | `family`, `tier`, `const` |
| Spell/passive effect template | `caster` (a creature or character), `self` (the spell), `const` |
| Selector rule | `target` (candidate entity), `const` |
| Wizard step | `draft` (the character being built), `const` |

## 6. Identity rules

Non-negotiable, and they retroactively fix a whole class of problem in the source sheet:

- Every entity has a **stable internal ID**. All references — formulas, links, templates — store IDs and display current names.
- **Renaming can never break a reference.** `Strenght`, `Equimment`, `Architype`, `Prefomance` can be corrected or kept, freely, at any time.
- **Deleting a referenced entity is blocked** by default; the UI lists the references ("used by 41 formulas, 12 links") with jump-to-each. Force-delete converts references to *visible* errors, never silent zeros.

## 7. Errors are values

There is deliberately no `IFERROR`. A broken reference or type mismatch produces an error object that propagates with provenance and renders as a red chip. Clicking any computed value — error or not — opens its provenance tree: the formula, each input's value, recursively.

This replaces the spreadsheet's single transparency advantage (clicking a cell to see its formula) and beats it, while eliminating the `#N/A` walls that hide root causes.
