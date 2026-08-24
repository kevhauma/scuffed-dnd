/**
 * Rolls Section
 *
 * Each roll definition's derived pool, with the control to roll it and the breakdown of the last
 * roll (Concept 08). Grouped by `category`, ordered by `order`.
 *
 * The button is labelled with the **pool**, not a bonus: `Melee 1D20 + 1D12 + 1D6 + 1`. That is the
 * whole of TICKET-ROLL-06 in one line — raise a stat and the label changes, because the dice are
 * derived from the character rather than typed into the ruleset.
 *
 * **Validates: Concept 08; Requirements 13.4, 15.1, 15.4, 16.6, 21.1-21.5**
 */

import type { RollOutcome } from '#shared/types/formula';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { ErrorChip } from '../../ui/ErrorChip/ErrorChip';
import { Text } from '../../ui/Text/Text';
import { RollBreakdown } from '../rolls/RollBreakdown';
import type { RollGroup } from './useCharacterSheet';

export interface RollsSectionProps {
  rollGroups: RollGroup[];
  /** The last roll per roll id, if any */
  results: Record<string, RollOutcome>;
  /** A roll whose input did not evaluate, by roll id */
  errors: Record<string, string>;
  canRoll: boolean;
  onRoll: (rollId: string) => void;
}

export function RollsSection({ rollGroups, results, errors, canRoll, onRoll }: RollsSectionProps) {
  return (
    <Card className="p-6">
      <Text variant="h4" as="h2" className="mb-3">
        Rolls
      </Text>

      {rollGroups.length === 0 ? (
        <Text variant="body-small-secondary">This ruleset defines no rolls.</Text>
      ) : (
        rollGroups.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            {/* Only worth a heading when there is more than one group to tell apart */}
            {rollGroups.length > 1 && (
              <Text variant="body-small-secondary" as="h3" className="mb-1 capitalize">
                {group.label}
              </Text>
            )}

            {group.rolls.map((roll) => {
              const result = results[roll.id];
              const error = errors[roll.id];

              return (
                <div key={roll.id} className="border-b border-stone-200 py-2 last:border-b-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <Text variant="body-small" as="span">
                      {roll.name}
                    </Text>
                    <div className="flex flex-wrap items-baseline gap-2">
                      {roll.notation.error !== null ? (
                        <ErrorChip label="pool unavailable" detail={roll.notation.error} />
                      ) : (
                        <Text variant="caption" as="span">
                          input {roll.input.value}
                        </Text>
                      )}
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={!canRoll || roll.notation.error !== null}
                        onClick={() => onRoll(roll.id)}
                      >
                        Roll {roll.notation.text ?? roll.name}
                      </Button>
                    </div>
                  </div>

                  {error ? (
                    <Text variant="error" as="p" className="mt-1">
                      {error}
                    </Text>
                  ) : (
                    // Keyed on the roll's timestamp so a repeat roll replays the settle animation
                    result && (
                      <div className="mt-1">
                        <RollBreakdown key={result.timestamp} result={result} />
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>
        ))
      )}
    </Card>
  );
}
