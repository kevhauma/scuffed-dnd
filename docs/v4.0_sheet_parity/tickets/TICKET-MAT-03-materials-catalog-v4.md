# TICKET-MAT-03 — Materials catalog replaced

- **Area:** Materials configuration
- **Type:** Feature (data only)
- **Traceability:** System [09 · Materials](../systems/09-materials.md); overview
  [D5](../overview.md#d5--what-is-deliberately-not-parity) (prices are gone from the sheet).

> **⏸ Deferred to the data pass (overview [D7](../overview.md#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29)).**
> This ticket is nothing but seeded values — no type change, no engine change, no panel change —
> so it is **not built in v4.0's shape pass**. It stays here, cut and specified, as what the data
> pass implements. Nothing downstream waits on it: TICKET-INV-05 composes from the `Material`
> shape, which already exists, and which materials the corpus holds is not its business.

## User story

As a User, I want the new workbook's material catalog — 24 families in ten hand-authored tiers
each — so the things my players craft from are the ones the sheet scales.

## Description

The materials fragment is replaced wholesale: 24 families × 10 tiers across three groups
(biological, Stone & Clay, Raw Ores — harvested creature parts now inside Raw Ores), granting
bonuses over seven stat columns. No shape change: `Material`/`MaterialTier`/`bonuses` already
express everything here. The old catalog's ~100 extra families fall out of the corpus.

## Current situation (as-is)

- [materials.json](../../imports/materials.json) holds 124 families across 12 categories and 292
  tiers from the old `Components` tab — including whole categories the new sheet dropped (Runes,
  Liquids, fabrics, Cloths status, Food, Status) — with tier values priced in Copper (inferred).
- `MaterialModifier` targets stats by id (TICKET-MAT-01); tiers are stored, never generated;
  Health is already a valid stat target.
- The new tab (`Background Reference Material: scaling` A4:I250) has **no value column at all**.

## Desired result (to-be)

- **[materials.json](../../imports/materials.json) replaced**: 24 families, 3 groups, 240 tiers,
  no prices — every one of the 240 rows is data (the ladders are hand-authored, not linear; the
  tier-1 vector is not a base the others multiply).
- **Absent stays absent**: the tab covers 7 of 9 stats (no Mana, no Speed — those axes belong to
  inlays); the importer stores only what the sheet says, zero-filling nothing, and the fragment's
  `notes` records the two missing axes and where they live.
- **The drop is flagged, not smoothed**: the fragment's `notes` names the vanished categories, and
  closing the ticket tells the User ~100 old families leave the seed corpus (their own ruleset is
  their edit, not the corpus's).

## Acceptance criteria

- [ ] The regenerated corpus imports clean: 24 families × 10 tiers each, three groups, Iron Ore 10
      granting Str 10 / Con 10 / Health 5 (the sample-confirmed row, ready for TICKET-DX-09).
- [ ] No `Material` or `MaterialTier` type change; no engine change — asserted by untouched
      calculator suites.
- [ ] No price appears anywhere in the fragment; the old priced values are gone with a `notes`
      entry citing D5 rather than silently.
- [ ] [materials.json](../../imports/materials.json) cites `source.ranges` against the xlsx sheet
      name (`Background Reference Material s`, truncated as the workbook has it) with the three
      group-header rows noted and a new `exportedAt`; `yarn run sheet:import` regenerated; no
      number invented for any required field.
- [ ] Unit tests cover: the import count, a hand-authored ladder round-tripping (Wood's Dex
      1,1,2,2,3,4,4,5,5,6), and absence of Mana/Speed targets.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill. (Data-only — no browser criterion beyond the config panel listing the new families,
      ask the User whether to check it live.)

## Notes

- Where the dropped categories went is systems/09's open question (cut content vs a tab yet to
  come) — the corpus follows the sheet (D1); this ticket's job is to say the loss out loud.
- The same names reappear as purchasable *items* in TICKET-ITEM-02 (Stones & Ores shop) — one
  name, two roles, deliberately two records.
