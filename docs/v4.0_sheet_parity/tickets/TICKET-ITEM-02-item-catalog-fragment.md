# TICKET-ITEM-02 — The v4 item catalog: 40 categories, ~700 templates

- **Area:** Items (sheet corpus)
- **Type:** Feature (data only)
- **Traceability:** System [11 · Items and shops](../systems/11-items-and-shops.md) (gap 3);
  overview [D5](../overview.md#d5--what-is-deliberately-not-parity) (no prices). **Needs
  TICKET-ITEM-01** (the `skillBonuses` shape and shop tagging this data fills).

> **✅ Built 2026-09-01, in the data pass** — and it did get the script the note below asked for:
> [`scripts/build-fragments.mjs`](../../../scripts/build-fragments.mjs) reads the checked-in xlsx
> through a dependency-free reader and rewrites every fragment, this one included.
> **The reconciled count is 830**, not the ~700 estimated: the tail's 99 genuinely new rows and the
> Stones & Ores categories' 403 tiered rows are more than the estimate allowed for.

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

- [x] `yarn run sheet:import` regenerates a corpus that imports clean with the reconciled count;
      the fragment's `notes` states the raw row count (965 vector rows below 973 named ones), the
      reconciled count (830), and every decision made — the 8 structural rows by name, the 135 tail
      replacements, the 99 uncategorised tail rows, and the one nameless row dropped.
      *Evidence:* `sheetImport.test.ts` — *reconciles the item matrix to 830 templates (ITEM-02)*.
- [x] The Battleaxe's full vector matches systems/11's quote, all 18 entries in order, with its
      category and shop.
      *Evidence:* `sheetImport.test.ts` — *spells the Battleaxe's full vector as systems/11 quotes
      it (ITEM-02)*; the 9 distinct shops are asserted alongside the count.
- [x] Every `skillId` in every vector resolves against the corpus's 48 skills — twice over: the
      build **fails** on a matrix column naming a skill `skills.json` does not hold, and
      `sheetImport.test.ts`'s *resolves every skill a vector names against the corpus 48 (ITEM-02)*
      plus its whole-corpus referential check assert it after the fact.
- [x] No price anywhere; the old descriptions' retirement noted.
      *Evidence:* *prices nothing, because the new workbook prices nothing (D5)* also asserts no
      item description mentions copper.
- [x] The import script reads the checked-in xlsx, not a live sheet, and is committed — rerunnable
      by anyone with a clone: [`build-fragments.mjs`](../../../scripts/build-fragments.mjs) beside
      the merge script, reading through [`xlsx.mjs`](../../../scripts/xlsx.mjs) rather than a new
      dependency. `yarn run sheet:source` is the command.
- [x] Verified: `npx vitest run` 3,761 passing / 0 failing, `npx tsc --noEmit` at its 2-error
      baseline, `yarn run check` clean, `fallow audit --base main` with `buildItems` decomposed
      from cognitive 38 to 22. Browser check not run — offered to the User with the rest of the
      data pass.

## Notes

- ~~If vectors *differ* between a tail duplicate and its earlier copy, stop and ask the User.~~
  **They all differ, and the User ruled 2026-09-01: the tail wins.** The difference is systematic —
  the headed copy blankets ~21 physical and craft skills with −1 nuisance penalties and the tail
  copy keeps only the positives (headed Barley Cake is Cooking +1 and 22 penalties; the tail's is
  Cooking +1 and nothing else), which reads as the creator's revision. The tail vector replaces the
  headed one; the headed row still decides the category and shop.
- The Stones & Ores categories deliberately duplicate MAT-03's materials and INL-01's gems as
  items; cross-reference the three fragments in `notes` so nobody "fixes" the duplication later.
