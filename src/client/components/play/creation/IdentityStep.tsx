/**
 * Creation Step 1 — Identity
 *
 * Name and races. A character has **exactly as many races as the ruleset says** (TICKET-RACE-04),
 * so the step renders one picker per slot and every one of them has to be filled before the wizard
 * moves on — `useCharacterCreation.identityStepError` is what says so.
 *
 * **A picker per slot rather than a checkbox list**, which is the shape the count reshape forced: a
 * checkbox answers *is this race picked*, and since `Empty` retired, the same race picked in every
 * slot is how a pure-blood is written. Two slots holding Ducklets is a question a checkbox cannot
 * ask.
 *
 * The slots are **numbered**, not captioned. The sheet calls its two Mothers race and Fathers race,
 * and that reads well at exactly two and at no other count; captions are the ruleset's business the
 * day a User asks for them (TICKET-RACE-04's note), so the smallest honest thing is a number.
 *
 * **Validates: Concept 04; Requirements 11.1, 21.1-21.5**
 *
 * (Requirement 11.2's "one or more Races" is the ruleset's count now. The raceless character it
 * allowed for survives as the ruleset that defines no races at all, which requires none.)
 */

import type { UseFormRegister } from 'react-hook-form';
import type { Race } from '#shared/types/config';
import { Card } from '../../ui/Card/Card';
import { FormField } from '../../ui/FormField/FormField';
import { Label } from '../../ui/Label/Label';
import { Select, type SelectOption } from '../../ui/Select/Select';
import { Text } from '../../ui/Text/Text';
import type { CharacterCreationFormData } from './useCharacterCreation';

/**
 * What the step says about how many races this ruleset gives a character
 *
 * A branch rather than a template, because the plural is not the only thing that changes at one:
 * *blended into one stat block* and *the same race in every slot* are both sentences about having
 * more than one parent, and a one-race ruleset has nothing to blend and no second slot to fill.
 *
 * @param count How many slots the step is rendering
 * @returns The sentence, for a ruleset that has races at all
 */
function slotCaption(count: number): string {
  // A ruleset that has races but sets `race_count` to 0 — deliberately raceless characters
  if (count === 0) return 'A character in this ruleset has no races.';
  if (count === 1) return 'A character in this ruleset has one race.';

  return (
    `A character in this ruleset has ${count} races, blended into one stat block rather than ` +
    'stacked — the same race in every slot is a pure-blood.'
  );
}

export interface IdentityStepProps {
  register: UseFormRegister<CharacterCreationFormData>;
  races: Race[];
  /** One entry per slot the ruleset asks for — a race id, or `''` for an unfilled one */
  raceSlots: string[];
  onSelectRace: (index: number, raceId: string) => void;
}

export function IdentityStep({ register, races, raceSlots, onSelectRace }: IdentityStepProps) {
  const options: SelectOption[] = races.map((race) => ({ value: race.id, label: race.name }));

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
        {races.length === 0 ? (
          // The caption belongs in here too: a ruleset with no races has no count worth stating,
          // and "has 0 races, blended into one stat block" above "This ruleset defines no races."
          // is two sentences arguing with each other
          <Text variant="body-small-secondary">This ruleset defines no races.</Text>
        ) : (
          <>
            <Text variant="body-small-secondary" className="mb-3">
              {slotCaption(raceSlots.length)}
            </Text>

            <div className="flex flex-col gap-3">
              {raceSlots.map((raceId, index) => {
                const fieldId = `race-slot-${index}`;

                return (
                  <div key={fieldId} className="flex flex-col gap-1">
                    <Label htmlFor={fieldId}>Race {index + 1}</Label>
                    {/* No `error` flag on an empty slot: every slot starts empty, so marking them
                        invalid would paint the step red before the Player has touched anything.
                        The step's own message names the shortfall, which is where a Player who is
                        being stopped is already looking */}
                    <Select
                      id={fieldId}
                      className="w-64"
                      options={options}
                      placeholder="Choose a race"
                      value={raceId}
                      onChange={(event) => onSelectRace(index, event.target.value)}
                    />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
