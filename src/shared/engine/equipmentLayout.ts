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
 * The old source spreadsheet's, read straight off `Charactersheet!M3:O15` — the seven boxes are not
 * a list there, they are laid out as a figure across three columns and four rows:
 *
 * ```
 *            M            N            O
 *   3                    Head
 *   7     main hand     chest       Off hand
 *  11                    Legs       accesory
 *  14                    Feet
 * ```
 *
 * The v4 workbook's six boxes (`Backpack` C4:D9) are the same figure with the accessory box empty,
 * so the grid is unchanged — see {@link SEED_PLACEMENTS}. **It is still only a default**: a ruleset's
 * board is whatever size the User picks in the builder, and the count of slots standing on it is
 * theirs too (v4.0 overview, *Rulings — ticket review*).
 */
export const DEFAULT_EQUIPMENT_LAYOUT: EquipmentLayout = { columns: 3, rows: 4 };

/*
 * The boxes the seeded figure is made of, each named once. A block comment rather than a JSDoc one
 * because it describes the whole run below: JSDoc would attach to `HEAD_BOX` alone and leave the
 * other seven hovering undocumented. The argument itself is in {@link SEED_PLACEMENTS}'s doc.
 */
const HEAD_BOX: EquipmentSlotPlacement = { column: 2, row: 1, glyph: 'helm' };
const MAIN_HAND_BOX: EquipmentSlotPlacement = { column: 1, row: 2, glyph: 'main-hand' };
const CHEST_BOX: EquipmentSlotPlacement = { column: 2, row: 2, glyph: 'chest' };
const OFF_HAND_BOX: EquipmentSlotPlacement = { column: 3, row: 2, glyph: 'off-hand' };
const LEGS_BOX: EquipmentSlotPlacement = { column: 2, row: 3, glyph: 'legs' };
const ACCESSORY_BOX: EquipmentSlotPlacement = { column: 3, row: 3, glyph: 'accessory' };
const AMULET_BOX: EquipmentSlotPlacement = { column: 3, row: 3, glyph: 'amulet' };
const FEET_BOX: EquipmentSlotPlacement = { column: 2, row: 4, glyph: 'feet' };

/**
 * The figure the seed draws, keyed by normalised slot type
 *
 * Aliases are here because the sheet itself is inconsistent — it spells the accessory box
 * "accesory" — and because a ruleset written by hand will reasonably say `weapon` or `boots`
 * rather than `main_hand` or `feet`. Recognising a few obvious spellings costs one line each and
 * is the difference between opening the builder on a figure and opening it on twelve empty cells.
 *
 * **Two generations of the workbook are in here at once** (TICKET-INV-04). The v4 sheet renamed its
 * body slots — `head_gear`, `upperbody_gear`, `lowerbody_gear`, `foot_gear`, `right_hand`,
 * `left_hand` (`Backpack` C4:D9, `Background References: Naming` BA12:BA17) — and dropped the
 * accessory box. Each new spelling joins the box its old spelling already stands on, and **nothing
 * is removed**: a ruleset that says `chest` keeps its figure, and `accessory` is an ordinary
 * spelling of an ordinary box that a ruleset may or may not have a slot for.
 *
 * **Every value here is one of the `*_BOX` constants above rather than a repeated literal**, which
 * is what keeps the two generations from drifting: `right_hand` *is* the main-hand box, so moving
 * the box moves every spelling of it at once. `AMULET_BOX` is a box of its own rather than another
 * alias because it shares the accessory box's cell and differs only in its drawing.
 *
 * **This table is a convenience, not a vocabulary.** It has no say in how many slots a ruleset has
 * or what they may be called — that is the builder's, and the User's. Unlike the table this grew
 * out of, being absent from it costs a slot nothing: it seeds unplaced and the User places it.
 */
const SEED_PLACEMENTS: Record<string, EquipmentSlotPlacement> = {
  head: HEAD_BOX,
  helmet: HEAD_BOX,
  helm: HEAD_BOX,
  head_gear: HEAD_BOX,

  main_hand: MAIN_HAND_BOX,
  weapon: MAIN_HAND_BOX,
  right_hand: MAIN_HAND_BOX,

  chest: CHEST_BOX,
  body: CHEST_BOX,
  torso: CHEST_BOX,
  upperbody_gear: CHEST_BOX,

  off_hand: OFF_HAND_BOX,
  shield: OFF_HAND_BOX,
  left_hand: OFF_HAND_BOX,

  legs: LEGS_BOX,
  lowerbody_gear: LEGS_BOX,

  accessory: ACCESSORY_BOX,
  ring: ACCESSORY_BOX,
  amulet: AMULET_BOX,

  feet: FEET_BOX,
  boots: FEET_BOX,
  foot_gear: FEET_BOX,
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
 * A **copy** of the box, because several spellings share one — handing the same object to two
 * rulesets would make the seed table something a caller could edit from a distance.
 *
 * @param type - The `EquipmentSlot.type` from the ruleset
 * @returns Its seeded cell and glyph, or `null` for a slot the User will place themselves
 */
export function seedPlacementFor(type: string): EquipmentSlotPlacement | null {
  const key = normalise(type);
  const box = SEED_PLACEMENTS[key];

  return box ? { ...box } : null;
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
