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
import type { Stat } from '../../../types';
import { Button } from '../../ui/Button/Button';
import { Dialog } from '../../ui/Dialog/Dialog';
import { FormField } from '../../ui/FormField/FormField';
import { Input } from '../../ui/Input/Input';
import { Label } from '../../ui/Label/Label';
import { Text } from '../../ui/Text/Text';

interface RaceFormData {
  name: string;
  description: string;
  statValues: Record<string, number>;
}

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

        <div className="space-y-3">
          <Text variant="body-small" className="font-semibold">
            Stat Block
          </Text>
          <Text variant="body-small-secondary">
            What a member of this race has, before anything they invest.
          </Text>

          {availableStats.length === 0 ? (
            <div className="p-3 bg-parchment-100 rounded">
              <Text variant="body-small-secondary">
                This ruleset defines no stats yet, so there is nothing for a race to be made of.
              </Text>
            </div>
          ) : (
            <div className="space-y-2">
              {availableStats.map((stat) => (
                <div key={stat.id} className="flex items-center gap-2 p-2 bg-parchment-50 rounded">
                  <Label htmlFor={`race-stat-${stat.id}`} className="flex-1">
                    {stat.name} ({stat.abbreviation})
                  </Label>
                  <Input
                    id={`race-stat-${stat.id}`}
                    type="number"
                    className="w-24"
                    {...register(`statValues.${stat.id}` as const, { valueAsNumber: true })}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {isEditing ? 'Update' : 'Add'} Race
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
