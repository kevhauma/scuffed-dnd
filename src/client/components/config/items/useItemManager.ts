/**
 * Item Manager Hook
 *
 * Manages item CRUD operations and form state.
 *
 * **Equipment slots are not this hook's** (CR-20). It used to carry a second, complete
 * implementation of slot CRUD beside `useEquipmentSlotManager`, and `/config/items` mounted both
 * panels — so the page showed two "Add Equipment Slot" buttons, two dialogs and two slot lists for
 * one entity, and any change to how a slot works had to be made twice. The slots the hook still
 * reads are **read-only** here: an item names one, and the card and the form dialog spell it.
 *
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { Item } from '#shared/types';
import { useConfigStore } from '../../../stores/configStore';
import { useGuardedDelete } from '../shared/useGuardedDelete';

export interface ItemFormData {
  name: string;
  description: string;
  categoryId: string;
  materialId: string;
  materialLevel: number;
  equipmentSlotType: string;
}

export function useItemManager() {
  const config = useConfigStore((state) => state.config);
  const addItem = useConfigStore((state) => state.addItem);
  const updateItem = useConfigStore((state) => state.updateItem);
  const deleteItem = useConfigStore((state) => state.deleteItem);

  const { blocked, attemptDelete, dismissBlocked } = useGuardedDelete();

  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const itemForm = useForm<ItemFormData>({
    defaultValues: {
      name: '',
      description: '',
      categoryId: '',
      materialId: '',
      materialLevel: 1,
      equipmentSlotType: '',
    },
  });

  const items = config?.items || [];
  const materials = config?.materials || [];
  /** Read-only: which slots an item may be assigned to, and how to spell the one it has */
  const equipmentSlots = config?.equipmentSlots || [];
  // For spelling a material tier's stat modifiers on the item card (TICKET-MAT-01)
  const stats = config?.stats || [];

  // Get unique categories from items
  const itemCategories = Array.from(new Set(items.map((item) => item.categoryId).filter(Boolean)));

  // Filter items by category
  const filteredItems =
    categoryFilter === 'all' ? items : items.filter((item) => item.categoryId === categoryFilter);

  const handleAddItem = () => {
    setEditingItemId(null);
    itemForm.reset({
      name: '',
      description: '',
      categoryId: '',
      materialId: '',
      materialLevel: 1,
      equipmentSlotType: '',
    });
    setIsItemDialogOpen(true);
  };

  const handleEditItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    setEditingItemId(id);
    itemForm.reset({
      name: item.name,
      description: item.description,
      categoryId: item.categoryId || '',
      materialId: item.materialId || '',
      materialLevel: item.materialLevel || 1,
      equipmentSlotType: item.equipmentSlotType || '',
    });
    setIsItemDialogOpen(true);
  };

  const handleDeleteItem = (id: string) => {
    const item = items.find((candidate) => candidate.id === id);
    attemptDelete(`Item ${item?.name ?? id}`, (options) => deleteItem(id, options));
  };

  const handleSaveItem = itemForm.handleSubmit((data) => {
    const item: Item = {
      id: editingItemId || crypto.randomUUID(),
      name: data.name,
      description: data.description,
      categoryId: data.categoryId || undefined,
      materialId: data.materialId || undefined,
      materialLevel: data.materialId ? data.materialLevel : undefined,
      equipmentSlotType: data.equipmentSlotType || undefined,
    };

    if (editingItemId) {
      updateItem(editingItemId, item);
    } else {
      addItem(item);
    }

    setIsItemDialogOpen(false);
  });

  return {
    blocked,
    dismissBlocked,
    config,
    items,
    filteredItems,
    materials,
    stats,
    equipmentSlots,
    itemCategories,
    categoryFilter,
    setCategoryFilter,
    isItemDialogOpen,
    setIsItemDialogOpen,
    editingItemId,
    itemForm,
    handleAddItem,
    handleEditItem,
    handleDeleteItem,
    handleSaveItem,
  };
}
