/**
 * Curve Table Structure
 *
 * Adding and removing the rows and columns of a curve (Concept 06), as opposed to
 * `curveGenerator.ts`, which fills the cells they make.
 *
 * These exist because `columns`, `rows[].values` and `rows[].overridden` are three arrays
 * addressed by one index. Rewriting `columns` alone shifts every value and every override flag
 * onto the wrong cell — the table still type-checks, still renders, and quietly means something
 * else. TICKET-CRV-02 stated that invariant; this is where it is enforced, because this is where
 * column editing became reachable (TICKET-CRV-03).
 *
 * Pure functions over `(curve, …) → curve`. Nothing here persists — the store action does that.
 *
 * **Validates: Concept 06; spec §5.6**
 */

import type { Curve, CurveColumn, CurveRow } from '../types/config';

/**
 * A row's cells and flags rebuilt to `length`, in one addressing pass
 *
 * The flag array comes back absent when nothing is flagged: absent and all-false are the same
 * state, and only one of them survives a round trip through JSON unchanged (`curveGenerator.ts`
 * makes the same choice for the same reason).
 *
 * @param row - The row being rebuilt
 * @param length - How many cells it should end up with
 * @param at - Reads the old index each new index takes its cell from; -1 means "a new cell"
 */
function rebuildRow(row: CurveRow, length: number, at: (index: number) => number): CurveRow {
  const values = Array.from({ length }, (_, index) => {
    const source = at(index);
    // A cell no column supplied becomes 0 rather than a hole: a sparse `number[]` is not what
    // the type promises, and a lookup would read the gap as NaN
    return source === -1 ? 0 : (row.values[source] ?? 0);
  });

  const flags = values.map((_, index) => {
    const source = at(index);
    return source === -1 ? false : row.overridden?.[source] === true;
  });

  return flags.some(Boolean)
    ? { key: row.key, values, overridden: flags }
    : { key: row.key, values };
}

/**
 * Append a value column, giving every row a cell for it
 *
 * The new cells are 0 and unflagged. A generated column's real values arrive from
 * `regenerateCurve`, which is the same path "extend the key range" takes — the alternative,
 * evaluating the generator here, would duplicate that decision in two places.
 *
 * @param curve - The curve gaining a column
 * @param column - The column to append
 * @returns The curve with the column appended and every row widened
 */
export function addCurveColumn(curve: Curve, column: CurveColumn): Curve {
  const length = curve.columns.length + 1;

  return {
    ...curve,
    columns: [...curve.columns, column],
    // Every new index maps to itself except the last, which is the new cell
    rows: curve.rows.map((row) =>
      rebuildRow(row, length, (index) => (index === length - 1 ? -1 : index))
    ),
  };
}

/**
 * Remove a value column and the cell it owned in every row
 *
 * @param curve - The curve losing a column
 * @param columnId - Which column, by its stable id
 * @returns The curve without it; unchanged if no column has that id
 */
export function removeCurveColumn(curve: Curve, columnId: string): Curve {
  const columnIndex = curve.columns.findIndex((column) => column.id === columnId);
  if (columnIndex === -1) return curve;

  const length = curve.columns.length - 1;

  return {
    ...curve,
    columns: curve.columns.filter((_, index) => index !== columnIndex),
    // Indices at or past the removed one take the cell that used to sit one to their right
    rows: curve.rows.map((row) =>
      rebuildRow(row, length, (index) => (index < columnIndex ? index : index + 1))
    ),
  };
}

/**
 * Add a row at `key`, keeping the table sorted
 *
 * Its cells start at 0 and unflagged, so a generated column fills in on the next regeneration —
 * Concept 06's "extend point-buy to 40 points" scenario. Keys are unique by definition (the key
 * *is* the row's address), so a key the table already has is a no-op rather than a second row
 * `engine/validator.ts` would then report.
 *
 * @param curve - The curve gaining a row
 * @param key - The new row's input value
 * @returns The curve with the row inserted in key order; unchanged if the key is taken
 */
export function addCurveRow(curve: Curve, key: number): Curve {
  if (curve.rows.some((row) => row.key === key)) return curve;

  const row: CurveRow = { key, values: curve.columns.map(() => 0) };

  return {
    ...curve,
    rows: [...curve.rows, row].sort((a, b) => a.key - b.key),
  };
}

/**
 * Remove the row at `key`
 *
 * @param curve - The curve losing a row
 * @param key - Which row
 * @returns The curve without it; unchanged if no row has that key
 */
export function removeCurveRow(curve: Curve, key: number): Curve {
  return { ...curve, rows: curve.rows.filter((row) => row.key !== key) };
}
