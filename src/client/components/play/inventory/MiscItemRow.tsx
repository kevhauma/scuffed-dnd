/**
 * Miscellaneous Item Row
 *
 * One carried, unequipped **build**: the name of the template it was made from, the slot that
 * template declares (or that it declares none), and the control to drop it.
 *
 * The **display phrase** — *Iron Ore 10 Battleaxe with Diamond 4 inlay* — is TICKET-INV-06's, along
 * with the Backpack this row will list in; TICKET-INV-05 put the links on the record and left the
 * label reading the template's own name.
 *
 * **Validates: Requirements 12.4, 12.6, 21.1-21.5**
 */

import { Button } from '../../ui/Button/Button';
import { Text } from '../../ui/Text/Text';
import type { MiscItemEntry } from './useInventoryManager';

export interface MiscItemRowProps {
  entry: MiscItemEntry;
  /** Called with the `ComposedItem.id` of the build to put down (TICKET-INV-05) */
  onRemove: (composedId: string) => void;
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

      {/* Offered even for a build whose template is gone, which the row above names as *Unknown
          item*: it is the Player's, it is in their pack, and refusing to let them drop it would
          leave a row nothing can clear (TICKET-INV-05 — the build has its own identity now, so the
          control no longer needs the template's id to say which one) */}
      <Button variant="danger" size="sm" onClick={() => onRemove(entry.build.id)}>
        Remove
      </Button>
    </div>
  );
}
