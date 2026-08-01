/**
 * Combat Skills Section
 *
 * Each combat skill's dice and calculated bonus, with the control to roll it and the breakdown of
 * the last roll.
 *
 * **Validates: Requirements 5.5, 13.4, 15.1, 15.4, 21.1-21.5**
 */

import type { CombatRollResult } from '../../../types/formula';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { RollBreakdown } from '../rolls/RollBreakdown';
import type { CombatSkillBreakdown } from './useCharacterSheet';

export interface CombatSkillsSectionProps {
  combatSkills: CombatSkillBreakdown[];
  /** The last roll per skill code, if any */
  results: Record<string, CombatRollResult>;
  /** A skill whose bonus formula did not evaluate, by skill code */
  errors: Record<string, string>;
  canRoll: boolean;
  onRoll: (skillCode: string) => void;
}

export function CombatSkillsSection({
  combatSkills,
  results,
  errors,
  canRoll,
  onRoll,
}: CombatSkillsSectionProps) {
  return (
    <Card className="p-6">
      <Text variant="h4" as="h2" className="mb-3">
        Combat Skills
      </Text>

      {combatSkills.length === 0 ? (
        <Text variant="body-small-secondary">This ruleset defines no combat skills.</Text>
      ) : (
        combatSkills.map((skill) => {
          const result = results[skill.code];
          const error = errors[skill.code];

          return (
            <div key={skill.code} className="border-b border-stone-200 py-2 last:border-b-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <Text variant="body-small" as="span">
                  {skill.name} ({skill.code})
                </Text>
                <div className="flex flex-wrap items-baseline gap-2">
                  <Text variant="caption" as="span">
                    {skill.diceNotation || 'no dice'}
                  </Text>
                  <Text variant="highlight" as="span">
                    {skill.bonus > 0 ? `+${skill.bonus}` : skill.bonus}
                  </Text>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!canRoll}
                    onClick={() => onRoll(skill.code)}
                  >
                    Roll {skill.code}
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
        })
      )}
    </Card>
  );
}
