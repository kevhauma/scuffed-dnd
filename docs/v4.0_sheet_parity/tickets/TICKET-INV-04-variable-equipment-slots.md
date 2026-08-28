# TICKET-INV-04 — Equipment slots stay User-built and variable

- **Area:** Inventory & equipment
- **Type:** Feature (seed placements + a proof)
- **Traceability:** System [08 · Equipment slots](../systems/08-equipment-slots.md); overview
  [Rulings — ticket review](../overview.md#rulings-user-2026-08-29--ticket-review) (the builder is
  the authority, the sheet's six are seed data). Builds on **TICKET-INV-03**, the equipment slot
  display builder.

> **Scope (overview [D7](../overview.md#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29)):**
> which slots the seeded ruleset ships, and their names, are the data pass's. It owes this ticket
> the sheet's six rows (`Backpack` C4:D9, `Naming` BA12:BA17) in
> [equipment-slots.json](../../imports/equipment-slots.json), with the `accesory` retirement noted.

## User story

As a User, I want to decide how many equipment slots my ruleset has and what they are called — six
like the sheet, three, or twelve — so the figure my players equip is the one I drew, not one the
app assumed.

## Description

The v4 sheet has six body slots where the old one had seven. That is a change of *data*, not of the
app: TICKET-INV-03 already made the slot set User-built — a grid the User sizes, a slot on each
cell, a glyph on each slot — and `EquipmentSlot.type` is free text a Player's `equippedItems` keys
on. This ticket's job is to keep it that way while the sheet's new spellings arrive, and to prove
the count is genuinely free rather than incidentally free.

The one code-level gap is [equipmentLayout.ts](../../../src/shared/engine/equipmentLayout.ts)'s
`SEED_PLACEMENTS`: a convenience table that opens the builder on a recognisable figure instead of a
column of unplaced boxes. It knows `head`, `chest`, `main_hand`, `off_hand`, `legs`, `feet`,
`accessory` and their obvious aliases; it has never heard of `upperbody_gear` or `right_hand`, so a
v4 ruleset would open unplaced.

## Current situation (as-is)

- **The builder already exists and is already variable** (TICKET-INV-03):
  [EquipmentSlotsConfigPanel](../../../src/client/components/config/equipment/EquipmentSlotsConfigPanel.tsx)
  is CRUD over the slot list and
  [EquipmentLayoutPanel](../../../src/client/components/config/equipment/EquipmentLayoutPanel.tsx)
  is the board — columns and rows the User picks up to
  `MAX_EQUIPMENT_GRID_COLUMNS`/`MAX_EQUIPMENT_GRID_ROWS`, slots assigned to cells, unplaced slots
  listed beside it. `placement` is optional metadata; nothing requires one.
- `EquipmentSlot.type` is free text (`e.g., "helmet", "main_hand", "off_hand"` in
  [config.ts](../../../src/shared/types/config.ts)), lowercase-with-underscores by form validation
  only. `Inventory.equippedItems` is `Record<slotType, itemId>`.
- `SEED_PLACEMENTS` in [equipmentLayout.ts](../../../src/shared/engine/equipmentLayout.ts) maps a
  normalised type to a cell + glyph, with aliases (`weapon`, `boots`, `torso`, `ring`); an unknown
  type seeds **unplaced**, which costs it nothing. `DEFAULT_EQUIPMENT_LAYOUT` is 3×4.
- The old seven-slot set lives in
  [equipment-slots.json](../../imports/equipment-slots.json) — data, and therefore the data pass's.

## Desired result (to-be)

- **The sheet's spellings recognised**: `head_gear`, `upperbody_gear`, `lowerbody_gear`,
  `foot_gear`, `right_hand`, `left_hand` join `SEED_PLACEMENTS` as aliases of the cells and glyphs
  their old spellings already use — `right_hand` beside `main_hand`, not replacing it. Nothing is
  removed: a ruleset that says `chest` keeps its figure.
- **The count is proven free, not assumed free**: a test walks a ruleset with one slot, one with
  twelve, and one with none through config, equip and the play-mode doll
  ([EquipmentDoll.tsx](../../../src/client/components/play/inventory/EquipmentDoll.tsx)). If any of
  the three surfaces a fixed assumption — a hard-coded key, a grid that cannot hold the set, a doll
  that renders only what it recognises — fixing it is this ticket's work.
- **`accessory` is not special**: it stays in the alias table and in the glyph catalogue. Whether
  the seeded ruleset ships an accessory slot is a data question, and no app code answers it.

## Acceptance criteria

- [ ] A ruleset whose slots are exactly the sheet's six opens the builder on a placed figure — six
      cells, sensible glyphs, nothing unplaced — pinned by an `equipmentLayout` test naming each of
      the six spellings.
- [ ] The old spellings still place: `chest`, `main_hand`, `off_hand`, `legs`, `feet`, `accessory`
      and their existing aliases resolve exactly as they do today — the same test, both halves.
- [ ] Rulesets with 1, 6 and 12 slots each configure, equip and render on the doll end to end; a
      ruleset with **no** slots renders the empty state rather than a broken board — component
      tests over all four.
- [ ] No slot key is named outside `SEED_PLACEMENTS` and the glyph catalogue: a grep for the slot
      spellings across `engine/`, `services/` and play-mode components finds them nowhere else.
- [ ] Persistence through store actions only; slot changes ride the existing
      equip/unequip and slot-CRUD actions unmodified.
- [ ] Unit tests cover: alias resolution for both generations of spelling, an unknown type seeding
      unplaced, and `equippedItems` round-tripping import/export at a slot count of one and twelve.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser check of a six-slot board and a twelve-slot board (ask the User
      first).

## Notes

- **Must land before TICKET-INV-05/06** — composed items hang off whatever slots the ruleset has,
  and INV-05's per-slot summation should be written against a variable set from the start.
- No `RETIRED_FIELDS` entry and no conversion: nothing in the *shape* is being retired here. A
  stored character keyed on slots its ruleset no longer has is the existing validation surface's
  problem, unchanged by this ticket.
- The alias table is a convenience, not a vocabulary. It earns its keep by opening the builder on a
  figure; a slot it has never heard of is a first-class slot that the User places once.
