/**
 * Miscellaneous Item Row
 *
 * One carried, unequipped item: its name, the slot it declares (or that it declares none), and the
 * control to drop it.
 *
 * **Validates: Requirements 12.4, 12.6, 21.1-21.5**
 */

import { Button } from '../../ui/Button/Button';
import { Text } from '../../ui/Text/Text';
import type { MiscItemEntry } from './useInventoryManager';

export interface MiscItemRowProps {
  entry: MiscItemEntry;
  onRemove: (itemId: string) => void;
}

export function MiscItemRow({ entry, onRemove }: MiscItemRowProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 py-2 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-2">
        <Text variant="body-small" as="span">
          {entry.item?.name ?? 'Unknown item'}
        </Text>
        <Text variant="caption" as="span">
          {entry.slotType ?? 'no slot'}
        </Text>
      </div>

      {entry.item && (
        <Button variant="danger" size="sm" onClick={() => onRemove(entry.item?.id ?? '')}>
          Remove
        </Button>
      )}
    </div>
  );
}
