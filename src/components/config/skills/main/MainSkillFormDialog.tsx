/**
 * Main Skill Form Dialog
 * 
 * Form for adding/editing main skills.
 */

import type { UseFormReturn } from 'react-hook-form';
import { Button } from '../../../ui/Button/Button';
import { FormField } from '../../../ui/FormField/FormField';
import { Dialog } from '../../../ui/Dialog/Dialog';
import type { DiceConfig } from '../../../../types';

interface SkillFormData {
  code: string;
  name: string;
  description: string;
  maxLevel: number;
  bonusFormula: string;
  dice: DiceConfig;
}

interface MainSkillFormDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  form: UseFormReturn<SkillFormData>;
  validateCode: (code: string) => string | true;
  onClose: () => void;
  onSave: () => void;
}

export function MainSkillFormDialog({
  isOpen,
  isEditing,
  form,
  validateCode,
  onClose,
  onSave,
}: MainSkillFormDialogProps) {
  const { register, formState: { errors } } = form;

  return (
    <Dialog 
      open={isOpen} 
      onClose={onClose} 
      title={`${isEditing ? 'Edit' : 'Add'} Main Skill`}
    >
      <form onSubmit={onSave} className="space-y-4">
        <FormField
          label="3-Letter Code"
          required
          placeholder="STR"
          maxLength={3}
          error={errors.code?.message}
          disabled={isEditing}
          {...register('code', {
            required: 'Code is required',
            validate: validateCode,
            setValueAs: (v) => v.toUpperCase().slice(0, 3),
          })}
        />

        <FormField
          label="Name"
          required
          placeholder="Strength"
          error={errors.name?.message}
          {...register('name', { required: 'Name is required' })}
        />

        <FormField
          label="Description"
          placeholder="Physical power and muscle"
          {...register('description')}
        />

        <FormField
          label="Max Level"
          required
          type="number"
          min="1"
          error={errors.maxLevel?.message}
          {...register('maxLevel', {
            required: 'Max level is required',
            min: { value: 1, message: 'Must be at least 1' },
            valueAsNumber: true,
          })}
        />

        {/* Actions */}
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
