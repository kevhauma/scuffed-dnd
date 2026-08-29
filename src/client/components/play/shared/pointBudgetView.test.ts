/**
 * Point Budget View Tests
 *
 * **Validates: Concept 06; Concept 20; Requirements 16.6**
 */

import { describe, expect, it } from 'vitest';
import { formulaError } from '#shared/engine/formula/errors';
import type { StatAllocationResult } from '#shared/engine/skillAllocation';
import { toPointBudgetView } from './pointBudgetView';

function result(overrides: Partial<StatAllocationResult> = {}): StatAllocationResult {
  return {
    isValid: true,
    pointsSpent: 4,
    grantedPoints: 0,
    pointBudget: 15,
    pointsRemaining: 11,
    isOverBudget: false,
    gains: [],
    violations: [],
    skillViolations: [],
    unknownStatIds: [],
    ...overrides,
  };
}

describe('toPointBudgetView', () => {
  it('should return null when there is no allocation to show', () => {
    expect(toPointBudgetView(null)).toBeNull();
  });

  it('should carry the numbers through unchanged', () => {
    expect(toPointBudgetView(result())).toEqual({
      pointsSpent: 4,
      grantedPoints: 0,
      pointBudget: { value: 15, error: null },
      pointsRemaining: { value: 11, error: null },
      isOverBudget: false,
    });
  });

  it("should carry the DM's grant through, so the tally can say where the pool came from", () => {
    expect(toPointBudgetView(result({ grantedPoints: 3 }))?.grantedPoints).toBe(3);
  });

  it('should describe an unavailable budget rather than reading it as zero', () => {
    const view = toPointBudgetView(
      result({
        pointBudget: formulaError('undefined-variable', 'no xp_thresholds curve'),
        pointsRemaining: formulaError('undefined-variable', 'no xp_thresholds curve'),
        isValid: false,
      })
    );

    expect(view?.pointBudget.value).toBeNull();
    expect(view?.pointBudget.error).toContain('xp_thresholds');
    expect(view?.pointsRemaining.error).toContain('xp_thresholds');
  });

  it('should keep the spend readable even when the pool is not', () => {
    const view = toPointBudgetView(
      result({ pointBudget: formulaError('undefined-variable', 'gone'), pointsSpent: 7 })
    );

    expect(view?.pointsSpent).toBe(7);
  });

  it('should pass the over-budget verdict straight through', () => {
    expect(toPointBudgetView(result({ isOverBudget: true }))?.isOverBudget).toBe(true);
  });
});
