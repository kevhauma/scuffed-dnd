/**
 * Inlay Tier Form Dialog
 *
 * One rung of a gem family's ladder: which tier it is, and what socketing it grants (v4
 * systems/10, TICKET-INL-01).
 *
 * **The rung number is typed, not derived.** A family may skip one — the sheet's Zircon has no
 * tenth tier — so the User says which rung this is rather than the dialog counting the rows it
 * already has. The picker is handed only the stats a bonus may land on, so a derived stat is never
 * on offer here; `useInlayManager` decides which those are.
 *
 * **Validates: v4 systems/10; Requirements 21.1-21.5**
 */

import { type UseFormReturn, useFieldArray } from 'react-hook-form';
import type { Stat } from '#shared/types';
import { Dialog } from '../../ui/Dialog/Dialog';
import { FormField } from '../../ui/FormField/FormField';
import { Text } from '../../ui/Text/Text';
import { FormDialogActions } from '../shared/FormDialogActions';
import { StatValueRowsField } from '../shared/StatValueRowsField';
import type { TierFormData } from './useInlayManager';

interface InlayTierFormDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  form: UseFormReturn<TierFormData>;
  /** The stats a bonus may target — invested and resource, never derived */
  modifiableStats: Stat[];
  onClose: () => void;
  onSave: () => void;
}

export function InlayTierFormDialog({
  isOpen,
  isEditing,
  form,
  modifiableStats,
  onClose,
  onSave,
}: InlayTierFormDialogProps) {
  const {
    register,
    formState: { errors },
    control,
  } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'bonuses' });

  const handleAddBonus = () => {
    const firstStatId = modifiableStats[0]?.id ?? '';
    append({ statId: firstStatId, modifier: 0 });
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title={`${isEditing ? 'Edit' : 'Add'} Inlay Tier`}
      className="max-w-2xl"
    >
      <form onSubmit={onSave} className="space-y-4">
        <FormField
          label="Tier"
          type="number"
          required
          placeholder="1"
          error={errors.tier?.message}
          {...register('tier', {
            required: 'Tier is required',
            valueAsNumber: true,
            min: { value: 1, message: 'Tier must be at least 1' },
            // `min` alone let `2.5` through, and the shape gate refuses a fractional rung — so a
            // ruleset the panel wrote would fail the app's own import. The other half of that gate,
            // *unique within the family*, is `useInlayManager.handleSaveTier`'s: it needs the
            // family in hand, which a field rule has not got.
            validate: (value) => Number.isInteger(value) || 'Tier must be a whole number',
          })}
        />

        <StatValueRowsField
          title="Stat Grants"
          addLabel="Add Grant"
          onAdd={handleAddBonus}
          availableStats={modifiableStats}
          rows={fields}
          onRemove={remove}
          registerStat={(index) => register(`bonuses.${index}.statId` as const)}
          registerValue={(index) => register(`bonuses.${index}.modifier`, { valueAsNumber: true })}
          rowNoun="grant"
          valueLabel="Modifier"
          valuePlaceholder="Modifier (+ or -)"
        >
          {modifiableStats.length === 0 && (
            <Text variant="body-small-secondary" className="italic">
              No stats a grant can land on. A derived stat takes its value from its formula, so add
              an invested or resource stat first.
            </Text>
          )}

          {fields.length === 0 && modifiableStats.length > 0 && (
            <Text variant="body-small-secondary" className="italic">
              No grants defined. Click 'Add Grant' to say what this tier is worth.
            </Text>
          )}
        </StatValueRowsField>

        <FormDialogActions
          submitLabel={`${isEditing ? 'Update' : 'Add'} Tier`}
          onCancel={onClose}
        />
      </form>
    </Dialog>
  );
}
