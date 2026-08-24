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
 * **Validates: Concept 04; Requirements 8.1, 8.2, 21.1-21.5**
 */

import type { UseFormReturn } from 'react-hook-form';
import type { Stat } from '#shared/types';
import { Dialog } from '../../ui/Dialog/Dialog';
import { FormField } from '../../ui/FormField/FormField';
import { Input } from '../../ui/Input/Input';
import { FormDialogActions } from '../shared/FormDialogActions';
import { StatRowsField } from '../shared/StatRowsField';
import type { RaceFormData } from './useRaceManager';

interface RaceFormDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  form: UseFormReturn<RaceFormData>;
  /** The ruleset's stats, in display order — the block has exactly these rows */
  availableStats: Stat[];
  onClose: () => void;
  onSave: () => void;
}

export function RaceFormDialog({
  isOpen,
  isEditing,
  form,
  availableStats,
  onClose,
  onSave,
}: RaceFormDialogProps) {
  const {
    register,
    formState: { errors },
  } = form;

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
