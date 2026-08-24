/**
 * Currency Manager Hook
 *
 * Manages currency tier CRUD operations, form state, and reordering.
 *
 * **Validates: Requirements 10.1, 10.2, 10.3**
 */

import { useForm } from 'react-hook-form';
import type { CurrencyTier } from '#shared/types';
import { useConfigStore } from '../../../stores/configStore';
import { useEntityDialog } from '../shared/useEntityDialog';
import { useGuardedDelete } from '../shared/useGuardedDelete';

export interface CurrencyFormData {
  name: string;
  conversionToNext: number;
}

export function useCurrencyManager() {
  const config = useConfigStore((state) => state.config);
  const addCurrencyTier = useConfigStore((state) => state.addCurrencyTier);
  const updateCurrencyTier = useConfigStore((state) => state.updateCurrencyTier);
  const deleteCurrencyTier = useConfigStore((state) => state.deleteCurrencyTier);

  const { blocked, attemptDelete, dismissBlocked } = useGuardedDelete();

  const form = useForm<CurrencyFormData>({
    defaultValues: {
      name: '',
      conversionToNext: 1,
    },
  });
  const dialog = useEntityDialog(form);

  // Get sorted currency tiers
  const currentTiers = [...(config?.currencyTiers || [])].sort((a, b) => a.order - b.order);

  const handleAdd = () => {
    dialog.openForAdd({
      name: '',
      conversionToNext: 1,
    });
  };

  const handleEdit = (id: string) => {
    const tier = currentTiers.find((t) => t.id === id);
    if (!tier) return;

    dialog.openForEdit(id, {
      name: tier.name,
      conversionToNext: tier.conversionToNext,
    });
  };

  const handleDelete = (id: string) => {
    const tier = config?.currencyTiers.find((candidate) => candidate.id === id);
    attemptDelete(`Currency tier ${tier?.name ?? id}`, (options) =>
      deleteCurrencyTier(id, options)
    );
  };

  const handleSave = form.handleSubmit((data) => {
    const tier: CurrencyTier = {
      id: dialog.editingId || crypto.randomUUID(),
      name: data.name,
      conversionToNext: data.conversionToNext,
      // `??`, never `||` (CR-04): the lowest tier has `order: 0`, and falling through a falsy
      // check reassigned it the highest order — so editing the bottom of the ladder moved it to
      // the top, silently changing what the ruleset's conversions mean
      order: dialog.editingId
        ? (currentTiers.find((t) => t.id === dialog.editingId)?.order ?? currentTiers.length)
        : currentTiers.length,
    };

    if (dialog.editingId) {
      updateCurrencyTier(dialog.editingId, tier);
    } else {
      addCurrencyTier(tier);
    }

    dialog.close();
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
    blocked,
    dismissBlocked,
    config,
    currentTiers,
    isDialogOpen: dialog.isOpen,
    closeDialog: dialog.close,
    editingTierId: dialog.editingId,
    form,
    handleAdd,
    handleEdit,
    handleDelete,
    handleSave,
    handleMoveUp,
    handleMoveDown,
  };
}
