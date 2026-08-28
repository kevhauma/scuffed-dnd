# 11 · Items — templates that target skills, sold in shops

**Sheet source:** `Background Reference items: scaling` A1:AX1055 (row 2 = the 48 skill column
headers; 40 `###` category rows; 973 item rows) · `Background References: Naming` N2:AT (per-shop
name lists).

## What the new sheet says

An item template is now a **bonus vector over the 48 skills** — columns C:AX, one per skill in
alphabetical order (the header numbering skips 37; the *skills* don't — 48 columns for 48
skills). Values are small signed integers; a wielded Battleaxe reads:

> Athletics +2, intimidation +3, woodcutting +2, Butchering/Construction/Dancing/Prefomance/
> Storytelling/Teaching/woodcrafting +1 — and −1 to Assassination, graple, hand to hand, Hiding,
> Lock picking, skinning, Sneaking, Summening.

**No stat columns and no prices** — an item's stat side comes entirely from its material and
inlay (systems/12), and nothing in the workbook prices anything (overview D5).

Items are grouped into 40 categories, each tagged with its **shop**:

| Shop | Categories (item counts) |
|---|---|
| Imperial Forge | Arsenal (40) · Armory (19) · Ranged (5) |
| Imperial Restaurant | Peasant Fare (10) · Tavern Classics (22) · Plant-Based (19) · Merchant's Choice (22) · Noble Dining (14) · Imperial Feasts (6) · Desserts (10) · Beverages (10) |
| Imperial Grocery | Bakery (5) · Butchery (7) · Seafood (5) · Produce (4) · Dairy & Bases (5) · Pantry (5) · Exploration (5) |
| General Store | Containers (10) · Survival Gear (10) · Tools (5) · Kitchenware (40) |
| Stones & Ores | Stone & Clay (61) · Raw Ores (101) · Common Gems (121) · Precious Gems (120) |
| Imperial Jewelry | Finery (7) · Regalia (4) |
| Imperial Arcanum | Scholarly Goods (3) · Foci (4) · Reagents (4) |
| Imperial Clothing | Essentials (7) · Accessories (3) · Noble Attire (3) · Outerwear (2) |
| Imperial Furniture | Seating (5) · Tables (4) · Beds (4) · Storage (4) · Bedding & Comfort (238*) |

Name lists worth pinning now (Naming tab, complete): **melee weapons** (40): Battleaxe, Billhook,
Blowgun, Claymore, Cleaver, Club, Dagger, Dart, Dirk, Estoc, Falchion, Flail, Glaive, Greataxe,
Greatsword, Halberd, Halfspear, Hatchet, Javelin, Kukri, Lance, Longsword, Lucerne Hammer, Mace,
Maul, Morningstar, Pike, Pitchfork, Quarterstaff, Rapier, Scimitar, Scythe, Shortsword, Sickle,
Sling, Spiked Chain, Stiletto, Trident, Warhammer, Whip. **Ranged** (5): Hand Crossbow, Heavy
Crossbow, Light Crossbow, Longbow, Shortbow. **Ammo** (2): Arrows (Batch), Bolts (Batch).
**Armor** (19): Banded Mail, Bascinet, Breastplate, Brigandine, Buckler, Chain Pants, Chain Shirt,
Full Plate, Gauntlets, Greaves, Half-Plate, Helmet, Kite Shield, Knuckles, Leg Plate, Pauldrons,
Ring Mail Chest, Scale Mail Chest, Tower Shield.

### Anomalies, recorded not repaired

- **\*The tail is un-headed** (rows ~822–1055): after Bedding & Comfort's four real items, the
  category column stops and ~233 rows follow with no `###` — groceries by quantity ("Flour
  (5kg)"), then the Restaurant's prepared dishes *again* (Barley Cake…), then every material
  family as tiered items (Wood 1…Exotic Feathers 10). They land under "Bedding & Comfort" only by
  position. Deduplication against the earlier sections is real import work, not a formatting
  detail.
- **Gems and materials are items too** — the Stones & Ores categories re-enumerate systems/09's
  materials and systems/10's inlays as purchasable rows (with their own skill-bonus vectors,
  almost all just −1 nuisance penalties). One name, two roles: catalog entry vs crafting
  component.
- A handful of rows are all-zero vectors (5 Kitchenware, 1 each in Stone & Clay/Raw Ores/Common
  Gems) — fine, an item may do nothing.
- Consumables (food) carry skill vectors like equipment does; nothing marks them consumable.

## What the app has today

191 item templates (items.json, v1.0 shape): name, description, `categoryId?`, `materialId?`,
`materialLevel?`, `equipmentSlotType?` — **no bonuses of their own** (the old sheet's item stat
columns were all zero; bonuses came from materials), base values parked in descriptions.

## Parity gap

1. **`Item.skillBonuses?`** — `[{ skillId, modifier }]`, keyed by skill id (the same id-keyed
   treatment `MaterialModifier` got in TICKET-MAT-01; a rename cannot orphan a bonus). Sparse:
   only nonzero entries stored. Additive-optional.
2. **Shops** — the category list becomes 40 `ItemCategory`-style records tagged with a shop name
   (or 9 shops holding categories; ticket decides the nesting — the sheet writes
   `category (shop)` on one line). The existing `categoryId` field already points at categories.
3. **The catalog fragment** — a rewritten items.json from A1:AX1055: 40 categories, ~700 unique
   templates once the un-headed tail is reconciled, each with its skill vector. The old fragment's
   priced descriptions retire with a note (D5: prices left the sheet). This is the milestone's
   biggest pure-data lift; the full matrix lives in the checked-in xlsx
   (`Background Reference items scal`), so the import is scriptable against a file in the repo
   rather than a live sheet.
4. **Engine** — equipped items' `skillBonuses` sum into skill levels per slot (systems/06 gap 4,
   confirmed arithmetic in systems/12).

## Backend note

Document and engine only.

## Open questions

- **How to reconcile the tail block** — duplicate dishes: same template listed twice, or a second
  record? Recommend: first occurrence wins, tail duplicates noted in the fragment (`skinning`
  precedent). Ask the User only if vectors *differ* between copies.
- **Are food vectors meant to apply while carried, while equipped, or when eaten?** Nothing in the
  sheet says. The app's rule today: bonuses apply when *equipped*. Keep that and note the gap.
