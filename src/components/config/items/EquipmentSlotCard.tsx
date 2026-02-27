/**
 * Equipment Slot Card Component
 * 
 * Displays an equipment slot with its details and action buttons.
 */

import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import type { EquipmentSlot } from '../../../types';

interface EquipmentSlotCardProps {
  slot: EquipmentSlot;
  onEdit: (type: string) => void;
  onDelete: (type: string) => void;
}

export function EquipmentSlotCard({ slot, onEdit, onDelete }: EquipmentSlotCardProps) {
  return (
    <Card variant="bordered" className="p-4">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <Text variant="h5" as="h3" className="mb-1">{slot.name}</Text>
          <Text variant="body-small-secondary" className="text-xs mb-2">
            Type: {slot.type}
          </Text>
          {slot.description && (
            <Text variant="body-small-secondary" as="p">
              {slot.description}
            </Text>
          )}
        </div>
        <div className="flex gap-2">
          <Button 
            variant="secondary" 
            onClick={() => onEdit(slot.type)}
            className="text-sm px-2 py-1"
          >
            Edit
          </Button>
          <Button 
            variant="danger" 
            onClick={() => onDelete(slot.type)}
            className="text-sm px-2 py-1"
          >
            Delete
          </Button>
        </div>
      </div>
    </Card>
  );
}
