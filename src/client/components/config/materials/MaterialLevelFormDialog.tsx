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
import type { CurrencyTier, Stat } from '#shared/types';
import { Dialog } from '../../ui/Dialog/Dialog';
import { FormField } from '../../ui/FormField/FormField';
import { Label } from '../../ui/Label/Label';
import { Select } from '../../ui/Select/Select';
import { Text } from '../../ui/Text/Text';
import { FormDialogActions } from '../shared/FormDialogActions';
import { StatValueRowsField } from '../shared/StatValueRowsField';
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

        <StatValueRowsField
          title="Stat Bonuses/Penalties"
          addLabel="Add Bonus"
          onAdd={handleAddBonus}
          availableStats={modifiableStats}
          rows={fields}
          onRemove={remove}
          registerStat={(index) => register(`bonuses.${index}.statId` as const)}
          registerValue={(index) => register(`bonuses.${index}.modifier`, { valueAsNumber: true })}
          rowNoun="bonus"
          valueLabel="Modifier"
          valuePlaceholder="Modifier (+ or -)"
        >
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
        </StatValueRowsField>

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
