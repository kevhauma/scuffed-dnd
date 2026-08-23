/**
 * Equipment Slot Form Dialog Component
 *
 * Dialog for creating and editing equipment slot types.
 *
 * On `FormField` and `FormDialogActions` since CR-23. The errors here were raw
 * `<span className="text-xs text-crimson mt-1">` — a third spelling of the error node, and one
 * whose `mt-1` was inert on an inline span, so the message sat tight against the input while the
 * other dialogs' errors had space.
 *
 * The description stays a hand-built `Label` + `Textarea`: `FormField` renders an `Input`, and a
 * multi-line field is not that.
 *
 * **Validates: Requirements 7.5, 21.1-21.5**
 */

import { useId } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Dialog } from '../../ui/Dialog/Dialog';
import { FormField } from '../../ui/FormField/FormField';
import { Label } from '../../ui/Label/Label';
import { Textarea } from '../../ui/Textarea/Textarea';
import { FormDialogActions } from '../shared/FormDialogActions';
import type { EquipmentSlotFormData } from './useEquipmentSlotManager';

interface EquipmentSlotFormDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  form: UseFormReturn<EquipmentSlotFormData>;
  onClose: () => void;
  onSave: () => void;
}

export function EquipmentSlotFormDialog({
  isOpen,
  isEditing,
  form,
  onClose,
  onSave,
}: EquipmentSlotFormDialogProps) {
  const slotDescriptionId = useId();

  const {
    register,
    formState: { errors },
  } = form;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave();
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Equipment Slot' : 'Add Equipment Slot'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField
          label="Type"
          required
          placeholder="e.g., helmet, main_hand, off_hand"
          error={errors.type?.message}
          // The guidance is only worth saying while the field can still be changed
          helperText={
            isEditing ? undefined : 'Use lowercase with underscores (e.g., main_hand, off_hand)'
          }
          disabled={isEditing}
          {...register('type', {
            required: 'Type is required',
            pattern: {
              value: /^[a-z_]+$/,
              message: 'Type must be lowercase with underscores only (e.g., main_hand)',
            },
          })}
        />

        <FormField
          label="Display Name"
          required
          placeholder="e.g., Main Hand, Off Hand"
          error={errors.name?.message}
          {...register('name', { required: 'Name is required' })}
        />

        <div>
          <Label htmlFor={slotDescriptionId}>Description</Label>
          <Textarea
            id={slotDescriptionId}
            {...register('description')}
            rows={3}
            className="w-full mt-1"
          />
        </div>

        <FormDialogActions
          submitLabel={isEditing ? 'Save Changes' : 'Add Equipment Slot'}
          onCancel={onClose}
        />
      </form>
    </Dialog>
  );
}
