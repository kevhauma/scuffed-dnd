/**
 * Material Level Form Dialog
 * 
 * Form for adding/editing material levels with bonuses and values.
 */

import { useFieldArray, type UseFormReturn } from 'react-hook-form';
import { Button } from '../../ui/Button/Button';
import { FormField } from '../../ui/FormField/FormField';
import { Dialog } from '../../ui/Dialog/Dialog';
import { Select } from '../../ui/Select/Select';
import { Text } from '../../ui/Text/Text';
import type { CurrencyTier } from '../../../types';

interface LevelFormData {
  level: number;
  name: string;
  bonuses: Array<{ skillCode: string; modifier: number }>;
  tierId: string;
  amount: number;
}

interface MaterialLevelFormDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  form: UseFormReturn<LevelFormData>;
  availableSkillCodes: string[];
  currencyTiers: CurrencyTier[];
  onClose: () => void;
  onSave: () => void;
}

export function MaterialLevelFormDialog({
  isOpen,
  isEditing,
  form,
  availableSkillCodes,
  currencyTiers,
  onClose,
  onSave,
}: MaterialLevelFormDialogProps) {
  const { register, formState: { errors }, control, watch } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'bonuses',
  });

  const handleAddBonus = () => {
    append({ skillCode: availableSkillCodes[0] || '', modifier: 0 });
  };

  return (
    <Dialog 
      open={isOpen} 
      onClose={onClose} 
      title={`${isEditing ? 'Edit' : 'Add'} Material Level`}
      className="max-w-2xl"
    >
      <form onSubmit={onSave} className="space-y-4">
        {/* Level Number */}
        <FormField
          label="Level"
          type="number"
          required
          placeholder="1"
          error={errors.level?.message}
          {...register('level', { 
            required: 'Level is required',
            valueAsNumber: true,
            min: { value: 1, message: 'Level must be at least 1' },
          })}
        />

        {/* Level Name */}
        <FormField
          label="Name"
          required
          placeholder="Iron"
          error={errors.name?.message}
          {...register('name', { required: 'Name is required' })}
        />

        {/* Bonuses Section */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Text variant="body-small" className="font-semibold">
              Skill Bonuses/Penalties
            </Text>
            <Button 
              type="button"
              variant="secondary" 
              onClick={handleAddBonus}
              disabled={availableSkillCodes.length === 0}
              className="text-xs px-2 py-1"
            >
              Add Bonus
            </Button>
          </div>

          {availableSkillCodes.length === 0 && (
            <Text variant="body-small-secondary" className="italic">
              No skills configured yet. Add skills first to define bonuses.
            </Text>
          )}

          {fields.length === 0 && availableSkillCodes.length > 0 && (
            <Text variant="body-small-secondary" className="italic">
              No bonuses defined. Click 'Add Bonus' to add skill modifiers.
            </Text>
          )}

          {fields.map((field, index) => (
            <div key={field.id} className="flex gap-2 items-start">
              <div className="flex-1">
                <Select
                  value={watch(`bonuses.${index}.skillCode`)}
                  onChange={(e) => form.setValue(`bonuses.${index}.skillCode`, e.target.value)}
                  options={availableSkillCodes.map(code => ({
                    value: code,
                    label: code,
                  }))}
                  className="w-full"
                />
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  placeholder="Modifier (+ or -)"
                  className="w-full px-3 py-2 border border-stone-300 rounded bg-white text-ink-900 focus:outline-none focus:ring-2 focus:ring-amber"
                  {...register(`bonuses.${index}.modifier`, {
                    valueAsNumber: true,
                  })}
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

        {/* Currency Value Section */}
        <div className="space-y-2">
          <Text variant="body-small" className="font-semibold">
            Monetary Value
          </Text>

          {currencyTiers.length === 0 ? (
            <Text variant="body-small-secondary" className="italic">
              No currency tiers configured yet. Add currency tiers first to set values.
            </Text>
          ) : (
            <div className="flex gap-2">
              <div className="flex-1">
                <FormField
                  label="Amount"
                  type="number"
                  required
                  placeholder="100"
                  error={errors.amount?.message}
                  {...register('amount', { 
                    required: 'Amount is required',
                    valueAsNumber: true,
                    min: { value: 0, message: 'Amount must be non-negative' },
                  })}
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-ink-800 mb-1">
                  Currency Tier
                </label>
                <Select
                  value={watch('tierId')}
                  onChange={(e) => form.setValue('tierId', e.target.value)}
                  options={currencyTiers
                    .sort((a, b) => a.order - b.order)
                    .map(tier => ({
                      value: tier.id,
                      label: tier.name,
                    }))}
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {isEditing ? 'Update' : 'Add'} Level
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
