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

## Implementation notes (2026-08-29)

Three decisions this build made, each answering a question the ticket or TICKET-INV-05 left open.
They amend the criteria below rather than sitting beside them.

**1. The Backpack is derived, and `Inventory.miscItems` is deleted.** The to-be said *derived,
exactly the sheet's `FILTER`*, and INV-05 handed the choice over explicitly: deriving the bag as the
complement of `equippedItems` over `composedItems` changes the rule its `Inventory` doc states. It
was taken. `miscItems` was a **stored derivation** — precisely `composedItems − worn`, maintained by
hand in five separate actions, one of which INV-05's own review caught leaving a build in neither
place — and *derived values are computed, never stored* is the first hard rule in
[CLAUDE.md](../../../CLAUDE.md). Deleting it removes the failure mode instead of guarding it. Cost:
a one-line fixture edit in 45 files. Under [D6](../overview.md#d6--no-backwards-compatibility-v40-is-a-clean-break-user-2026-08-29)
this needs no conversion and **no second `SUPPORTED_SCHEMA_VERSION` bump** — 10 stands, and a stored
document still carrying `miscItems` is read as a field nothing reads, with every build it named in
the bag.

**2. `wear-item` and `stow-item` are retired** (`PLAYER_ACTION`, two route modules, two store
actions). This is the API-surface question INV-05 deferred here, and the derived Backpack answers it:
*wear* and *equip* were already one implementation, and *stow* and *unequip* were separated only by
which stored list the build landed in. Four intents for two acts became one intent per act — build
it, put it on, take it off, throw it away. **`unequip-item` no longer destroys the build** (that was
its behaviour, while `stow-item` kept it — a distinction no Player reading the two words would
predict); destruction is `drop-item`, which now refuses a build that is being worn.

**`take-item` was renamed `build-item` in the same breath** (the review's finding, taken). Retiring
two values while keeping a third whose *meaning* had changed would have been the exact failure the
retirements were for: `take-item` meant *put a template in the pack*, and the act it names now is
*build three picks into one thing*. Two `event` rows sharing one `type` string and meaning two acts
is unreadable in a way a missing string never is. `routes/play/takeItem.ts` → `buildItem.ts` went
with it, and the Kernel rule became **`composeBuild`** so the store action could hold the act's name
— `equipItem`/`equipToSlot`, `unequipItem`/`unequipSlot`, `discardItem`/`discardBuild`,
`buildItem`/`composeBuild`. The first draft had the store action and the Kernel rule both spelled
`buildItem`, which `fallow` cannot catch because a Zustand action is an object property rather than
an export; that is now written down in `playerActions.ts`' header.

**3. A Player can discard**, which the Notes asked for the smallest honest answer to: `discardBuild`
destroys an unworn build and refuses a worn one with *take it off first*. The DM's inventory controls
(TICKET-DM-02) are **not** touched — still deferred, and now with one fewer collection to reach.

## Acceptance criteria

- [x] Building writes exactly one composed record via the store action / player route; the server
      refuses a malformed triple (unknown ids, out-of-range tiers) with the same shared rule the
      client uses. (`composeBuild` in
      [playerActions.ts](../../../src/shared/services/playerActions.ts) is the one rule; the browser
      calls it through `useCharacterStore.buildItem` and the server through
      [buildItem.ts](../../../src/server/routes/play/buildItem.ts). Proven at all three levels:
      `playerActions.test.ts` *"mints the build and leaves it in the Backpack"* and its five refusal
      cases, `characterStore.test.ts` *"should mint a build out of the three picks"*, and
      `play.test.ts` *"refuses a triple with no material and one naming a rung the family lacks"* —
      the last a request the UI cannot make.)
- [x] The display phrase derives from the current links — rename the material, watch the label
      move — component + engine tests; no `name` field on the record.
      (`composedItemLabel` in [composedItems.ts](../../../src/shared/engine/composedItems.ts);
      `composedItems.test.ts` *"spells the sheet's own concatenation"* → `Iron Ore 10 Battleaxe with
      Diamond 4 inlay`, *"moves when the material is renamed"*, *"writes 'with empty inlay' for an
      unsocketed build"* and *"carries one space… not the sheet's two"*. Component half:
      `InventoryPanel.test.tsx` *"should relabel every build made of a material when the material is
      renamed"*. `ComposedItem` still has no `name` field.)
- [x] The Backpack shows built-but-not-worn only; equipping moves the row out, unequipping moves
      it back — pinned both ways. (`backpackOf` — the sheet's `FILTER` — with no stored list behind
      it. `composedItems.test.ts` *"is everything built and not worn"*; `playerActions.test.ts`
      *"rounds a build out of the bag and back again"*; `play.test.ts` *"takes a slot occupant off
      and back on"*; `InventoryPanel.test.tsx` *"should move a build from a slot back to the Backpack
      and in again"*.)
- [x] A family's absent tier is not offered by the picker and a direct request for it is refused
      naming the gap (TICKET-INL-01's absent-tier rule surfacing here; Zircon 10 is the row the
      data pass will make real). ([PartPicker.tsx](../../../src/client/components/play/inventory/PartPicker.tsx)
      builds its tier list from the stored rows, sorted by rung number — `InventoryPanel.test.tsx`
      *"should offer only the rungs a family actually has"*. The refusal is `inlayRefusal` /
      `materialRefusal`: `playerActions.test.ts` *"refuses the rung a family skips — the sheet's
      Zircon 10"* asserts the exact sentence `Zircon has no tier 10.`, and `play.test.ts` asserts the
      same shape through the route.)
- [x] Feature components compose `components/ui` primitives; theme tokens only; persistence
      through store actions. (`ItemBuilder`, `PartPicker` and `BackpackRow` compose `Select`,
      `Label`, `Button`, `Text`; the only colours used are `stone-200` and the `Text` variants' own.
      No component calls storage: the panel's writes all go through `useInventoryManager`, which
      calls `useCharacterStore`. `yarn run arch` clean.)
- [x] Unit tests cover: the build action's validation, the derived phrase (with and without
      inlay), the Backpack filter, and equip/unequip round-trips. (+25 tests overall.
      `src/shared/engine/composedItems.test.ts` is new — 14 cases, the phrase and the partition;
      `playerActions.test.ts` gained the `building a thing` describe; `InventoryPanel.test.tsx`
      gained the builder, the phrase, the rung list and the round trip; `play.test.ts` gained the
      route-level build refusals and the discard rule.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, ~~plus a live browser check of build → backpack → equip → stats moving (ask the User
      first)~~. (`npx vitest run` 3448 passing / 201 files / 0 failing / 0 skipped;
      `npx tsc --noEmit` at the documented 2-error baseline; `yarn run check` clean;
      `fallow audit --base main` **pass**, 0 introduced dead code, 0 introduced duplication, and the
      one introduced complexity finding — `ItemBuilder` at cyclomatic 13 / cognitive 20 — split into
      `PartPicker` before closing, after which the audit reports none. `fallow dead-code` reports two
      issues, both inherited (`RulesetHomeKind` from RUL-02, and the `fallow` dependency itself). The
      **coding-conventions** skill was followed through the build; the `conventions-reviewer` pass
      over the diff is the calling session's, before the commit. **The browser check was skipped by
      User instruction for this run** — build → backpack → equip → stats moving is unverified live,
      though `InventoryPanel.test.tsx` renders the whole `CharacterSheet` and reads the Strength
      value back out for the equip half of it.)

## Notes

- Whether a Player can *discard* a composed item, and whether the DM's inventory controls
  (TICKET-DM-02) see composed records, are surface questions this ticket answers in passing —
  the smallest honest answer wins; note what is deferred. **Answered in implementation note 3:
  discard yes, DM controls still deferred.**
- The sheet's 18 `empty` selecter rows are capacity theatre — the app needs no fixed row count.
  **Not reproduced** — the builder is one row and a Player builds as many things as they build.

## What this owes the data pass (D7)

Nothing of its own. The builder's columns are the ruleset's `materials`, `inlays` and `items`, all
three of which the data pass fills; a ruleset with no materials gets *"This ruleset defines no
materials, so there is nothing to build things out of yet"* rather than a dead form. The one row this
ticket names by hand is **Zircon's missing tenth tier** — used here as a fixture, real in the corpus
once TICKET-MAT-03 / the inlay catalog land.
