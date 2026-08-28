# 09 · Materials — 24 families, hand-authored tiers

**Sheet source:** `Background Reference Material: scaling` A4:I250 (three group headers: row 4
"biological material", row 26 "### Stone & Clay (Stones & Ores)", row 88
"### Raw Ores (Stones & Ores)"; data ends at row 250 — the grid padding beyond is empty).

## What the new sheet says

24 material families, each in **exactly ten tiers** (`Wood 1` … `Wood 10`), granting stat bonuses
over **seven columns: Strenght, Dex, Con, Int, Wis, Char, Health** — no Mana, no Speed (those two
axes belong to inlays, systems/10). The ladders are **hand-authored, not linear**: Wood's Dex runs
1,1,2,2,3,4,4,5,5,6. Captured tier-1 → tier-10 endpoints per family
(`Str/Dex/Con/Int/Wis/Char/Health`):

| Family | Group | Tier 1 | Tier 10 |
|---|---|---|---|
| Wood | biological | 0/1/0/0/1/0/0 | 2/6/3/0/5/0/2 |
| Bones | biological | 0/0/0/0/1/0/0 | 2/2/4/0/6/0/0 |
| Limestone | Stone & Clay | 0/0/1/0/0/0/0 | 4/0/6/0/0/0/0 |
| Sandstone | Stone & Clay | 0/0/1/0/0/0/0 | 3/0/5/0/0/0/0 |
| Clay | Stone & Clay | 0/0/0/0/0/0/0 | 0/0/3/0/0/0/2 |
| Granite | Stone & Clay | 1/0/1/0/0/0/0 | 8/0/12/0/0/0/0 |
| Marble | Stone & Clay | 1/0/1/0/0/1/0 | 5/0/6/0/0/12/0 |
| Obsidian | Stone & Clay | 1/0/1/0/0/1/0 | 12/0/6/4/0/8/0 |
| Coal | Raw Ores | 0/0/0/0/0/0/0 | 0/0/2/0/0/0/0 |
| Bauxite Ore | Raw Ores | 0/1/0/0/0/0/0 | 4/8/4/0/0/0/0 |
| Iron Ore | Raw Ores | 1/0/1/0/0/0/1 | 10/0/10/0/0/0/5 |
| Lead Ore | Raw Ores | 1/0/1/0/0/0/0 | 8/0/8/0/0/0/0 |
| Copper Ore | Raw Ores | 0/0/0/0/0/0/0 | 4/2/4/2/0/2/0 |
| Silver Ore | Raw Ores | 0/0/0/1/1/1/0 | 3/4/3/12/8/10/0 |
| Gold Ore | Raw Ores | 0/0/0/1/1/2/0 | 2/0/2/5/5/20/0 |
| Platinum Ore | Raw Ores | 0/0/0/1/1/2/0 | 4/0/4/8/8/20/0 |
| Mithril Ore | Raw Ores | 1/2/1/1/0/1/0 | 8/20/8/8/4/10/0 |
| Adamantine Ore | Raw Ores | 2/0/2/0/0/1/2 | 20/0/20/0/0/5/20 |
| Harvested Hide | Raw Ores | 0/2/1/0/0/0/1 | 0/20/10/0/0/0/15 |
| Harvested Bone | Raw Ores | 2/0/2/0/0/0/1 | 20/0/20/0/0/0/10 |
| Harvested Arcane Organ | Raw Ores | 0/0/0/2/2/1/0 | 0/0/0/20/20/15/0 |
| Harvested Exotic Meat | Raw Ores | 1/0/1/0/0/0/2 | 15/0/10/0/0/0/20 |
| Exotic Carapace | Raw Ores | 1/0/2/0/0/0/1 | 10/0/20/0/0/0/15 |
| Exotic Feathers | Raw Ores | 0/2/0/0/1/1/0 | 0/20/0/0/10/15/0 |

The tier-1 vector is *not* a base the others multiply — every one of the 240 rows is data. The
harvested creature parts (the old sheet's "Monster harvest items" concept) now sit inside the Raw
Ores group. Confirmed against the sample: **Iron Ore 10** grants Str 10 / Con 10 / Health 5 —
readable in the gear column (systems/12).

## What the app has today

124 families across 12 categories, 292 tiers (materials.json from the old `Components` tab) —
including whole categories the new sheet dropped from this tab: Runes, Liquids, fabrics, Cloths
status, Food, Status. `MaterialModifier` targets stats by id (TICKET-MAT-01); tiers are stored,
never generated. Tier values were priced in Copper (inferred); **the new tab has no value column
at all** — prices left the sheet entirely (overview D5).

## Parity gap

1. **Replace the materials fragment**: 24 families, 3 categories, 240 tiers, no prices. The old
   categories that vanished (Runes, Liquids, …) leave the corpus with the fragment; whether the
   User wants them kept in their *own* ruleset is their edit, not the corpus's.
2. **No shape change** — `Material`/`MaterialTier`/`bonuses` already express everything here.
   Health is already a stat id target. Data only.
3. Note in the fragment: the tab's columns cover 7 of 9 stats; Mana/Speed grants live on inlays.
   The importer must not zero-fill what the sheet does not say — absent stays absent.

## Backend note

Data only.

## Open questions

- **Where did the dropped categories go?** Fabrics/liquids/etc. appear nowhere in the new
  workbook. Either cut content or a tab yet to come. The corpus follows the sheet (D1); flag to
  the User that ~100 old families fall out of the seed corpus when this fragment lands.
