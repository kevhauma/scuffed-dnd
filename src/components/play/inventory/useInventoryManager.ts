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
 * **Validates: Requirements 12.1, 12.2, 12.4, 12.5, 12.6, 21.1-21.5**
 */

import { useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';
import type { Item } from '../../../types/config';

/**
 * One equipment slot with its occupant resolved
 */
export interface EquipmentSlotEntry {
  type: string;
  name: string;
  /** The equipped item, or `null` when the slot is empty (Requirement 12.1) */
  item: Item | null;
  /** Carried items this slot will accept, for the "equip" control */
  candidates: Item[];
}

/**
 * A carried item, positioned by index because `miscItems` may hold the same id twice
 */
export interface MiscItemEntry {
  /** Index in `inventory.miscItems` — the identity the list uses, since ids can repeat */
  index: number;
  item: Item | null;
  /** The slot this item declares, or `null` when it is not equippable (Requirement 12.4) */
  slotType: string | null;
}

export function useInventoryManager(characterId: string) {
  const config = useConfigStore((state) => state.config);
  const characters = useCharacterStore((state) => state.characters);

  const moveItemToMisc = useCharacterStore((state) => state.moveItemToMisc);
  const moveItemToEquipment = useCharacterStore((state) => state.moveItemToEquipment);
  const addMiscItem = useCharacterStore((state) => state.addMiscItem);
  const removeMiscItem = useCharacterStore((state) => state.removeMiscItem);

  const character = characters.find((candidate) => candidate.id === characterId) ?? null;

  const items = config?.items ?? [];
  const findItem = (itemId: string): Item | null =>
    items.find((item) => item.id === itemId) ?? null;

  const miscItemIds = character?.inventory.miscItems ?? [];

  const slots: EquipmentSlotEntry[] = (config?.equipmentSlots ?? []).map((slot) => ({
    type: slot.type,
    name: slot.name,
    item: character ? findItem(character.inventory.equippedItems[slot.type] ?? '') : null,
    candidates: miscItemIds
      .map(findItem)
      .filter((item): item is Item => item !== null && item.equipmentSlotType === slot.type),
  }));

  const miscItems: MiscItemEntry[] = miscItemIds.map((itemId, index) => {
    const item = findItem(itemId);
    return {
      index,
      item,
      slotType: item?.equipmentSlotType ?? null,
    };
  });

  const handleEquip = (equipmentSlotType: string, itemId: string) => {
    if (!character || !config) return;

    // The store owns both the move and the slot-type rule
    moveItemToEquipment(character.id, itemId, equipmentSlotType, config);
  };

  const handleUnequip = (equipmentSlotType: string) => {
    if (!character) return;

    // "Unequip" puts the item back in the pack rather than destroying it
    moveItemToMisc(character.id, equipmentSlotType);
  };

  const handleAddItem = (itemId: string) => {
    if (!character || !itemId) return;

    addMiscItem(character.id, itemId);
  };

  /**
   * Remove every copy of an item from the pack
   *
   * `removeMiscItem` filters by id, so a character carrying the same item twice loses both. v1.0
   * models no quantities, and changing `Inventory.miscItems` to carry counts is a persistence
   * change — left as-is deliberately (see TICKET-INV-01).
   */
  const handleRemoveItem = (itemId: string) => {
    if (!character) return;

    removeMiscItem(character.id, itemId);
  };

  return {
    hasCharacter: character !== null,
    slots,
    miscItems,
    /** Everything the ruleset defines, for the "add to inventory" picker */
    availableItems: items,
    handleEquip,
    handleUnequip,
    handleAddItem,
    handleRemoveItem,
  };
}
