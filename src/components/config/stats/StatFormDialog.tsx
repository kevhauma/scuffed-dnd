/**
 * Stat Form Dialog
 *
 * Form for adding/editing stats with formula editor.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 21.1-21.5**
 */

import type { UseFormReturn } from 'react-hook-form';
import { Button } from '../../ui/Button/Button';
import { Checkbox } from '../../ui/Checkbox/Checkbox';
import { Dialog } from '../../ui/Dialog/Dialog';
import { FormField } from '../../ui/FormField/FormField';
import { FormulaEditor } from '../../ui/FormulaEditor/FormulaEditor';
import { Text } from '../../ui/Text/Text';

interface StatFormData {
  name: string;
  abbreviation: string;
  description: string;
  formula: string;
  countsTowardTotal: boolean;
  isResource: boolean;
}

interface StatFormDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  form: UseFormReturn<StatFormData>;
  availableSkillCodes: string[];
  onClose: () => void;
  onSave: () => void;
}

export function StatFormDialog({
  isOpen,
  isEditing,
  form,
  availableSkillCodes,
  onClose,
  onSave,
}: StatFormDialogProps) {
  const {
    register,
    formState: { errors },
    watch,
    setValue,
  } = form;
  const formulaValue = watch('formula');

  return (
    <Dialog open={isOpen} onClose={onClose} title={`${isEditing ? 'Edit' : 'Add'} Stat`}>
      <form onSubmit={onSave} className="space-y-4">
        <FormField
          label="Name"
          required
          placeholder="Health"
          error={errors.name?.message}
          {...register('name', { required: 'Name is required' })}
        />

        <FormField
          label="Abbreviation"
          required
          placeholder="HP"
          error={errors.abbreviation?.message}
          {...register('abbreviation', { required: 'Abbreviation is required' })}
        />

        <FormField
          label="Description"
          placeholder="Character's life force"
          {...register('description')}
        />

        <div className="flex flex-col gap-2">
          <Checkbox
            label="Counts toward the character's stat total"
            {...register('countsTowardTotal')}
          />
          <Checkbox
            label="Is a resource — the value is a maximum the character spends against"
            {...register('isResource')}
          />
        </div>

        <FormulaEditor
          label="Formula (leave empty for an invested stat)"
          value={formulaValue}
          onChange={(value) => {
            // Editing clears a refusal from the previous save attempt
            form.clearErrors('formula');
            setValue('formula', value);
          }}
          availableVariables={availableSkillCodes}
          placeholder="e.g., STR * 10 + CON * 5"
          className="w-full mb-2"
        />
        {errors.formula && (
          <Text variant="error" as="p" className="mt-1">
            {errors.formula.message}
          </Text>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {isEditing ? 'Update' : 'Add'} Stat
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
