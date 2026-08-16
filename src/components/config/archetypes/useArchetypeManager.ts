/**
 * Archetype Manager Hook
 *
 * Archetype CRUD and form state (Concept 03, TICKET-ARC-01). The editor has one row per configured
 * stat, so adding a stat to the ruleset grows every archetype rather than leaving it half-tagged —
 * the same shape `useRaceManager` gives a stat block, and for the same reason.
 *
 * **Validates: Concept 03**
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useConfigStore } from '../../../stores/configStore';
import type { Archetype, StatAffinity } from '../../../types';
import { DEFAULT_STAT_AFFINITY } from '../../../types';
import { useGuardedDelete } from '../shared/useGuardedDelete';

interface ArchetypeFormData {
  name: string;
  description: string;
  /** Affinity per stat id — dense in the form, pruned to sparse on save */
  statAffinity: Record<string, StatAffinity>;
}

export function useArchetypeManager() {
  const config = useConfigStore((state) => state.config);
  const addArchetype = useConfigStore((state) => state.addArchetype);
  const updateArchetype = useConfigStore((state) => state.updateArchetype);
  const deleteArchetype = useConfigStore((state) => state.deleteArchetype);

  const { blocked, attemptDelete, dismissBlocked } = useGuardedDelete();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingArchetypeId, setEditingArchetypeId] = useState<string | null>(null);

  const form = useForm<ArchetypeFormData>({
    defaultValues: { name: '', description: '', statAffinity: {} },
  });

  const currentArchetypes = config?.archetypes ?? [];
  const availableStats = [...(config?.stats ?? [])].sort((a, b) => a.order - b.order);

  /** A dense tagging over every configured stat, so the form has a row for each */
  const affinityFor = (archetype?: Archetype): Record<string, StatAffinity> =>
    Object.fromEntries(
      availableStats.map((stat) => [
        stat.id,
        archetype?.statAffinity[stat.id] ?? DEFAULT_STAT_AFFINITY,
      ])
    );

  const handleAdd = () => {
    setEditingArchetypeId(null);
    form.reset({ name: '', description: '', statAffinity: affinityFor() });
    setIsDialogOpen(true);
  };

  const handleEdit = (id: string) => {
    const archetype = currentArchetypes.find((candidate) => candidate.id === id);
    if (!archetype) return;

    setEditingArchetypeId(id);
    form.reset({
      name: archetype.name,
      description: archetype.description,
      statAffinity: affinityFor(archetype),
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    const archetype = currentArchetypes.find((candidate) => candidate.id === id);
    attemptDelete(`Archetype ${archetype?.name ?? id}`, (options) => deleteArchetype(id, options));
  };

  const handleSave = form.handleSubmit((data) => {
    const archetype: Archetype = {
      id: editingArchetypeId || crypto.randomUUID(),
      name: data.name,
      description: data.description,
      // Read against the ruleset as it stands at *save* time rather than as it stood when the
      // dialog opened, so a stat added while the editor was open is picked up rather than dropped.
      //
      // `non` entries are pruned, the way a race's zeros are: absent already reads `non`, so a
      // dense record says nothing extra — and a stored `non` would read as a reference, making
      // `deleteStat` refuse for every stat every archetype has ever been saved over.
      statAffinity: Object.fromEntries(
        availableStats
          .map((stat) => [stat.id, data.statAffinity[stat.id] ?? DEFAULT_STAT_AFFINITY] as const)
          .filter(([, affinity]) => affinity !== DEFAULT_STAT_AFFINITY)
      ),
    };

    if (editingArchetypeId) {
      updateArchetype(editingArchetypeId, archetype);
    } else {
      addArchetype(archetype);
    }

    setIsDialogOpen(false);
  });

  return {
    blocked,
    dismissBlocked,
    config,
    currentArchetypes,
    availableStats,
    isDialogOpen,
    setIsDialogOpen,
    editingArchetypeId,
    form,
    handleAdd,
    handleEdit,
    handleDelete,
    handleSave,
  };
}
