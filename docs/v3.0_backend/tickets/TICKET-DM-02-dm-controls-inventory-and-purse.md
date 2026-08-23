# TICKET-DM-02 — DM controls: inventory and purse

- **Area:** Dungeon Master controls
- **Type:** Feature
- **Traceability:** v3 [Req 42.5–42.7](../requirements.md#requirement-42-dungeon-master-controls)

## User story

As a DM, I want to put the sword in their pack and the payment in their purse, so that loot and
rewards land on the sheet instead of in a note.

## Description

The second half of the DM's powers: the things a table hands out. It needs CUR-02's purse to exist,
and it reuses PLY-01's inventory rules wholesale rather than granting the DM a bypass — a DM adding
an item still cannot put a helmet in a boot slot.

It also closes the DM surface with the visibility rule: a Player must be able to see what was done
to their sheet.

## Current situation (as-is)

- All six inventory actions go through one `patchInventory` helper, and returning the inventory
  unchanged is how an action declines. `equipItem`/`moveItemToEquipment` refuse any item whose
  `Item.equipmentSlotType` does not equal the target slot, including an item with no slot type
  (Req 12.3).
- PLY-01 moved those to the server behind `requireCharacterWriter` and wrote Events for each.
- CUR-02 added `Character.purse?` with refuse-don't-clamp on a negative balance.
- DM-01 established the DM routes, the `requireDM` guard and the Event-naming convention.

## Desired result (to-be)

- DM routes to add and remove inventory items and to set or adjust the purse on any Character in
  the session — reusing PLY-01's Kernel checks and CUR-02's refusal, with no DM-only relaxation of
  either.
- Every adjustment writes an Event naming the DM, the Character and the before/after values, the
  same shape DM-01 established.
- A Player-facing feed of the adjustments that changed their own sheet, so a DM's action is visible
  rather than a number that moved on its own.

## Acceptance criteria

- [ ] A DM adds an item to a player's misc storage and equips one into a matching slot; a mismatched
      slot is refused for the DM exactly as for the Player.
- [ ] A DM sets and adjusts the purse; a change taking it negative is refused with the shortfall
      named.
- [ ] An item the Snapshot does not define is refused, for the DM as for the Player.
- [ ] Every DM adjustment writes one Event with before/after; the Player reads the Events affecting
      their character and sees who made each change.
- [ ] A `player` Member calling these routes on someone else's character is refused; on their own
      character they are routed through PLY-01's own-character routes, not these.
- [ ] The DM panel renders from `components/ui/` primitives on theme tokens and is absent entirely
      for a non-DM — not present and disabled.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check with two accounts (ask the User first).

## Notes

- **No DM bypass of the ruleset's own rules**, and this is the ticket where that gets decided. A DM
  who needs a helmet in a boot slot should change the ruleset, not the enforcement — otherwise the
  Snapshot stops describing what the table is actually playing, and every derived number quietly
  stops being trustworthy.
- Absent-for-a-non-DM rather than present-and-disabled: a disabled control still tells a Player the
  power exists and invites a request to use it. It also tends to become a bug where the disable is
  client-side only — which the server guard covers, but the surface should not need it to.
- **TICKET-DM-03 turns these controls and DM-01's into quick actions**, so the routes landing here
  are the ones a DM will actually press dozens of times a session. Keep each one a named intent with
  a clean refusal — a quick action is only safe to put behind one press because the route behind it
  refuses properly.
- The Player-facing feed is the first read of Events by a non-DM and is a natural precursor to
  LIVE-02's fan-out. Query it by `(session, character)` over the same `(session, seq)` index
  ROLL-07 built.
