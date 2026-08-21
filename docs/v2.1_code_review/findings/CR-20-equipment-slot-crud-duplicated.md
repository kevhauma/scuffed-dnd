# CR-20 — Equipment-slot CRUD exists twice, and both copies are mounted on the same page

**Severity:** High · **Area:** config components (items) · **Type:** duplicate code / UX bug

## Summary

The entire equipment-slot management flow (form, dialog state, add/edit/delete/save) is
implemented independently in `useItemManager` **and** `useEquipmentSlotManager`, and both are
live: `/config/items` mounts `ItemsConfigPanel` and `EquipmentSlotsConfigPanel` on the same page,
so the user sees two "Add Equipment Slot" buttons, two `EquipmentSlotFormDialog` mounts, and two
slot lists for one entity. `ItemsConfigPanel` additionally re-implements the slot card inline
instead of using the existing `EquipmentSlotCard`.

## Evidence

- `src/components/config/items/useItemManager.ts:24-28, 41-44, 58-64, 134-176` — the duplicated
  slot CRUD inside the item manager.
- `src/components/config/items/useEquipmentSlotManager.ts` — the dedicated (and complete)
  implementation, using the shared card and `ConfigEmptyState`.
- `src/routes/config/items.tsx` — mounts both panels.
- `src/components/config/items/ItemsConfigPanel.tsx:79-122` — inline slot card duplicating
  `EquipmentSlotCard.tsx`.

## Impact

Two divergence-prone copies of one flow; double dialogs on one page; any slot-rule change must be
made twice or the two UIs disagree. This is the largest single block of live duplicated feature
code in the repo.

## Suggested direction

Strip the slot half out of `useItemManager` and `ItemsConfigPanel` (keep at most a read-only
"define slots first" prerequisite note linking down the page). `EquipmentSlotsConfigPanel`
already does the job correctly.
