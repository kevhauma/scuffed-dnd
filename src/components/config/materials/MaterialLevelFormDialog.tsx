/**
 * Material Level Form Dialog
 *
 * Form for adding/editing material levels with bonuses and values.
 *
 * A tier's modifiers target **stats** since TICKET-MAT-01 — the sheet's own shape, and what makes
 * "+50 max Mana" expressible. The picker is handed only the stats a modifier may land on, so a
 * derived stat is never on offer here; `useMaterialManager` decides which those are.
 *
 * **Validates: Concept 09; Requirements 6.4, 6.5, 6.6, 21.1-21.5**
 */

import { useId } from 'react';
import { type UseFormReturn, useFieldArray } from 'react-hook-form';
import type { CurrencyTier, Stat } from '../../../types';
import { Button } from '../../ui/Button/Button';
import { Dialog } from '../../ui/Dialog/Dialog';
import { FormField } from '../../ui/FormField/FormField';
import { Input } from '../../ui/Input/Input';
import { Label } from '../../ui/Label/Label';
import { Select } from '../../ui/Select/Select';
import { Text } from '../../ui/Text/Text';
import { FormDialogActions } from '../shared/FormDialogActions';
import type { LevelFormData } from './useMaterialManager';

interface MaterialLevelFormDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  form: UseFormReturn<LevelFormData>;
  /** The stats a modifier may target — invested and resource, never derived */
  modifiableStats: Stat[];
  currencyTiers: CurrencyTier[];
  onClose: () => void;
  onSave: () => void;
}

export function MaterialLevelFormDialog({
  isOpen,
  isEditing,
  form,
  modifiableStats,
  currencyTiers,
  onClose,
  onSave,
}: MaterialLevelFormDialogProps) {
  const tierId = useId();

  const {
    register,
    formState: { errors },
    control,
    watch,
  } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'bonuses',
  });

  const handleAddBonus = () => {
    append({ statId: modifiableStats[0]?.id ?? '', modifier: 0 });
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
              Stat Bonuses/Penalties
            </Text>
            <Button
              type="button"
              variant="secondary"
              onClick={handleAddBonus}
              disabled={modifiableStats.length === 0}
              className="text-xs px-2 py-1"
            >
              Add Bonus
            </Button>
          </div>

          {modifiableStats.length === 0 && (
            <Text variant="body-small-secondary" className="italic">
              No stats a modifier can land on. A derived stat takes its value from its formula, so
              add an invested or resource stat first.
            </Text>
          )}

          {fields.length === 0 && modifiableStats.length > 0 && (
            <Text variant="body-small-secondary" className="italic">
              No bonuses defined. Click 'Add Bonus' to add stat modifiers.
            </Text>
          )}

          {fields.map((field, index) => (
            <div key={field.id} className="flex gap-2 items-start">
              {/*
                `register`, not watch/setValue (CR-35): the archetype dialog proves the primitive
                takes it, and rhf's dirty tracking only sees a registered field. The rows repeat, so
                each control names its own row — there is no visible label to point `htmlFor` at.
              */}
              <div className="flex-1">
                <Select
                  aria-label={`Stat for bonus row ${index + 1}`}
                  options={modifiableStats.map((stat) => ({
                    value: stat.id,
                    label: `${stat.name} (${stat.abbreviation})`,
                  }))}
                  className="w-full"
                  {...register(`bonuses.${index}.statId` as const)}
                />
              </div>
              <div className="flex-1">
                <Input
                  type="number"
                  placeholder="Modifier (+ or -)"
                  aria-label={`Modifier for bonus row ${index + 1}`}
                  className="w-full"
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
                <Label htmlFor={tierId} className="block mb-1">
                  Currency Tier
                </Label>
                <Select
                  id={tierId}
                  value={watch('tierId')}
                  onChange={(e) => form.setValue('tierId', e.target.value)}
                  // Copy before sorting (CR-15): this prop is the store's own
                  // `config.currencyTiers`, and `Array.prototype.sort` reorders in place — so the
                  // unguarded call had a render pass writing to persisted state
                  options={[...currencyTiers]
                    .sort((a, b) => a.order - b.order)
                    .map((tier) => ({
                      value: tier.id,
                      label: tier.name,
                    }))}
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>

        <FormDialogActions
          submitLabel={`${isEditing ? 'Update' : 'Add'} Level`}
          onCancel={onClose}
        />
      </form>
    </Dialog>
  );
}
