/**
 * Equipment Slot Tile
 *
 * One box on the equipment rack: a glyph of what belongs there, the slot's name, and whatever is
 * in it. Empty reads as a dim silhouette cut into the board; filled lights the glyph in brass and
 * names the item underneath.
 *
 * **The whole tile is the control.** A `Select` is laid over it at full size and made transparent,
 * so clicking anywhere on the box opens the item list. That is a real form control — same
 * component, same `aria-label`, same keyboard behaviour, and a native picker on a phone — rather
 * than a div with a click handler; the tile is only its skin. The alternative was a dropdown
 * rendered inside a 110px box, which is not a dropdown anybody can read.
 *
 * The captions are plain `span`s rather than `Text`, deliberately: they are brass on timber, and a
 * `Text` variant emits a colour of its own that a `className` cannot reliably override (CR-07).
 * The library's rule is about *controls* — no raw `button`, `input`, `select` or `textarea` — and
 * both real controls here are base components.
 *
 * The full state of the slot is in the DOM as text even where the tile draws it as a picture, so
 * "empty", "nothing carried fits this slot" and the item's name are all available to a screen
 * reader. Only the redundant half is `sr-only`.
 *
 * **Validates: Requirements 12.1, 12.2, 12.5, 21.1-21.5, 22.1-22.6**
 */

import { useId } from 'react';
import { Button } from '../../ui/Button/Button';
import { Glyph, type GlyphName } from '../../ui/Glyph/Glyph';
import { Select } from '../../ui/Select/Select';
import type { EquipmentSlotEntry } from './useInventoryManager';

export interface EquipmentSlotTileProps {
  slot: EquipmentSlotEntry;
  /** What to draw while the slot is empty */
  glyph: GlyphName;
  onEquip: (equipmentSlotType: string, itemId: string) => void;
  onUnequip: (equipmentSlotType: string) => void;
  /** Grid placement, from the caller */
  className?: string;
}

const tileStyles = [
  'group relative flex flex-col items-center justify-start gap-1',
  'min-h-24 px-2 py-2.5',
  'rounded',
  'bg-oak-900/70',
  'border border-oak-900',
  'shadow-carved',
  'transition-colors duration-150',
  'focus-within:outline-none focus-within:ring-2 focus-within:ring-amber',
].join(' ');

export function EquipmentSlotTile({
  slot,
  glyph,
  onEquip,
  onUnequip,
  className = '',
}: EquipmentSlotTileProps) {
  const selectId = useId();

  const filled = slot.equipped !== null;

  // A build the ruleset can no longer name — its template was deleted under the Player — is still
  // *in* the slot and still says so, the way `MiscItemRow` names an unresolvable carried one. The
  // engine grants nothing for it; hiding it would leave a slot that reads empty and cannot be filled.
  const wornLabel = slot.equipped?.item?.name ?? 'Unknown item';

  // Whatever is in the slot stays in the list, so the control shows it as the current value and
  // swapping is one gesture rather than unequip-then-equip. The values are `ComposedItem.id`s since
  // TICKET-INV-05 — one Player's builds rather than the catalog's templates.
  const options = [
    ...(slot.equipped ? [{ value: slot.equipped.build.id, label: wornLabel }] : []),
    ...slot.candidates.map((carried) => ({
      value: carried.build.id,
      label: carried.item?.name ?? 'Unknown item',
    })),
  ];

  // A tile with nothing to choose is not a control, and must not light up like one
  const interactive = options.length > 0;

  return (
    <li
      className={[tileStyles, interactive ? 'hover:bg-oak-800' : '', className]
        .filter(Boolean)
        .join(' ')}
    >
      <Glyph name={glyph} className={`h-9 w-9 ${filled ? 'text-brass-light' : 'text-oak-500'}`} />

      <span className="text-center font-heading text-[0.62rem] uppercase leading-tight tracking-wider text-brass">
        {slot.name}
      </span>

      {filled ? (
        <span className="text-center font-body text-xs font-semibold leading-tight text-parchment-50">
          {wornLabel}
        </span>
      ) : (
        // The picture already says "empty" to anyone who can see it; this is the same fact for
        // anyone who cannot, plus the reason when there is one
        <span className="sr-only">
          {slot.candidates.length === 0 ? 'Empty — nothing carried fits this slot.' : 'Empty'}
        </span>
      )}

      {interactive && (
        <Select
          id={selectId}
          aria-label={`Equip into ${slot.name}`}
          value={slot.equipped?.build.id ?? ''}
          placeholder="Empty"
          options={options}
          onChange={(event) => {
            const composedId = event.target.value;
            if (composedId === '') onUnequip(slot.type);
            else onEquip(slot.type, composedId);
          }}
          // Laid over the whole tile and made invisible: the box is the button. `inset-0` and the
          // sizing are the caller's positioning, which is what `className` is for.
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      )}

      {filled && (
        <Button
          variant="plaque"
          size="xs"
          aria-label="Unequip"
          onClick={() => onUnequip(slot.type)}
          // Above the transparent select, which would otherwise swallow the click.
          //
          // Hidden until the tile is hovered or the button itself is focused: a rack of six lit
          // slots was six × buttons competing with the gear they belonged to. `opacity` rather
          // than `hidden`, so it stays in the accessibility tree and on the tab order — it is
          // always reachable, just not always shouting.
          className="absolute right-0.5 top-0.5 z-10 rounded-full leading-none opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
        >
          ×
        </Button>
      )}
    </li>
  );
}
