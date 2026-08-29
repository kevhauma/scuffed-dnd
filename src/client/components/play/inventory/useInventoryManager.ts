/**
 * Inventory Manager Hook
 *
 * Owns the store selectors and every inventory handler for one character: what is in each
 * equipment slot, what is carried loose, and which of the configuration's items can go where.
 * The panel renders; this decides.
 *
 * Slot-type validation is enforced by the store actions (Requirement 12.3). The `fitsSlot` filter
 * here only decides what to *offer* — it is a convenience, not the rule.
 *
 * **What a slot and a pack hold is a `ComposedItem.id` since TICKET-INV-05** (v4 systems/12), so
 * every row here resolves *twice*: the id names one of the character's builds, and that build names
 * the template the panel spells. The rows the panel draws are otherwise unchanged, deliberately —
 * the **derived display phrase** (*Iron Ore 10 Battleaxe with Diamond 4 inlay*) and the Backpack that
 * lists what is built-but-not-worn are TICKET-INV-06's, and this ticket is the shape underneath them.
 *
 * **Validates: Requirements 12.1, 12.2, 12.4, 12.5, 12.6, 21.1-21.5; v4 systems/12**
 */

import type { ComposedItem } from '#shared/types/character';
import type { EquipmentSlotPlacement, Item } from '#shared/types/config';
import { selectCharacter, useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';

/**
 * One equipment slot with its occupant resolved
 */
export interface EquipmentSlotEntry {
  type: string;
  name: string;
  /** What is worn in this slot, or `null` when it is empty (Requirement 12.1) */
  equipped: CarriedBuild | null;
  /** Carried builds this slot will accept, for the "equip" control */
  candidates: CarriedBuild[];
  /**
   * Where the ruleset puts this slot on the figure, or absent when it is unplaced.
   *
   * Carried straight through from the configuration rather than derived here: since TICKET-INV-03
   * the arrangement is the User's, made in the equipment builder, and play mode only reads it.
   */
  placement?: EquipmentSlotPlacement;
}

/**
 * One of the character's builds, with the template it was built from resolved
 *
 * The pair rather than either alone, because the two answer different questions and every control
 * needs both: the **id** is what an equip or a drop names, and the **template** is what the row is
 * spelled and slot-matched by. `build` is carried whole rather than reduced to an id so that
 * TICKET-INV-06 can read its material and inlay links for the display phrase without this hook
 * growing a third field per row.
 */
export interface CarriedBuild {
  build: ComposedItem;
  /** The template the ruleset still defines, or `null` when it has been deleted under the Player */
  item: Item | null;
}

/**
 * A carried build, with the one thing the pack row needs beyond the build itself
 *
 * **The position is not part of it any more** (TICKET-INV-05). `miscItems` held catalog ids, so the
 * same id could appear twice and an index was the only identity a row had; a build's id *is* its
 * identity, so `InventoryPanel` keys on `build.id` and nothing read the index. It survived one draft
 * as a field whose own doc claimed it was the React key it had stopped being — which `fallow` cannot
 * catch, since it does not see interface members.
 */
export interface MiscItemEntry extends CarriedBuild {
  /**
   * The slot this build's template declares, or `null` when it is not equippable (Req 12.4)
   *
   * The one derived field, and the reason this is still a type of its own rather than a bare
   * {@link CarriedBuild}: the row *renders* it, and deciding it here is what keeps the component
   * free of `item?.equipmentSlotType ?? null`.
   */
  slotType: string | null;
}

export function useInventoryManager(characterId: string) {
  const config = useConfigStore((state) => state.config);
  // Wherever it lives (TICKET-PLY-01) — a character at a table is not in the browser's own list,
  // and the pack is one of the things a Player moves things in and out of at one
  const character = useCharacterStore((state) => selectCharacter(state, characterId));

  const moveItemToMisc = useCharacterStore((state) => state.moveItemToMisc);
  const moveItemToEquipment = useCharacterStore((state) => state.moveItemToEquipment);
  const addMiscItem = useCharacterStore((state) => state.addMiscItem);
  const removeMiscItem = useCharacterStore((state) => state.removeMiscItem);

  const items = config?.items ?? [];
  const builds = character?.inventory.composedItems ?? [];

  /**
   * What an inventory id resolves to — the build, and the template behind it
   *
   * `null` covers both dangling cases at once: an id no build of this character's carries, and a
   * build whose template the ruleset has deleted. Neither is renderable, and the engine grants
   * nothing for either, so the panel draws an empty slot rather than a row it cannot label.
   */
  const findBuild = (composedId: string): CarriedBuild | null => {
    const build = builds.find((candidate) => candidate.id === composedId);
    if (!build) return null;

    const item = items.find((candidate) => candidate.id === build.templateId) ?? null;

    return { build, item };
  };

  const miscItemIds = character?.inventory.miscItems ?? [];

  const slots: EquipmentSlotEntry[] = (config?.equipmentSlots ?? []).map((slot) => {
    const equippedId = character?.inventory.equippedItems[slot.type];
    const equipped = equippedId === undefined ? null : findBuild(equippedId);

    const carried = miscItemIds.map(findBuild);
    const candidates = carried.filter(
      (entry): entry is CarriedBuild =>
        entry !== null && entry.item?.equipmentSlotType === slot.type
    );

    return {
      type: slot.type,
      name: slot.name,
      equipped,
      candidates,
      ...(slot.placement ? { placement: slot.placement } : {}),
    };
  });

  const miscItems: MiscItemEntry[] = miscItemIds.flatMap((composedId) => {
    const carried = findBuild(composedId);
    if (!carried) return [];

    return [{ ...carried, slotType: carried.item?.equipmentSlotType ?? null }];
  });

  const handleEquip = (equipmentSlotType: string, composedId: string) => {
    if (!character || !config) return;

    // The store owns both the move and the slot-type rule
    moveItemToEquipment(character.id, composedId, equipmentSlotType, config);
  };

  const handleUnequip = (equipmentSlotType: string) => {
    if (!character) return;

    // "Unequip" puts the build back in the pack rather than destroying it
    moveItemToMisc(character.id, equipmentSlotType);
  };

  /**
   * Build one of the ruleset's templates into the pack
   *
   * Takes an `Item.id` — the only handler here that still speaks the catalog's language, because it
   * is the only one that creates something. Picking the **material and inlay tiers** to build it
   * from is TICKET-INV-06's three-column builder; until then a build names a template and nothing
   * else, which is a rope.
   */
  const handleAddItem = (itemId: string) => {
    if (!character || !config || !itemId) return;

    addMiscItem(character.id, itemId, config);
  };

  /**
   * Put one build down for good
   *
   * **Exactly the one named, where this used to take every copy** (TICKET-INV-05). The pack held
   * catalog ids with no quantities, so two of a thing were indistinguishable and removing one
   * removed both; a build has its own identity, so this drops the row the Player clicked.
   */
  const handleRemoveItem = (composedId: string) => {
    if (!character) return;

    removeMiscItem(character.id, composedId);
  };

  return {
    hasCharacter: character !== null,
    slots,
    /** The grid the ruleset arranges its slots on, or `undefined` when it has never been laid out */
    equipmentLayout: config?.equipmentLayout,
    miscItems,
    /** Everything the ruleset defines, for the "add to inventory" picker */
    availableItems: items,
    handleEquip,
    handleUnequip,
    handleAddItem,
    handleRemoveItem,
  };
}
