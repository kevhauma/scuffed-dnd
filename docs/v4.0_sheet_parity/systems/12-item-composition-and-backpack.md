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

1. **A composed item is an inventory record that links its parts** (User ruling, 2026-08-29).
   It lives on the **character**, not in the ruleset's catalog, and it stores *references* rather
   than a copy of the numbers:

   ```
   { id, templateId, materialId, materialLevel, inlayId?, inlayLevel? }
   ```

   Three things follow, and each is the house rule rather than a new invention:

   - **Nothing about its bonuses is stored.** Stats and skill vectors are re-read from the
     template, material tier and inlay tier at calculation time — the derived-values rule, and the
     reason retuning a material relabels every axe in the game instead of rewriting none of them.
   - **`Inventory` grows a home for them.** `equippedItems` and `miscItems` hold ids today; the
     ticket decides whether composed items live in a third collection keyed by id or whether those
     two start naming composed records. Prefer the smaller change that keeps
     `equippedItems: Record<slotType, id>` intact.
   - **Guarded deletes reach further.** Deleting a material, item template or inlay a character
     has built something out of must be refused by the existing walker
     (`engine/dependencies.ts` already counts characters as references — this is a new edge in the
     same graph, not a new mechanism).

   The catalog side keeps its part: `Item` stays the **template** (name, category, skill vector),
   and its old v1 `materialId`/`materialLevel` fields — the fused-instance experiment — are
   **deleted**, since instances now live where they belong. Under D6 that costs no conversion.
2. **Engine**: per equipped slot, stat bonuses = material row + inlay row (statCalculator gains
   one term); skill bonuses = template vector (skillCalculator gains the slot walk — systems/06
   gap 4). Confirmed numbers above become golden fixtures (plan §15).
3. **The builder** — an "item selecter" flow in the app: pick template, material + tier, inlay +
   tier → writes the composed record into the character's inventory. This is the User-facing
   answer to the sheet's three-column picker, and it is a **player action**, so it goes through a
   store action locally and the existing player-action route on the server.
4. **Naming**: the display phrase is derived, never stored — `<Material N> <Template> with
   <Inlay N|empty> inlay`, rebuilt from the links every render, so renaming a material relabels
   every item made of it. Many composed items may share one template; that is the
   template/instance split the ruling settles, and it is why the instance carries no name of its
   own. The sheet's `with empty inlay` suffix is mirrored (its double space is not).

## Backend note

Document and engine only. Composed items live inside `character.data`'s inventory; the ruleset's
item list holds templates. Both are JSON documents — no schema change (overview D2).

## Open questions

None.

*(Settled by User ruling, 2026-08-29: a composed item is a record in the Player's inventory
carrying links to the template, material tier and inlay tier it is made of — gap 1 above.)*
