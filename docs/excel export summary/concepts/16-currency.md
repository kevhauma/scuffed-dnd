# 16 · Currency

[← Index](README.md) · [Field model](00-field-model.md) · [Spec](../ttrpg-app-spec.md)

> **Purpose:** coin denominations and their exchange rates.

---

## Why it's data, not code

Small, but the coin pouch is a fixed five-row block on the *Charactersheet* with hardcoded labels. Adding a sixth denomination means editing the layout, and there is no exchange rate anywhere — conversion is mental arithmetic at the table.

## Fields

| Field | Type | Source | Notes |
|---|---|---|---|
| `name` | text | literal | ✅ Copper, Silver, Electrum, Gold, Platinum |
| `abbreviation` | text | literal | cp, sp, ep, gp, pp |
| `order` | number | literal | Display order, low → high |
| `exchange_rate` | number | literal or formula | Value in the base denomination |
| `is_base` | boolean | literal | Exactly one currency is the base unit for `value` fields |
| `material` | ref | link → [Material family](09-material-family.md) | ⚠️ §The coin overlap |
| `icon`, `colour` | — | literal | |

## Seed content ✅

Sample character's pouch: 6 Copper, 0 Silver, 29 Electrum, 26 Gold, 0 Platinum.

🔍 Exchange rates are not visible in the export. [Item](11-item-template.md) values are large integers (dagger 1000, breastplate 10000), which suggests copper is the base unit and prices are quoted in it. Needs confirming.

## The coin overlap ⚠️

Coins appear in **three** places in the sheet:

1. The *Charactersheet* coin pouch — five denominations.
2. *Components* — copper, silver, electrum, gold, platinum as [material families](09-material-family.md) with tiers 1–10 and stat mods.
3. *Equipment* — a `Money → coin` item template.

So `gold` is simultaneously a currency, a craftable metal, and an item. The sheet gets away with this because nothing enforces the distinction.

**Recommendation: keep them as two concepts with a link.** A Currency denomination (`Gold`) references a Material family (`gold`). This lets you price things in gold *and* forge a gold breastplate, without the exchange rate accidentally becoming a stat modifier.

The alternative — one concept with a `is_currency` flag — is fewer records but conflates "worth 100" with "grants +3 Char", and those diverge the moment you add a currency that isn't a metal.

## Links

| Direction | Target | Via |
|---|---|---|
| out | [Material family](09-material-family.md) | `material` |
| in | Character | coin pouch (instance-state) |
| in | [Item template](11-item-template.md) | `base_value` denominated in the base currency |

## Validation

- Exactly one currency must have `is_base = true`.
- Exchange rates must be strictly increasing with `order`, or the editor warns (a higher denomination worth less is almost always a typo).
- Deleting a currency holding a non-zero balance on any character is blocked.

## Editing scenarios

| You want to | You do |
|---|---|
| Add a sixth denomination | One record. The pouch UI grows. |
| Change gold:silver from 10:1 to 20:1 | Edit `exchange_rate`. All item prices re-quote. |
| Show all prices in gold instead of copper | Move `is_base`. Every value field re-renders. |
| Add a non-metal currency (favours, souls) | One record with no `material` link. |

## Open questions

- 🔍 **What are the exchange rates?** Not in the export.
- ❓ **One concept or two?** Recommendation above is two (currency + material, linked), but it is your call and it is easier to decide now than after 60 item templates are priced.
