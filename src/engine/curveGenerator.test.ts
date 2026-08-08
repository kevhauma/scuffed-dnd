/**
 * Curve Generation Tests
 *
 * The contract is that regenerating a progression can never quietly rebalance the game, so the
 * cases that matter are the ones where the generator and a hand-tuned cell disagree — including
 * the one the sheet actually has, where the generator changed *under* an override.
 *
 * **Validates: Concept 06; Concept 00 §1.1; spec §5.6, §7**
 */

import { describe, expect, it } from 'vitest';
import type { Constant, Curve } from '../types/config';
import { clearCurveOverride, regenerateCurve, setCurveCell } from './curveGenerator';
import { describeFormulaError } from './formula/errors';

const constants: Constant[] = [
  {
    id: 'id-mult',
    name: 'point_multiplier',
    displayName: 'Point multiplier',
    description: 'What a main-type point is worth',
    value: 0.75,
  },
];

/**
 * The point-buy shape from Concept 06: a generated column beside a hand-entered one
 *
 * `main_type` is the page's confirmed derivation, `0.75 × (points + 1)`; `non_type` is authored
 * by hand and has no generator at all.
 */
function pointBuy(overrides: Partial<Curve> = {}): Curve {
  return {
    id: 'curve-pb',
    name: 'point_buy',
    displayName: 'Point buy',
    description: 'Points spent converted to stat gain',
    keyName: 'points',
    columns: [
      { id: 'c-non', name: 'non_type' },
      { id: 'c-main', name: 'main_type', generator: 'const.point_multiplier * (key + 1)' },
    ],
    rows: [
      { key: 0, values: [0, 0] },
      { key: 1, values: [1, 0] },
      { key: 2, values: [1, 0] },
    ],
    interpolation: 'step',
    outOfRange: 'clamp',
    lookupDirection: 'forward',
    ...overrides,
  };
}

/** The generated column's values, in row order */
function generated(curve: Curve): number[] {
  return curve.rows.map((row) => row.values[1]);
}

describe('regenerateCurve', () => {
  it('should fill a generated column from its formula, row by row', () => {
    const { curve, report } = regenerateCurve(pointBuy(), { constants });

    expect(generated(curve)).toEqual([0.75, 1.5, 2.25]);
    expect(report).toEqual({ written: 3, kept: 0, errors: [] });
  });

  it('should resolve const.* in a generator, so retuning one moves the whole column', () => {
    const retuned = [{ ...constants[0], value: 1 }];

    expect(generated(regenerateCurve(pointBuy(), { constants: retuned }).curve)).toEqual([1, 2, 3]);
  });

  it('should not touch a column with no generator', () => {
    const { curve } = regenerateCurve(pointBuy(), { constants });

    expect(curve.rows.map((row) => row.values[0])).toEqual([0, 1, 1]);
  });

  it('should keep every overridden cell and count it', () => {
    const withOverride = pointBuy();
    withOverride.rows[1] = { key: 1, values: [1, 4.642857], overridden: [false, true] };

    const { curve, report } = regenerateCurve(withOverride, { constants });

    expect(generated(curve)).toEqual([0.75, 4.642857, 2.25]);
    expect(report).toEqual({ written: 2, kept: 1, errors: [] });
  });

  it('should keep an override even when the generator changed under it', () => {
    const withOverride = pointBuy({
      columns: [
        { id: 'c-non', name: 'non_type' },
        // The User flattened the archetype advantage after hand-tuning one row
        { id: 'c-main', name: 'main_type', generator: '0.5 * (key + 1)' },
      ],
    });
    withOverride.rows[1] = { key: 1, values: [1, 99], overridden: [false, true] };

    const { curve, report } = regenerateCurve(withOverride, { constants });

    expect(generated(curve)).toEqual([0.5, 99, 1.5]);
    expect(report.kept).toBe(1);
  });

  it('should fill rows added past the end of the table', () => {
    const extended = pointBuy();
    extended.rows.push({ key: 3, values: [2] });

    const { curve, report } = regenerateCurve(extended, { constants });

    expect(generated(curve)).toEqual([0.75, 1.5, 2.25, 3]);
    expect(report.written).toBe(4);
  });

  it('should report a generator that cannot produce a number, keeping what was there', () => {
    const broken = pointBuy({
      columns: [
        { id: 'c-non', name: 'non_type' },
        { id: 'c-main', name: 'main_type', generator: 'const.nope * key' },
      ],
    });
    broken.rows[0] = { key: 0, values: [0, 7] };

    const { curve, report } = regenerateCurve(broken, { constants });

    expect(generated(curve)[0]).toBe(7);
    expect(report.written).toBe(0);
    expect(report.errors).toHaveLength(3);
    // Addressed, not described — CRV-03 highlights the cell rather than parsing a sentence
    expect(report.errors[0]).toMatchObject({ key: 0, column: 'main_type' });
    expect(describeFormulaError(report.errors[0].error)).toBe('Unknown member: const.nope');
  });

  it('should fill a row that has no cell for the generated column, without leaving a hole', () => {
    // The "extend the key range" case with a hand-entered column *before* the generated one:
    // assigning past the end would put a hole in a `number[]`, which a lookup reads as NaN
    const extended = pointBuy();
    extended.rows.push({ key: 3, values: [] });

    const { curve } = regenerateCurve(extended, { constants });
    const added = curve.rows[3];

    expect(added.values).toEqual([0, 3]);
    expect(added.values.every((value) => Number.isFinite(value))).toBe(true);
  });

  it('should drop a stale flag left on a column whose generator was removed', () => {
    const degenerated = pointBuy({
      columns: [
        { id: 'c-non', name: 'non_type' },
        { id: 'c-main', name: 'main_type' },
      ],
    });
    degenerated.rows[1] = { key: 1, values: [1, 42], overridden: [false, true] };

    const { curve, report } = regenerateCurve(degenerated, { constants });

    // The flag meant "deviates from the generator"; with none, keeping it would silently refuse
    // to fill the cell if a generator ever came back
    expect(curve.rows[1].values).toEqual([1, 42]);
    expect(curve.rows[1].overridden).toBeUndefined();
    expect(report.kept).toBe(0);
  });

  it('should leave a curve with no generators exactly as it was', () => {
    const plain = pointBuy({
      columns: [
        { id: 'c-non', name: 'non_type' },
        { id: 'c-main', name: 'main_type' },
      ],
    });

    const { curve, report } = regenerateCurve(plain, { constants });

    expect(curve.rows).toEqual(plain.rows);
    expect(report).toEqual({ written: 0, kept: 0, errors: [] });
  });

  it('should leave no overridden array behind when nothing is overridden', () => {
    const { curve } = regenerateCurve(pointBuy(), { constants });

    expect(curve.rows.every((row) => row.overridden === undefined)).toBe(true);
  });
});

describe('setCurveCell', () => {
  it('should flag a hand edit to a generated cell as an override', () => {
    const edited = setCurveCell(pointBuy(), 1, 'main_type', 42);

    expect(edited.rows[1].values[1]).toBe(42);
    expect(edited.rows[1].overridden).toEqual([false, true]);
  });

  it('should survive a regeneration once flagged', () => {
    const edited = setCurveCell(pointBuy(), 1, 'main_type', 42);

    const { curve, report } = regenerateCurve(edited, { constants });

    expect(generated(curve)).toEqual([0.75, 42, 2.25]);
    expect(report.kept).toBe(1);
  });

  it('should not flag a column that has no generator to deviate from', () => {
    const edited = setCurveCell(pointBuy(), 1, 'non_type', 9);

    expect(edited.rows[1].values[0]).toBe(9);
    expect(edited.rows[1].overridden).toBeUndefined();
  });

  it('should leave the curve alone for an unknown row or column', () => {
    const curve = pointBuy();

    expect(setCurveCell(curve, 99, 'main_type', 1)).toEqual(curve);
    expect(setCurveCell(curve, 1, 'nope', 1)).toEqual(curve);
  });
});

describe('clearCurveOverride', () => {
  it('should put the generated value back and drop the flag', () => {
    const edited = setCurveCell(pointBuy(), 1, 'main_type', 42);

    const cleared = clearCurveOverride(edited, 1, 'main_type', { constants });

    expect(cleared.rows[1].values[1]).toBe(1.5);
    expect(cleared.rows[1].overridden).toBeUndefined();
  });

  it('should leave a cleared cell free to move with the generator again', () => {
    const edited = setCurveCell(pointBuy(), 1, 'main_type', 42);
    const cleared = clearCurveOverride(edited, 1, 'main_type', { constants });

    const { report } = regenerateCurve(cleared, { constants });

    expect(report).toEqual({ written: 3, kept: 0, errors: [] });
  });

  it('should keep the value and the flag when the generator cannot produce a number', () => {
    const broken = pointBuy({
      columns: [
        { id: 'c-non', name: 'non_type' },
        { id: 'c-main', name: 'main_type', generator: 'const.nope * key' },
      ],
    });
    const edited = setCurveCell(broken, 1, 'main_type', 42);

    const cleared = clearCurveOverride(edited, 1, 'main_type', { constants });

    // Dropping the flag here would silently adopt a number nobody chose
    expect(cleared.rows[1].values[1]).toBe(42);
    expect(cleared.rows[1].overridden).toEqual([false, true]);
  });

  it('should do nothing for a column with no generator', () => {
    const curve = pointBuy();

    expect(clearCurveOverride(curve, 1, 'non_type', { constants })).toEqual(curve);
  });
});
