/**
 * Skills Section
 *
 * Each skill's two numbers together (Concept 02, TICKET-SKL-03): the **level** it derives to, and
 * the **bonus** — the integer a Player actually adds to a roll — with the terms that produced them
 * spelled out beside the name.
 *
 * The weighted stats *are* itemised here, unlike before this ticket. They are a property of the
 * ruleset rather than something the Player changed, but a Player reading `+3` has no way to tell a
 * high stat from spent points without them, which is the question the breakdown exists to answer.
 * Every number comes from the calculator; this section multiplies nothing.
 *
 * **Validates: Concept 02; Requirements 13.4, 21.1-21.5**
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
            secondary={{ label: 'level', value: skill.total }}
            contributions={[
              ...skill.statContributions,
              { label: 'invested', value: skill.invested, alwaysShow: true },
            ]}
          />
        ))
      )}
    </Card>
  );
}
