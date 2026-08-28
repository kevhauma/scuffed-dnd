# 12 · Item composition — material + template + inlay, and the Backpack

**Sheet source (xlsx):** `Background Item selecter` C2:E20 · `Backpack` C3:J9 ·
`background Backpack Calculation` B3:BN20 (the composition engine) ·
`Background Charater Sheet Calcu` G2:L50 (skill side), T2:Y11 (stat side).

## What the new sheet says

A carried thing is a **triple**: material tier + item template + optional inlay tier, written as
one phrase. The *Item selecter* tab is the builder (three pick-columns: Materiaal / Inlay / item,
18 `empty` rows waiting), and the Backpack-calculation sheet turns each pick into a row — **all
formulas now read directly**:

- **Display name** = `material & " " & item & " with " & inlay & " inlay"` (the sample's
  `Adamantine Ore 10  Battleaxe with empty inlay` carries a double space because the item cell's
  value is `" Battleaxe"`, leading space and all — a data quirk to record, not reproduce).
- **Skill row** = `VLOOKUP(template, items-scaling, 48 columns)` — the template's vector alone.
- **Stat row** = `VLOOKUP(material, material-scaling, 7 columns) + VLOOKUP(inlay, inlay-scaling,
  7 columns)`, plus Mana and Speed looked up from the **inlay table only** (materials have no
  Mana/Speed columns — systems/09/10 agree by construction).
- **The equipped-slot columns key on the composed display name**: each gear column on the engine
  tab VLOOKUPs `Backpack!D4…D9`'s string against the composition rows. Names are identity in the
  sheet; in the app, ids are (the standing rule) — the parity model keeps id references and
  treats the phrase as display.

The sample verifies end to end: right hand *Iron Ore 10 Battleaxe with Diamond 4 inlay* → stats
Str 18 / Con 18 / Char 8 / Health 5 / Mana 4000 (= Iron Ore 10 + Diamond 4), skills = the
Battleaxe vector (+2 Athletics, +3 intimidation, −1 Assassination …).

The Backpack tab is the character's inventory surface: the six slots (systems/08), the coin purse
(systems/14), and the **Backpack list** — a `FILTER` of composed items *not currently equipped*,
i.e. the sheet derives "in the bag" as "built but not worn".

## What the app has today

`Item` already *is* a fused instance — `materialId?` + `materialLevel?` on the template record
(v1.0's reading of "iron 1 empty rapier") — and `Inventory` holds
`equippedItems: Record<slotType, itemId>` + `miscItems: itemId[]`. Equipment stat bonuses come
from the item's material tier (TICKET-MAT-02). There is no inlay, no builder flow, and no
skill-side contribution.

## Parity gap

1. **Add the socket**: `Item.inlayId?` + `Item.inlayLevel?` beside the existing
   `materialId`/`materialLevel` — the composed-item pattern the shape already uses, extended one
   axis. Additive-optional → no version bump.
2. **Engine**: per equipped slot, stat bonuses = material row + inlay row (statCalculator gains
   one term); skill bonuses = template vector (skillCalculator gains the slot walk — systems/06
   gap 4). Confirmed numbers above become golden fixtures (plan §15).
3. **The builder** — an "item selecter" flow in the app: pick template, material+tier,
   inlay+tier → creates the composed `Item` and puts it in `miscItems`. This is the User-facing
   answer to the sheet's three-column picker. Display-name convention follows the sheet:
   `<Material N> <Template> with <Inlay N|empty> inlay`.
4. **Naming note**: two different `Item` records may share a template ("Battleaxe") — the
   template list (systems/11) is the catalog; a composed item is an instance record pointing at
   material/inlay. That is v1.0's existing pattern, kept deliberately rather than a new
   template/instance split — no new abstraction before its third caller.

## Backend note

Document and engine only. Composed items live inside `character.data`'s inventory and the ruleset's
item list exactly as today.

## Open questions

- **Where do composed instances live** when a Player builds one — in the ruleset's `items` array
  (today's home, but it is Configuration data a Player edits) or in a character-side list? Today
  players already reference ruleset items; the sheet is one workbook per character so it cannot
  say. This is the one real design decision in §10 — put it to the User in the ticket's plan.
- **Inlay-less display** — the sheet spells it "with empty inlay"; mirror or drop the suffix.
  Cosmetic; follow the sheet by default.
