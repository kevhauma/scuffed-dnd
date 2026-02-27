/**
 * Stat Form Dialog
 * 
 * Form for adding/editing stats with formula editor.
 */

import type { UseFormReturn } from 'react-hook-form';
import { Button } from '../../ui/Button/Button';
import { FormField } from '../../ui/FormField/FormField';
import { Dialog } from '../../ui/Dialog/Dialog';
import { FormulaEditor } from '../../ui/FormulaEditor/FormulaEditor';

interface StatFormData {
  name: string;
  description: string;
  formula: string;
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
  const { register, formState: { errors }, watch, setValue } = form;
  const formulaValue = watch('formula');

  return (
    <Dialog 
      open={isOpen} 
      onClose={onClose} 
      title={`${isEditing ? 'Edit' : 'Add'} Stat`}
    >
      <form onSubmit={onSave} className="space-y-4">
        <FormField
          label="Name"
          required
          placeholder="Health"
          error={errors.name?.message}
          {...register('name', { required: 'Name is required' })}
        />

        <FormField
          label="Description"
          placeholder="Character's life force"
          {...register('description')}
        />

        <FormulaEditor
          label="Formula"
          value={formulaValue}
          onChange={(value) => setValue('formula', value)}
          availableVariables={availableSkillCodes}
          placeholder="e.g., STR * 10 + CON * 5"
          onValidate={(isValid, error) => {
            if (!isValid && error) {
              form.setError('formula', { message: error });
            } else {
              form.clearErrors('formula');
            }
          }}
          className="mb-2"
        />
        {errors.formula && (
          <p className="text-sm text-crimson mt-1">{errors.formula.message}</p>
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
