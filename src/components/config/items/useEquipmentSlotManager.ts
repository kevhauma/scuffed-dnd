/**
 * Equipment Slot Manager Hook
 * 
 * Manages equipment slot CRUD operations and form state.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useConfigStore } from '../../../stores/configStore';
import type { EquipmentSlot } from '../../../types';

interface EquipmentSlotFormData {
  type: string;
  name: string;
  description: string;
}

export function useEquipmentSlotManager() {
  const config = useConfigStore((state) => state.config);
  const addEquipmentSlot = useConfigStore((state) => state.addEquipmentSlot);
  const updateEquipmentSlot = useConfigStore((state) => state.updateEquipmentSlot);
  const deleteEquipmentSlot = useConfigStore((state) => state.deleteEquipmentSlot);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSlotType, setEditingSlotType] = useState<string | null>(null);

  const form = useForm<EquipmentSlotFormData>({
    defaultValues: {
      type: '',
      name: '',
      description: '',
    },
  });

  const equipmentSlots = config?.equipmentSlots || [];

  const handleAdd = () => {
    setEditingSlotType(null);
    form.reset({
      type: '',
      name: '',
      description: '',
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (type: string) => {
    const slot = equipmentSlots.find(s => s.type === type);
    if (!slot) return;
    
    setEditingSlotType(type);
    form.reset({
      type: slot.type,
      name: slot.name,
      description: slot.description,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (type: string) => {
    // Check if any items reference this equipment slot
    const referencingItems = config?.items.filter(item => item.equipmentSlotType === type) || [];
    
    if (referencingItems.length > 0) {
      const itemNames = referencingItems.map(item => item.name).join(', ');
      if (!confirm(`This equipment slot is used by ${referencingItems.length} item(s): ${itemNames}. Deleting it will remove the equipment slot assignment from these items. Continue?`)) {
        return;
      }
    }
    
    deleteEquipmentSlot(type);
  };

  const handleSave = form.handleSubmit((data) => {
    const slot: EquipmentSlot = {
      type: data.type,
      name: data.name,
      description: data.description,
    };
    
    if (editingSlotType) {
      updateEquipmentSlot(editingSlotType, slot);
    } else {
      addEquipmentSlot(slot);
    }
    
    setIsDialogOpen(false);
  });

  return {
    config,
    equipmentSlots,
    isDialogOpen,
    setIsDialogOpen,
    editingSlotType,
    form,
    handleAdd,
    handleEdit,
    handleDelete,
    handleSave,
  };
}
