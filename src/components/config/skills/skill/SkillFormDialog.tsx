/**
 * Skill Form Dialog
 *
 * Form for adding and editing a skill and its weight rows (Concept 02, TICKET-SKL-02).
 *
 * There is **no formula field**, so there is no `FormulaPreview` beneath one: a skill is weights
 * now, and the arithmetic they feed lives once in the calculator. The standing rule in CLAUDE.md
 * applies to fields the User types a formula into, and this dialog no longer has one.
 *
 * Deliberately plain — TICKET-SKL-03 owns the real panel, the categories and the validation
 * surfacing; this is the editor the new entity needs to be usable at all.
 *
 * **Validates: Concept 02; Requirements 4.1, 4.2, 21.1-21.5**
 */

import { type UseFormReturn, useFieldArray } from 'react-hook-form';
import type { Stat } from '../../../../types';
import { Button } from '../../../ui/Button/Button';
import { Dialog } from '../../../ui/Dialog/Dialog';
import { FormField } from '../../../ui/FormField/FormField';
import { Input } from '../../../ui/Input/Input';
import { Select } from '../../../ui/Select/Select';
import { Text } from '../../../ui/Text/Text';
import type { SkillFormData } from './useSkillManager';

interface SkillFormDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  form: UseFormReturn<SkillFormData>;
  /** The stats a weight row may name */
  weightableStats: Stat[];
  onClose: () => void;
  onSave: () => void;
}

export function SkillFormDialog({
  isOpen,
  isEditing,
  form,
  weightableStats,
  onClose,
  onSave,
}: SkillFormDialogProps) {
  const {
    register,
    control,
    formState: { errors },
    watch,
    setValue,
  } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'statWeights' });

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title={`${isEditing ? 'Edit' : 'Add'} Skill`}
      className="max-w-2xl"
    >
      <form onSubmit={onSave} className="space-y-4">
        <FormField
          label="Name"
          required
          placeholder="Lock picking"
          error={errors.name?.message}
          {...register('name', { required: 'Name is required' })}
        />

        <FormField
          label="Description"
          placeholder="What this skill covers"
          {...register('description')}
        />

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Text variant="body-small" className="font-semibold">
              Governing stats
            </Text>
            <Button
              type="button"
              variant="secondary"
              onClick={() => append({ statId: weightableStats[0]?.id ?? '', weight: 0.2 })}
              disabled={weightableStats.length === 0}
              className="text-xs px-2 py-1"
            >
              Add Stat
            </Button>
          </div>

          <Text variant="body-small-secondary" className="italic">
            The level is each stat's value times its weight, plus what the Player invested. The
            sheet's own skills weigh one stat at 0.2 or 0.3, or two at 0.2 and 0.1.
          </Text>

          {fields.length === 0 && (
            <Text variant="body-small-secondary" className="italic">
              No stats yet, so this skill is worth whatever the Player invests in it.
            </Text>
          )}

          {fields.map((field, index) => (
            <div key={field.id} className="flex gap-2 items-start">
              <div className="flex-1">
                <Select
                  value={watch(`statWeights.${index}.statId`)}
                  onChange={(event) => setValue(`statWeights.${index}.statId`, event.target.value)}
                  options={weightableStats.map((stat) => ({
                    value: stat.id,
                    label: `${stat.name} (${stat.abbreviation})`,
                  }))}
                  className="w-full"
                />
              </div>
              <div className="flex-1">
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Weight"
                  className="w-full"
                  {...register(`statWeights.${index}.weight`, { valueAsNumber: true })}
                />
              </div>
              <Button
                type="button"
                variant="danger"
                onClick={() => remove(index)}
                className="text-xs px-2 py-1 mt-1"
              >
                Remove
              </Button>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {isEditing ? 'Update' : 'Add'} Skill
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
