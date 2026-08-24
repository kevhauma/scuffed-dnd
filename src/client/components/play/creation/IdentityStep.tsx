/**
 * Creation Step 1 — Identity
 *
 * Name and races. A character may have none, one, or two races: the sheet's hybrid blends exactly
 * two stat blocks (Concept 04, TICKET-RACE-02), so past that there is nothing to compute. The
 * boxes that would take a third are disabled rather than the choice being refused after the fact —
 * `useCharacterCreation.toggleRace` still refuses it, this only makes the limit visible.
 *
 * **Validates: Concept 04; Requirements 11.1, 21.1-21.5**
 *
 * (Requirement 11.2's "one or more Races" is bounded at two by Concept 04, TICKET-RACE-02 — the
 * lower end stays open, since a ruleset may define no races at all.)
 */

import type { UseFormRegister } from 'react-hook-form';
import type { Race } from '#shared/types/config';
import { Card } from '../../ui/Card/Card';
import { Checkbox } from '../../ui/Checkbox/Checkbox';
import { FormField } from '../../ui/FormField/FormField';
import { Text } from '../../ui/Text/Text';
import type { CharacterCreationFormData } from './useCharacterCreation';

export interface IdentityStepProps {
  register: UseFormRegister<CharacterCreationFormData>;
  races: Race[];
  selectedRaceIds: string[];
  /** Whether another race still fits within the blend's cardinality */
  canAddRace: boolean;
  /** How many races the blend is defined over, so the copy states the real number */
  maxRaceCount: number;
  onToggleRace: (raceId: string) => void;
}

export function IdentityStep({
  register,
  races,
  selectedRaceIds,
  canAddRace,
  maxRaceCount,
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
          Pick up to {maxRaceCount}. Two races blend into a single stat block rather than stacking.
        </Text>

        {races.length === 0 ? (
          <Text variant="body-small-secondary">This ruleset defines no races.</Text>
        ) : (
          <div className="flex flex-col gap-2">
            {races.map((race) => {
              const isSelected = selectedRaceIds.includes(race.id);

              return (
                <Checkbox
                  key={race.id}
                  label={race.name}
                  checked={isSelected}
                  disabled={!isSelected && !canAddRace}
                  onChange={() => onToggleRace(race.id)}
                />
              );
            })}
          </div>
        )}

        {!canAddRace && (
          <Text variant="body-small-secondary" className="mt-3">
            That is {maxRaceCount} races. Clear one to choose a different lineage.
          </Text>
        )}
      </div>
    </Card>
  );
}
