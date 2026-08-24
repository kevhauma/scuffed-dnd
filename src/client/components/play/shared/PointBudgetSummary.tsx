/**
 * Point Budget Summary
 *
 * A character's stat point pool as a tally — `0/3 Points spent`.
 *
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

import { ErrorChip } from '../../ui/ErrorChip/ErrorChip';
import { Text } from '../../ui/Text/Text';
import type { PointBudgetView } from './pointBudgetView';

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

  /*
   * The ratio carries the whole thing, so it is the only part drawn loud.
   *
   * It used to read "0 of 3 points spent · 3 remaining" in the same muted grey as everything
   * around it — a sentence twice as long as it needed to be, saying the remainder twice, and
   * invisible in a header. `0/3` is the same fact, and the tally beside a character's name is one
   * of the few numbers on this page a Player acts on.
   *
   * Its colour is the state: amber while there is something to spend, because unspent points are
   * the whole reason to look here after a level; ink once the pool is empty, which is the resting
   * state and not news; crimson when the spend has gone past the pool.
   *
   * Plain `span`s rather than `Text`, because each needs a colour of its own and a variant's
   * colour cannot be overridden from outside (CR-07).
   */
  const hasUnspent = pointsRemaining.value !== null && pointsRemaining.value > 0;
  const ratioColour = isOverBudget
    ? 'text-crimson'
    : hasUnspent
      ? 'text-amber-dark'
      : 'text-ink-900';

  return (
    <p className={`flex items-baseline gap-2 ${className}`}>
      <span className={`font-heading text-xl font-bold leading-none ${ratioColour}`}>
        {`${pointsSpent}/${pointBudget.value}`}
      </span>
      <span className="font-heading text-xs uppercase tracking-wider text-ink-700">
        Points spent
      </span>
    </p>
  );
}
