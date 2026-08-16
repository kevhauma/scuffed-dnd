/**
 * Archetype Form Dialog
 *
 * An archetype's affinity table: one row per configured stat, tagged `main`, `sub` or `non`
 * (Concept 03). Every stat is present and defaulted to `non`, so adding a stat to the ruleset grows
 * every archetype rather than leaving it half-tagged — the treatment `RaceFormDialog` gives a stat
 * block, and for the same reason.
 *
 * There is no add/remove control, because the ruleset's stats decide what an archetype has an
 * opinion about: it cannot have one about a stat that does not exist, and cannot decline to have
 * one about a stat that does.
 *
 * **Validates: Concept 03; Requirements 21.1-21.5**
 */

import type { UseFormReturn } from 'react-hook-form';
import type { Stat, StatAffinity } from '../../../types';
import { STAT_AFFINITIES } from '../../../types';
import { Button } from '../../ui/Button/Button';
import { Dialog } from '../../ui/Dialog/Dialog';
import { FormField } from '../../ui/FormField/FormField';
import { Select } from '../../ui/Select/Select';
import { StatRowsField } from '../shared/StatRowsField';

interface ArchetypeFormData {
  name: string;
  description: string;
  statAffinity: Record<string, StatAffinity>;
}

export interface ArchetypeFormDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  form: UseFormReturn<ArchetypeFormData>;
  /** The ruleset's stats, in display order — the table has exactly these rows */
  availableStats: Stat[];
  onClose: () => void;
  onSave: () => void;
}

/** What each affinity means, in the words a User picking one needs */
const AFFINITY_LABELS: Record<StatAffinity, string> = {
  main: 'Main — grows fastest',
  sub: 'Sub — grows moderately',
  non: 'Non — grows slowest',
};

const AFFINITY_OPTIONS = STAT_AFFINITIES.map((affinity) => ({
  value: affinity,
  label: AFFINITY_LABELS[affinity],
}));

export function ArchetypeFormDialog({
  isOpen,
  isEditing,
  form,
  availableStats,
  onClose,
  onSave,
}: ArchetypeFormDialogProps) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <Dialog open={isOpen} onClose={onClose} title={`${isEditing ? 'Edit' : 'Add'} Archetype`}>
      <form onSubmit={onSave} className="space-y-4">
        <FormField
          label="Name"
          required
          placeholder="Strong"
          error={errors.name?.message}
          {...register('name', { required: 'Name is required' })}
        />

        <FormField
          label="Description"
          placeholder="Built for raw physical force"
          {...register('description')}
        />

        <StatRowsField
          title="Stat Affinity"
          description="How readily a character of this archetype grows each stat. The rate itself lives in the point buy curve, so retuning it is a table edit rather than a change here."
          emptyMessage="This ruleset defines no stats yet, so there is nothing for an archetype to favour."
          availableStats={availableStats}
          idPrefix="archetype-stat"
          renderControl={(stat, controlId) => (
            <Select
              id={controlId}
              options={AFFINITY_OPTIONS}
              className="w-56"
              {...register(`statAffinity.${stat.id}` as const)}
            />
          )}
        />

        <div className="flex justify-end gap-3 mt-6">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {isEditing ? 'Update' : 'Add'} Archetype
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
