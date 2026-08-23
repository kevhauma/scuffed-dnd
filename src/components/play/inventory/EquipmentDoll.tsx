/**
 * Equipment Doll
 *
 * The character's kit as a figure rather than a list — a dark board with the slots arranged the way
 * the **ruleset** arranges them, joined by a thin brass cross so the boxes read as one body instead
 * of a grid of squares.
 *
 * This is the one dark object on the sheet, and that is deliberate: everything else on the page is
 * parchment the Player writes on, and this is the rack their gear hangs from. It also makes the
 * silhouettes legible, which they would not be cut into paper.
 *
 * **The arrangement is configuration now, not code** (TICKET-INV-03). It used to come from a
 * recognition table here — a slot called `head` landed on the figure and one called `horns` did
 * not, with nothing the User could do about either. The board is the grid they built under
 * *Configuration → Equipment*, and a slot they have not placed is rendered underneath in a plain
 * wrap rather than dropped. A ruleset with no layout at all draws every slot that way, until
 * someone opens the builder and it seeds itself.
 *
 * **Validates: Concept 10; Requirements 12.1, 12.2, 12.5, 21.1-21.5, 22.1-22.6**
 */

import { splitByPlacement } from '../../../engine/equipmentLayout';
import type { EquipmentLayout } from '../../../types/config';
import { gridCellClasses, gridTrackClasses } from '../../shared/equipmentGrid';
import { EquipmentSlotTile } from './EquipmentSlotTile';
import type { EquipmentSlotEntry } from './useInventoryManager';

export interface EquipmentDollProps {
  slots: EquipmentSlotEntry[];
  /** The grid the ruleset arranges its slots on, or `undefined` when it has none */
  layout?: EquipmentLayout;
  onEquip: (equipmentSlotType: string, itemId: string) => void;
  onUnequip: (equipmentSlotType: string) => void;
}

const boardStyles = [
  'relative',
  'rounded-md p-3',
  'bg-oak-800 surface-fibre',
  'border-2 border-brass-dark',
  'ring-1 ring-inset ring-brass/25',
  'shadow-parchment-lg',
].join(' ');

/**
 * Which row the shoulder bar is drawn across, as a percentage of the board's height
 *
 * View geometry rather than a rule, so it lives with the drawing. The bar belongs on the row the
 * figure is widest at — the arms — which on the sheet's own 3×4 figure is row 2 of 4 and comes out
 * at 37.5%, exactly where it was hardcoded before the grid became the User's. On a layout with no
 * obviously widest row the first occupied one wins, which is the top of the body either way.
 */
function shoulderRow(placed: { placement: { row: number } }[], rows: number): number {
  const counts = new Map<number, number>();
  for (const slot of placed) {
    counts.set(slot.placement.row, (counts.get(slot.placement.row) ?? 0) + 1);
  }

  let best = 1;
  for (const [row, count] of [...counts].sort((a, b) => a[0] - b[0])) {
    if (count > (counts.get(best) ?? 0)) best = row;
  }

  return ((best - 0.5) / rows) * 100;
}

export function EquipmentDoll({ slots, layout, onEquip, onUnequip }: EquipmentDollProps) {
  const { placed, loose } = splitByPlacement(slots, layout);

  return (
    <div className={boardStyles}>
      {layout && placed.length > 0 && (
        <div className="relative">
          {/* The spine and the shoulders. Drawn behind the tiles, which are opaque, so the line
              appears only in the gaps — the join between boxes rather than a line across them. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-8 left-1/2 w-0.5 -translate-x-1/2 bg-brass/45"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-10 h-0.5 bg-brass/45"
            style={{ top: `${shoulderRow(placed, layout.rows)}%` }}
          />

          <ul className={`relative grid gap-2 ${gridTrackClasses(layout.columns, layout.rows)}`}>
            {placed.map((slot) => (
              <EquipmentSlotTile
                key={slot.type}
                slot={slot}
                glyph={slot.placement.glyph}
                onEquip={onEquip}
                onUnequip={onUnequip}
                className={gridCellClasses(slot.placement.column, slot.placement.row)}
              />
            ))}
          </ul>
        </div>
      )}

      {loose.length > 0 && (
        <ul
          className={`grid grid-cols-3 gap-2 ${placed.length > 0 ? 'mt-2 border-t border-brass-dark/50 pt-3' : ''}`}
        >
          {loose.map((slot) => (
            <EquipmentSlotTile
              key={slot.type}
              slot={slot}
              glyph="slot"
              onEquip={onEquip}
              onUnequip={onUnequip}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
