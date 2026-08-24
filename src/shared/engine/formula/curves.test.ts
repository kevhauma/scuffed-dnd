/**
 * Curve Lookup and Namespace Tests
 *
 * One describe per lookup mode, because the modes are the contract: `step` versus `linear`, what
 * happens past either end, and the two directions. Boundary keys — an input landing exactly on a
 * row — get their own cases in each, since that is where an off-by-one hides.
 *
 * **Validates: Concept 06; spec §5.1, §5.5**
 */

import { describe, expect, it } from 'vitest';
import type { Curve } from '../../types/config';
import type { FormulaError } from '../../types/formula';
import { curvesNamespace, lookupCurve } from './curves';
import { describeFormulaError, isFormulaError } from './errors';
import { evaluateFormulaString } from './evaluator';

/** A curve with sensible defaults, so each test states only what it is about */
function makeCurve(overrides: Partial<Curve> = {}): Curve {
  return {
    id: 'curve-1',
    name: 'growth',
    displayName: 'Growth',
    description: 'Test curve',
    keyName: 'level',
    columns: [{ id: 'col-1', name: 'value' }],
    rows: [
      { key: 0, values: [0] },
      { key: 2, values: [10] },
      { key: 4, values: [30] },
    ],
    interpolation: 'step',
    outOfRange: 'clamp',
    lookupDirection: 'forward',
    ...overrides,
  };
}

/** The point-buy table from Concept 06, three affinity columns wide */
function pointBuy(): Curve {
  return makeCurve({
    id: 'curve-pb',
    name: 'point_buy',
    displayName: 'Point buy',
    keyName: 'points',
    columns: [
      { id: 'c-non', name: 'non_type' },
      { id: 'c-sub', name: 'sub_type' },
      { id: 'c-main', name: 'main_type' },
    ],
    rows: [
      { key: 0, values: [0, 0, 0.75] },
      { key: 1, values: [1, 1, 1.5] },
      { key: 2, values: [1, 1, 2.25] },
      { key: 3, values: [1, 2, 3.0] },
    ],
  });
}

/** The XP table from Concept 06 — authored level → XP, read XP → level */
function xpThresholds(): Curve {
  return makeCurve({
    id: 'curve-xp',
    name: 'xp_thresholds',
    displayName: 'XP thresholds',
    keyName: 'level',
    columns: [{ id: 'c-xp', name: 'xp_required' }],
    rows: [
      { key: 1, values: [0] },
      { key: 2, values: [300] },
      { key: 3, values: [900] },
      { key: 4, values: [2700] },
    ],
    lookupDirection: 'reverse',
    outOfRange: 'extrapolate',
  });
}

describe('lookupCurve — step interpolation', () => {
  it('should hold the last row at or below the key', () => {
    expect(lookupCurve(makeCurve(), 3)).toBe(10);
  });

  it('should read a boundary key as that row, not the one before it', () => {
    const curve = makeCurve();

    expect(lookupCurve(curve, 0)).toBe(0);
    expect(lookupCurve(curve, 2)).toBe(10);
    expect(lookupCurve(curve, 4)).toBe(30);
  });

  it('should hold the same value across a whole band', () => {
    const curve = makeCurve();

    expect(lookupCurve(curve, 2.01)).toBe(10);
    expect(lookupCurve(curve, 3.99)).toBe(10);
  });
});

describe('lookupCurve — linear interpolation', () => {
  it('should interpolate between the two rows either side', () => {
    const curve = makeCurve({ interpolation: 'linear' });

    expect(lookupCurve(curve, 1)).toBe(5);
    expect(lookupCurve(curve, 3)).toBe(20);
  });

  it('should return the row exactly when the key lands on one', () => {
    const curve = makeCurve({ interpolation: 'linear' });

    expect(lookupCurve(curve, 0)).toBe(0);
    expect(lookupCurve(curve, 2)).toBe(10);
    expect(lookupCurve(curve, 4)).toBe(30);
  });
});

describe('lookupCurve — out of range', () => {
  it('should clamp to the nearest end', () => {
    const curve = makeCurve({ outOfRange: 'clamp' });

    expect(lookupCurve(curve, -5)).toBe(0);
    expect(lookupCurve(curve, 99)).toBe(30);
  });

  it('should extrapolate a step curve onto the continued grid, not along a line', () => {
    const curve = makeCurve({ outOfRange: 'extrapolate' });

    // Below: the 0 → 2 rows are 10 apart, so the grid continues with a row at -2 worth -10,
    // and -1 holds that row rather than reading half way
    expect(lookupCurve(curve, -2)).toBe(-10);
    expect(lookupCurve(curve, -1)).toBe(-10);
    // Above: the 2 → 4 rows are 20 apart, so the next row is at 6, and 5 still holds 30
    expect(lookupCurve(curve, 6)).toBe(50);
    expect(lookupCurve(curve, 5)).toBe(30);
  });

  it('should extrapolate a linear curve along the line through the end rows', () => {
    const curve = makeCurve({ outOfRange: 'extrapolate', interpolation: 'linear' });

    expect(lookupCurve(curve, -1)).toBe(-5);
    expect(lookupCurve(curve, 5)).toBe(40);
  });

  it('should hold its one value when a single-row curve is extrapolated', () => {
    const curve = makeCurve({ outOfRange: 'extrapolate', rows: [{ key: 3, values: [7] }] });

    expect(lookupCurve(curve, 0)).toBe(7);
    expect(lookupCurve(curve, 100)).toBe(7);
  });

  it('should refuse with an error value naming the range', () => {
    const curve = makeCurve({ outOfRange: 'error' });

    const result = lookupCurve(curve, 99);

    expect(isFormulaError(result)).toBe(true);
    if (!isFormulaError(result)) return;
    expect(result.kind).toBe('out-of-range');
    expect(result.message).toContain('99');
    expect(result.message).toContain('0 to 4');
  });

  it('should not treat the ends themselves as out of range', () => {
    const curve = makeCurve({ outOfRange: 'error' });

    expect(lookupCurve(curve, 0)).toBe(0);
    expect(lookupCurve(curve, 4)).toBe(30);
  });
});

describe('lookupCurve — reverse direction', () => {
  it('should answer with the highest key whose value is at or below the input', () => {
    const curve = xpThresholds();

    expect(lookupCurve(curve, 0)).toBe(1);
    expect(lookupCurve(curve, 299)).toBe(1);
    expect(lookupCurve(curve, 2699)).toBe(3);
  });

  it('should promote exactly on a threshold, not one short of it', () => {
    const curve = xpThresholds();

    expect(lookupCurve(curve, 300)).toBe(2);
    expect(lookupCurve(curve, 900)).toBe(3);
    expect(lookupCurve(curve, 2700)).toBe(4);
  });

  it('should keep producing whole levels past the last row when extrapolating', () => {
    const curve = xpThresholds();

    // The 900 → 2700 rows gain a level per 1800 XP, so the next threshold is 4500
    expect(lookupCurve(curve, 4500)).toBe(5);
    expect(lookupCurve(curve, 6299)).toBe(5);
    expect(lookupCurve(curve, 6300)).toBe(6);
    // …and short of the next one you are still the level you were — the reason `step` exists
    expect(lookupCurve(curve, 3412)).toBe(4);
  });

  it('should refuse below the first value when configured to', () => {
    const curve = makeCurve({
      lookupDirection: 'reverse',
      outOfRange: 'error',
      rows: [
        { key: 1, values: [100] },
        { key: 2, values: [200] },
      ],
    });

    const result = lookupCurve(curve, 50);

    expect(isFormulaError(result)).toBe(true);
    if (isFormulaError(result)) expect(result.kind).toBe('out-of-range');
  });

  it('should still answer in a defined order when the value column doubles back', () => {
    // `engine/validator.ts` reports a decreasing column on a reverse curve as an error, but it
    // reports rather than refuses — so the lookup reads the sorted table rather than pretending
    // the column ascends. The answer is "the key of the greatest value at or below the input".
    const curve = makeCurve({
      lookupDirection: 'reverse',
      rows: [
        { key: 1, values: [500] },
        { key: 2, values: [100] },
        { key: 3, values: [900] },
      ],
    });

    expect(lookupCurve(curve, 400)).toBe(2);
    expect(lookupCurve(curve, 600)).toBe(1);
  });
});

describe('lookupCurve — column selection', () => {
  it('should read the named column', () => {
    const curve = pointBuy();

    expect(lookupCurve(curve, 3, 'non_type')).toBe(1);
    expect(lookupCurve(curve, 3, 'sub_type')).toBe(2);
    expect(lookupCurve(curve, 3, 'main_type')).toBe(3);
  });

  it('should refuse a call that names no column when there is more than one', () => {
    const result = lookupCurve(pointBuy(), 3);

    expect(isFormulaError(result)).toBe(true);
    if (!isFormulaError(result)) return;
    expect(result.kind).toBe('unknown-member');
    expect(result.message).toContain('3 columns');
  });

  it('should name the column it could not find', () => {
    const result = lookupCurve(pointBuy(), 3, 'nope');

    expect(isFormulaError(result)).toBe(true);
    if (!isFormulaError(result)) return;
    expect(result.message).toBe('Unknown member: curve.point_buy.nope');
  });

  it('should report a curve with no rows rather than inventing a number', () => {
    const result = lookupCurve(makeCurve({ rows: [] }), 1);

    expect(isFormulaError(result)).toBe(true);
    if (isFormulaError(result)) expect(result.message).toContain('no rows');
  });

  it('should refuse a table with a missing cell rather than reading NaN', () => {
    // Reachable whenever a column is added without backfilling the rows. NaN is a `number` as
    // far as the result type is concerned, so it would reach a character sheet unchallenged.
    const curve = pointBuy();
    curve.rows[2] = { key: 2, values: [1, 1] };

    const result = lookupCurve(curve, 2, 'main_type');

    expect(isFormulaError(result)).toBe(true);
    if (!isFormulaError(result)) return;
    expect(result.message).toBe('curve.point_buy has no value for main_type at points 2');
  });

  it('should refuse a non-finite cell for the same reason', () => {
    const curve = makeCurve({ rows: [{ key: 1, values: [Number.NaN] }] });

    expect(isFormulaError(lookupCurve(curve, 1))).toBe(true);
  });
});

describe('curvesNamespace', () => {
  const namespace = curvesNamespace([makeCurve(), pointBuy()]);

  it('should call a curve by name', () => {
    expect(namespace.call?.('growth', [3])).toBe(10);
    expect(namespace.call?.('point_buy', [1], 'main_type')).toBe(1.5);
  });

  it('should report an unknown curve as undefined, so the evaluator names it', () => {
    expect(namespace.call?.('nope', [1])).toBeUndefined();
    expect(namespace.resolve('nope')).toBeUndefined();
  });

  it('should refuse to be read without a call', () => {
    const result = namespace.resolve('growth');

    expect(isFormulaError(result)).toBe(true);
    if (!isFormulaError(result)) return;
    expect(result.message).toContain('call it');
  });

  it('should refuse the wrong number of arguments', () => {
    const result = namespace.call?.('growth', [1, 2]);

    expect(isFormulaError(result)).toBe(true);
    if (!isFormulaError(result)) return;
    expect(result.kind).toBe('wrong-arity');
  });

  it('should treat no curves as every curve being unknown', () => {
    expect(curvesNamespace().call?.('growth', [1])).toBeUndefined();
  });

  it('should let the first spelling win when two curves share a name', () => {
    const duplicated = curvesNamespace([
      makeCurve({ id: 'a', rows: [{ key: 0, values: [1] }] }),
      makeCurve({ id: 'b', rows: [{ key: 0, values: [2] }] }),
    ]);

    expect(duplicated.call?.('growth', [0])).toBe(1);
  });
});

describe('curve calls in formulas', () => {
  const curves = [makeCurve(), pointBuy()];

  /** Evaluate with the `curve` namespace available, plus one bare code to mix in */
  function evaluate(formula: string, available: Curve[] = curves) {
    return evaluateFormulaString(formula, {
      variables: { STR: 3 },
      namespaces: { curve: curvesNamespace(available) },
    });
  }

  it('should evaluate the single-column call form', () => {
    expect(evaluate('curve.growth(3)')).toBe(10);
  });

  it('should evaluate the column-selecting call form', () => {
    expect(evaluate('curve.point_buy.main_type(3)')).toBe(3);
    expect(evaluate('curve.point_buy.sub_type(3)')).toBe(2);
  });

  it('should take an expression as its input, not just a literal', () => {
    expect(evaluate('curve.growth(STR)')).toBe(10);
    expect(evaluate('curve.point_buy.main_type(1 + 2)')).toBe(3);
  });

  it('should compose with arithmetic and the function library', () => {
    expect(evaluate('round(curve.point_buy.main_type(3) * 2) + 1')).toBe(7);
  });

  it('should name an unknown curve', () => {
    const result = evaluate('curve.nope(1)');

    expect(isFormulaError(result)).toBe(true);
    expect(describeFormulaError(result as FormulaError)).toContain('Unknown member: curve.nope');
  });

  it('should name an unknown column', () => {
    const result = evaluate('curve.point_buy.nope(1)');

    expect(isFormulaError(result)).toBe(true);
    expect(describeFormulaError(result as FormulaError)).toContain(
      'Unknown member: curve.point_buy.nope'
    );
  });

  it('should propagate an out-of-range refusal as a value rather than throwing', () => {
    const strict = [makeCurve({ outOfRange: 'error' })];

    expect(() => evaluate('curve.growth(99) + 1', strict)).not.toThrow();

    const result = evaluate('curve.growth(99) + 1', strict);
    expect(isFormulaError(result)).toBe(true);
    expect((result as FormulaError).kind).toBe('out-of-range');
  });

  it('should propagate an errored argument without calling the curve', () => {
    const result = evaluate('curve.growth(1 / 0)');

    expect(isFormulaError(result)).toBe(true);
    expect((result as FormulaError).kind).toBe('division-by-zero');
  });

  it('should report a namespace with no curves resolver as unknown', () => {
    const result = evaluateFormulaString('curve.growth(1)', { variables: {} });

    expect(isFormulaError(result)).toBe(true);
    expect((result as FormulaError).message).toBe('Unknown namespace: curve');
  });

  it('should report a call into a namespace that has no callable members', () => {
    const result = evaluateFormulaString('const.bonus_divider(2)', {
      variables: {},
      namespaces: { const: { resolve: () => 5 } },
    });

    expect(isFormulaError(result)).toBe(true);
    expect((result as FormulaError).message).toBe('const.bonus_divider is not callable');
  });
});
