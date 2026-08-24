/**
 * Currency Form Dialog
 *
 * Dialog for creating and editing currency tiers.
 *
 * On `FormField` and `FormDialogActions` since CR-23: the label, input, error and helper text were
 * hand-rolled here, with the error as a raw `<p className="text-crimson text-sm">` — one of three
 * spellings the older dialogs used for the same thing.
 *
 * **Validates: Requirements 10.1, 10.2, 10.3, 21.1-21.5**
 */

import type { UseFormReturn } from 'react-hook-form';
import { Dialog } from '../../ui/Dialog/Dialog';
import { FormField } from '../../ui/FormField/FormField';
import { FormDialogActions } from '../shared/FormDialogActions';
import type { CurrencyFormData } from './useCurrencyManager';

interface CurrencyFormDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  form: UseFormReturn<CurrencyFormData>;
  onClose: () => void;
  onSave: () => void;
}

export function CurrencyFormDialog({
  isOpen,
  isEditing,
  form,
  onClose,
  onSave,
}: CurrencyFormDialogProps) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Currency Tier' : 'Add Currency Tier'}
    >
      <form onSubmit={onSave} className="space-y-4">
        <FormField
          label="Name"
          required
          placeholder="e.g., Copper, Silver, Gold"
          error={errors.name?.message}
          {...register('name', { required: 'Name is required' })}
        />

        <FormField
          label="Conversion to Next Tier"
          type="number"
          placeholder="e.g., 100"
          error={errors.conversionToNext?.message}
          helperText="How many of this tier equals 1 of the next higher tier"
          {...register('conversionToNext', {
            required: 'Conversion rate is required',
            min: { value: 1, message: 'Must be at least 1' },
            valueAsNumber: true,
          })}
        />

        <FormDialogActions
          submitLabel={isEditing ? 'Save Changes' : 'Add Tier'}
          onCancel={onClose}
        />
      </form>
    </Dialog>
  );
}
