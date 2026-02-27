/**
 * Currency Manager Hook
 * 
 * Manages currency tier CRUD operations, form state, and reordering.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useConfigStore } from '../../../stores/configStore';
import type { CurrencyTier } from '../../../types';

interface CurrencyFormData {
  name: string;
  conversionToNext: number;
}

export function useCurrencyManager() {
  const config = useConfigStore((state) => state.config);
  const addCurrencyTier = useConfigStore((state) => state.addCurrencyTier);
  const updateCurrencyTier = useConfigStore((state) => state.updateCurrencyTier);
  const deleteCurrencyTier = useConfigStore((state) => state.deleteCurrencyTier);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTierId, setEditingTierId] = useState<string | null>(null);

  const form = useForm<CurrencyFormData>({
    defaultValues: {
      name: '',
      conversionToNext: 1,
    },
  });

  // Get sorted currency tiers
  const currentTiers = [...(config?.currencyTiers || [])].sort((a, b) => a.order - b.order);

  const handleAdd = () => {
    setEditingTierId(null);
    form.reset({
      name: '',
      conversionToNext: 1,
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (id: string) => {
    const tier = currentTiers.find(t => t.id === id);
    if (!tier) return;
    
    setEditingTierId(id);
    form.reset({
      name: tier.name,
      conversionToNext: tier.conversionToNext,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteCurrencyTier(id);
  };

  const handleSave = form.handleSubmit((data) => {
    const tier: CurrencyTier = {
      id: editingTierId || crypto.randomUUID(),
      name: data.name,
      conversionToNext: data.conversionToNext,
      order: editingTierId 
        ? currentTiers.find(t => t.id === editingTierId)?.order || currentTiers.length
        : currentTiers.length,
    };
    
    if (editingTierId) {
      updateCurrencyTier(editingTierId, tier);
    } else {
      addCurrencyTier(tier);
    }
    
    setIsDialogOpen(false);
  });

  const handleReorder = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    
    const reordered = [...currentTiers];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    
    // Update order for all tiers
    reordered.forEach((tier, index) => {
      updateCurrencyTier(tier.id, { order: index });
    });
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      handleReorder(index, index - 1);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < currentTiers.length - 1) {
      handleReorder(index, index + 1);
    }
  };

  return {
    config,
    currentTiers,
    isDialogOpen,
    setIsDialogOpen,
    editingTierId,
    form,
    handleAdd,
    handleEdit,
    handleDelete,
    handleSave,
    handleMoveUp,
    handleMoveDown,
  };
}
