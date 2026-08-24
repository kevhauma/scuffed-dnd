/**
 * Skill Form Dialog
 *
 * Form for adding and editing a skill and its weight rows (Concept 02, TICKET-SKL-02).
 *
 * There is **no formula field**, so there is no `FormulaPreview` beneath one: a skill is weights
 * now, and the arithmetic they feed lives once in the calculator. The standing rule in CLAUDE.md
 * applies to fields the User types a formula into, and this dialog no longer has one.
 *
 * A name, a description and the weight rows — which is everything a `Skill` holds that the User
 * authors. `Skill.category` exists on the type and has no editor here; it wants a ticket rather
 * than a promise in a comment.
 *
 * **Validates: Concept 02; Requirements 21.1-21.5**
 */

import { type UseFormReturn, useFieldArray } from 'react-hook-form';
import type { Stat } from '#shared/types';
import { Dialog } from '../../../ui/Dialog/Dialog';
import { FormField } from '../../../ui/FormField/FormField';
import { Text } from '../../../ui/Text/Text';
import { FormDialogActions } from '../../shared/FormDialogActions';
import { StatValueRowsField } from '../../shared/StatValueRowsField';
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

        <StatValueRowsField
          title="Governing stats"
          addLabel="Add Stat"
          onAdd={() => append({ statId: weightableStats[0]?.id ?? '', weight: 0.2 })}
          availableStats={weightableStats}
          rows={fields}
          onRemove={remove}
          registerStat={(index) => register(`statWeights.${index}.statId` as const)}
          registerValue={(index) =>
            register(`statWeights.${index}.weight`, { valueAsNumber: true })
          }
          rowNoun="weight"
          valueLabel="Weight"
          valueStep="0.1"
        >
          <Text variant="body-small-secondary" className="italic">
            The level is each stat's value times its weight, plus what the Player invested. The
            sheet's own skills weigh one stat at 0.2 or 0.3, or two at 0.2 and 0.1.
          </Text>

          {fields.length === 0 && (
            <Text variant="body-small-secondary" className="italic">
              No stats yet, so this skill is worth whatever the Player invests in it.
            </Text>
          )}
        </StatValueRowsField>

        <FormDialogActions
          submitLabel={`${isEditing ? 'Update' : 'Add'} Skill`}
          onCancel={onClose}
        />
      </form>
    </Dialog>
  );
}
