/**
 * Point Budget Summary
 *
 * One line saying what a character's stat point pool looks like: spent, available, remaining.
 * Shared by the creation wizard and the character sheet, because since TICKET-RES-02 the two ask
 * exactly the same question — the pool is `level × const.points_per_level` at creation and at the
 * table alike, so a Player who spends at level 1 and a Player who spends at level 7 read the same
 * sentence.
 *
 * The budget can fail: the level it derives from is read out of a User curve (TICKET-RES-01), so
 * both numbers arrive as `DerivedValue` and an unavailable pool chips rather than reading as zero.
 *
 * **Validates: Concept 06; Concept 20; Requirements 16.6, 21.1-21.5**
 */

import type { StatAllocationResult } from '../../../engine/skillAllocation';
import { ErrorChip } from '../../ui/ErrorChip/ErrorChip';
import { Text } from '../../ui/Text/Text';
import type { DerivedValue } from './derivedValue';
import { toDerivedValue } from './derivedValue';

/**
 * The engine's allocation verdict, spelled for display
 *
 * Built once here rather than in each hook so the wizard and the sheet cannot drift on what
 * "remaining" means — the two surfaces read the same pool.
 */
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

export interface PointBudgetSummaryProps extends PointBudgetView {
  className?: string;
}

export function PointBudgetSummary({
  pointsSpent,
  pointBudget,
  pointsRemaining,
  isOverBudget,
  className = '',
}: PointBudgetSummaryProps) {
  // Nothing about the spend is worth stating beside a pool that could not be derived — the chip is
  // the whole message, and "3 of ? spent" would only invite the reader to fill in the blank
  if (pointBudget.error !== null) {
    return (
      <Text variant="body-small-secondary" as="p" className={className}>
        {'Points available: '}
        <ErrorChip label="unavailable" detail={pointBudget.error} />
      </Text>
    );
  }

  return (
    <Text variant={isOverBudget ? 'error' : 'body-small-secondary'} as="p" className={className}>
      {`${pointsSpent} of ${pointBudget.value} points spent · ${pointsRemaining.value} remaining`}
    </Text>
  );
}
