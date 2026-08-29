/**
 * Backpack Row
 *
 * One built, unworn thing: the **derived phrase** that names it — *Iron Ore 10 Battleaxe with
 * Diamond 4 inlay* — the slot its template declares (or that it declares none), and the control to
 * put it down for good.
 *
 * `MiscItemRow` renamed with TICKET-INV-06, because there is no "misc" collection any more: the
 * Backpack is everything built and not worn, derived rather than stored, and a row here is in it by
 * virtue of not being on the body.
 *
 * The label is `composedItemLabel`'s, handed down through `useInventoryManager` — never rebuilt here,
 * so renaming a material relabels this row on the next render and cannot make it disagree with the
 * equipment tile showing the same build.
 *
 * **Validates: Requirements 12.4, 12.6, 21.1-21.5; v4 systems/12**
 */

import { Button } from '../../ui/Button/Button';
import { Text } from '../../ui/Text/Text';
import type { BackpackEntry } from './useInventoryManager';

export interface BackpackRowProps {
  entry: BackpackEntry;
  /** Called with the `ComposedItem.id` of the build to destroy (TICKET-INV-05) */
  onDiscard: (composedId: string) => void;
}

export function BackpackRow({ entry, onDiscard }: BackpackRowProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 py-2 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-2">
        <Text variant="body-small" as="span">
          {entry.label}
        </Text>
        <Text variant="caption" as="span">
          {entry.slotType ?? 'no slot'}
        </Text>
      </div>

      {/* Offered even for a build whose template is gone, which the phrase above names as *Unknown
          item*: it is the Player's, it is in their bag, and refusing to let them drop it would leave
          a row nothing can clear */}
      <Button variant="danger" size="sm" onClick={() => onDiscard(entry.build.id)}>
        Remove
      </Button>
    </div>
  );
}
