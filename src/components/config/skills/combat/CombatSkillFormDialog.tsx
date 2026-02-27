/**
 * Combat Skill Form Dialog
 * 
 * Form for adding/editing combat skills with dice and bonus formula.
 */

import { Controller, type UseFormReturn } from 'react-hook-form';
import { Button } from '../../../ui/Button/Button';
import { Input } from '../../../ui/Input/Input';
import { Label } from '../../../ui/Label/Label';
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

interface CombatSkillFormDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  form: UseFormReturn<SkillFormData>;
  availableSkillCodes: string[];
  validateCode: (code: string) => string | true;
  onClose: () => void;
  onSave: () => void;
}

export function CombatSkillFormDialog({
  isOpen,
  isEditing,
  form,
  availableSkillCodes,
  validateCode,
  onClose,
  onSave,
}: CombatSkillFormDialogProps) {
  const { register, control, formState: { errors } } = form;

  return (
    <Dialog 
      open={isOpen} 
      onClose={onClose} 
      title={`${isEditing ? 'Edit' : 'Add'} Combat Skill`}
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
          placeholder="ATK"
          maxLength={3}
          disabled={isEditing}
          error={errors.code?.message}
        />

        <FormField
          label="Name"
          required
          {...register('name', { required: 'Name is required' })}
          placeholder="Attack"
          error={errors.name?.message}
        />

        <FormField
          label="Description"
          {...register('description')}
          placeholder="Basic attack roll"
        />

        {/* Dice Configuration */}
        <div>
          <Label>Dice Configuration</Label>
          <div className="grid grid-cols-3 gap-3 mt-2">
            {(['d4', 'd6', 'd8', 'd10', 'd12', 'd20'] as const).map((die) => (
              <div key={die}>
                <Label htmlFor={`dice-${die}`} className="text-sm">
                  {die}
                </Label>
                <Input
                  id={`dice-${die}`}
                  type="number"
                  {...register(`dice.${die}`, {
                    min: { value: 0, message: 'Must be 0 or greater' },
                    valueAsNumber: true,
                  })}
                  min="0"
                  className="w-full mt-1"
                />
              </div>
            ))}
          </div>
        </div>

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
              placeholder="STR + MEL"
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
