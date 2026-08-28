# 08 · Equipment slots — the six-slot body

**Sheet source:** `Backpack` C4:D9 · `Background References: Naming` BA12:BA17 ·
`Background Charater Sheet: Calculations` H2:M2, U2:Z2.

## What the new sheet says

Six slots, named identically in the Backpack, the glossary, and both bonus matrices (a gear
column per slot on the ability calculator *and* on the base-stat assembly):

| Slot (sheet spelling) | Sample content |
|---|---|
| Head gear | empty |
| Upperbody gear | empty |
| Lowerbody gear | empty |
| Foot gear | empty |
| right hand | Iron Ore 10 Battleaxe with Diamond 4 inlay |
| Left hand | empty |

The old sheet's **accessory box is gone**, and `main hand`/`off hand` became `right hand`/`Left
hand`. Every slot now contributes on **two axes**: the equipped item's material+inlay vectors feed
the six stat-side gear columns (Calculations U2:Z2), and its template vector feeds the six
skill-side gear columns (Calculations H2:M2) — systems/12 has the confirmed arithmetic.

## What the app has today

Seven slots from the old sheet (equipment-slots.json): Head, chest, main hand, off hand, Legs,
Feet, accesory — laid out on a 3×4 board (TICKET-INV-03). `EquipmentSlot` is **keyed by `type`**
(the one entity still addressed by a code-like key), and `Inventory.equippedItems` is
`Record<slotType, itemId>`.

## Parity gap

1. **Rename five slots, drop one, keep the count at six** — head→Head gear, chest→Upperbody gear,
   legs→Lowerbody gear, feet→Foot gear, main_hand→right hand, off_hand→Left hand, and retire
   `accessory`.
2. **The reshape risk lives in the key.** Slot `type` is the join key into every character's
   `equippedItems`. Two honest paths, per the data-model rules (bump XOR migrate):
   - keep the existing `type` values (`head`, `chest`, `main_hand`…) and change only display
     `name`s — zero character impact, `accessory` type retired via `RETIRED_FIELDS`-style
     validation and a conversion that moves an equipped accessory to `miscItems`;
   - or rename types and ship a key-mapping conversion in the load path with a test feeding the
     old shape.
   The first is smaller and loses nothing the sheet shows (the sheet names are display). Recommend
   it in the ticket; either way an accessory-wearing character must not lose the item.
3. **Board layout** — re-place six slots on the figure (the sheet draws a simple list; our board
   is our own presentation, TICKET-INV-03's `placement` is optional metadata).
4. **Fragment update** — equipment-slots.json re-sourced with the new names and the retirement
   noted.

## Backend note

Document-only. If the conversion path is chosen it is a client-load-path conversion with a test —
still no server change (server-held characters flow through the same shared shape check).

## Open questions

- **What may an accessory-era ruleset do?** A stored ruleset with seven slots keeps working — the
  slot list is User data, and six-vs-seven is their edit. The parity change is to the *seed* and
  the *corpus*; the ticket must not force-edit existing rulesets beyond the accessory retirement
  decision above. Confirm with the User which of the two paths in gap 2 they want.
