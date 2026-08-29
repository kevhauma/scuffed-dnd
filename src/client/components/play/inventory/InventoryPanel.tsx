/**
 * Inventory Panel
 *
 * The character's equipment slots and the pack they carry. Layout and composition only — every
 * decision lives in `useInventoryManager`, and every write goes through a character store action.
 *
 * Equipping changes what the rest of the sheet shows: `calculateCharacter` reads
 * `inventory.equippedItems` at render time, so no recalculation is triggered from here
 * (Requirements 13.1, 13.3, 13.5). Since TICKET-INV-05 those ids name the character's **builds**,
 * and the tiers each build is made of are read at that same moment — so retuning a material moves
 * every sheet wearing it without anything here being told.
 *
 * **The picker still offers templates**, because building one is what putting a thing in your pack
 * means; the three-column builder that also picks a material and an inlay tier is TICKET-INV-06's,
 * as is the Backpack that will replace this flat pack list.
 *
 * **Validates: Requirements 12.1, 12.2, 12.4, 12.5, 12.6, 13.1, 13.3, 13.5, 21.1-21.5**
 */

import { useId, useState } from 'react';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Select } from '../../ui/Select/Select';
import { Text } from '../../ui/Text/Text';
import { EquipmentDoll } from './EquipmentDoll';
import { MiscItemRow } from './MiscItemRow';
import { useInventoryManager } from './useInventoryManager';

export interface InventoryPanelProps {
  characterId: string;
}

export function InventoryPanel({ characterId }: InventoryPanelProps) {
  const {
    slots,
    equipmentLayout,
    miscItems,
    availableItems,
    handleEquip,
    handleUnequip,
    handleAddItem,
    handleRemoveItem,
  } = useInventoryManager(characterId);

  const addSelectId = useId();

  /** The item chosen in the picker but not yet added — purely local to this control */
  const [itemToAdd, setItemToAdd] = useState('');

  const addItem = () => {
    handleAddItem(itemToAdd);
    setItemToAdd('');
  };

  return (
    <Card className="p-6">
      <Text variant="h4" as="h2" className="mb-3">
        Inventory
      </Text>

      <Text variant="h5" as="h3" className="mb-2">
        Equipment
      </Text>
      {slots.length === 0 ? (
        <Text variant="body-small-secondary">This ruleset defines no equipment slots.</Text>
      ) : (
        <EquipmentDoll
          slots={slots}
          layout={equipmentLayout}
          onEquip={handleEquip}
          onUnequip={handleUnequip}
        />
      )}

      <Text variant="h5" as="h3" className="mt-6 mb-2">
        Pack
      </Text>
      {miscItems.length === 0 ? (
        <Text variant="body-small-secondary">Nothing carried.</Text>
      ) : (
        miscItems.map((entry) => (
          <MiscItemRow key={entry.build.id} entry={entry} onRemove={handleRemoveItem} />
        ))
      )}

      {availableItems.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Select
            id={addSelectId}
            aria-label="Add an item to the pack"
            value={itemToAdd}
            placeholder="Choose an item"
            options={availableItems.map((item) => ({ value: item.id, label: item.name }))}
            onChange={(event) => setItemToAdd(event.target.value)}
            className="w-56"
          />
          <Button variant="secondary" disabled={itemToAdd === ''} onClick={addItem}>
            Add to Pack
          </Button>
        </div>
      )}
    </Card>
  );
}
