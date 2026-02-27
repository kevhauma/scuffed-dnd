/**
 * Item Form Dialog Component
 * 
 * Dialog for creating and editing items with material and equipment slot assignment.
 */

import { useEffect } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Dialog } from '../../ui/Dialog/Dialog';
import { Button } from '../../ui/Button/Button';
import { Input } from '../../ui/Input/Input';
import { Textarea } from '../../ui/Textarea/Textarea';
import { Select } from '../../ui/Select/Select';
import { Label } from '../../ui/Label/Label';
import type { Material, EquipmentSlot } from '../../../types';

interface ItemFormData {
  name: string;
  description: string;
  categoryId: string;
  materialId: string;
  materialLevel: number;
  equipmentSlotType: string;
}

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
  const { register, watch, setValue, formState: { errors } } = form;
  
  const selectedMaterialId = watch('materialId');
  const selectedMaterial = materials.find(m => m.id === selectedMaterialId);

  // Reset material level when material changes
  useEffect(() => {
    if (selectedMaterialId && selectedMaterial) {
      const currentLevel = watch('materialLevel');
      const validLevel = selectedMaterial.levels.find(l => l.level === currentLevel);
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
    <Dialog
      open={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Item' : 'Add Item'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <Label htmlFor="item-name" required>Name</Label>
          <Input
            id="item-name"
            {...register('name', { required: 'Name is required' })}
            error={!!errors.name}
            className="w-full mt-1"
          />
          {errors.name && (
            <span className="text-xs text-crimson mt-1">{errors.name.message}</span>
          )}
        </div>

        {/* Description */}
        <div>
          <Label htmlFor="item-description">Description</Label>
          <Textarea
            id="item-description"
            {...register('description')}
            rows={3}
            className="w-full mt-1"
          />
        </div>

        {/* Category */}
        <div>
          <Label htmlFor="item-category">Category (optional)</Label>
          <Input
            id="item-category"
            {...register('categoryId')}
            placeholder="e.g., Weapons, Armor, Consumables"
            className="w-full mt-1"
          />
        </div>

        {/* Material */}
        <div>
          <Label htmlFor="item-material">Material (optional)</Label>
          <Select
            id="item-material"
            {...register('materialId')}
            options={[
              { value: '', label: 'None' },
              ...materials.map(m => ({ value: m.id, label: m.name }))
            ]}
            className="w-full mt-1"
          />
        </div>

        {/* Material Level */}
        {selectedMaterial && selectedMaterial.levels.length > 0 && (
          <div>
            <Label htmlFor="item-material-level">Material Level</Label>
            <Select
              id="item-material-level"
              {...register('materialLevel', { valueAsNumber: true })}
              options={selectedMaterial.levels.map(l => ({
                value: l.level.toString(),
                label: `Level ${l.level}: ${l.name}`
              }))}
              className="w-full mt-1"
            />
          </div>
        )}

        {/* Equipment Slot */}
        <div>
          <Label htmlFor="item-equipment-slot">Equipment Slot (optional)</Label>
          <Select
            id="item-equipment-slot"
            {...register('equipmentSlotType')}
            options={[
              { value: '', label: 'None (Miscellaneous)' },
              ...equipmentSlots.map(s => ({ value: s.type, label: s.name }))
            ]}
            className="w-full mt-1"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {isEditing ? 'Save Changes' : 'Add Item'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
