# TICKET-MAT-03 — Materials catalog replaced

- **Area:** Materials configuration
- **Type:** Feature (data only)
- **Traceability:** System [09 · Materials](../systems/09-materials.md); overview
  [D5](../overview.md#d5--what-is-deliberately-not-parity) (prices are gone from the sheet).

> **✅ Built 2026-09-01, in the data pass.** Generated rather than transcribed: the catalog is read
> out of the checked-in workbook by [`scripts/build-fragments.mjs`](../../../scripts/build-fragments.mjs)
> (`yarn run sheet:source`), so re-reading it is a command. **One correction to the spec below**:
> the tab has **four** group headers, not three — row 190 heads the six harvested families
> `new materials` in their own right — and the sheet wins (D1). systems/09 is corrected to match.

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

- [x] The regenerated corpus imports clean: 24 families × 10 tiers each, **four** groups (the
      correction above), Iron Ore 10 granting Str 10 / Con 10 / Health 5.
      *Evidence:* `sheetImport.test.ts` — *holds 24 material families in four groups, ten tiers
      apiece (MAT-03)* and *grants what the sample character reads off Iron Ore 10 (MAT-03)*.
- [x] No `Material` or `MaterialTier` type change; no engine change — `git diff` touches neither
      `src/shared/types/config.ts` nor any calculator, and all 3,761 tests pass.
- [x] No price appears anywhere in the fragment; the old priced values are gone with a `notes`
      entry citing D5 rather than silently.
      *Evidence:* `sheetImport.test.ts` — *prices nothing, because the new workbook prices nothing
      (D5)* asserts every tier's amount is 0 and no item description mentions copper.
- [x] [materials.json](../../imports/materials.json) cites `source.ranges` against the xlsx sheet
      name (`Background Reference Material s`, truncated as the workbook has it) with the group
      headers noted and `exportedAt` 2026-08-28; `yarn run sheet:import` regenerated; the only
      required field the sheet cannot fill is `MaterialLevel.value`, which takes the neutral 0 in
      the base tier with a note saying so.
- [x] Unit tests cover: the import count, a hand-authored ladder round-tripping (Wood's Dex
      1,1,2,2,3,4,4,5,5,6), and absence of Mana/Speed targets.
      *Evidence:* the three `the v4 catalogs` cases named above, plus *targets no stat axis the
      material tab does not have (MAT-03)*.
- [x] Verified: `npx vitest run` 3,761 passing / 0 failing, `npx tsc --noEmit` at its 2-error
      baseline, `yarn run check` clean, `fallow audit --base main` with the dead export it found
      removed and `buildMaterials` decomposed below CRITICAL. Browser check not run — offered to
      the User with the rest of the data pass.

## Notes

- Where the dropped categories went is systems/09's open question (cut content vs a tab yet to
  come) — the corpus follows the sheet (D1); this ticket's job is to say the loss out loud.
- The same names reappear as purchasable *items* in TICKET-ITEM-02 (Stones & Ores shop) — one
  name, two roles, deliberately two records.
