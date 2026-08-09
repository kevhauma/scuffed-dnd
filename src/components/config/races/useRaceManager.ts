/**
 * Race Manager Hook
 *
 * Manages race CRUD operations and form state.
 *
 * **Validates: Requirements 8.1, 8.2**
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useConfigStore } from '../../../stores/configStore';
import type { Race } from '../../../types';
import { useGuardedDelete } from '../shared/useGuardedDelete';

interface RaceFormData {
  name: string;
  description: string;
  /** Absolute value per stat id (TICKET-RACE-01) */
  statValues: Record<string, number>;
}

export function useRaceManager() {
  const config = useConfigStore((state) => state.config);
  const addRace = useConfigStore((state) => state.addRace);
  const updateRace = useConfigStore((state) => state.updateRace);
  const deleteRace = useConfigStore((state) => state.deleteRace);

  const { blocked, attemptDelete, dismissBlocked } = useGuardedDelete();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRaceId, setEditingRaceId] = useState<string | null>(null);

  const form = useForm<RaceFormData>({
    defaultValues: {
      name: '',
      description: '',
      statValues: {},
    },
  });

  const currentRaces = config?.races || [];
  // A race's stat block has one row per configured stat, in the User's display order — so a stat
  // added to the ruleset grows every block rather than leaving a race half-defined (TICKET-RACE-01)
  const availableStats = [...(config?.stats ?? [])].sort((a, b) => a.order - b.order);

  /** A block covering every configured stat, defaulting a stat the race says nothing about to 0 */
  const blockFor = (race?: Race): Record<string, number> =>
    Object.fromEntries(availableStats.map((stat) => [stat.id, race?.statValues[stat.id] ?? 0]));

  const handleAdd = () => {
    setEditingRaceId(null);
    form.reset({
      name: '',
      description: '',
      statValues: blockFor(),
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (id: string) => {
    const race = currentRaces.find((r) => r.id === id);
    if (!race) return;

    setEditingRaceId(id);
    form.reset({
      name: race.name,
      description: race.description,
      statValues: blockFor(race),
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    const race = config?.races.find((candidate) => candidate.id === id);
    attemptDelete(`Race ${race?.name ?? id}`, (options) => deleteRace(id, options));
  };

  const handleSave = form.handleSubmit((data) => {
    const race: Race = {
      id: editingRaceId || crypto.randomUUID(),
      name: data.name,
      description: data.description,
      // Read against the ruleset as it stands at *save* time, not as it stood when the dialog
      // opened, so a stat added while the editor was open is picked up rather than dropped.
      //
      // Zeros are pruned: absent reads 0, so a dense block says nothing extra — and a stored zero
      // is not harmless, because it would read as a reference and make `deleteStat` refuse for
      // every stat every race has ever been saved over. Sparse is also the form the sheet
      // fragment writes, so the two agree.
      // A cleared `valueAsNumber` field arrives as NaN, which is a number as far as `??` is
      // concerned — so the guard is `isFinite`, not nullishness
      statValues: Object.fromEntries(
        availableStats
          .map((stat) => {
            const value = data.statValues[stat.id];
            return [stat.id, Number.isFinite(value) ? value : 0] as const;
          })
          .filter(([, value]) => value !== 0)
      ),
    };

    if (editingRaceId) {
      updateRace(editingRaceId, race);
    } else {
      addRace(race);
    }

    setIsDialogOpen(false);
  });

  return {
    blocked,
    dismissBlocked,
    config,
    currentRaces,
    availableStats,
    isDialogOpen,
    setIsDialogOpen,
    editingRaceId,
    form,
    handleAdd,
    handleEdit,
    handleDelete,
    handleSave,
  };
}
