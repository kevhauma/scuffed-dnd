/**
 * Point Budget Summary
 *
 * A character's point pool as the source sheet's own pair — `3/3 Points spent · 0 Points to use`,
 * which is `Character Sheet` K1:L3 read left to right.
 *
 * Shared by the creation wizard and the character sheet, because since TICKET-RES-02 the two ask
 * exactly the same question — the pool is `level × const.points_per_level + grants` at creation and
 * at the table alike, so a Player who spends at level 1 and a Player who spends at level 7 read the
 * same sentence. The `grants` term arrived with TICKET-DM-01 and is stated beside the tally when it
 * is not zero, because it is the one term in the pool no ruleset rule accounts for.
 *
 * **Both halves of the sheet's pair are named since TICKET-RES-05.** The remainder was there all
 * along, but only as the denominator's shadow and a colour — legible enough while the pool paid for
 * stat boxes alone, and not once it also pays for forty-eight skill boxes a scroll further down.
 * *Points to use* is the number a Player at that point is actually deciding with, and it is the one
 * the workbook prints first.
 *
 * Neither number is computed here: both come off the one allocation result
 * (`pointsSpent`, `pointsRemaining`), so the header cannot disagree with the controls it governs.
 *
 * The budget can fail: the level it derives from is read out of a User curve (TICKET-RES-01), so
 * both numbers arrive as `DerivedValue` and an unavailable pool chips rather than reading as zero.
 *
 * **Validates: Concept 06; Concept 20; Requirements 16.6, 21.1-21.5; v4 systems/02 gap 4**
 */

import { ErrorChip } from '../../ui/ErrorChip/ErrorChip';
import { Text } from '../../ui/Text/Text';
import type { PointBudgetView } from './pointBudgetView';

export interface PointBudgetSummaryProps extends PointBudgetView {
  className?: string;
}

/**
 * The two spellings this tally uses, each written once
 *
 * Plain `span`s rather than `Text`, because the figure needs a colour of its own and a variant's
 * colour cannot be overridden from outside (CR-07) — which is what leaves the classes here to name.
 * The pair is stated twice over (spent, to use), and two strings drifting apart is how a header ends
 * up with two type scales in it.
 */
const figureStyles = 'font-heading text-xl font-bold leading-none';
const captionStyles = 'font-heading text-xs uppercase tracking-wider';

export function PointBudgetSummary({
  pointsSpent,
  grantedPoints,
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
   * The two class strings are module consts — see them for why.
   */
  const toUse = pointsRemaining.value;
  const hasUnspent = toUse !== null && toUse > 0;
  const stateColour = isOverBudget
    ? 'text-crimson'
    : hasUnspent
      ? 'text-amber-dark'
      : 'text-ink-900';

  return (
    <p className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 ${className}`}>
      <span className={`${figureStyles} ${stateColour}`}>
        {`${pointsSpent}/${pointBudget.value}`}
      </span>
      <span className={`${captionStyles} text-ink-700`}>Points spent</span>

      {/* The sheet's other half (`K1:L3`). Same colour as the ratio because it is the same state
          said the other way round — amber while there is something to spend, crimson past the
          pool. Omitted rather than guessed at when the remainder has no number, which the chip
          above has already accounted for. */}
      {toUse !== null && (
        <>
          <span className={`${figureStyles} ${stateColour}`}>{toUse}</span>
          <span className={`${captionStyles} text-ink-700`}>Points to use</span>
        </>
      )}
      {/* Where the extra came from (TICKET-DM-01, v3 Req 42.3). A pool that grew by three between
          sessions is otherwise a number a Player has nothing to read against — and the grant is the
          one term in it that no ruleset rule explains. Silent at zero, which is every character
          nobody has handed anything. */}
      {grantedPoints > 0 && (
        <span className={`${captionStyles} text-amber-dark`}>
          {`incl. ${grantedPoints} granted`}
        </span>
      )}
    </p>
  );
}
