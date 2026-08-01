# TICKET-INV-01 — Inventory panel on the character sheet, with slot-type validation

- **Area:** Inventory
- **Type:** Feature (carries a bug fix — `equipItem` accepts any item in any slot)
- **Traceability:** Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 13.1, 13.2, 13.3, 13.5, 21.1-21.5
- **Replaces plan items:** tasks.md §12.4, §14.1

## User story

As a Player, I want to equip and carry the items my ruleset defines, so that my gear changes the
numbers on my character sheet.

## Description

The character sheet renders every derived number but a character can never own anything — nothing
in the app writes to `Inventory`. This ticket adds the inventory panel to the sheet: a slot per
configured equipment slot, a miscellaneous list, and moves between them, with the item's declared
slot type actually enforced.

## Current situation (as-is)

- [`useCharacterStore`](../../../src/stores/characterStore.ts) already has `equipItem`,
  `unequipItem`, `addMiscItem`, `removeMiscItem`, `moveItemToMisc` and `moveItemToEquipment`, all
  persisting via `autoSave`. **None of the six has a caller anywhere in `src/`.**
- **Bug:** `equipItem(characterId, equipmentSlotType, itemId)` and `moveItemToEquipment` write the
  item id into `inventory.equippedItems[equipmentSlotType]` with no check that
  [`Item.equipmentSlotType`](../../../src/types/config.ts) matches the target slot — a helmet can be
  equipped in the main hand, and an item with no `equipmentSlotType` at all can be equipped
  anywhere. Requirement 12.3 therefore has to be enforced in the **store action**, not only in the
  panel, which is the note carried on the overview line.
- `Inventory.equippedItems` is `Record<equipmentSlotType, itemId>`
  ([`character.ts`](../../../src/types/character.ts)), so a slot holds at most one item; `miscItems`
  is a flat `itemId[]` that may hold duplicates.
- Equipment bonuses are already fully solved and read at render time:
  [`calculateEquipmentBonuses`](../../../src/engine/calculators/equipmentBonusCalculator.ts)
  aggregates the material bonuses of every equipped item, and `calculateCharacter` folds them into
  main, speciality and combat skills. The sheet already displays them as a separate `equipment`
  contribution ([TICKET-CHAR-03](./TICKET-CHAR-03-character-sheet.md)). **So plan §14.1 needs no new
  calculation** — it needs the equip action to exist and a test proving the sheet's numbers move.
- The sheet is [`CharacterSheet.tsx`](../../../src/components/play/sheet/CharacterSheet.tsx), whose
  sections take props and whose decisions live in
  [`useCharacterSheet`](../../../src/components/play/sheet/useCharacterSheet.ts).
- `config.items` may reference a `materialId` + `materialLevel`; the material level's `bonuses` are
  what a bonus actually is. An item with no material contributes nothing but is still carryable.

## Desired result (to-be)

- An `InventoryPanel` under `src/components/play/inventory/` renders on the character sheet:
  - one entry per configured equipment slot, showing the equipped item or that the slot is empty
    (Req 12.1);
  - a miscellaneous list of everything carried but not equipped (Req 12.4);
  - controls to equip from misc, unequip to misc, add an item to misc, and remove an item entirely
    (Req 12.2, 12.5, 12.6).
- **Slot-type validation lives in the store** (Req 12.3): `equipItem` and `moveItemToEquipment`
  refuse an item whose `equipmentSlotType` does not equal the target slot, and refuse an item with
  no `equipmentSlotType`. The panel additionally only offers items that fit, so the refusal is a
  guard rather than the primary UX.
- Equipping or unequipping changes the sheet's numbers on the next render, with no recalculation
  code added anywhere (Req 13.1, 13.2, 13.3, 13.5).
- Assignment is done with explicit controls rather than drag-and-drop — see Notes.
- All persistence goes through the store actions; the panel and its hook never touch
  `localStorage`.

## Acceptance criteria

- [x] The sheet renders an inventory panel showing every equipment slot the configuration defines,
      each either holding one item or shown as empty (Req 12.1). ([`InventoryPanel.tsx`](../../../src/components/play/inventory/InventoryPanel.tsx), mounted between the stats and speciality sections of [`CharacterSheet.tsx`](../../../src/components/play/sheet/CharacterSheet.tsx). Test *"should render one row per configured equipment slot, each empty"* — both `Helmet` and `Main Hand` render, the helmet row reading `Empty`.)
- [x] A Player can equip an item into a matching slot and the sheet shows it there (Req 12.2). (Test *"should equip a carried item into its matching slot"* — choosing `helm` in the helmet control leaves `equippedItems.helmet === 'helm'`, an empty pack, and `Iron Helm` rendered in the row.)
- [x] The store refuses to equip an item whose `equipmentSlotType` does not match the target slot,
      and refuses an item with no `equipmentSlotType` — proven by a store-level test that calls the
      action directly, not only through the UI (Req 12.3). `moveItemToEquipment` is guarded the same
      way. (`fitsSlot(itemId, slotType, config)` in [`characterStore.ts`](../../../src/stores/characterStore.ts) — a strict equality against the item's declared type, so a mismatched item, a typeless item and an item the ruleset does not define are all refused by one check. Guards both `equipItem` and `moveItemToEquipment`. Store tests call the actions directly: *"should refuse an item whose slot type does not match"* (and asserts `saveCharacters` was **not** called), *"should refuse an item that declares no slot type"*, *"should refuse an item the configuration does not define"*, plus the same mismatch test on `moveItemToEquipment`. The panel additionally only offers items that fit — test *"should only offer carried items that fit the slot"* asserts the blade and rope are absent from the helmet control and the rope is absent from the main-hand one.)
- [x] Items without an equipment slot type are carryable in the miscellaneous list (Req 12.4). ([`MiscItemRow.tsx`](../../../src/components/play/inventory/MiscItemRow.tsx). Test *"should carry an item that declares no equipment slot type"* — the rope renders in the pack marked `no slot`.)
- [x] A Player can move an item from a slot to miscellaneous and back (Req 12.5). (Test *"should move an item from a slot back to the pack and in again"* asserts the full round trip on the store's state: slot empty + pack `['helm']`, then slot `helm` + pack empty.)
- [x] A Player can remove an item from the inventory entirely (Req 12.6). (Test *"should remove a carried item from the inventory"* — `miscItems` is empty afterwards.)
- [x] Equipping an item with material bonuses changes the affected main, speciality and combat
      values on the sheet, and unequipping restores them (Req 13.1, 13.3, 13.5) — proven by a test
      that reads rendered values before and after, with no new arithmetic added. (Test *"should raise the affected values when an item is equipped and restore them when it is not"* renders the whole `CharacterSheet`, reads Strength as `5`, equips the iron helm, reads `7` with an `equipment +2` contribution, unequips, and reads `5` again. Test *"should carry the equipment bonus through to stats and combat skills"* shows the same equip moving Health's maximum to `70` and the Melee bonus to `+7`. **No calculation code was added** — `calculateCharacter` already reads `inventory.equippedItems` at render time, which is exactly what plan §14.1 asked for.)
- [x] Bonuses from several equipped items combine additively (Req 13.2) — already the calculator's
      behaviour; assert it end-to-end through the panel. (Test *"should combine bonuses from several equipped items additively"* — iron `+2` and steel `+3` equipped together render Strength `10` and `equipment +5`.)
- [x] Persistence goes through the store actions only; no `localStorage` or `saveCharacters()` call
      in the panel or its hook. (`grep -rn "localStorage\|saveCharacters" src/components/play/inventory/` finds nothing outside the test file's `vi.mock`. Test *"should persist through the store rather than storage directly"* asserts the change lands in store state.)
- [x] The panel composes `components/ui` primitives and owns its layout; no raw HTML controls, and
      no base component gains layout styling (Req 21.1-21.5). Medieval theme tokens only. (`Card`, `Text`, `Button`, `Select` throughout; `grep -n "<\(button\|input\|select\|textarea\)\b" src/components/play/inventory/*.tsx` returns nothing. Layout (`flex`, `gap-*`, `w-56`, `mt-*`) is passed via `className`; no file under `components/ui/` was touched. Colour and typography come from the primitives' variants; the only raw class is `border-stone-200`.)
- [x] Unit tests cover: slots rendered from the configuration; equip into a matching slot; store
      refuses a mismatched slot; store refuses an item with no slot type; misc list holds
      typeless items; slot → misc → slot round trip; remove; sheet values change on equip and
      revert on unequip; two items' bonuses combine. (+16 tests: `InventoryPanel.test.tsx` (11 — 8 panel, 3 equipment-bonus) and 5 added to `characterStore.test.ts`. Suite: **587 passing, 0 failing, 0 skipped** (was 571).)
- [x] Verified via the fallow skill and the coding-conventions skill. (`fallow audit --base HEAD` → `"verdict": "pass"` with **0 introduced findings of every kind**. Two were fixed rather than suppressed: `MiscItemEntry` was exported but consumed nowhere (the misc row became its own `MiscItemRow` component, which imports it — better structure than deleting the export), and the new slot guard duplicated `moveItemToEquipment`'s body (all six inventory actions now go through one `patchInventory(set, get, characterId, update)` helper). That refactor also cleared the store's **two pre-existing** clone groups, so inherited duplication went 2 → 0. `npx tsc --noEmit` at the documented 9; `yarn run lint` at the documented 35 errors with warnings down 23 → 22.)
- [ ] Verified live in the browser: equip an item on a character and watch a main skill and a combat
      bonus change, then unequip and watch them revert. — **left open at the User's request**
      (2026-08-01: "don't browser check"). The equip → recalculate → unequip cycle is covered by
      the three sheet-level tests above.

## Notes

- **Drag-and-drop is deliberately not built.** Plan §12.4 says "drag-and-drop assignment", but the
  app has no drag library and adding one is a new runtime dependency, which needs the User's
  agreement. Explicit equip/unequip controls satisfy every acceptance criterion in Requirement 12 —
  12.2 says "assign", not "drag". If the User wants drag-and-drop, it is an additive follow-up over
  the same store actions. **Say so if you want it.**
- Where does an item come from? There is no shop or loot system in v1.0, so the panel needs a way to
  add any configured item to the character. Keep it plain: pick from the configuration's item list
  and it lands in miscellaneous.
- `miscItems` is a flat array that can hold the same item id twice, and `removeMiscItem` filters by
  id, so removing one of two identical items removes both. Left as-is: quantities are not modelled
  in v1.0 and changing the shape is a persistence change. Note it in the panel's JSDoc rather than
  silently working around it.
- Requirement 12.3's check needs the `Configuration` to resolve the item, so the guarded actions
  take it as an argument — the same pattern `createCharacter` and `updateCurrentStatValue` already
  use.
- The combat roller ([plan §12.5](../overview.md)) also mounts into the sheet; the two tickets touch
  different sections and can land in either order.
- **Added during implementation:** `moveItemToEquipment` now swaps a displaced item back into the
  pack instead of overwriting the slot and losing it. A slot holds exactly one item, and a "move"
  that silently destroys the previous occupant is a data-loss bug — covered by the store test
  *"should swap the displaced item back into the pack rather than losing it"*. `equipItem` still
  replaces outright, which is what its existing test asserts and what "equip directly" means.
