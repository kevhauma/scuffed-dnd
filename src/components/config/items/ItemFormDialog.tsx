/**
 * Item Form Dialog Component
 *
 * Dialog for creating and editing items with material and equipment slot assignment.
 *
 * The text fields are on `FormField` and the footer on `FormDialogActions` since CR-23. The
 * pickers and the description stay hand-built: `FormField` renders an `Input`, which a `Select`
 * and a `Textarea` are not.
 *
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 21.1-21.5**
 */

import { useEffect, useId } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { EquipmentSlot, Material } from '../../../types';
import { Dialog } from '../../ui/Dialog/Dialog';
import { FormField } from '../../ui/FormField/FormField';
import { Label } from '../../ui/Label/Label';
import { Select } from '../../ui/Select/Select';
import { Textarea } from '../../ui/Textarea/Textarea';
import { FormDialogActions } from '../shared/FormDialogActions';
import type { ItemFormData } from './useItemManager';

interface ItemFormDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  form: UseFormReturn<ItemFormData>;
  materials: Material[];
  equipmentSlots: EquipmentSlot[];
  onClose: () => void;
  onSave: () => void;
}

export function ItemFormDialog({
  isOpen,
  isEditing,
  form,
  materials,
  equipmentSlots,
  onClose,
  onSave,
}: ItemFormDialogProps) {
  const itemDescriptionId = useId();
  const itemEquipmentSlotId = useId();
  const itemMaterialId = useId();
  const itemMaterialLevelId = useId();

  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form;

  const selectedMaterialId = watch('materialId');
  const selectedMaterial = materials.find((m) => m.id === selectedMaterialId);

  // Reset material level when material changes
  useEffect(() => {
    if (selectedMaterialId && selectedMaterial) {
      const currentLevel = watch('materialLevel');
      const validLevel = selectedMaterial.levels.find((l) => l.level === currentLevel);
      if (!validLevel && selectedMaterial.levels.length > 0) {
        setValue('materialLevel', selectedMaterial.levels[0].level);
      }
    }
  }, [selectedMaterialId, selectedMaterial, watch, setValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave();
  };

  return (
    <Dialog open={isOpen} onClose={onClose} title={isEditing ? 'Edit Item' : 'Add Item'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField
          label="Name"
          required
          error={errors.name?.message}
          {...register('name', { required: 'Name is required' })}
        />

        <div>
          <Label htmlFor={itemDescriptionId}>Description</Label>
          <Textarea
            id={itemDescriptionId}
            {...register('description')}
            rows={3}
            className="w-full mt-1"
          />
        </div>

        <FormField
          label="Category (optional)"
          placeholder="e.g., Weapons, Armor, Consumables"
          {...register('categoryId')}
        />

        <div>
          <Label htmlFor={itemMaterialId}>Material (optional)</Label>
          <Select
            id={itemMaterialId}
            {...register('materialId')}
            options={[
              { value: '', label: 'None' },
              ...materials.map((m) => ({ value: m.id, label: m.name })),
            ]}
            className="w-full mt-1"
          />
        </div>

        {selectedMaterial && selectedMaterial.levels.length > 0 && (
          <div>
            <Label htmlFor={itemMaterialLevelId}>Material Level</Label>
            <Select
              id={itemMaterialLevelId}
              {...register('materialLevel', { valueAsNumber: true })}
              options={selectedMaterial.levels.map((l) => ({
                value: l.level.toString(),
                label: `Level ${l.level}: ${l.name}`,
              }))}
              className="w-full mt-1"
            />
          </div>
        )}

        <div>
          <Label htmlFor={itemEquipmentSlotId}>Equipment Slot (optional)</Label>
          <Select
            id={itemEquipmentSlotId}
            {...register('equipmentSlotType')}
            options={[
              { value: '', label: 'None (Miscellaneous)' },
              ...equipmentSlots.map((s) => ({ value: s.type, label: s.name })),
            ]}
            className="w-full mt-1"
          />
        </div>

        <FormDialogActions
          submitLabel={isEditing ? 'Save Changes' : 'Add Item'}
          onCancel={onClose}
        />
      </form>
    </Dialog>
  );
}
