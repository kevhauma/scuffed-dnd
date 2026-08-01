/**
 * Roll Breakdown
 *
 * One roll spelled out: every individual die, the dice total, the bonus, and the combined total
 * (Requirement 15.4). Nothing is recomputed — the engine already returned all four.
 *
 * The result animates in on each new roll; the caller keys this component on the roll's timestamp
 * so a repeat roll restarts the animation without a timer.
 *
 * **Validates: Requirements 15.4, 21.1-21.5, 22.1-22.6**
 */

import type { CombatRollResult } from '../../../types/formula';
import { Text } from '../../ui/Text/Text';

export interface RollBreakdownProps {
  result: CombatRollResult;
}

/** Render a bonus with an explicit sign, so a penalty reads as one */
function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export function RollBreakdown({ result }: RollBreakdownProps) {
  return (
    <div className="animate-roll-settle flex flex-wrap items-baseline gap-x-3 gap-y-1">
      {result.diceResults.map((die) => (
        <Text key={die.dieType} variant="caption" as="span">
          {die.dieType}: {die.rolls.join(', ')}
        </Text>
      ))}

      <Text variant="caption" as="span">
        dice {result.diceTotal}
      </Text>
      <Text variant="caption" as="span">
        bonus {signed(result.bonus)}
      </Text>
      <Text variant="highlight" as="span">
        {result.total}
      </Text>
    </div>
  );
}
