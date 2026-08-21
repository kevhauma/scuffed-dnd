/**
 * Currency Form Dialog
 *
 * Dialog for creating and editing currency tiers.
 *
 * **Validates: Requirements 10.1, 10.2, 10.3, 21.1-21.5**
 */

import { useId } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Button } from '../../ui/Button/Button';
import { Dialog } from '../../ui/Dialog/Dialog';
import { Input } from '../../ui/Input/Input';
import { Label } from '../../ui/Label/Label';
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
  const conversionToNextId = useId();
  const nameId = useId();

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
        {/* Name */}
        <div>
          <Label htmlFor={nameId} required>
            Name
          </Label>
          <Input
            id={nameId}
            {...register('name', { required: 'Name is required' })}
            placeholder="e.g., Copper, Silver, Gold"
            error={!!errors.name}
            className="w-full mt-1"
          />
          {errors.name && <p className="text-crimson text-sm mt-1">{errors.name.message}</p>}
        </div>

        {/* Conversion Rate */}
        <div>
          <Label htmlFor={conversionToNextId}>Conversion to Next Tier</Label>
          <Input
            id={conversionToNextId}
            type="number"
            {...register('conversionToNext', {
              required: 'Conversion rate is required',
              min: { value: 1, message: 'Must be at least 1' },
              valueAsNumber: true,
            })}
            placeholder="e.g., 100"
            error={!!errors.conversionToNext}
            className="w-full mt-1"
          />
          {errors.conversionToNext && (
            <p className="text-crimson text-sm mt-1">{errors.conversionToNext.message}</p>
          )}
          <p className="text-ink-600 text-sm mt-1">
            How many of this tier equals 1 of the next higher tier
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {isEditing ? 'Save Changes' : 'Add Tier'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
