/**
 * Equipment Layout
 *
 * Where each equipment slot sits on the sheet's figure, as data the User owns rather than a table
 * the app hardcodes. Pure over `(slots, layout)` — no store, no React — so the configuration
 * builder, the store action that seeds a layout, and the play-mode doll all read one set of rules.
 *
 * This replaced `components/play/inventory/slotLayout.ts`, whose recognition table decided the
 * figure by *guessing at slot names*: a slot called `head` landed on the figure, one called
 * `horns` did not, and no amount of configuration could change either. The table survives here as
 * {@link SEED_PLACEMENTS} — demoted from the rule to the **starting point**. It is what
 * `seedEquipmentLayout` writes into a ruleset the first time the equipment page is opened, after
 * which the stored placements are the only thing anything reads.
 *
 * Three rules the whole module turns on:
 *
 * - **A cell holds one slot.** Two placements on the same cell would stack invisibly, so the first
 *   in configuration order keeps it and the rest fall through to the loose row.
 * - **A placement outside the grid is loose, not an error to throw on.** Shrinking the grid is a
 *   normal edit; the store prunes as it shrinks, but an imported file may still carry one and the
 *   sheet has to render rather than crash. `engine/validator.ts` is what *reports* it.
 * - **No layout means nothing is placed.** Absence is the pre-builder state, not a defect.
 *
 * **Validates: Concept 10; Requirements 12.1, 12.2**
 */

import type {
  EquipmentLayout,
  EquipmentSlot,
  EquipmentSlotPlacement,
  GlyphName,
} from '../types/config';
import { MAX_EQUIPMENT_GRID_COLUMNS, MAX_EQUIPMENT_GRID_ROWS } from '../types/config';

/**
 * The grid a ruleset gets seeded with
 *
 * The source spreadsheet's, read straight off `Charactersheet!M3:O15` — the seven boxes are not a
 * list there, they are laid out as a figure across three columns and four rows:
 *
 * ```
 *            M            N            O
 *   3                    Head
 *   7     main hand     chest       Off hand
 *  11                    Legs       accesory
 *  14                    Feet
 * ```
 */
export const DEFAULT_EQUIPMENT_LAYOUT: EquipmentLayout = { columns: 3, rows: 4 };

/**
 * The figure the seed draws, keyed by normalised slot type
 *
 * Aliases are here because the sheet itself is inconsistent — it spells the accessory box
 * "accesory" — and because a ruleset written by hand will reasonably say `weapon` or `boots`
 * rather than `main_hand` or `feet`. Recognising a few obvious spellings costs one line each and
 * is the difference between opening the builder on a figure and opening it on twelve empty cells.
 *
 * Unlike the table this grew out of, being absent from it costs a slot nothing: it seeds unplaced
 * and the User places it.
 */
const SEED_PLACEMENTS: Record<string, EquipmentSlotPlacement> = {
  head: { column: 2, row: 1, glyph: 'helm' },
  helmet: { column: 2, row: 1, glyph: 'helm' },
  helm: { column: 2, row: 1, glyph: 'helm' },

  main_hand: { column: 1, row: 2, glyph: 'main-hand' },
  weapon: { column: 1, row: 2, glyph: 'main-hand' },

  chest: { column: 2, row: 2, glyph: 'chest' },
  body: { column: 2, row: 2, glyph: 'chest' },
  torso: { column: 2, row: 2, glyph: 'chest' },

  off_hand: { column: 3, row: 2, glyph: 'off-hand' },
  shield: { column: 3, row: 2, glyph: 'off-hand' },

  legs: { column: 2, row: 3, glyph: 'legs' },

  accessory: { column: 3, row: 3, glyph: 'accessory' },
  ring: { column: 3, row: 3, glyph: 'accessory' },
  amulet: { column: 3, row: 3, glyph: 'amulet' },

  feet: { column: 2, row: 4, glyph: 'feet' },
  boots: { column: 2, row: 4, glyph: 'feet' },
};

/** What the picker offers a slot the seed table has never heard of */
export const FALLBACK_GLYPH: GlyphName = 'slot';

/**
 * Fold a slot type into the key {@link SEED_PLACEMENTS} uses
 *
 * The sheet's types arrive as `main_hand`, a hand-written ruleset's as `Main Hand` or `main-hand`.
 * All three name the same box.
 */
function normalise(type: string): string {
  return type
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

/**
 * Where the seed would put this slot, or `null` when it has never heard of it
 *
 * @param type - The `EquipmentSlot.type` from the ruleset
 * @returns Its seeded cell and glyph, or `null` for a slot the User will place themselves
 */
export function seedPlacementFor(type: string): EquipmentSlotPlacement | null {
  return SEED_PLACEMENTS[normalise(type)] ?? null;
}

/** A placement's cell as one comparable string — `2:3` */
export function cellKey(cell: { column: number; row: number }): string {
  return `${cell.column}:${cell.row}`;
}

/** Whether a cell is a whole number pair inside the grid */
export function isWithinLayout(
  cell: { column: number; row: number },
  layout: EquipmentLayout
): boolean {
  return (
    Number.isInteger(cell.column) &&
    Number.isInteger(cell.row) &&
    cell.column >= 1 &&
    cell.row >= 1 &&
    cell.column <= layout.columns &&
    cell.row <= layout.rows
  );
}

/**
 * Hold a grid to a size the app can draw
 *
 * A non-integer, a zero, or a hundred columns all come back as something between 1 and the
 * maximum, because the caller is a number input and an out-of-range value there is a keystroke on
 * the way to a good one rather than an error worth refusing.
 */
export function clampEquipmentLayout(layout: EquipmentLayout): EquipmentLayout {
  const clamp = (value: number, max: number) =>
    Number.isFinite(value) ? Math.min(Math.max(Math.round(value), 1), max) : 1;

  return {
    columns: clamp(layout.columns, MAX_EQUIPMENT_GRID_COLUMNS),
    rows: clamp(layout.rows, MAX_EQUIPMENT_GRID_ROWS),
  };
}

/**
 * Drop every placement the grid no longer has room for
 *
 * What shrinking the grid means: the slot is not deleted and its glyph is not forgotten, it simply
 * stops being on the figure. Re-growing the grid does **not** bring it back — the User places it
 * again, which is the honest reading of "I made the board smaller".
 *
 * @param slots - The ruleset's equipment slots
 * @param layout - The grid they must fit in
 * @returns The same slots, with out-of-bounds placements removed
 */
export function prunePlacements(slots: EquipmentSlot[], layout: EquipmentLayout): EquipmentSlot[] {
  return slots.map((slot) => {
    if (!slot.placement || isWithinLayout(slot.placement, layout)) return slot;

    const { placement: _dropped, ...rest } = slot;
    return rest;
  });
}

/**
 * The placements a ruleset opening the builder for the first time starts with
 *
 * Only ever called on a ruleset with no `equipmentLayout`, and it **never overwrites a placement a
 * slot already carries** — an imported file may have placements without the layout key, and
 * throwing those away to draw the sheet's figure over them would be the builder editing the
 * User's work uninvited.
 *
 * @param slots - The ruleset's equipment slots
 * @returns The same slots, with recognised ones placed on {@link DEFAULT_EQUIPMENT_LAYOUT}
 */
export function seedPlacements(slots: EquipmentSlot[]): EquipmentSlot[] {
  const taken = new Set(
    slots
      .filter((slot) => slot.placement)
      .map((slot) => cellKey(slot.placement as EquipmentSlotPlacement))
  );

  return slots.map((slot) => {
    if (slot.placement) return slot;

    const placement = seedPlacementFor(slot.type);
    if (!placement || taken.has(cellKey(placement))) return slot;

    taken.add(cellKey(placement));
    return { ...slot, placement };
  });
}

/**
 * Split slots into the ones the figure draws and the ones it lists beneath
 *
 * @param slots - Anything carrying an optional placement — configuration slots, or the play-mode
 *   entries that resolve their occupant
 * @param layout - The configured grid, or `undefined` when the ruleset has none yet
 * @returns `placed` in configuration order with a narrowed placement, and `loose` for the rest
 */
export function splitByPlacement<T extends { placement?: EquipmentSlotPlacement }>(
  slots: T[],
  layout: EquipmentLayout | undefined
): { placed: (T & { placement: EquipmentSlotPlacement })[]; loose: T[] } {
  const taken = new Set<string>();
  const placed: (T & { placement: EquipmentSlotPlacement })[] = [];
  const loose: T[] = [];

  for (const slot of slots) {
    const { placement } = slot;

    if (
      layout &&
      placement &&
      isWithinLayout(placement, layout) &&
      !taken.has(cellKey(placement))
    ) {
      taken.add(cellKey(placement));
      placed.push({ ...slot, placement });
    } else {
      loose.push(slot);
    }
  }

  return { placed, loose };
}
