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
2. **The keys are rewritten, and nothing is carried across** (User ruling, 2026-08-29 → overview
   D6). Slot `type` is the join key into every character's `equippedItems`, and the two-path fork
   this document used to carry — keep the old keys, or rename them and ship a conversion — is
   resolved by the clean break: **rename them to match the sheet** (`head_gear`, `upperbody_gear`,
   `lowerbody_gear`, `foot_gear`, `right_hand`, `left_hand`), delete `accessory`, and write no
   conversion. An old stored character does not lose its accessory quietly; it meets
   `IncompatibleDataNotice` with a backup offer, along with everything else from the old shape.
   `accessory` still earns a `RETIRED_FIELDS` entry — that is the sentence naming what replaced
   it, not a compatibility path.
3. **Board layout** — re-place six slots on the figure (the sheet draws a simple list; our board
   is our own presentation, TICKET-INV-03's `placement` is optional metadata).
4. **Fragment update** — equipment-slots.json re-sourced with the new names and the retirement
   noted.

## Backend note

Document-only, and simpler under D6 than it looked: no conversion means no load-path code and no
old-shape test. Server-held characters meet the same shared shape check.

## Open questions

None.

*(Settled by User ruling, 2026-08-29: slot keys are rewritten to the sheet's six, `accessory` is
deleted, and no backwards compatibility is built — overview D6.)*
