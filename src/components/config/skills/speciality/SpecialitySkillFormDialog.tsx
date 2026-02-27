/**
 * Speciality Skill Form Dialog
 * 
 * Form for adding/editing speciality skills with bonus formula.
 */

import { Controller, type UseFormReturn } from 'react-hook-form';
import { Button } from '../../../ui/Button/Button';
import { Dialog } from '../../../ui/Dialog/Dialog';
import { FormulaEditor } from '../../../ui/FormulaEditor/FormulaEditor';
import { FormField } from '../../../ui/FormField/FormField';
import type { DiceConfig } from '../../../../types';

interface SkillFormData {
  code: string;
  name: string;
  description: string;
  maxLevel: number;
  bonusFormula: string;
  dice: DiceConfig;
}

interface SpecialitySkillFormDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  form: UseFormReturn<SkillFormData>;
  availableSkillCodes: string[];
  validateCode: (code: string) => string | true;
  onClose: () => void;
  onSave: () => void;
}

export function SpecialitySkillFormDialog({
  isOpen,
  isEditing,
  form,
  availableSkillCodes,
  validateCode,
  onClose,
  onSave,
}: SpecialitySkillFormDialogProps) {
  const { register, control, formState: { errors } } = form;

  return (
    <Dialog 
      open={isOpen} 
      onClose={onClose} 
      title={`${isEditing ? 'Edit' : 'Add'} Speciality Skill`}
    >
      <form onSubmit={onSave} className="space-y-4">
        <FormField
          label="3-Letter Code"
          required
          {...register('code', {
            required: 'Code is required',
            validate: validateCode,
            setValueAs: (v) => v.toUpperCase().slice(0, 3),
          })}
          placeholder="MEL"
          maxLength={3}
          disabled={isEditing}
          error={errors.code?.message}
        />

        <FormField
          label="Name"
          required
          {...register('name', { required: 'Name is required' })}
          placeholder="Melee"
          error={errors.name?.message}
        />

        <FormField
          label="Description"
          {...register('description')}
          placeholder="Close combat proficiency"
        />

        <FormField
          label="Max Base Level"
          required
          type="number"
          {...register('maxLevel', {
            required: 'Max base level is required',
            min: { value: 1, message: 'Must be at least 1' },
            valueAsNumber: true,
          })}
          min="1"
          error={errors.maxLevel?.message}
        />

        {/* Bonus Formula */}
        <Controller
          name="bonusFormula"
          control={control}
          render={({ field }) => (
            <FormulaEditor
              label="Bonus Formula"
              value={field.value}
              onChange={field.onChange}
              availableVariables={availableSkillCodes}
              placeholder="(STR + DEX) / 2"
              className="w-full"
            />
          )}
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
