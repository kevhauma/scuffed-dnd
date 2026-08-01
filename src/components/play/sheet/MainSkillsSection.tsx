/**
 * Main Skills Section
 *
 * Every main skill with its allocated level, racial modifier, equipment bonus and focus bonus
 * shown apart from the engine's total.
 *
 * **Validates: Requirements 8.5, 9.3, 13.4, 21.1-21.5**
 */

import type { MainSkillBreakdown } from './useCharacterSheet';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { SkillBreakdownRow } from './SkillBreakdownRow';

export interface MainSkillsSectionProps {
  mainSkills: MainSkillBreakdown[];
}

export function MainSkillsSection({ mainSkills }: MainSkillsSectionProps) {
  return (
    <Card className="p-6">
      <Text variant="h4" as="h2" className="mb-3">
        Main Skills
      </Text>

      {mainSkills.length === 0 ? (
        <Text variant="body-small-secondary">This ruleset defines no main skills.</Text>
      ) : (
        mainSkills.map((skill) => (
          <SkillBreakdownRow
            key={skill.code}
            name={skill.name}
            code={skill.code}
            total={skill.total}
            isFocusStat={skill.isFocusStat}
            contributions={[
              { label: 'allocated', value: skill.allocated, alwaysShow: true },
              { label: 'racial', value: skill.racial },
              { label: 'equipment', value: skill.equipment },
              { label: 'focus', value: skill.focus },
            ]}
          />
        ))
      )}
    </Card>
  );
}
