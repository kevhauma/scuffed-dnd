/**
 * Stat Point Budget
 *
 * Lets the User cap how many points a Player may spend across all invested stats at creation.
 * Leaving it blank means unlimited.
 *
 * Moved here from the main-skills panel when stats became the invested atom (TICKET-STAT-01).
 * TICKET-RES-02 retires the flat pool entirely, deriving the budget as
 * `level × const.points_per_level`.
 *
 * **Validates: Concept 01; Requirements 2.4, 21.1-21.5**
 */

import { useId, useState } from 'react';
import { useConfigStore } from '../../../stores/configStore';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Input } from '../../ui/Input/Input';
import { Label } from '../../ui/Label/Label';
import { Text } from '../../ui/Text/Text';

export function StatPointBudget() {
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

  // Only invested stats can take points — a derived stat computes its own value
  const investableStats = (config?.stats ?? []).filter((stat) => stat.formula === undefined).length;

  return (
    <Card className="p-6">
      <Text variant="h5" as="h3" className="mb-1">
        Point Budget
      </Text>
      <Text variant="body-small-secondary" className="mb-4">
        Points a player may spend across all invested stats when creating a character. Leave blank
        for unlimited.
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

      {isValid && parsed !== undefined && investableStats > 0 && (
        <Text variant="body-small-secondary" className="mt-2">
          Players may spend {parsed} points across the {investableStats} invested stat
          {investableStats === 1 ? '' : 's'} this ruleset defines.
        </Text>
      )}

      {isValid && parsed === undefined && (
        <Text variant="body-small-secondary" className="mt-2">
          Unlimited — players are bounded only by each stat's own value clamps.
        </Text>
      )}
    </Card>
  );
}
