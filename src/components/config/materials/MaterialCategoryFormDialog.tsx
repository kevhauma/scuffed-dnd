/**
 * Material Category Form Dialog
 *
 * Form for adding/editing material categories.
 *
 * **Validates: Requirements 6.3, 21.1-21.5**
 */

import type { UseFormReturn } from 'react-hook-form';
import { Button } from '../../ui/Button/Button';
import { Dialog } from '../../ui/Dialog/Dialog';
import { FormField } from '../../ui/FormField/FormField';
import type { CategoryFormData } from './useMaterialManager';

interface MaterialCategoryFormDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  form: UseFormReturn<CategoryFormData>;
  onClose: () => void;
  onSave: () => void;
}

export function MaterialCategoryFormDialog({
  isOpen,
  isEditing,
  form,
  onClose,
  onSave,
}: MaterialCategoryFormDialogProps) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title={`${isEditing ? 'Edit' : 'Add'} Material Category`}
    >
      <form onSubmit={onSave} className="space-y-4">
        <FormField
          label="Name"
          required
          placeholder="Metals"
          error={errors.name?.message}
          {...register('name', { required: 'Name is required' })}
        />

        <FormField
          label="Description"
          placeholder="Metal materials for weapons and armor"
          {...register('description')}
        />

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {isEditing ? 'Update' : 'Add'} Category
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
