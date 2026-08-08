/**
 * Curve Table Structure Tests
 *
 * The point of these is the invariant, not the arithmetic: `columns`, `values` and `overridden`
 * are three arrays addressed by one index, and a splice that only lands on one of them moves
 * every flag onto the wrong cell. The property test is there because that failure is silent —
 * the table still has numbers in it, they just mean something else.
 *
 * **Validates: Concept 06; spec §5.6**
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Curve } from '../types/config';
import { addCurveColumn, addCurveRow, removeCurveColumn, removeCurveRow } from './curveTable';

function makeCurve(): Curve {
  return {
    id: 'c1',
    name: 'point_buy',
    displayName: 'Point buy',
    description: '',
    keyName: 'points',
    columns: [
      { id: 'col-non', name: 'non' },
      { id: 'col-sub', name: 'sub' },
      { id: 'col-main', name: 'main', generator: '0.75 * (key + 1)' },
    ],
    rows: [
      { key: 0, values: [0, 0, 0.75] },
      { key: 1, values: [1, 1, 1.5], overridden: [false, true, false] },
      { key: 2, values: [1, 1, 2.25] },
    ],
    interpolation: 'step',
    outOfRange: 'error',
    lookupDirection: 'forward',
  };
}

describe('addCurveColumn', () => {
  it('should give every row a cell for the new column', () => {
    const curve = addCurveColumn(makeCurve(), { id: 'col-hyper', name: 'hyper' });

    expect(curve.columns.map((column) => column.name)).toEqual(['non', 'sub', 'main', 'hyper']);
    expect(curve.rows.map((row) => row.values)).toEqual([
      [0, 0, 0.75, 0],
      [1, 1, 1.5, 0],
      [1, 1, 2.25, 0],
    ]);
  });

  it('should keep every existing override on the cell it belonged to', () => {
    const curve = addCurveColumn(makeCurve(), { id: 'col-hyper', name: 'hyper' });

    expect(curve.rows[1].overridden).toEqual([false, true, false, false]);
  });
});

describe('removeCurveColumn', () => {
  it('should drop the removed column cell from every row', () => {
    const curve = removeCurveColumn(makeCurve(), 'col-sub');

    expect(curve.columns.map((column) => column.name)).toEqual(['non', 'main']);
    expect(curve.rows.map((row) => row.values)).toEqual([
      [0, 0.75],
      [1, 1.5],
      [1, 2.25],
    ]);
  });

  it('should carry each surviving flag with its own cell', () => {
    // `sub` was the flagged one, so removing `non` must leave the flag on `sub` — at index 0 now
    const curve = removeCurveColumn(makeCurve(), 'col-non');

    expect(curve.rows[1].overridden).toEqual([true, false]);
  });

  it('should drop the flag array entirely when the flagged column goes', () => {
    const curve = removeCurveColumn(makeCurve(), 'col-sub');

    expect(curve.rows[1].overridden).toBeUndefined();
  });

  it('should leave a curve alone when no column has that id', () => {
    const curve = makeCurve();

    expect(removeCurveColumn(curve, 'nope')).toEqual(curve);
  });
});

describe('addCurveRow', () => {
  it('should insert in key order with one zero cell per column', () => {
    const curve = addCurveRow(makeCurve(), 1.5);

    expect(curve.rows.map((row) => row.key)).toEqual([0, 1, 1.5, 2]);
    expect(curve.rows[2].values).toEqual([0, 0, 0]);
  });

  it('should refuse a key the table already has', () => {
    const curve = makeCurve();

    expect(addCurveRow(curve, 1)).toEqual(curve);
  });
});

describe('removeCurveRow', () => {
  it('should remove the row at that key', () => {
    expect(removeCurveRow(makeCurve(), 1).rows.map((row) => row.key)).toEqual([0, 2]);
  });
});

describe('curve table structure', () => {
  it('should keep values, flags and columns the same length under any edit sequence', () => {
    const edit = fc.oneof(
      fc.record({ kind: fc.constant('add-column' as const), index: fc.nat(20) }),
      fc.record({ kind: fc.constant('remove-column' as const), index: fc.nat(5) }),
      fc.record({ kind: fc.constant('add-row' as const), index: fc.integer({ min: 0, max: 20 }) }),
      fc.record({ kind: fc.constant('remove-row' as const), index: fc.nat(5) })
    );

    fc.assert(
      fc.property(fc.array(edit, { maxLength: 30 }), (edits) => {
        let curve = makeCurve();

        for (const step of edits) {
          if (step.kind === 'add-column') {
            curve = addCurveColumn(curve, { id: `col-${step.index}`, name: `c${step.index}` });
          } else if (step.kind === 'remove-column') {
            curve = removeCurveColumn(
              curve,
              curve.columns[step.index % curve.columns.length]?.id ?? ''
            );
          } else if (step.kind === 'add-row') {
            curve = addCurveRow(curve, step.index);
          } else if (curve.rows.length > 0) {
            curve = removeCurveRow(curve, curve.rows[step.index % curve.rows.length].key);
          }
        }

        for (const row of curve.rows) {
          expect(row.values).toHaveLength(curve.columns.length);
          if (row.overridden) expect(row.overridden).toHaveLength(curve.columns.length);
        }

        // Keys stay unique and sorted, which is what the lookup and the validator both assume
        const keys = curve.rows.map((row) => row.key);
        expect([...keys].sort((a, b) => a - b)).toEqual(keys);
        expect(new Set(keys).size).toBe(keys.length);
      })
    );
  });
});
