/**
 * Equipment Slot Form Dialog Component
 * 
 * Dialog for creating and editing equipment slot types.
 */

import type { UseFormReturn } from 'react-hook-form';
import { Dialog } from '../../ui/Dialog/Dialog';
import { Button } from '../../ui/Button/Button';
import { Input } from '../../ui/Input/Input';
import { Textarea } from '../../ui/Textarea/Textarea';
import { Label } from '../../ui/Label/Label';

interface EquipmentSlotFormData {
  type: string;
  name: string;
  description: string;
}

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
  const { register, formState: { errors } } = form;

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
        {/* Type */}
        <div>
          <Label htmlFor="slot-type" required>Type</Label>
          <Input
            id="slot-type"
            {...register('type', { 
              required: 'Type is required',
              pattern: {
                value: /^[a-z_]+$/,
                message: 'Type must be lowercase with underscores only (e.g., main_hand)'
              }
            })}
            placeholder="e.g., helmet, main_hand, off_hand"
            error={!!errors.type}
            disabled={isEditing}
            className="w-full mt-1"
          />
          {errors.type && (
            <span className="text-xs text-crimson mt-1">{errors.type.message}</span>
          )}
          {!isEditing && (
            <span className="text-xs text-ink-600 mt-1 block">
              Use lowercase with underscores (e.g., main_hand, off_hand)
            </span>
          )}
        </div>

        {/* Name */}
        <div>
          <Label htmlFor="slot-name" required>Display Name</Label>
          <Input
            id="slot-name"
            {...register('name', { required: 'Name is required' })}
            placeholder="e.g., Main Hand, Off Hand"
            error={!!errors.name}
            className="w-full mt-1"
          />
          {errors.name && (
            <span className="text-xs text-crimson mt-1">{errors.name.message}</span>
          )}
        </div>

        {/* Description */}
        <div>
          <Label htmlFor="slot-description">Description</Label>
          <Textarea
            id="slot-description"
            {...register('description')}
            rows={3}
            className="w-full mt-1"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {isEditing ? 'Save Changes' : 'Add Equipment Slot'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
