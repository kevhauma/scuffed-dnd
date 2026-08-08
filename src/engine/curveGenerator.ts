/**
 * Curve Generation
 *
 * Generate, overlay overrides, show both — the spec's central editing idea (Concept 00 §1.1,
 * Concept 06), applied to a curve's rows.
 *
 * A source spreadsheet has no way to tell "this cell follows the pattern" from "somebody changed
 * this cell on purpose". That is how the point-buy table ends up with a lone `4.642857142857`
 * that nobody noticed. Here the pattern is a **generator formula** on the column and the
 * exceptions are cells flagged `overridden`, so regenerating a progression can never quietly
 * rebalance the game: an overridden cell is kept and counted, and the report says how many.
 *
 * Pure functions over `(curve, …) → curve`. Nothing here persists — the store action does that,
 * and `components/config/curves/CurveGrid.tsx` is where the flag becomes visible (TICKET-CRV-03).
 *
 * **Validates: Concept 06; Concept 00 §1.1; spec §5.6, §7**
 */

import type { Curve, CurveRow } from '../types/config';
import type { FormulaContext, FormulaError } from '../types/formula';
import { isFormulaError } from './formula/errors';
import { evaluateFormulaString } from './formula/evaluator';
import type { NamespaceSource } from './formula/namespaces';
import { namespacesFor } from './formula/namespaces';

/** One cell whose generator could not produce a number */
export interface CellError {
  /** The row's key */
  key: number;
  /** The column's formula name */
  column: string;
  /** Why, as an error value — so a caller can render it with `describeFormulaError` */
  error: FormulaError;
}

/** What one regeneration did, in the terms the User asked the question in */
export interface RegenerationReport {
  /** Cells the generator wrote */
  written: number;
  /** Cells left alone because they were hand-tuned */
  kept: number;
  /**
   * Cells whose generator failed, addressed rather than described.
   *
   * The address is kept apart from the message so TICKET-CRV-03 can highlight the failing cell
   * without parsing prose back out of a sentence.
   */
  errors: CellError[];
}

/** Whether a cell is flagged as deliberately hand-tuned */
function isOverridden(row: CurveRow, columnIndex: number): boolean {
  return row.overridden?.[columnIndex] === true;
}

/**
 * A row with one cell's value and flag rewritten
 *
 * An all-`false` flag array comes back as absent, so a curve with no overrides persists without
 * an array of nothing — absent and all-false are the same state, and only one of them survives a
 * round trip unchanged.
 */
function withCell(
  row: CurveRow,
  columnIndex: number,
  value: number,
  overridden: boolean
): CurveRow {
  // Built by length rather than by assigning past the end: a sparse array would put holes in a
  // `number[]`, which the type does not admit and a lookup would read as `NaN`. A cell the row
  // never had, in a column nothing can supply, becomes 0 — a visible placeholder in a row
  // `engine/validator.ts` is already reporting as mis-sized.
  const length = Math.max(row.values.length, columnIndex + 1);
  const values = Array.from({ length }, (_, index) =>
    index === columnIndex ? value : (row.values[index] ?? 0)
  );

  const flags = values.map((_, index) =>
    index === columnIndex ? overridden : isOverridden(row, index)
  );

  return flags.some(Boolean)
    ? { key: row.key, values, overridden: flags }
    : { key: row.key, values };
}

/**
 * Evaluate a column's generator for one row
 *
 * The row's key is bound as `KEY`, which is what the parser makes of the `key` a User writes —
 * bare identifiers are normalised to uppercase, so the two spellings are the same reference.
 *
 * @returns The generated number, or the error value explaining why there isn't one
 */
function generateCell(
  generator: string,
  key: number,
  source: NamespaceSource
): number | FormulaError {
  const context: FormulaContext = {
    variables: { KEY: key },
    namespaces: namespacesFor(source, 'curve-generator'),
  };

  return evaluateFormulaString(generator, context);
}

/**
 * Refill every generated cell of a curve, keeping the hand-tuned ones
 *
 * A hand-entered column keeps its values — it has no pattern to restore — but loses any stale
 * override flag, since a flag means "deviates from the generator" and there is none. A row
 * missing a generated cell gains one, which is what makes "extend the key range" work: add the
 * rows, regenerate, and the generated columns arrive.
 *
 * A cell whose generator fails keeps whatever it had. That is deliberate: refusing the whole
 * regeneration over one bad formula would leave the User with neither the old table nor the new
 * one, and the report names every failure.
 *
 * @param curve - The curve to regenerate
 * @param source - The ruleset, for the `const.*` a generator may name
 * @returns The regenerated curve and a report of what happened
 */
export function regenerateCurve(
  curve: Curve,
  source: NamespaceSource = {}
): { curve: Curve; report: RegenerationReport } {
  const report: RegenerationReport = { written: 0, kept: 0, errors: [] };

  const rows = curve.rows.map((row) => {
    let next = row;

    curve.columns.forEach((column, columnIndex) => {
      if (column.generator === undefined) {
        // A flag on a column with no generator means nothing — there is no pattern to deviate
        // from — and leaving it would silently refuse to fill the cell if a generator came back
        if (isOverridden(next, columnIndex)) {
          next = withCell(next, columnIndex, next.values[columnIndex] ?? 0, false);
        }
        return;
      }

      if (isOverridden(row, columnIndex)) {
        report.kept++;
        return;
      }

      const generated = generateCell(column.generator, row.key, source);
      if (isFormulaError(generated)) {
        report.errors.push({ key: row.key, column: column.name, error: generated });
        return;
      }

      report.written++;
      next = withCell(next, columnIndex, generated, false);
    });

    return next;
  });

  return { curve: { ...curve, rows }, report };
}

/**
 * Record a hand edit to one cell
 *
 * Editing a generated cell is what *makes* it an override — there is no separate "mark as
 * overridden" gesture, because a User who types a number into a generated column has already
 * said what they mean. A column with no generator has nothing to deviate from, so its cells take
 * the value without a flag.
 *
 * @param curve - The curve being edited
 * @param key - Which row
 * @param columnName - Which column, by its formula name
 * @param value - The number the User typed
 * @returns The edited curve; unchanged if the row or column does not exist
 */
export function setCurveCell(curve: Curve, key: number, columnName: string, value: number): Curve {
  const columnIndex = curve.columns.findIndex((column) => column.name === columnName);
  if (columnIndex === -1) return curve;

  const isGenerated = curve.columns[columnIndex].generator !== undefined;

  return {
    ...curve,
    rows: curve.rows.map((row) =>
      row.key === key ? withCell(row, columnIndex, value, isGenerated) : row
    ),
  };
}

/**
 * Flag every cell of one column as hand-tuned
 *
 * What "add a generator to a column that did not have one" has to do first (TICKET-CRV-03). Every
 * value already in that column was typed by somebody; without the flags, the next regeneration
 * would overwrite the lot, which is the exact silent rebalance this module exists to prevent.
 * Concept 06 says the same thing about importing the sheet: bring the column in as-is with the
 * cells flagged, then decide which ones to hand back to the pattern.
 *
 * @param curve - The curve being edited
 * @param columnId - Which column, by its stable id
 * @returns The curve with that column's cells flagged; unchanged if the column does not exist
 */
export function flagColumnAsOverridden(curve: Curve, columnId: string): Curve {
  const columnIndex = curve.columns.findIndex((column) => column.id === columnId);
  if (columnIndex === -1) return curve;

  return {
    ...curve,
    rows: curve.rows.map((row) => withCell(row, columnIndex, row.values[columnIndex] ?? 0, true)),
  };
}

/**
 * Clear one cell's override, putting the generated value back
 *
 * The inverse of `setCurveCell`, and the answer to "was that anomalous cell deliberate?" — clear
 * the flag and the pattern refills it. A cell whose generator fails keeps its value and stays
 * flagged, since dropping the flag would silently adopt a number nobody chose.
 *
 * @param curve - The curve being edited
 * @param key - Which row
 * @param columnName - Which column, by its formula name
 * @param source - The ruleset, for the `const.*` the generator may name
 * @returns The edited curve; unchanged if the row, the column, or its generator is missing
 */
export function clearCurveOverride(
  curve: Curve,
  key: number,
  columnName: string,
  source: NamespaceSource = {}
): Curve {
  const columnIndex = curve.columns.findIndex((column) => column.name === columnName);
  const generator = curve.columns[columnIndex]?.generator;
  if (generator === undefined) return curve;

  if (!curve.rows.some((row) => row.key === key)) return curve;

  const generated = generateCell(generator, key, source);
  if (isFormulaError(generated)) return curve;

  return {
    ...curve,
    rows: curve.rows.map((row) =>
      row.key === key ? withCell(row, columnIndex, generated, false) : row
    ),
  };
}
