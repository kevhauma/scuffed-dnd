/**
 * Creation Step 1 — Identity
 *
 * Name and races. A character may have zero or more races (Requirement 11.2).
 *
 * **Validates: Requirements 11.1, 11.2, 21.1-21.5**
 */

import type { UseFormRegister } from 'react-hook-form';
import type { Race } from '../../../types/config';
import { Card } from '../../ui/Card/Card';
import { Checkbox } from '../../ui/Checkbox/Checkbox';
import { FormField } from '../../ui/FormField/FormField';
import { Text } from '../../ui/Text/Text';
import type { CharacterCreationFormData } from './useCharacterCreation';

export interface IdentityStepProps {
  register: UseFormRegister<CharacterCreationFormData>;
  races: Race[];
  selectedRaceIds: string[];
  onToggleRace: (raceId: string) => void;
}

export function IdentityStep({
  register,
  races,
  selectedRaceIds,
  onToggleRace,
}: IdentityStepProps) {
  return (
    <Card className="p-6">
      <Text variant="h4" as="h2" className="mb-4">
        Identity
      </Text>

      <FormField
        label="Character Name"
        required
        placeholder="Aria Swiftfoot"
        {...register('name')}
      />

      <div className="mt-6">
        <Text variant="label" as="p" className="mb-1">
          Races
        </Text>
        <Text variant="body-small-secondary" className="mb-3">
          Pick any number — their skill modifiers combine.
        </Text>

        {races.length === 0 ? (
          <Text variant="body-small-secondary">This ruleset defines no races.</Text>
        ) : (
          <div className="flex flex-col gap-2">
            {races.map((race) => (
              <Checkbox
                key={race.id}
                label={race.name}
                checked={selectedRaceIds.includes(race.id)}
                onChange={() => onToggleRace(race.id)}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
