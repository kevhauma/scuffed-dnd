/**
 * Equipment Slot Row
 *
 * One configured equipment slot: what occupies it, and the controls to fill or empty it. Only
 * carried items declaring this slot's type are offered — and the store refuses the rest anyway
 * (Requirement 12.3).
 *
 * **Validates: Requirements 12.1, 12.2, 12.5, 21.1-21.5**
 */

import { useId } from 'react';
import { Button } from '../../ui/Button/Button';
import { Select } from '../../ui/Select/Select';
import { Text } from '../../ui/Text/Text';
import type { EquipmentSlotEntry } from './useInventoryManager';

export interface EquipmentSlotRowProps {
  slot: EquipmentSlotEntry;
  onEquip: (equipmentSlotType: string, itemId: string) => void;
  onUnequip: (equipmentSlotType: string) => void;
}

export function EquipmentSlotRow({ slot, onEquip, onUnequip }: EquipmentSlotRowProps) {
  const selectId = useId();

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-stone-200 py-2 last:border-b-0">
      <Text variant="body-small" as="span" className="w-40 shrink-0">
        {slot.name}
      </Text>

      {slot.item ? (
        <>
          <Text variant="highlight" as="span">
            {slot.item.name}
          </Text>
          <Button variant="secondary" size="sm" onClick={() => onUnequip(slot.type)}>
            Unequip
          </Button>
        </>
      ) : slot.candidates.length === 0 ? (
        <Text variant="body-small-secondary" as="span">
          Empty — nothing carried fits this slot.
        </Text>
      ) : (
        <>
          <Text variant="body-small-secondary" as="span">
            Empty
          </Text>
          <Select
            id={selectId}
            aria-label={`Equip into ${slot.name}`}
            value=""
            placeholder="Choose an item"
            options={slot.candidates.map((item) => ({ value: item.id, label: item.name }))}
            onChange={(event) => onEquip(slot.type, event.target.value)}
            className="w-56"
          />
        </>
      )}
    </div>
  );
}
