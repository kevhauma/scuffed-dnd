/**
 * Roll Breakdown
 *
 * One roll spelled out: the input the ladder decomposed, every individual die by size, the flat
 * remainder, and the total (Requirement 15.4). Nothing is recomputed — the engine returned all of
 * it, including the notation.
 *
 * Reshaped by TICKET-ROLL-06 with the roll itself: a die is identified by its **size** rather than
 * by one of six type names, and there is no bonus — the character's number went *into* the pool
 * rather than being added after it.
 *
 * The result animates in on each new roll; the caller keys this component on the roll's timestamp
 * so a repeat roll restarts the animation without a timer.
 *
 * **Validates: Requirements 15.4, 21.1-21.5, 22.1-22.6**
 */

import type { RollOutcome } from '../../../types/formula';
import { Text } from '../../ui/Text/Text';

export interface RollBreakdownProps {
  result: RollOutcome;
}

export function RollBreakdown({ result }: RollBreakdownProps) {
  return (
    <div className="animate-roll-settle flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <Text variant="caption" as="span">
        input {result.input} → {result.notation}
      </Text>

      {/* A rung with no dice is in the result (`showZeroTerms` is a display choice) but has
          nothing to show here, so it is dropped from the per-die list rather than printed empty */}
      {result.dice
        .filter((die) => die.rolls.length > 0)
        .map((die) => (
          <Text key={die.size} variant="caption" as="span">
            D{die.size}: {die.rolls.join(', ')}
          </Text>
        ))}

      <Text variant="caption" as="span">
        dice {result.diceTotal} · flat {result.flat}
      </Text>
      <Text variant="highlight" as="span">
        {result.total}
      </Text>
    </div>
  );
}
