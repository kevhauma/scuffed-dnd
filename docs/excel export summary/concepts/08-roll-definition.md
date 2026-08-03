# 08 · Roll Definition

[← Index](README.md) · [Field model](00-field-model.md) · [Spec](../ttrpg-app-spec.md)

> **Purpose:** a named, rollable line on a sheet — melee, ranged, evasion, endure. Each is a record with an input expression, not a hardcoded box in a layout.

---

## Why it's data, not code

The sheet has exactly four rolls, hardwired into two layouts (*Charactersheet* and *creature call sheet*) as duplicated formula blocks. Adding "initiative" means editing both layouts and both formula sets, and keeping them in sync forever.

Here it is one record. It appears on every sheet whose `applies_to` matches.

## Fields

| Field | Type | Source | Notes |
|---|---|---|---|
| `name` | text | literal | ✅ Seed: melee, ranged, evasion, endure |
| `description` | text | literal | What the roll is for |
| `input` | number | **formula** | The value fed to the ladder — §Input expressions |
| `ladder` | ref | link → [Dice ladder](07-dice-ladder.md) | Usually the default |
| `applies_to` | enum | literal | character / creature / both |
| `category` | enum | literal | offence / defence / utility — drives grouping in views |
| `visibility` | — | literal | Which views show the button |
| `order` | number | literal | |

## Confirmed outputs ✅

| Roll | Sample character | Sample creature |
|---|---|---|
| melee | `0D20 + 0D12 + 1D6 + 4` (input 10) | `1D20 + 1D12 + 0D6 + 0` (input 32) |
| ranged | `0D20 + 0D12 + 1D6 + 5` (input 11) | `1D20 + 0D12 + 0D6 + 5` (input 25) |
| evasion | `0D20 + 1D12 + 1D6 + 0` (input 18) | `0D20 + 1D12 + 0D6 + 0` (input 12) |
| endure | `0D20 + 1D12 + 0D6 + 4` (input 16) | `1D20 + 1D12 + 1D6 + 1` (input 39) |

The decomposition is fully confirmed (see [Dice ladder](07-dice-ladder.md)). The **inputs** are where the uncertainty sits.

## Input expressions

| Roll | Input | Character stat | Match? |
|---|---|---|---|
| melee | 10 | Str 10 | ✅ `stats.str` |
| ranged | 11 | Dex 11 | ✅ `stats.dex` |
| evasion | 18 | Dex 11 | ❌ +7 from somewhere |
| endure | 16 | Con 12 | ❌ +4 from somewhere |

🔍 Melee and ranged are plainly the raw stat. Evasion and endure are not — they carry an extra term, almost certainly armour or equipment. Note the sample character's *Charactersheet* also shows a bare `7.0` near the equipment block, which is a plausible source for the evasion delta.

This resolves during import against the golden-test fixtures, and it is a formula edit either way — not a structural question. The concept is unaffected.

## Rolling

The roll definition produces a **dice expression**; the play layer rolls it. Formulas never contain randomness (see [spec §5](../ttrpg-app-spec.md#5-formula-engine)) — this keeps every computed value deterministic and reproducible, and confines randomness to one auditable place.

The roller shows: the expression, each die result, the total, and the provenance of the input.

## Links

| Direction | Target | Via |
|---|---|---|
| out | [Dice ladder](07-dice-ladder.md) | `ladder` |
| out | [Stat](01-stat.md), [Skill](02-skill.md) | via the `input` expression |
| in | Character / creature views | `applies_to` |

## Validation

- The `input` expression must resolve to a number in both the character and creature contexts when `applies_to = both`. Cross-context references are caught at save time.
- A roll whose input can go negative is flagged — decide whether the ladder clamps at 0.

## Editing scenarios

| You want to | You do |
|---|---|
| Add "initiative" | One record: `input = stats.dex + stats.wis / 2`. Appears on every sheet. |
| Make evasion armour-dependent | Edit one expression. |
| Give creatures a different melee formula | Split into two records with `applies_to` set accordingly, or branch inside the expression with `if()`. |
| Add a per-skill roll | `input = skills.persuasion.bonus + stats.char` — a roll definition does not have to be stat-based. |

## Open questions

- 🔍 **What are the evasion and endure input expressions?** They produce 18 and 16 for the sample character, which is not raw Dex/Con. Needs confirming against the live *Calculator* rows.
