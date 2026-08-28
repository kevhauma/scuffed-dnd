# TICKET-INV-06 — The item builder and the Backpack

- **Area:** Inventory & equipment (play mode)
- **Type:** Feature
- **Traceability:** System [12 · Item composition](../systems/12-item-composition-and-backpack.md)
  (gaps 3, 4); the sheet's `Background Item selecter` and `Backpack` tabs. **Needs
  TICKET-INV-05** (the composed record it writes).

## User story

As a Player, I want to build an item by picking a template, a material tier and an inlay tier —
and see my unequipped builds in my Backpack — so crafting works the way the sheet's Item selecter
does.

## Description

The User-facing answer to the sheet's three-column picker: a builder flow that writes a composed
record into the character's inventory, the derived display phrase that names it, and the Backpack
list the sheet derives as "built but not worn". Building is a **player action** — a store action
locally, the existing player-action route on the server.

## Current situation (as-is)

- TICKET-INV-05 gives composed records and their arithmetic a home, but nothing creates one — the
  inventory surface
  ([InventoryPanel.tsx](../../../src/client/components/play/inventory/InventoryPanel.tsx),
  [useInventoryManager.ts](../../../src/client/components/play/inventory/useInventoryManager.ts),
  TICKET-INV-01) equips catalog items only.
- No display phrase exists; nothing renders a composed item's name.
- Player actions flow through
  [playerActions.ts](../../../src/shared/services/playerActions.ts) called by existing routes
  (overview [D2](../overview.md#d2--the-backend-does-not-change)'s surface).

## Desired result (to-be)

- **The builder flow**: pick template, material + tier, inlay + tier (or none) → a composed
  record in the character's inventory, through a shared-service action the local store and the
  existing player-action route both call. Invalid picks (missing tier, Zircon 10) are refused
  with the reason, not clamped.
- **The derived name, never stored**: `<Material N> <Template> with <Inlay N|empty> inlay`,
  rebuilt from the links every render — renaming a material relabels every item made of it. The
  sheet's `with empty inlay` suffix is mirrored; its double-space quirk is not.
- **The Backpack**: the inventory surface lists composed items *not currently equipped* (derived,
  exactly the sheet's `FILTER`), and equip/unequip moves them between the ruleset's slots and the
  bag.

## Acceptance criteria

- [ ] Building writes exactly one composed record via the store action / player route; the server
      refuses a malformed triple (unknown ids, out-of-range tiers) with the same shared rule the
      client uses.
- [ ] The display phrase derives from the current links — rename the material, watch the label
      move — component + engine tests; no `name` field on the record.
- [ ] The Backpack shows built-but-not-worn only; equipping moves the row out, unequipping moves
      it back — pinned both ways.
- [ ] A family's absent tier is not offered by the picker and a direct request for it is refused
      naming the gap (TICKET-INL-01's absent-tier rule surfacing here; Zircon 10 is the row the
      data pass will make real).
- [ ] Feature components compose `components/ui` primitives; theme tokens only; persistence
      through store actions.
- [ ] Unit tests cover: the build action's validation, the derived phrase (with and without
      inlay), the Backpack filter, and equip/unequip round-trips.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser check of build → backpack → equip → stats moving (ask the User
      first).

## Notes

- Whether a Player can *discard* a composed item, and whether the DM's inventory controls
  (TICKET-DM-02) see composed records, are surface questions this ticket answers in passing —
  the smallest honest answer wins; note what is deferred.
- The sheet's 18 `empty` selecter rows are capacity theatre — the app needs no fixed row count.
