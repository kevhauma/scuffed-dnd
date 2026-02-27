/**
 * Focus Stat Configuration Component
 * 
 * Allows users to configure the bonus level applied when a character selects a focus stat.
 * 
 * **Validates: Requirements 9.1, 21.1-21.5**
 */

import { useConfigStore } from '../../../stores/configStore';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Input } from '../../ui/Input/Input';
import { Label } from '../../ui/Label/Label';
import { Text } from '../../ui/Text/Text';
import { useState } from 'react';

export function FocusStatConfig() {
  const config = useConfigStore((state) => state.config);
  const setFocusStatBonusLevel = useConfigStore((state) => state.setFocusStatBonusLevel);
  
  const [localValue, setLocalValue] = useState<string>(
    config?.focusStatBonusLevel.toString() ?? '0'
  );
  const [hasChanges, setHasChanges] = useState(false);

  const handleChange = (value: string) => {
    setLocalValue(value);
    setHasChanges(true);
  };

  const handleSave = () => {
    const numValue = Number.parseInt(localValue, 10);
    if (!Number.isNaN(numValue) && numValue >= 0) {
      setFocusStatBonusLevel(numValue);
      setHasChanges(false);
    }
  };

  const handleReset = () => {
    setLocalValue(config?.focusStatBonusLevel.toString() ?? '0');
    setHasChanges(false);
  };

  if (!config) {
    return (
      <Card className="p-6">
        <Text variant="body-secondary">
          No configuration loaded. Please initialize a configuration first.
        </Text>
      </Card>
    );
  }

  const numValue = Number.parseInt(localValue, 10);
  const isValid = !Number.isNaN(numValue) && numValue >= 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6">
        <div className="mb-4">
          <Text variant="h4" as="h2" className="mb-2">Focus Stat Configuration</Text>
          <Text variant="body-secondary">
            Configure the bonus level characters receive when they select a focus stat
          </Text>
        </div>

        <div className="mt-4 p-4 bg-parchment-100 border border-stone-200 rounded">
          <Text variant="body-small" className="text-ink-700">
            <strong>What is a Focus Stat?</strong> During character creation, players can select one Main Skill or Speciality Skill as their focus stat. This represents their character's area of expertise and grants bonus levels.
          </Text>
        </div>
      </Card>

      {/* Configuration Form */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="focusBonusLevel" required>
              Focus Stat Bonus Level
            </Label>
            <Input
              id="focusBonusLevel"
              type="number"
              value={localValue}
              onChange={handleChange}
              placeholder="Enter bonus level (e.g., 5)"
              error={!isValid}
              className="mt-2"
            />
            {!isValid && (
              <Text variant="body-small" className="text-crimson mt-1">
                Please enter a valid non-negative number
              </Text>
            )}
            <Text variant="body-small" className="text-ink-600 mt-2">
              This bonus will be added to the selected skill's level when a character chooses it as their focus stat
            </Text>
          </div>

          {/* Example Preview */}
          {isValid && numValue > 0 && (
            <div className="p-4 bg-forest/10 border border-forest/30 rounded">
              <Text variant="body-small" className="text-ink-700">
                <strong>Example:</strong> If a character has 10 levels in STR and selects it as their focus stat, their effective STR level becomes {10 + numValue} (10 base + {numValue} focus bonus).
              </Text>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!hasChanges || !isValid}
            >
              Save Changes
            </Button>
            {hasChanges && (
              <Button variant="secondary" onClick={handleReset}>
                Reset
              </Button>
            )}
          </div>

          {/* Current Value Display */}
          {!hasChanges && (
            <div className="pt-2">
              <Text variant="body-small" className="text-forest">
                Current focus stat bonus: {config.focusStatBonusLevel} levels
              </Text>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
