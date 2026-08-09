/**
 * Speciality Skills Section
 *
 * Each speciality skill's base level and engine total, with the equipment and focus contributions
 * shown separately. The formula bonus is the remainder and is not itemised — it is a property of
 * the ruleset, not something the Player changed.
 *
 * **Validates: Requirements 9.3, 13.4, 21.1-21.5**
 */

import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { SkillBreakdownRow } from '../shared/SkillBreakdownRow';
import type { SpecialitySkillBreakdown } from './useCharacterSheet';

export interface SpecialitySkillsSectionProps {
  specialitySkills: SpecialitySkillBreakdown[];
}

export function SpecialitySkillsSection({ specialitySkills }: SpecialitySkillsSectionProps) {
  return (
    <Card className="p-6">
      <Text variant="h4" as="h2" className="mb-3">
        Speciality Skills
      </Text>

      {specialitySkills.length === 0 ? (
        <Text variant="body-small-secondary">This ruleset defines no speciality skills.</Text>
      ) : (
        specialitySkills.map((skill) => (
          <SkillBreakdownRow
            key={skill.code}
            name={skill.name}
            code={skill.code}
            total={skill.total}
            isFocusStat={skill.isFocusStat}
            contributions={[
              { label: 'base', value: skill.base, alwaysShow: true },
              { label: 'equipment', value: skill.equipment },
              { label: 'focus', value: skill.focus },
            ]}
          />
        ))
      )}
    </Card>
  );
}
