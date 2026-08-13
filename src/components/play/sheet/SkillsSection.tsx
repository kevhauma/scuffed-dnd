/**
 * Skills Section
 *
 * Each skill's **bonus** — the integer a Player adds to a roll (Concept 02) — with the points the
 * Player invested beside it. The weighted stats are the remainder and are not itemised: they are a
 * property of the ruleset, not something the Player changed.
 *
 * The *level* is deliberately not shown yet: TICKET-SKL-03 owns the sheet's skill grid, where
 * level and bonus sit together in a table rather than being squeezed into a one-line row.
 *
 * **Validates: Concept 02; Requirements 9.3, 21.1-21.5**
 */

import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { SkillBreakdownRow } from '../shared/SkillBreakdownRow';
import type { SkillBreakdown } from './useCharacterSheet';

export interface SkillsSectionProps {
  skills: SkillBreakdown[];
}

export function SkillsSection({ skills }: SkillsSectionProps) {
  return (
    <Card className="p-6">
      <Text variant="h4" as="h2" className="mb-3">
        Skills
      </Text>

      {skills.length === 0 ? (
        <Text variant="body-small-secondary">This ruleset defines no skills.</Text>
      ) : (
        skills.map((skill) => (
          <SkillBreakdownRow
            key={skill.id}
            name={skill.name}
            total={skill.bonus}
            contributions={[{ label: 'invested', value: skill.invested, alwaysShow: true }]}
          />
        ))
      )}
    </Card>
  );
}
