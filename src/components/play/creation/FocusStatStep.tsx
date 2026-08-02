/**
 * Creation Step 3 — Focus Stat
 *
 * One focus stat, chosen from main **and** speciality skills, granting the configured bonus.
 *
 * **Validates: Requirements 11.4, 9.2, 9.3, 21.1-21.5**
 */

import { useId } from 'react';
import type { MainSkill, SpecialitySkill } from '../../../types/config';
import { Card } from '../../ui/Card/Card';
import { Label } from '../../ui/Label/Label';
import { Select } from '../../ui/Select/Select';
import { Text } from '../../ui/Text/Text';

export interface FocusStatStepProps {
  mainSkills: MainSkill[];
  specialitySkills: SpecialitySkill[];
  focusStatBonusLevel: number;
  focusStatCode: string;
  onChangeFocusStatCode: (code: string) => void;
}

export function FocusStatStep({
  mainSkills,
  specialitySkills,
  focusStatBonusLevel,
  focusStatCode,
  onChangeFocusStatCode,
}: FocusStatStepProps) {
  const selectId = useId();
  const options = [
    ...mainSkills.map((skill) => ({
      value: skill.code,
      label: `${skill.name} (${skill.code}) — main skill`,
    })),
    ...specialitySkills.map((skill) => ({
      value: skill.code,
      label: `${skill.name} (${skill.code}) — speciality skill`,
    })),
  ];

  const selected = options.find((option) => option.value === focusStatCode);

  return (
    <Card className="p-6">
      <Text variant="h4" as="h2" className="mb-2">
        Focus Stat
      </Text>
      <Text variant="body-secondary" className="mb-4">
        Your character's area of expertise. Choosing one grants{' '}
        <Text variant="highlight" as="span">
          +{focusStatBonusLevel} levels
        </Text>{' '}
        to that skill. Optional — leave it unset if you would rather spread out.
      </Text>

      <Label htmlFor={selectId} className="mb-2">
        Focus stat
      </Label>
      {options.length === 0 ? (
        <Text variant="body-small-secondary">This ruleset defines no skills to focus on yet.</Text>
      ) : (
        <Select
          id={selectId}
          options={options}
          placeholder="No focus stat"
          value={focusStatCode}
          onChange={(event) => onChangeFocusStatCode(event.target.value)}
          className="w-full max-w-md"
        />
      )}

      {selected && (
        <Text variant="body-small-secondary" className="mt-3">
          {selected.label.split(' — ')[0]} will be {focusStatBonusLevel} level(s) higher than
          allocated.
        </Text>
      )}
    </Card>
  );
}
