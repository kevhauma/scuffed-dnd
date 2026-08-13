/**
 * Speciality Skills Section
 *
 * Each speciality skill's base level and engine total, with the focus contribution shown
 * separately. The formula bonus is the remainder and is not itemised — it is a property of the
 * ruleset, not something the Player changed.
 *
 * **No equipment row** since TICKET-MAT-02: equipment moves a stat, and a skill follows through
 * the stats its formula reads, so the contribution is already inside the formula bonus. Itemising
 * it here would need the engine to split a formula's result by cause, which it cannot do — and a
 * row that always read `equipment +0` would be worse than no row.
 *
 * **Validates: Concepts 01, 09; Requirements 9.3, 21.1-21.5**
 *
 * (Requirement 13.4's "display equipment bonuses separately" is `StatsSection`'s now — that is
 * where the contribution exists.)
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
              { label: 'focus', value: skill.focus },
            ]}
          />
        ))
      )}
    </Card>
  );
}
