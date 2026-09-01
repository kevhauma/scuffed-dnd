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

> **Implementation note (2026-09-01) — "misc storage" is the derived Backpack.** The first criterion
> was written before TICKET-INV-06 deleted `Inventory.miscItems`. There is no stored misc collection
> any more: the Backpack is *everything built and not worn* (`backpackOf`), so **adding an item to it
> is building one**, which is what `dm-build-item` does. The criterion is ticked against that reading
> rather than against a field that no longer exists.

- [x] A DM adds an item to a player's misc storage and equips one into a matching slot; a mismatched
      slot is refused for the DM exactly as for the Player.
      (`POST /api/characters/:id/dm-build-item` → [dmBuildItem.ts](../../../src/server/routes/dm/dmBuildItem.ts)
      and `dm-equip-item` → [dmEquipItem.ts](../../../src/server/routes/dm/dmEquipItem.ts), whose
      rules are `composeBuild` and `equipToSlot` in
      [playerActions.ts](../../../src/shared/services/playerActions.ts) — **the identical functions
      `routes/play/` calls**, which is what makes the refusal the Player's own rather than a copy of
      it. `dm.test.ts` — *builds a thing into a player's Backpack, where the DM did not own it*
      (asserted through `backpackOf` against the row read back off disk), *equips a build into the
      slot its template declares*, and *refuses a mismatched slot for the DM in exactly the sentence
      a Player gets*, which pins the wording twice — `"Test Boots does not go in that slot."` for a
      template declaring the **wrong** slot and the same sentence for one declaring **none** — and
      then asserts nothing is worn and the log holds the two builds and neither refusal.)
- [x] A DM sets and adjusts the purse; a change taking it negative is refused with the shortfall
      named.
      (`dm-set-purse` → [dmSetPurse.ts](../../../src/server/routes/dm/dmSetPurse.ts) and
      `dm-adjust-purse` → [dmAdjustPurse.ts](../../../src/server/routes/dm/dmAdjustPurse.ts), whose
      rules are CUR-02's `setPurseAmount` and `adjustPurseBy` unchanged. `dm.test.ts` — *sets what the
      character is carrying, in the base tier*, *moves a purse by a delta, so paying somebody is not
      arithmetic on a stale balance* (30 → +340 → −12 → 358), and *refuses a change that would take
      the purse negative, and names the shortfall*, which asserts the exact sentence
      `"That would leave the purse 10 short. Nothing was taken."`, the same refusal for a negative
      **total**, the balance unmoved at 30, and **one** Event for the accepted set rather than three.)
- [x] An item the Snapshot does not define is refused, for the DM as for the Player.
      (`composeBuild`'s own sentence, reached through the DM's route. `dm.test.ts` — *refuses an item
      the Snapshot does not define, for the DM as for the Player* (`"This ruleset has no such item."`,
      with zero Events written), plus *refuses a build whose metal the Snapshot has no such rung of*
      (`"Test Metal has no tier 10."`) — the second because *the ruleset decides* has to hold for the
      parts as well as for the template, or a DM could forge a thing out of a tier that does not
      exist.)
- [x] Every DM adjustment writes one Event with before/after; the Player reads the Events affecting
      their character and sees who made each change.
      (All six routes go through DM-01's `applyPlayerAction`, and `listAdjustments.ts` reads
      `Object.values(DM_ACTION)` — so the six appear in the Player's feed with no change to that
      route. `dm.test.ts` — *records the money and the pack the same way, with the before and after*,
      which drives four adjustments as the DM, reads them back **as the Player** through
      `GET /api/characters/:id/adjustments`, and asserts newest-first order, the DM's name on each,
      the purse pair's two balances, and that a build names its **template** while an equip names its
      **slot type**. The sentences are `describeAdjustment.test.ts`'s: six new cases including
      *should read a purse through the ruleset's own tiers, never as a bare stored number* and
      *should say a build was taken away without inventing a name for it*.)
- [x] A `player` Member calling these routes on someone else's character is refused; on their own
      character they are routed through PLY-01's own-character routes, not these.
      (`requireCharacterDM` on all six, which `dmRules.test.ts` proves by scanning every write module.
      `dm.test.ts` — *refuses a `player` Member the money and the pack too, on their own sheet*, which
      asserts the owner's 404 is **byte-identical** to a stranger's (v3 Req 32.5), the purse and the
      builds untouched, and zero Events; and *routes a Player to their own inventory action instead,
      which is unchanged*, which drives `routes/play/buildItem.ts` as the Player and gets a 200.
      **The purse has no player counterpart to be routed to** — v3 Req 42.5 gives money to the DM as
      Req 42.1 gives them experience — so `characterStore.refuseAtTable` is what a Player's own sheet
      meets, unchanged from CUR-02. Recorded in the implementation notes below.)
- [x] The DM panel renders from `components/ui/` primitives on theme tokens and is absent entirely
      for a non-DM — not present and disabled.
      (`DmControlsPanel` is unchanged and still drawn only behind `useDmControls().isDungeonMaster`.
      What this ticket added renders through the **existing** surfaces rather than a second copy of
      them — `PurseSection` and `InventoryPanel`, both already `Card`/`Text`/`Input`/`Label` on theme
      tokens — with `usePurseControls` and `useInventoryActs` deciding which actor's store actions
      they call. See the implementation notes for why that is the honest reading of this criterion.
      `usePurseControls.test.ts` — *gives a Player at a table nothing, because coin is handed out at
      the table*; `PurseSection.test.tsx` — *draws no entry box at all, rather than a disabled one*;
      `CharacterSheet.test.tsx` — *should show the purse and no way to edit it*.)
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check with two accounts (ask the User first).

      **Left open: the User deferred interactive browser checks for the rest of the milestone on
      2026-09-01**, exactly as TICKET-GAM-04 records. No live check was attempted and none was asked
      for. Everything else in the Definition of Done ran in full:

      **`verifier`**: `npx vitest run` **3808 passed / 0 failed / 0 skipped** across 227 files, up
      from the 3761/225 baseline in [TEST_STATUS.md](../../../TEST_STATUS.md) (+47, +2 files — the
      per-file delta is recorded there); `npx tsc --noEmit` at the documented **2-error baseline** and
      nothing else; `yarn run check` clean over 760 files, with `yarn run arch` reporting no
      dependency violations across 779 modules.

      **`fallow`**: `audit --base main` moved from **fail** to **warn** — `complexity_introduced: 0`
      and `dead_code_introduced: 0`. Both complexity findings this ticket first introduced were fixed
      rather than suppressed: `describeAdjustment` 23 cyclomatic → a `Record` lookup, and
      `useDmControls` 19 cognitive → the DM's six new handlers moved to the two surfaces that use
      them, with `useIsDungeonMaster` extracted as the predicate all three share. Both files now read
      **cooling**. Measured on the shipped tree: `describeAdjustment` **3 cyclomatic**,
      `useDmControls` **10 cognitive / 10 hooks**, `useInventoryActs` 12, `usePurseControls` 7 — all
      under the 20/15 thresholds. (The 23 and the 19 were readings on intermediate states and are not
      reproducible from the final tree; they are recorded as this build's own measurements.) `dead-code` reports nothing this
      ticket introduced; its two findings — the `fallow` dependency itself and `RulesetHomeKind` in
      `rulesetSync.ts` — are both pre-existing and in untouched files, and the second is noted as
      out-of-scope. `health --hotspots --since 6m`: four touched files come back **Accelerating** and
      each has its row in TEST_STATUS.md amended in place. The two remaining duplication groups are
      deliberate and argued below.

      **`conventions-reviewer` was not run — the User is running it.**

## Implementation notes (2026-09-01)

Six things this built that the to-be did not spell out, and one it deliberately did not build.

- **Six routes, and `shared/` gained nothing at all.** `dm-set-purse`, `dm-adjust-purse`,
  `dm-build-item`, `dm-drop-item`, `dm-equip-item`, `dm-unequip-item` — every one of them calls a
  `playerActions.ts` function that already existed, so the ticket's central note is enforced by there
  being no second implementation to diverge rather than by a rule saying there must not be.
  `dmRules.test.ts` makes that structural: its count is `Object.values(DM_ACTION).length` and it
  fails a write module that takes its rule from anywhere but the Kernel.
- **Four inventory routes rather than the two v3 Req 42.5 names.** `discardBuild` refuses a build the
  character is **wearing**, so without `dm-unequip-item` a DM could add to a pack, destroy what was
  loose in it, and do nothing about the sword in somebody's hand. The four are `PLAYER_ACTION`'s own
  four, one act each — which is also what TICKET-DM-03 needs, since a quick action is only safe
  behind one press when the route under it refuses properly.
- **The purse and the pack are reached through the Player's own surfaces, not through a second
  panel.** The sixth criterion says *the DM panel*; a purse box and an item builder redrawn onto
  `DmControlsPanel` would have been a second `PurseSection` and a second `ItemBuilder`, which is the
  duplication this codebase spends tickets removing. Instead `usePurseControls` and
  `useInventoryActs` decide *which actor's store actions* the existing cards call —
  `usePassiveHandout`'s shape, twice — so `InventoryPanel` and everything under it never learns a DM
  exists, and no prop is threaded through the doll, the slot tile and the builder. The criterion's
  substance holds unchanged: the DM panel is still primitives on theme tokens and still absent for a
  non-DM, and nothing anywhere is present-and-disabled.
- **A Player at a table now sees their purse read-only, where the card used to be absent.** That was
  right while nobody at a table could change a purse and wrong the moment the DM could: *"the payment
  lands on the sheet instead of in a note"* is not satisfied by a number the Player cannot see. An
  amount with no entry box is a **display**, not the present-and-disabled *control* the sixth
  criterion rejects, and it is the optional-handler shape `SheetHeader` already uses for the
  experience controls it withholds. The card says who does change it, so the missing box reads as a
  rule of the table rather than as something that failed to render.
- **`adjustmentNames.ts` became `adjustmentVocabulary.ts`.** The log needed the purse spelled the way
  the purse card spells it — `formatPurse` decides the display tier every render (v3 Req 43.2), so a
  log reading *"30 → 42"* beside a card reading *"4 Gold"* would be the app disagreeing with itself
  about what somebody is carrying. Resolving the phrase in the module that already turns stored ids
  into what a reader sees kept `describeAdjustment`'s parameter count where it was and gave
  `AdjustmentLog` no third prop. The module's docblock claim that *every key here is a UUID* is
  **amended**: an `EquipmentSlot.type` is a slug the User writes, so the claim is now *the key spaces
  cannot collide*, which holds.
- **`describeAdjustment` and `useDmControls` were both restructured because `fallow` said so.** The
  first hit 23 cyclomatic at fourteen `switch` cases and is a `Record<DmAction, …>` lookup now — a
  *stronger* exhaustiveness check than the `never` it replaced, since a retired action is a compile
  error too. The second hit 19 cognitive with fourteen handlers on it. **The first answer to that was
  wrong and the review caught it**: a second *bundle* (`useDmBelongings`) holding the other six, which
  no caller wanted whole — `usePurseControls` uses two of them and `useInventoryActs` uses four, so
  each would have subscribed to writes it never makes, which is a smaller copy of the very defect the
  split was for. What shipped instead is **a surface takes the actions it uses**: the six live on the
  two hooks that use them, and `useIsDungeonMaster` is extracted because the *predicate* — not a bag
  of handlers — is what all three genuinely share. Both files come back **cooling**, and the shipped
  readings are in the Definition-of-Done note above.
- **`dm-drop-item` names nothing, deliberately.** Its `target` is a `ComposedItem.id` for a build that
  stopped existing in the very act the row records, so no lookup on the ruleset or the character can
  resolve it. The log says *"Took an item out of the pack"*; inventing a name would be worse than the
  honest sentence, and `describeAdjustment.test.ts` asserts the id does not leak into it.

**What was deliberately not built: a player route to the purse at a table.** v3 Req 42.5 gives money
to the DM the way Req 42.1 gives them experience, so `characterStore.refuseAtTable` still refuses a
Player's own `setPurse` there and this ticket added nothing to change that. The fifth criterion's
*"on their own character they are routed through PLY-01's own-character routes"* therefore applies to
the **pack** — where a player route exists and is untouched — and not to the purse, where there has
never been one.

`fallow` reports **two duplication groups**, both introduced and both deliberate, on DM-01's stated
reasoning: `routeGuards.test.ts` and `dmRules.test.ts` both scan a *module* for a guard **call site**,
so one route per file is what makes those checks possible at all, and merging
`dmBuildItem`/`buildItem` or `dmEquipItem`/`equipItem` would trade a real check for a dozen lines.
PLY-01 accepted the same shape eleven times. What was **not** duplicated is the one thing that could
have been: `partsFrom` moved out of `routes/play/buildItem.ts` into `playPayloads.ts`, so the two
build routes read one body rather than two copies of one.

**A third group dissolved when the review's third finding was applied.** `dmSetPurse` /
`dmAwardExperience` / `dmDeductExperience` were reported as a clone until all six new routes bound
`characterId` before handing it to `requireCharacterDM` — the no-nested-call rule, which
`dmSetDreamLevel` and the two passive routes in the same folder already followed. Obeying the rule
broke the clone, which is the useful part: the named intermediate is what makes each prologue about
*this* route rather than an identical incantation.

**Nothing in `docs/imports/` changed**, and the rule was checked rather than skipped: no
`Configuration` entity is added or reshaped, and `Character.purse` and `Character.inventory` both
already exist with the shapes CUR-02 and INV-06 gave them. No `SUPPORTED_SCHEMA_VERSION` bump, and
none owed.

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
