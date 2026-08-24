/**
 * Material Form Dialog
 *
 * Form for adding/editing materials.
 *
 * **Validates: Requirements 6.1, 6.2, 21.1-21.5**
 */

import type { UseFormReturn } from 'react-hook-form';
import { Dialog } from '../../ui/Dialog/Dialog';
import { FormField } from '../../ui/FormField/FormField';
import { FormDialogActions } from '../shared/FormDialogActions';
import type { MaterialFormData } from './useMaterialManager';

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
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <Dialog open={isOpen} onClose={onClose} title={`${isEditing ? 'Edit' : 'Add'} Material`}>
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
        <FormDialogActions
          submitLabel={`${isEditing ? 'Update' : 'Add'} Material`}
          onCancel={onClose}
        />
      </form>
    </Dialog>
  );
}
