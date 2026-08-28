# TICKET-ITEM-02 — The v4 item catalog: 40 categories, ~700 templates

- **Area:** Items (sheet corpus)
- **Type:** Feature (data only)
- **Traceability:** System [11 · Items and shops](../systems/11-items-and-shops.md) (gap 3);
  overview [D5](../overview.md#d5--what-is-deliberately-not-parity) (no prices). **Needs
  TICKET-ITEM-01** (the `skillBonuses` shape and shop tagging this data fills).

> **⏸ Deferred to the data pass (overview [D7](../overview.md#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29)).**
> The milestone's biggest pure-data lift, and pure data is exactly what the shape pass does not
> ship. It stays here, cut and specified, as what the data pass implements — and it is the reason
> the data pass wants a script rather than a ticket-by-ticket trickle.

## User story

As a User, I want the workbook's full item catalog — every weapon, dish, gem and chair with its
skill vector, grouped into its shop — so my ruleset sells what the table's sheet sells.

## Description

The milestone's biggest pure-data lift: [items.json](../../imports/items.json) rewritten from the
xlsx's 973-row × 48-column matrix into 40 shop-tagged categories and roughly 700 unique templates
once the un-headed tail is reconciled. The full matrix lives in the checked-in xlsx
([`4.1 source sheets.xlsx`](../4.1%20source%20sheets.xlsx), sheet
`Background Reference items scal`), so the import is scriptable against a file in the repo.

## Current situation (as-is)

- [items.json](../../imports/items.json) holds 191 old-sheet templates with base values parked in
  priced descriptions; TICKET-ITEM-01 added `skillBonuses` and shop tagging but seeded only
  sample-confirmed vectors.
- The new matrix's tail (rows ~822–1055) is **un-headed**: after Bedding & Comfort's four real
  items, ~233 rows follow with no `###` category — groceries by quantity, the Restaurant's dishes
  *again*, and every material family as tiered items — landing under "Bedding & Comfort" only by
  position.

## Desired result (to-be)

- **items.json rewritten from `A1:AX1055`**: 40 categories with their shops, ~700 unique
  templates, each with its sparse skill vector. Tail reconciliation: **first occurrence wins**,
  tail duplicates noted in the fragment (the `skinning` precedent) — asking the User **only if
  vectors differ between copies**.
- **Prices retire**: the old fragment's priced descriptions go, with a `notes` entry citing D5 —
  no number invented, item values keep the old sheet's numbers only as historical notes where the
  fragment already records them.
- **Anomalies recorded, not repaired**: the all-zero vectors (an item may do nothing), gems and
  materials re-enumerated as purchasable rows (one name, two roles — catalog entry vs crafting
  component), consumables carrying vectors nothing marks consumable.

## Acceptance criteria

- [ ] `yarn run sheet:import` regenerates a corpus that imports clean with the reconciled count;
      the fragment's `notes` states the raw row count, the deduplicated count, and every tail
      decision made — silent truncation is a bug.
- [ ] The Battleaxe's full vector matches systems/11's quote (+2 Athletics, +3 intimidation,
      −1 Assassination …) — spot-pinned along with at least one row from each shop.
- [ ] Every `skillId` in every vector resolves against TICKET-SKL-04's 48 skills (the header
      numbering skips 37; the columns don't) — an import-level assertion.
- [ ] No price anywhere; the old descriptions' retirement noted.
- [ ] The import script (extending
      [build-sheet-import.mjs](../../../scripts/build-sheet-import.mjs) or beside it) reads the
      checked-in xlsx, not a live sheet, and is committed — rerunnable by anyone.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill. (Data-only; offer the User a browser look at the grouped catalog.)

## Notes

- If vectors *differ* between a tail duplicate and its earlier copy, stop and ask the User —
  that is the one reconciliation call systems/11 reserves for them.
- The Stones & Ores categories deliberately duplicate MAT-03's materials and INL-01's gems as
  items; cross-reference the three fragments in `notes` so nobody "fixes" the duplication later.
