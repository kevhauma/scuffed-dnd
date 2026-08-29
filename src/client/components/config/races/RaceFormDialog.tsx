/**
 * Race Form Dialog
 *
 * A race's **stat block**: one row per configured stat, holding the absolute value a member of
 * this race has (Concept 04). Every stat is present with a default of 0, so adding a stat to the
 * ruleset grows every race's block rather than leaving the race half-defined — the concept page's
 * editing scenario, wired by TICKET-RACE-01.
 *
 * There is no add/remove control any more, because the ruleset's stats decide what a block
 * contains: a race cannot have an opinion about a stat that does not exist, and cannot decline to
 * have one about a stat that does.
 *
 * **Plus the creature identity the old sheet never gave a race** (v4 systems/04, TICKET-RACE-03):
 * type, size and challenge rate. The first two are *pickers* rather than free text boxes even
 * though the stored fields are free strings — the ruleset's reference lists are the vocabulary, and
 * a picker is what makes them worth keeping. A word the list does not offer is still shown and
 * still selected, because an imported ruleset may carry one and editing a race must not quietly
 * change its kind.
 *
 * **Validates: Concept 04; Requirements 8.1, 8.2, 21.1-21.5**
 */

import { useId } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { Stat } from '#shared/types';
import { Dialog } from '../../ui/Dialog/Dialog';
import { FormField } from '../../ui/FormField/FormField';
import { Input } from '../../ui/Input/Input';
import { Label } from '../../ui/Label/Label';
import { Select, type SelectOption } from '../../ui/Select/Select';
import { Text } from '../../ui/Text/Text';
import { FormDialogActions } from '../shared/FormDialogActions';
import { StatRowsField } from '../shared/StatRowsField';
import type { RaceFormData } from './useRaceManager';

interface RaceFormDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  form: UseFormReturn<RaceFormData>;
  /** The ruleset's stats, in display order — the block has exactly these rows */
  availableStats: Stat[];
  /** The sizes the ruleset offers; empty means it has named none yet */
  creatureSizes: string[];
  /** The creature types the ruleset offers; empty means it has named none yet */
  creatureTypes: string[];
  onClose: () => void;
  onSave: () => void;
}

/**
 * A reference list as the picker's options, keeping a word the list no longer offers
 *
 * The lists are the *vocabulary*, not a constraint — a ruleset imported from elsewhere may name a
 * creature type this one has never heard of, and `engine/validator.ts` reports that as a finding.
 * Dropping the option would turn "the ruleset disagrees with its own list" into "editing this race
 * silently changed its kind", so the stored word is offered alongside the listed ones and marked.
 *
 * @param listed - What the ruleset offers
 * @param current - What this race says, which may be none of them
 * @returns The options, blank first
 */
function identityOptions(listed: string[], current: string): SelectOption[] {
  const offered = listed.map((word) => ({ value: word, label: word }));
  const unlisted =
    current !== '' && !listed.includes(current)
      ? [{ value: current, label: `${current} (not in this ruleset's list)` }]
      : [];

  return [{ value: '', label: '—' }, ...offered, ...unlisted];
}

export function RaceFormDialog({
  isOpen,
  isEditing,
  form,
  availableStats,
  creatureSizes,
  creatureTypes,
  onClose,
  onSave,
}: RaceFormDialogProps) {
  const {
    register,
    watch,
    formState: { errors },
  } = form;

  const chosenType = watch('type');
  const chosenSize = watch('size');
  const typeOptions = identityOptions(creatureTypes, chosenType);
  const sizeOptions = identityOptions(creatureSizes, chosenSize);

  // One prefix per mounted dialog rather than three literals: `StatRowsField` already takes an
  // `idPrefix` for the same reason, and a hard-coded id is a duplicate the moment a page mounts
  // this twice
  const fieldPrefix = useId();

  return (
    <Dialog open={isOpen} onClose={onClose} title={`${isEditing ? 'Edit' : 'Add'} Race`}>
      <form onSubmit={onSave} className="space-y-4">
        <FormField
          label="Name"
          required
          placeholder="Elf"
          error={errors.name?.message}
          {...register('name', { required: 'Name is required' })}
        />

        <FormField
          label="Description"
          placeholder="Graceful and long-lived beings"
          {...register('description')}
        />

        <div className="space-y-3">
          <Text variant="body-small" as="p" className="font-semibold">
            Creature Identity
          </Text>
          <Text variant="body-small-secondary" as="p">
            What kind of creature this is, picked from the lists this ruleset offers. Leave a field
            blank to say nothing about it.
          </Text>

          <div className="flex flex-wrap gap-4">
            <div className="space-y-1">
              <Label htmlFor={`${fieldPrefix}-type`}>Creature Type</Label>
              <Select
                id={`${fieldPrefix}-type`}
                className="w-48"
                options={typeOptions}
                {...register('type')}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor={`${fieldPrefix}-size`}>Size</Label>
              <Select
                id={`${fieldPrefix}-size`}
                className="w-48"
                options={sizeOptions}
                {...register('size')}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor={`${fieldPrefix}-challenge-rate`}>Challenge Rate</Label>
              {/* Stored because the workbook has it, and built on nothing — it is 0 for every
                  playable race, a creature-facing number waiting for a bestiary (systems/04) */}
              <Input
                id={`${fieldPrefix}-challenge-rate`}
                type="number"
                className="w-32"
                {...register('challengeRate')}
              />
            </div>
          </div>
        </div>

        <StatRowsField
          title="Stat Block"
          description="What a member of this race has, before anything they invest."
          emptyMessage="This ruleset defines no stats yet, so there is nothing for a race to be made of."
          availableStats={availableStats}
          idPrefix="race-stat"
          renderControl={(stat, controlId) => (
            <Input
              id={controlId}
              type="number"
              className="w-24"
              {...register(`statValues.${stat.id}` as const, { valueAsNumber: true })}
            />
          )}
        />

        <FormDialogActions
          submitLabel={`${isEditing ? 'Update' : 'Add'} Race`}
          onCancel={onClose}
        />
      </form>
    </Dialog>
  );
}
