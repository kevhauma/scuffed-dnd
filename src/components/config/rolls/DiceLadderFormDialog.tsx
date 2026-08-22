/**
 * Dice Ladder Form Dialog
 *
 * A ladder's die sizes, typed the way the sheet writes them — `20, 12, 6` (Concept 07). One text
 * field rather than a row of numeric inputs, because the list is **ordered and arbitrary-length**:
 * a fixed set of boxes is exactly the `DiceConfig` shape this entity exists to replace.
 *
 * `remainder` has no control: it is an enum of one until a ruleset needs `smallest_die` or `drop`
 * (TICKET-ROLL-03's notes), and a select with a single option is a control that lies about a choice.
 *
 * **Validates: Concept 07; Requirements 21.1-21.5**
 */

import type { UseFormReturn } from 'react-hook-form';
import { Checkbox } from '../../ui/Checkbox/Checkbox';
import { Dialog } from '../../ui/Dialog/Dialog';
import { FormField } from '../../ui/FormField/FormField';
import { FormDialogActions } from '../shared/FormDialogActions';
import type { LadderFormData } from './useDiceLadderManager';

export interface DiceLadderFormDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  form: UseFormReturn<LadderFormData>;
  /** The form's own size-list refusal, ahead of the validator's report */
  validateDieSizes: (raw: string) => string | true;
  onClose: () => void;
  onSave: () => void;
}

export function DiceLadderFormDialog({
  isOpen,
  isEditing,
  form,
  validateDieSizes,
  onClose,
  onSave,
}: DiceLadderFormDialogProps) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <Dialog open={isOpen} onClose={onClose} title={`${isEditing ? 'Edit' : 'Add'} Dice Ladder`}>
      <form onSubmit={onSave} className="space-y-4">
        <FormField
          label="Name"
          required
          placeholder="Standard"
          error={errors.name?.message}
          {...register('name', { required: 'Name is required' })}
        />

        <FormField
          label="Description"
          placeholder="What this ladder is for"
          {...register('description')}
        />

        <FormField
          label="Die Sizes"
          required
          placeholder="20, 12, 6"
          helperText="Largest first. A value is walked down these greedily and whatever is left over becomes a flat bonus."
          error={errors.dieSizes?.message}
          {...register('dieSizes', {
            required: 'Give at least one die size',
            validate: validateDieSizes,
          })}
        />

        <FormField
          label="Max Per Die"
          type="number"
          min="1"
          placeholder="No cap"
          helperText="Optional. Caps how many of each die a roll can use; the excess falls down the ladder."
          error={errors.maxPerDie?.message}
          {...register('maxPerDie', {
            validate: (value) =>
              value === '' || Number(value) >= 1 || 'A cap of less than 1 would allow no dice',
          })}
        />

        <Checkbox label="Show zero terms (0D20 + 0D12 + 1D6)" {...register('showZeroTerms')} />

        <FormDialogActions
          submitLabel={`${isEditing ? 'Update' : 'Add'} Ladder`}
          onCancel={onClose}
        />
      </form>
    </Dialog>
  );
}
