/**
 * Material Form Dialog
 * 
 * Form for adding/editing materials.
 */

import type { UseFormReturn } from 'react-hook-form';
import { Button } from '../../ui/Button/Button';
import { FormField } from '../../ui/FormField/FormField';
import { Dialog } from '../../ui/Dialog/Dialog';

interface MaterialFormData {
  name: string;
  description: string;
}

interface MaterialFormDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  form: UseFormReturn<MaterialFormData>;
  onClose: () => void;
  onSave: () => void;
}

export function MaterialFormDialog({
  isOpen,
  isEditing,
  form,
  onClose,
  onSave,
}: MaterialFormDialogProps) {
  const { register, formState: { errors } } = form;

  return (
    <Dialog 
      open={isOpen} 
      onClose={onClose} 
      title={`${isEditing ? 'Edit' : 'Add'} Material`}
    >
      <form onSubmit={onSave} className="space-y-4">
        <FormField
          label="Name"
          required
          placeholder="Iron"
          error={errors.name?.message}
          {...register('name', { required: 'Name is required' })}
        />

        <FormField
          label="Description"
          placeholder="A common metal used in basic equipment"
          {...register('description')}
        />

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {isEditing ? 'Update' : 'Add'} Material
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
