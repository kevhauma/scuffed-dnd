/**
 * Derived Value
 *
 * One engine result, turned into something a play-mode component can render: the number, or the
 * error that stands in for it. Shared by the sheet and the creation wizard so the two surfaces
 * interpret a `FormulaResult` the same way and neither has to import the error helpers to decide
 * what to draw (TICKET-STAT-03).
 *
 * **Validates: Concept 00 §7; Requirements 16.6**
 */

import { describeFormulaError, isFormulaError } from '#shared/engine/formula/errors';
import type { FormulaResult } from '#shared/types/formula';

/**
 * A derived number for display: the value, or the error that stands in for it
 */
export type DerivedValue = { value: number; error: null } | { value: null; error: string };

/**
 * Turn one engine result into something a component can render
 *
 * A missing entry (a stat the engine produced nothing for) reads as 0 rather than an error —
 * that is absence, not breakage.
 *
 * @param result - The engine's entry for this value, or `undefined` when it produced none
 * @returns The number to show, or the described error to chip
 */
export function toDerivedValue(result: FormulaResult | undefined): DerivedValue {
  if (result === undefined) return { value: 0, error: null };
  if (isFormulaError(result)) return { value: null, error: describeFormulaError(result) };
  return { value: result, error: null };
}
