/**
 * Point Budget View
 *
 * The engine's allocation verdict, spelled for display. A pure mapper, kept out of the component
 * that renders it for the same reason [derivedValue.ts](./derivedValue.ts) is: two hooks read it,
 * and a hook should not pull `ErrorChip` and `Text` into its module graph to get a function.
 *
 * Built once here rather than in each hook so the wizard and the sheet cannot drift on what
 * "remaining" means — the two surfaces read the same pool (TICKET-RES-02).
 *
 * **Validates: Concept 06; Concept 20; Requirements 16.6**
 */

import type { StatAllocationResult } from '#shared/engine/skillAllocation';
import type { DerivedValue } from './derivedValue';
import { toDerivedValue } from './derivedValue';

export interface PointBudgetView {
  pointsSpent: number;
  /** `level × const.points_per_level` */
  pointBudget: DerivedValue;
  pointsRemaining: DerivedValue;
  isOverBudget: boolean;
}

/**
 * Turn the engine's verdict into the numbers a component renders
 *
 * @param allocation - The engine's result, or null when there is nothing to validate
 * @returns The view, or null when there is no allocation
 */
export function toPointBudgetView(allocation: StatAllocationResult | null): PointBudgetView | null {
  if (!allocation) return null;

  return {
    pointsSpent: allocation.pointsSpent,
    pointBudget: toDerivedValue(allocation.pointBudget),
    pointsRemaining: toDerivedValue(allocation.pointsRemaining),
    isOverBudget: allocation.isOverBudget,
  };
}
