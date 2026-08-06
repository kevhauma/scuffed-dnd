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
import type { Race, SkillModifier } from '../../../types';
import { useGuardedDelete } from '../shared/useGuardedDelete';

interface RaceFormData {
  name: string;
  description: string;
  skillModifiers: SkillModifier[];
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
      skillModifiers: [],
    },
  });

  const currentRaces = config?.races || [];
  const availableMainSkills = config?.mainSkills || [];

  const handleAdd = () => {
    setEditingRaceId(null);
    form.reset({
      name: '',
      description: '',
      skillModifiers: [],
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
      skillModifiers: race.skillModifiers,
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
      skillModifiers: data.skillModifiers,
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
    availableMainSkills,
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
