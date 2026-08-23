/**
 * Equipment Slot Manager Hook
 *
 * Manages equipment slot CRUD operations and form state.
 *
 * **Validates: Requirements 7.5**
 */

import { useForm } from 'react-hook-form';
import { useConfigStore } from '../../../stores/configStore';
import type { EquipmentSlot } from '../../../types';
import { useEntityDialog } from '../shared/useEntityDialog';
import { useGuardedDelete } from '../shared/useGuardedDelete';

export interface EquipmentSlotFormData {
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

  const form = useForm<EquipmentSlotFormData>({
    defaultValues: {
      type: '',
      name: '',
      description: '',
    },
  });
  // A slot's `type` is its identifier — it has no `id` — so that is what the dialog holds
  const dialog = useEntityDialog(form);

  const equipmentSlots = config?.equipmentSlots || [];

  const handleAdd = () => {
    dialog.openForAdd({
      type: '',
      name: '',
      description: '',
    });
  };

  const handleEdit = (type: string) => {
    const slot = equipmentSlots.find((s) => s.type === type);
    if (!slot) return;

    dialog.openForEdit(type, {
      type: slot.type,
      name: slot.name,
      description: slot.description,
    });
  };

  const handleDelete = (type: string) => {
    attemptDelete(`Equipment slot ${type}`, (options) => deleteEquipmentSlot(type, options));
  };

  const handleSave = form.handleSubmit((data) => {
    const existing = dialog.editingId
      ? equipmentSlots.find((slot) => slot.type === dialog.editingId)
      : undefined;

    const slot: EquipmentSlot = {
      type: data.type,
      name: data.name,
      description: data.description,
      // Carried through deliberately. `updateEquipmentSlot` merges with `mergeClearingAbsent`, so
      // an absent key **deletes** the stored one — renaming a slot would otherwise knock it off
      // the figure, which is the trap that rule exists to make visible rather than silent.
      ...(existing?.placement ? { placement: existing.placement } : {}),
    };

    if (dialog.editingId) {
      updateEquipmentSlot(dialog.editingId, slot);
    } else {
      addEquipmentSlot(slot);
    }

    dialog.close();
  });

  return {
    blocked,
    dismissBlocked,
    config,
    equipmentSlots,
    isDialogOpen: dialog.isOpen,
    closeDialog: dialog.close,
    editingSlotType: dialog.editingId,
    form,
    handleAdd,
    handleEdit,
    handleDelete,
    handleSave,
  };
}
