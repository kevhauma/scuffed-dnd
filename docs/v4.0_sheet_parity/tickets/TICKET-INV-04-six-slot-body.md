# TICKET-INV-04 — Equipment slots become the six-slot body

- **Area:** Inventory & equipment
- **Type:** Feature (reshape, clean break)
- **Traceability:** System [08 · Equipment slots](../systems/08-equipment-slots.md); overview
  [D6](../overview.md#d6--no-backwards-compatibility-v40-is-a-clean-break-user-2026-08-29)
  (slot keys rewritten, no conversion — the accessory ruling).

## User story

As a Player, I want my gear on the sheet's six body slots — Head, Upperbody, Lowerbody and Foot
gear plus right and Left hand — so my Backpack matches the workbook's.

## Description

Six slots, named identically in the sheet's Backpack, glossary, and both bonus matrices. The old
accessory box is gone and `main hand`/`off hand` became `right hand`/`Left hand`. Slot keys are
the join into every character's `equippedItems`, and under D6 they are rewritten outright — no
conversion, no dual-read.

## Current situation (as-is)

- Seven slots from the old sheet in
  [equipment-slots.json](../../imports/equipment-slots.json): Head, chest, main hand, off hand,
  Legs, Feet, accesory — laid out on a 3×4 board (TICKET-INV-03's `placement`, optional metadata
  on [`EquipmentSlot`](../../../src/shared/types/config.ts)).
- `EquipmentSlot` is **keyed by `type`** (the one entity still addressed by a code-like key), and
  `Inventory.equippedItems` is `Record<slotType, itemId>` — which is why a key rename is a
  reshape, not a rename.
- `RETIRED_FIELDS` (in [importExport.ts](../../../src/shared/services/importExport.ts)) is the
  mechanism that turns an old key into a sentence naming its replacement.

## Desired result (to-be)

- **The slot set rewritten to the sheet's six**: `head_gear`, `upperbody_gear`, `lowerbody_gear`,
  `foot_gear`, `right_hand`, `left_hand`; `accessory` deleted with a `RETIRED_FIELDS` entry
  (documentation, not a compatibility path). No conversion: an old stored character meets
  `IncompatibleDataNotice` with a backup offer.
- **The board re-places six slots** on the figure — the sheet draws a list; the board is our
  presentation, so the seeds' `placement` values are re-authored for six.
- **[equipment-slots.json](../../imports/equipment-slots.json) re-sourced** with the new names,
  ranges, and the accessory retirement noted.

## Acceptance criteria

- [ ] The config panel and the play-mode doll
      ([EquipmentDoll.tsx](../../../src/client/components/play/inventory/EquipmentDoll.tsx)) show
      exactly the six slots; equipping through each works end to end.
- [ ] `accessory` appears in no seed, fragment, or type — and an imported old-shape file's error
      names the retirement rather than failing on shape (a `RETIRED_FIELDS` test).
- [ ] No conversion code exists (D6); the milestone's `SUPPORTED_SCHEMA_VERSION` bump covers the
      break — if this ticket lands it, say so and update the `data-model` skill.
- [ ] Persistence through store actions only; slot changes ride the existing equip/unequip
      actions unmodified.
- [ ] [equipment-slots.json](../../imports/equipment-slots.json) re-sourced with `source.ranges`
      cited (Backpack C4:D9, Naming BA12:BA17) and new `exportedAt`; `yarn run sheet:import`
      regenerated.
- [ ] Unit tests cover: the six keys round-tripping import/export, the retired-key message, and
      equip validation against the new `equipmentSlotType` values.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser check of the six-slot board (ask the User first).

## Notes

- **Must land before TICKET-INV-05/06** — composed items hang off these six slots (the overview's
  ordering note).
- Items whose `equipmentSlotType` named `accessory` become validation findings for the User to
  re-home; the new item catalog (TICKET-ITEM-02) does not use the old keys, so the seeded corpus
  is clean by construction.
