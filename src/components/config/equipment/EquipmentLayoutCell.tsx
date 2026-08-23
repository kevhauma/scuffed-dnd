/**
 * Equipment Layout Cell
 *
 * One box on the builder's board: what stands there, the glyph it will show while empty, and the
 * control that puts something else there.
 *
 * Drawn as the play-mode tile is drawn — dark oak, brass caption, the same glyph at the same size —
 * because the whole purpose of the builder is that the User is arranging the thing the Player will
 * look at. A parchment-coloured editor for a timber board would make them arrange it twice.
 *
 * The assignment control is a real `Select` rather than drag-and-drop: no new dependency, it works
 * from a keyboard and on a phone, and "column 2, row 1" is a nameable thing a test can address.
 * Its blank option is a genuine `''` entry rather than the primitive's `placeholder`, which renders
 * disabled — clearing a cell has to be choosable.
 *
 * **Validates: Requirements 21.1-21.5, 22.1-22.6**
 */

import type { EquipmentSlot } from '../../../types';
import { gridCellClasses } from '../../shared/equipmentGrid';
import { Button } from '../../ui/Button/Button';
import { Glyph } from '../../ui/Glyph/Glyph';
import { GLYPH_LABELS } from '../../ui/Glyph/Glyph.catalogue';
import { Select } from '../../ui/Select/Select';

export interface EquipmentLayoutCellProps {
  /** 1-based */
  column: number;
  /** 1-based */
  row: number;
  /** What stands on this cell, or `null` while it is free */
  slot: EquipmentSlot | null;
  /** Every slot the ruleset defines — a cell can be given any of them */
  slots: EquipmentSlot[];
  onAssign: (column: number, row: number, type: string) => void;
  onEditGlyph: (type: string) => void;
}

const cellStyles = [
  'relative flex flex-col items-center gap-1',
  'min-h-28 px-1.5 py-2',
  'rounded',
  'bg-oak-900/70',
  'border border-oak-900',
  'shadow-carved',
].join(' ');

const emptyStyles = 'border-dashed border-oak-500 bg-oak-900/35';

export function EquipmentLayoutCell({
  column,
  row,
  slot,
  slots,
  onAssign,
  onEditGlyph,
}: EquipmentLayoutCellProps) {
  // Every slot, not just the unplaced ones: offering only the spares would make **moving** a slot
  // two gestures — empty its cell, then fill this one — and the store already turns out whoever
  // holds the target. A slot standing somewhere else says where, so choosing it reads as a move
  // rather than as a duplicate.
  const options = [
    { value: '', label: '— Empty —' },
    ...slots.map((candidate) => ({
      value: candidate.type,
      label:
        candidate.placement && candidate.type !== slot?.type
          ? `${candidate.name} (from column ${candidate.placement.column}, row ${candidate.placement.row})`
          : candidate.name,
    })),
  ];

  return (
    <li
      className={[cellStyles, slot ? '' : emptyStyles, gridCellClasses(column, row)]
        .filter(Boolean)
        .join(' ')}
    >
      {slot?.placement ? (
        <Button
          variant="plaque"
          size="xs"
          aria-label={`Glyph for ${slot.name} — ${GLYPH_LABELS[slot.placement.glyph]}`}
          onClick={() => onEditGlyph(slot.type)}
          className="rounded p-1 leading-none"
        >
          <Glyph name={slot.placement.glyph} className="h-8 w-8 text-brass-light" />
        </Button>
      ) : (
        // Not a `Glyph`: an empty cell has no drawing to show, and borrowing one would read as a
        // slot that is already there
        <span aria-hidden="true" className="h-10" />
      )}

      <span className="text-center font-heading text-[0.62rem] uppercase leading-tight tracking-wider text-brass">
        {slot ? slot.name : `${column}·${row}`}
      </span>

      <Select
        aria-label={`Slot at column ${column}, row ${row}`}
        value={slot?.type ?? ''}
        options={options}
        onChange={(event) => onAssign(column, row, event.target.value)}
        className="mt-auto w-full text-xs"
      />
    </li>
  );
}
