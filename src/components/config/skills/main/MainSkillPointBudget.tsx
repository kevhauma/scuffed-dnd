/**
 * Main Skill Point Budget
 *
 * Lets the User cap how many levels a Player may spend across all main skills at creation.
 * Leaving it blank means unlimited.
 *
 * **Validates: Requirements 2.4, 21.1-21.5**
 */

import { useId, useState } from 'react';
import { useConfigStore } from '../../../../stores/configStore';
import { Button } from '../../../ui/Button/Button';
import { Card } from '../../../ui/Card/Card';
import { Input } from '../../../ui/Input/Input';
import { Label } from '../../../ui/Label/Label';
import { Text } from '../../../ui/Text/Text';

export function MainSkillPointBudget() {
  const fieldId = useId();
  const config = useConfigStore((state) => state.config);
  const setMainSkillPointBudget = useConfigStore((state) => state.setMainSkillPointBudget);

  const savedValue = config?.mainSkillPointBudget;
  const [localValue, setLocalValue] = useState<string>(savedValue?.toString() ?? '');

  const trimmed = localValue.trim();
  const parsed = trimmed === '' ? undefined : Number.parseInt(trimmed, 10);
  const isValid = parsed === undefined || (!Number.isNaN(parsed) && parsed >= 0);
  const hasChanges = (savedValue?.toString() ?? '') !== trimmed;

  const handleSave = () => {
    if (!isValid) return;
    setMainSkillPointBudget(parsed);
  };

  const handleReset = () => {
    setLocalValue(savedValue?.toString() ?? '');
  };

  const totalMaxLevels = (config?.mainSkills ?? []).reduce(
    (sum, skill) => sum + skill.maxLevel,
    0
  );

  return (
    <Card className="p-6">
      <Text variant="h5" as="h3" className="mb-1">
        Point Budget
      </Text>
      <Text variant="body-small-secondary" className="mb-4">
        Levels a player may spend across all main skills when creating a character — one point per
        level. Leave blank for unlimited.
      </Text>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-48">
          <Label htmlFor={fieldId} className="mb-2">
            Total points
          </Label>
          <Input
            id={fieldId}
            type="number"
            min="0"
            value={localValue}
            onChange={(event) => setLocalValue(event.target.value)}
            placeholder="Unlimited"
            error={!isValid}
            className="w-full"
          />
        </div>

        <Button variant="primary" onClick={handleSave} disabled={!hasChanges || !isValid}>
          Save
        </Button>
        <Button variant="secondary" onClick={handleReset} disabled={!hasChanges}>
          Reset
        </Button>
      </div>

      {!isValid && (
        <Text variant="error" as="p" className="mt-2">
          Enter a whole number of 0 or more, or leave the field blank for unlimited.
        </Text>
      )}

      {isValid && parsed !== undefined && totalMaxLevels > 0 && (
        <Text variant="body-small-secondary" className="mt-2">
          Players may spend {parsed} of the {totalMaxLevels} levels this ruleset allows in total.
        </Text>
      )}

      {isValid && parsed === undefined && (
        <Text variant="body-small-secondary" className="mt-2">
          Unlimited — players are bounded only by each skill's own max level.
        </Text>
      )}
    </Card>
  );
}
