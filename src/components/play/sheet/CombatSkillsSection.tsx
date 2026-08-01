/**
 * Combat Skills Section
 *
 * Each combat skill's dice and calculated bonus.
 *
 * The roll control itself is deliberately not here — the roller (animated dice, result breakdown,
 * session history, Requirements 15.1-15.5) is its own ticket and mounts into this section. What
 * ships now is the reference a Player reads before rolling.
 *
 * **Validates: Requirements 5.5, 13.4, 21.1-21.5**
 */

import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import type { CombatSkillBreakdown } from './useCharacterSheet';

export interface CombatSkillsSectionProps {
  combatSkills: CombatSkillBreakdown[];
}

export function CombatSkillsSection({ combatSkills }: CombatSkillsSectionProps) {
  return (
    <Card className="p-6">
      <Text variant="h4" as="h2" className="mb-3">
        Combat Skills
      </Text>

      {combatSkills.length === 0 ? (
        <Text variant="body-small-secondary">This ruleset defines no combat skills.</Text>
      ) : (
        combatSkills.map((skill) => (
          <div
            key={skill.code}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-stone-200 py-2 last:border-b-0"
          >
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
            </div>
          </div>
        ))
      )}
    </Card>
  );
}
