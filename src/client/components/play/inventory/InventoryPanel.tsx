/**
 * Inventory Panel
 *
 * The character's equipment slots, the Backpack, and the builder that fills it. Layout and
 * composition only — every decision lives in `useInventoryManager`, and every write goes through a
 * character store action.
 *
 * Equipping changes what the rest of the sheet shows: `calculateCharacter` reads
 * `inventory.equippedItems` at render time, so no recalculation is triggered from here
 * (Requirements 13.1, 13.3, 13.5). Since TICKET-INV-05 those ids name the character's **builds**,
 * and the tiers each build is made of are read at that same moment — so retuning a material moves
 * every sheet wearing it without anything here being told.
 *
 * **The Backpack is the sheet's own `FILTER`** (TICKET-INV-06): everything built and not worn,
 * derived by `backpackOf` rather than read out of a stored list. That is why equipping a thing takes
 * its row out of the bag and unequipping puts it back, with neither control touching the bag — the
 * two lists cannot disagree because there is only one.
 *
 * **Validates: Requirements 12.1, 12.2, 12.4, 12.5, 12.6, 13.1, 13.3, 13.5, 21.1-21.5**
 */

import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { BackpackRow } from './BackpackRow';
import { EquipmentDoll } from './EquipmentDoll';
import { ItemBuilder } from './ItemBuilder';
import { useInventoryManager } from './useInventoryManager';

export interface InventoryPanelProps {
  characterId: string;
}

export function InventoryPanel({ characterId }: InventoryPanelProps) {
  const {
    slots,
    equipmentLayout,
    backpack,
    availableItems,
    availableMaterials,
    availableInlays,
    handleEquip,
    handleUnequip,
    handleBuild,
    handleDiscard,
    labelFor,
  } = useInventoryManager(characterId);

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
        Backpack
      </Text>
      {backpack.length === 0 ? (
        <Text variant="body-small-secondary">Nothing built and unworn.</Text>
      ) : (
        backpack.map((entry) => (
          <BackpackRow key={entry.build.id} entry={entry} onDiscard={handleDiscard} />
        ))
      )}

      {availableItems.length > 0 && (
        <div className="mt-4">
          <ItemBuilder
            templates={availableItems}
            materials={availableMaterials}
            inlays={availableInlays}
            labelFor={labelFor}
            onBuild={handleBuild}
          />
        </div>
      )}
    </Card>
  );
}
