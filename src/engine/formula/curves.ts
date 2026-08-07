/**
 * Curves Namespace and Lookup
 *
 * What backs `curve.<name>(x)` in a formula (Concept 06). A curve is a named lookup table —
 * point-buy, XP thresholds, challenge rating — so a progression is data the User can see and tune
 * rather than a chain of nested conditionals buried in a formula string.
 *
 * **Every mode is one lookup.** The table is first reduced to a list of `(input, output)` pairs:
 * forward reads `key → value`, reverse reads `value → key`. Everything after that — `step` versus
 * `linear`, and what happens past either end — is the same code for both directions, which is why
 * reverse needs no rule of its own.
 *
 * Precisely, reverse answers **the key of the greatest value ≤ the input**. Concept 06 phrases the
 * same thing as "the highest key whose value is ≤ the input", and the two agree exactly when the
 * value column is non-decreasing — which `engine/validator.ts` reports on, because a reverse
 * lookup over a column that doubles back is not well-defined under *any* phrasing. Validation
 * reports rather than refuses, so this still answers for an unsound table; it answers by the
 * sorted reading above rather than by pretending the column ascends.
 *
 * Resolution is by **name**, like `constants.ts`: the in-memory formula holds the display
 * spelling and the persisted one holds the curve's id, so renaming a curve re-spells every
 * formula naming it (TICKET-REF-01). Column names are **not** id-resolved yet — see the ticket's
 * implementation notes.
 *
 * **Validates: Concept 06; spec §5.1, §5.5, §7**
 */

import type { Curve, CurveColumn, CurveInterpolation } from '../../types/config';
import type { FormulaError, FormulaResult, NamespaceResolver } from '../../types/formula';
import { formulaError, isFormulaError } from './errors';

/** One `(input, output)` pair of the table being read, whichever direction that is */
interface LookupPair {
  input: number;
  output: number;
}

/**
 * The column a lookup reads, or an error naming what was asked for
 *
 * A curve with exactly one column may be called without naming it — that is the common case and
 * the concept page's own `curve.cr(x)` shape. Anything else has to say which column it means,
 * because picking one silently is how the wrong number ends up on a character sheet.
 */
function selectColumn(curve: Curve, property?: string): CurveColumn | FormulaError {
  if (property === undefined) {
    if (curve.columns.length === 1) return curve.columns[0];

    return formulaError(
      'unknown-member',
      curve.columns.length === 0
        ? `curve.${curve.name} has no value columns`
        : `curve.${curve.name} has ${curve.columns.length} columns — name one, as curve.${curve.name}.${curve.columns[0].name}(…)`
    );
  }

  const column = curve.columns.find((candidate) => candidate.name === property);
  if (column) return column;

  return formulaError('unknown-member', `Unknown member: curve.${curve.name}.${property}`);
}

/**
 * The table as `(input, output)` pairs, sorted by input ascending
 *
 * A cell that is missing or not a finite number makes the whole table unreadable rather than one
 * `NaN` pair: `NaN` is a `number` as far as `FormulaResult` is concerned, so it would sail past
 * `isFormulaError` and `asNumber` and land on a character sheet (Concept 00 §7 — a broken value is
 * an error, never a silently wrong number). It is reachable: a column added without backfilling
 * the rows is exactly what `engine/validator.ts` reports and does not prevent.
 *
 * Sorting rather than trusting the stored order matters for `reverse`, whose input axis is a value
 * column — validated as non-decreasing, but validation reports rather than refuses, so an unsound
 * table must still be read in a defined order rather than confidently backwards.
 *
 * @param curve - The curve being read
 * @param column - The value column selected for this lookup
 * @param columnIndex - Its position in `curve.columns`
 * @returns The pairs, or the error that makes them unreadable
 */
function lookupPairs(
  curve: Curve,
  column: CurveColumn,
  columnIndex: number
): LookupPair[] | FormulaError {
  const pairs: LookupPair[] = [];

  for (const row of curve.rows) {
    const value = row.values[columnIndex];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return formulaError(
        'not-evaluable',
        `curve.${curve.name} has no value for ${column.name} at ${curve.keyName} ${row.key}`
      );
    }

    pairs.push(
      curve.lookupDirection === 'reverse'
        ? { input: value, output: row.key }
        : { input: row.key, output: value }
    );
  }

  return pairs.sort((a, b) => a.input - b.input);
}

/** The value at `input` on the line through two pairs */
function extend(from: LookupPair, to: LookupPair, input: number): number {
  const run = to.input - from.input;
  // Two rows sharing an input describe a vertical step, which has no slope to extend along
  if (run === 0) return to.output;

  return from.output + ((to.output - from.output) * (input - from.input)) / run;
}

/**
 * Continue the table past `anchor`, in the shape the curve is read in
 *
 * `linear` extends the line through the two end rows. `step` extends the **grid** instead: the
 * end pair's spacing keeps repeating, and the answer is the last synthetic row at or below the
 * input. That distinction is the whole point of a step curve — extending an XP table linearly
 * would answer "level 4.4", when the reason the table steps is that you stay level 4 until you
 * cross the next threshold.
 *
 * @param from - The inner of the two rows nearest the end being extended
 * @param anchor - The end row itself
 * @param input - The out-of-range input
 * @param interpolation - How the curve reads between rows
 */
function extrapolateFrom(
  from: LookupPair,
  anchor: LookupPair,
  input: number,
  interpolation: CurveInterpolation
): number {
  if (interpolation === 'linear') return extend(from, anchor, input);

  // Measured outward-positive along the input axis, so `floor` lands on the last synthetic row
  // at or below the input whichever end is being extended
  const inputStep = Math.abs(anchor.input - from.input);
  if (inputStep === 0) return anchor.output;

  const outputStep =
    anchor.input > from.input
      ? anchor.output - from.output // extending past the last row
      : from.output - anchor.output; // extending before the first

  return anchor.output + Math.floor((input - anchor.input) / inputStep) * outputStep;
}

/**
 * Answer an input that falls outside the table, per the curve's `outOfRange` mode
 *
 * @param curve - The curve being read, for its mode and its name in the message
 * @param pairs - The table, sorted by input, non-empty
 * @param input - The out-of-range input
 * @returns The number that mode produces, or the refusal it produces instead
 */
function outsideTable(curve: Curve, pairs: LookupPair[], input: number): FormulaResult {
  const first = pairs[0];
  const last = pairs[pairs.length - 1];
  const below = input < first.input;

  switch (curve.outOfRange) {
    case 'clamp':
      return below ? first.output : last.output;

    case 'extrapolate':
      // A single-row curve has nothing to continue, so it holds its one value — the same
      // answer clamping would give.
      if (pairs.length === 1) return first.output;
      return below
        ? extrapolateFrom(pairs[1], first, input, curve.interpolation)
        : extrapolateFrom(pairs[pairs.length - 2], last, input, curve.interpolation);

    case 'error': {
      // Named for the axis actually being searched: a reverse curve is looked up along its value
      // column, so quoting `keyName` here would name the wrong numbers entirely
      const axis = curve.lookupDirection === 'reverse' ? 'value' : curve.keyName;
      return formulaError(
        'out-of-range',
        `curve.${curve.name} has no row for ${axis} ${input} — its range is ${first.input} to ${last.input}`
      );
    }

    default: {
      // Config and engine disagree about the enum — a bug, not a ruleset problem
      const _exhaustive: never = curve.outOfRange;
      throw new Error(`Unknown out-of-range mode: ${_exhaustive}`);
    }
  }
}

/**
 * Read a curve at one input
 *
 * @param curve - The curve to read
 * @param input - The key (forward) or the value (reverse) being looked up
 * @param property - Which value column, required unless the curve has exactly one
 * @returns The looked-up number, or a `FormulaError` explaining why there isn't one
 */
export function lookupCurve(curve: Curve, input: number, property?: string): FormulaResult {
  const column = selectColumn(curve, property);
  if (isFormulaError(column)) return column;

  const pairs = lookupPairs(curve, column, curve.columns.indexOf(column));
  if (isFormulaError(pairs)) return pairs;

  if (pairs.length === 0) {
    return formulaError('not-evaluable', `curve.${curve.name} has no rows`);
  }

  if (input < pairs[0].input || input > pairs[pairs.length - 1].input) {
    return outsideTable(curve, pairs, input);
  }

  // The last pair at or below the input. Present by construction: the range check above
  // guarantees `input >= pairs[0].input`.
  let lowerIndex = 0;
  for (let index = 0; index < pairs.length; index++) {
    if (pairs[index].input <= input) lowerIndex = index;
  }

  const lower = pairs[lowerIndex];
  if (curve.interpolation === 'step' || lower.input === input) {
    return lower.output;
  }

  // `linear`, strictly between two rows — the range check rules out being past the last one
  return extend(lower, pairs[lowerIndex + 1], input);
}

/**
 * Build the `curve` resolver for a configuration's curves
 *
 * Curves are callable, never readable: `curve.xp_thresholds` without an argument list is a
 * mistake with its own message rather than a silent zero or a stray function value.
 *
 * @param curves - The configuration's curves; absent is the same as none
 * @returns A resolver for `FormulaContext.namespaces.curve`
 */
export function curvesNamespace(curves: Curve[] = []): NamespaceResolver {
  // First spelling wins, matching `references.ts`'s reference index — see `constantsNamespace`
  const byName = new Map<string, Curve>();
  for (const curve of curves) {
    if (!byName.has(curve.name)) byName.set(curve.name, curve);
  }

  return {
    resolve(member) {
      if (!byName.has(member)) return undefined;

      return formulaError(
        'not-evaluable',
        `curve.${member} is a lookup table — call it, as curve.${member}(x)`
      );
    },

    call(member, args, property) {
      const curve = byName.get(member);
      if (!curve) return undefined;

      if (args.length !== 1) {
        return formulaError(
          'wrong-arity',
          `curve.${member} expects exactly 1 argument, got ${args.length}`
        );
      }

      return lookupCurve(curve, args[0], property);
    },
  };
}
