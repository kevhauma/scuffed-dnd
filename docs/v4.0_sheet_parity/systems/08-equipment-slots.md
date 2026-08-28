# 08 · Equipment slots — the sheet's six, on a board the User draws

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
Feet, accesory — but the seven are *seed data*, not a rule. TICKET-INV-03 built the equipment slot
display builder: the User adds and removes slots, sizes the board, assigns a slot to a cell and
picks its glyph, and a slot the seed table has never heard of costs nothing — it starts unplaced
and the User places it. `EquipmentSlot` is **keyed by `type`** (the one entity still addressed by a
code-like key), and `Inventory.equippedItems` is `Record<slotType, itemId>`.

## Parity gap

**The gap is data, not shape** (User ruling, 2026-08-29, ticket review). TICKET-INV-03 already made
the slot set User-built: the slots are a list the User edits, the board is a grid the User sizes,
and `EquipmentSlot.type` is free text. The app must not learn that a body has six slots — it must
keep not caring.

1. **Seed the new spellings** — `head_gear`, `upperbody_gear`, `lowerbody_gear`, `foot_gear`,
   `right_hand`, `left_hand` join `SEED_PLACEMENTS`'s alias table beside the spellings already
   there, so a v4 ruleset opens the builder on a placed figure instead of six unplaced boxes. The
   old spellings stay: a ruleset that says `chest` keeps its figure.
2. **Prove the count is free** — one slot, twelve slots, none. The builder was written for this;
   the play-mode doll and the equip path were not written *against* it, and nobody has checked.
3. **Fragment update** — equipment-slots.json re-sourced with the sheet's six names and the
   `accesory` retirement noted. This is the data pass's work
   ([D7](../overview.md#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29)),
   not a ticket's.

Nothing is retired from the *shape*, so there is no `RETIRED_FIELDS` entry and no conversion here:
a stored character keyed on slots its ruleset no longer has is the existing validation surface's
problem. The clean break (D6) still covers the milestone; this line does not spend it.

## Backend note

Document-only. Server-held characters meet the same shared shape check.

## Open questions

None.

*(Settled by User ruling, 2026-08-29 and the same day's ticket review: the equipment-slot builder
is the authority, a ruleset's slots are variable in count, and the sheet's six are seed data.)*
