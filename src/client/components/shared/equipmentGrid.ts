/**
 * Equipment Grid Classes
 *
 * The Tailwind utilities that turn a User-defined grid size into a real CSS grid, shared by the
 * configuration builder and the play-mode equipment doll so the board the User arranges and the
 * board the Player reads are laid out by the same strings.
 *
 * **Written out rather than interpolated, on purpose.** Tailwind builds its stylesheet by scanning
 * source text for class names, so `grid-cols-${columns}` produces markup referring to a class the
 * stylesheet does not contain — the grid silently collapses to one column. Every class the tree can
 * emit has to appear here literally, which is also why `MAX_EQUIPMENT_GRID_COLUMNS` and
 * `MAX_EQUIPMENT_GRID_ROWS` exist: the ceiling is what makes the list finite.
 *
 * **Validates: Requirements 21.4, 21.5**
 */

import { MAX_EQUIPMENT_GRID_COLUMNS, MAX_EQUIPMENT_GRID_ROWS } from '#shared/types/config';

/** `grid-cols-N`, indexed by column count */
const COLUMN_CLASSES: readonly string[] = [
  'grid-cols-1',
  'grid-cols-2',
  'grid-cols-3',
  'grid-cols-4',
  'grid-cols-5',
  'grid-cols-6',
];

/** `grid-rows-N`, indexed by row count */
const ROW_CLASSES: readonly string[] = [
  'grid-rows-1',
  'grid-rows-2',
  'grid-rows-3',
  'grid-rows-4',
  'grid-rows-5',
  'grid-rows-6',
];

/** `col-start-N`, indexed by 1-based column */
const COLUMN_START_CLASSES: readonly string[] = [
  'col-start-1',
  'col-start-2',
  'col-start-3',
  'col-start-4',
  'col-start-5',
  'col-start-6',
];

/** `row-start-N`, indexed by 1-based row */
const ROW_START_CLASSES: readonly string[] = [
  'row-start-1',
  'row-start-2',
  'row-start-3',
  'row-start-4',
  'row-start-5',
  'row-start-6',
];

/** Clamp a 1-based index into a class table, so a stored oddity cannot emit `undefined` */
function at(table: readonly string[], index: number): string {
  return table[Math.min(Math.max(Math.round(index), 1), table.length) - 1];
}

/**
 * The track classes for a grid of this size
 *
 * @param columns - Column count, 1 to {@link MAX_EQUIPMENT_GRID_COLUMNS}
 * @param rows - Row count, 1 to {@link MAX_EQUIPMENT_GRID_ROWS}
 */
export function gridTrackClasses(columns: number, rows: number): string {
  return `${at(COLUMN_CLASSES, Math.min(columns, MAX_EQUIPMENT_GRID_COLUMNS))} ${at(
    ROW_CLASSES,
    Math.min(rows, MAX_EQUIPMENT_GRID_ROWS)
  )}`;
}

/**
 * Where one cell sits in that grid
 *
 * @param column - 1-based column
 * @param row - 1-based row
 */
export function gridCellClasses(column: number, row: number): string {
  return `${at(COLUMN_START_CLASSES, column)} ${at(ROW_START_CLASSES, row)}`;
}
