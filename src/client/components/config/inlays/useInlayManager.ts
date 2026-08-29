/**
 * Inlay Manager Hook
 *
 * Owns the inlays panel's store selectors, its two dialogs' form state, and the CRUD handlers
 * (v4 systems/10, TICKET-INL-01). The panel renders; this decides.
 *
 * A family's **tiers are edited through `updateInlay`** with the whole ladder, the way a material's
 * levels are: a tier has no id of its own, so there is nothing a per-tier store action could
 * address. Persistence is the store's either way — nothing here touches storage.
 *
 * **Validates: v4 systems/10; Requirements 21.1-21.5**
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { Inlay, InlayTier, Stat, StatModifier } from '#shared/types';
import { useConfigStore } from '../../../stores/configStore';
import { groupByLabel } from '../../shared/labelledGroups';
import { useGuardedDelete } from '../shared/useGuardedDelete';

export interface InlayFormData {
  name: string;
  description: string;
  /** The Common/Precious heading; blank means the family is in no group */
  group: string;
}

export interface TierFormData {
  tier: number;
  bonuses: StatModifier[];
}

export function useInlayManager() {
  const config = useConfigStore((state) => state.config);
  const addInlay = useConfigStore((state) => state.addInlay);
  const updateInlay = useConfigStore((state) => state.updateInlay);
  const deleteInlay = useConfigStore((state) => state.deleteInlay);

  const { blocked, attemptDelete, dismissBlocked } = useGuardedDelete();

  const [isInlayDialogOpen, setIsInlayDialogOpen] = useState(false);
  const [isTierDialogOpen, setIsTierDialogOpen] = useState(false);
  const [editingInlayId, setEditingInlayId] = useState<string | null>(null);
  const [editingTierIndex, setEditingTierIndex] = useState<number | null>(null);
  const [tierOwnerId, setTierOwnerId] = useState<string | null>(null);

  const inlayForm = useForm<InlayFormData>({
    defaultValues: { name: '', description: '', group: '' },
  });

  const tierForm = useForm<TierFormData>({
    defaultValues: { tier: 1, bonuses: [] },
  });

  const inlays = config?.inlays ?? [];

  // The cards take **every** stat and the tier picker only the ones a grant can land on — the split
  // `useMaterialManager` documents, over the same `StatModifier` row and for the same two reasons
  const stats = [...(config?.stats ?? [])].sort((a, b) => a.order - b.order);
  const modifiableStats: Stat[] = stats.filter((stat) => stat.formula === undefined);

  /** The family whose tiers the tier dialog is editing */
  const tierOwner = inlays.find((inlay) => inlay.id === tierOwnerId);

  const handleAddInlay = () => {
    setEditingInlayId(null);
    inlayForm.reset({ name: '', description: '', group: '' });
    setIsInlayDialogOpen(true);
  };

  const handleEditInlay = (id: string) => {
    const inlay = inlays.find((candidate) => candidate.id === id);
    if (!inlay) return;

    setEditingInlayId(id);
    inlayForm.reset({
      name: inlay.name,
      description: inlay.description,
      group: inlay.group ?? '',
    });
    setIsInlayDialogOpen(true);
  };

  const handleDeleteInlay = (id: string) => {
    const inlay = inlays.find((candidate) => candidate.id === id);
    attemptDelete(`Inlay ${inlay?.name ?? id}`, (options) => deleteInlay(id, options));
  };

  const handleSaveInlay = inlayForm.handleSubmit((data) => {
    const named = data.group.trim();
    const existing = editingInlayId
      ? inlays.find((candidate) => candidate.id === editingInlayId)
      : undefined;
    const inlay: Inlay = {
      id: editingInlayId ?? crypto.randomUUID(),
      name: data.name,
      description: data.description,
      // Explicitly `undefined` rather than omitted: that is what tells `updateInlay` to *delete*
      // the key, so clearing the heading leaves no `"group": ""` behind
      group: named === '' ? undefined : named,
      tiers: existing?.tiers ?? [],
    };

    if (editingInlayId) {
      updateInlay(editingInlayId, inlay);
    } else {
      addInlay(inlay);
    }

    setIsInlayDialogOpen(false);
  });

  const handleAddTier = (inlayId: string) => {
    const inlay = inlays.find((candidate) => candidate.id === inlayId);
    setTierOwnerId(inlayId);
    setEditingTierIndex(null);

    // The next rung *above the highest one this family has* — not `tiers.length + 1`, which would
    // offer 10 to a family whose tenth is the one it is missing (Zircon, v4 systems/10)
    const rungs = (inlay?.tiers ?? []).map((tier) => tier.tier);
    const highest = rungs.length === 0 ? 0 : Math.max(...rungs);

    tierForm.reset({ tier: highest + 1, bonuses: [] });
    setIsTierDialogOpen(true);
  };

  const handleEditTier = (inlayId: string, tierIndex: number) => {
    const inlay = inlays.find((candidate) => candidate.id === inlayId);
    const tier = inlay?.tiers[tierIndex];
    if (!tier) return;

    setTierOwnerId(inlayId);
    setEditingTierIndex(tierIndex);
    tierForm.reset({ tier: tier.tier, bonuses: tier.bonuses });
    setIsTierDialogOpen(true);
  };

  const handleDeleteTier = (inlayId: string, tierIndex: number) => {
    const inlay = inlays.find((candidate) => candidate.id === inlayId);
    if (!inlay) return;

    // Removing a rung leaves a **gap** rather than renumbering what follows: a tier's number is what
    // a socket names, so shifting them would silently re-price every item made with this gem
    const remaining = inlay.tiers.filter((_, index) => index !== tierIndex);
    updateInlay(inlayId, { tiers: remaining });
  };

  const handleSaveTier = tierForm.handleSubmit((data) => {
    if (!tierOwner) return;

    // **The rung has to be unique, and this is the second of the two places that says so.**
    // `inlayTierShapeErrors` refuses two rows claiming one rung on import; without the same rule
    // here the panel writes a ladder the app's own importer would reject, `InlayCard` keys two rows
    // on one number, and INV-05's socket reads whichever row happens to come first. The pairing is
    // the standing one — `useConstantManager` on a constant's name, `useStatManager` on an
    // abbreviation, `useCurveManager` on a curve's name and its columns'.
    //
    // Deliberately **not** mirrored from `useMaterialManager`: `materialLevelShapeErrors` has no
    // uniqueness rule to pair with, so a material has nothing to copy. This gate is stricter by
    // design, which is exactly why the write path has to be too.
    const otherRungs = tierOwner.tiers
      .filter((_, index) => index !== editingTierIndex)
      .map((existing) => existing.tier);

    if (otherRungs.includes(data.tier)) {
      tierForm.setError('tier', {
        type: 'manual',
        message: `${tierOwner.name} already has a tier ${data.tier}`,
      });
      return;
    }

    const tier: InlayTier = { tier: data.tier, bonuses: data.bonuses };
    const tiers =
      editingTierIndex === null
        ? [...tierOwner.tiers, tier]
        : tierOwner.tiers.map((existing, index) => (index === editingTierIndex ? tier : existing));

    updateInlay(tierOwner.id, { tiers });
    setIsTierDialogOpen(false);
  });

  return {
    config,
    inlays,
    // The sheet writes `### Common Gems` and `### Precious Gems` over its 25 families; the headings
    // are the distinct values the ruleset actually carries, which is `shared/labelledGroups`'s one
    // rule rather than this hook's copy of it (TICKET-ITEM-01 extracted the third caller)
    inlayGroups: groupByLabel(inlays, (inlay) => inlay.group),
    stats,
    modifiableStats,
    isInlayDialogOpen,
    setIsInlayDialogOpen,
    isTierDialogOpen,
    setIsTierDialogOpen,
    editingInlayId,
    editingTierIndex,
    inlayForm,
    tierForm,
    handleAddInlay,
    handleEditInlay,
    handleDeleteInlay,
    handleSaveInlay,
    handleAddTier,
    handleEditTier,
    handleDeleteTier,
    handleSaveTier,
    blocked,
    dismissBlocked,
  };
}
