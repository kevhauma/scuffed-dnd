/**
 * Equipment Slot Card Component
 *
 * Displays an equipment slot with its details and action buttons.
 *
 * Since TICKET-INV-03 it also says where the slot sits on the figure, because that is now a
 * property of the slot rather than something the sheet decides: a User looking at this list should
 * not have to scroll to the builder to find out whether a slot is on the board at all.
 *
 * **Validates: Requirements 7.5, 21.1-21.5**
 */

import type { EquipmentSlot } from '#shared/types';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Glyph } from '../../ui/Glyph/Glyph';
import { GLYPH_LABELS } from '../../ui/Glyph/Glyph.catalogue';
import { Text } from '../../ui/Text/Text';

interface EquipmentSlotCardProps {
  slot: EquipmentSlot;
  onEdit: (type: string) => void;
  onDelete: (type: string) => void;
}

export function EquipmentSlotCard({ slot, onEdit, onDelete }: EquipmentSlotCardProps) {
  const { placement } = slot;

  return (
    <Card variant="bordered" className="p-4">
      <div className="flex justify-between items-start mb-3">
        <div className="flex flex-1 items-start gap-3">
          {placement && (
            <Glyph name={placement.glyph} className="mt-0.5 h-7 w-7 shrink-0 text-ink-700" />
          )}
          <div className="flex-1">
            <Text variant="h5" as="h3" className="mb-1">
              {slot.name}
            </Text>
            <Text variant="body-small-secondary" className="text-xs mb-2">
              Type: {slot.type}
            </Text>
            <Text variant="body-small-secondary" className="text-xs mb-2">
              {placement
                ? `On the figure at column ${placement.column}, row ${placement.row} · ${GLYPH_LABELS[placement.glyph]}`
                : 'Not placed on the figure'}
            </Text>
            {slot.description && (
              <Text variant="body-small-secondary" as="p">
                {slot.description}
              </Text>
            )}
          </div>
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
