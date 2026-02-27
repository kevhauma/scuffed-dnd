/**
 * Item Manager Hook
 * 
 * Manages items and equipment slots CRUD operations and form state.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useConfigStore } from '../../../stores/configStore';
import type { Item, EquipmentSlot } from '../../../types';

interface ItemFormData {
  name: string;
  description: string;
  categoryId: string;
  materialId: string;
  materialLevel: number;
  equipmentSlotType: string;
}

interface EquipmentSlotFormData {
  type: string;
  name: string;
  description: string;
}

export function useItemManager() {
  const config = useConfigStore((state) => state.config);
  const addItem = useConfigStore((state) => state.addItem);
  const updateItem = useConfigStore((state) => state.updateItem);
  const deleteItem = useConfigStore((state) => state.deleteItem);
  const addEquipmentSlot = useConfigStore((state) => state.addEquipmentSlot);
  const updateEquipmentSlot = useConfigStore((state) => state.updateEquipmentSlot);
  const deleteEquipmentSlot = useConfigStore((state) => state.deleteEquipmentSlot);

  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [isEquipmentSlotDialogOpen, setIsEquipmentSlotDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingEquipmentSlotType, setEditingEquipmentSlotType] = useState<string | null>(null);
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

  const equipmentSlotForm = useForm<EquipmentSlotFormData>({
    defaultValues: {
      type: '',
      name: '',
      description: '',
    },
  });

  const items = config?.items || [];
  const materials = config?.materials || [];
  const equipmentSlots = config?.equipmentSlots || [];

  // Get unique categories from items
  const itemCategories = Array.from(
    new Set(items.map(item => item.categoryId).filter(Boolean))
  );

  // Filter items by category
  const filteredItems = categoryFilter === 'all' 
    ? items 
    : items.filter(item => item.categoryId === categoryFilter);

  // Item handlers
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
    const item = items.find(i => i.id === id);
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
    // Check if item is used in character inventories
    // For now, just delete (character store integration will come later)
    deleteItem(id);
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

  // Equipment Slot handlers
  const handleAddEquipmentSlot = () => {
    setEditingEquipmentSlotType(null);
    equipmentSlotForm.reset({
      type: '',
      name: '',
      description: '',
    });
    setIsEquipmentSlotDialogOpen(true);
  };

  const handleEditEquipmentSlot = (type: string) => {
    const slot = equipmentSlots.find(s => s.type === type);
    if (!slot) return;
    
    setEditingEquipmentSlotType(type);
    equipmentSlotForm.reset({
      type: slot.type,
      name: slot.name,
      description: slot.description,
    });
    setIsEquipmentSlotDialogOpen(true);
  };

  const handleDeleteEquipmentSlot = (type: string) => {
    // Check if equipment slot is used by items
    const isUsed = items.some(item => item.equipmentSlotType === type);
    if (isUsed) {
      alert('Cannot delete equipment slot used by items. Remove from items first.');
      return;
    }
    deleteEquipmentSlot(type);
  };

  const handleSaveEquipmentSlot = equipmentSlotForm.handleSubmit((data) => {
    const slot: EquipmentSlot = {
      type: data.type,
      name: data.name,
      description: data.description,
    };
    
    if (editingEquipmentSlotType) {
      updateEquipmentSlot(editingEquipmentSlotType, slot);
    } else {
      addEquipmentSlot(slot);
    }
    
    setIsEquipmentSlotDialogOpen(false);
  });

  return {
    config,
    items,
    filteredItems,
    materials,
    equipmentSlots,
    itemCategories,
    categoryFilter,
    setCategoryFilter,
    isItemDialogOpen,
    setIsItemDialogOpen,
    isEquipmentSlotDialogOpen,
    setIsEquipmentSlotDialogOpen,
    editingItemId,
    editingEquipmentSlotType,
    itemForm,
    equipmentSlotForm,
    handleAddItem,
    handleEditItem,
    handleDeleteItem,
    handleSaveItem,
    handleAddEquipmentSlot,
    handleEditEquipmentSlot,
    handleDeleteEquipmentSlot,
    handleSaveEquipmentSlot,
  };
}
