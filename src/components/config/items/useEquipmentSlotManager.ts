/**
 * Equipment Slot Manager Hook
 *
 * Manages equipment slot CRUD operations and form state.
 *
 * **Validates: Requirements 7.5**
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useConfigStore } from '../../../stores/configStore';
import type { EquipmentSlot } from '../../../types';
import { useGuardedDelete } from '../shared/useGuardedDelete';

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

  const { blocked, attemptDelete, dismissBlocked } = useGuardedDelete();

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
    const slot = equipmentSlots.find((s) => s.type === type);
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
    attemptDelete(`Equipment slot ${type}`, (options) => deleteEquipmentSlot(type, options));
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
    blocked,
    dismissBlocked,
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
