/**
 * Stat Manager Hook
 * 
 * Manages stat CRUD operations and form state.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useConfigStore } from '../../../stores/configStore';
import type { Stat } from '../../../types';

interface StatFormData {
  name: string;
  description: string;
  formula: string;
}

export function useStatManager() {
  const config = useConfigStore((state) => state.config);
  const addStat = useConfigStore((state) => state.addStat);
  const updateStat = useConfigStore((state) => state.updateStat);
  const deleteStat = useConfigStore((state) => state.deleteStat);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStatId, setEditingStatId] = useState<string | null>(null);

  const form = useForm<StatFormData>({
    defaultValues: {
      name: '',
      description: '',
      formula: '',
    },
  });

  const currentStats = config?.stats || [];
  const availableSkillCodes = config?.mainSkills.map(s => s.code) || [];

  const handleAdd = () => {
    setEditingStatId(null);
    form.reset({
      name: '',
      description: '',
      formula: '',
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (id: string) => {
    const stat = currentStats.find(s => s.id === id);
    if (!stat) return;
    
    setEditingStatId(id);
    form.reset({
      name: stat.name,
      description: stat.description,
      formula: stat.formula,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteStat(id);
  };

  const handleSave = form.handleSubmit((data) => {
    const stat: Stat = {
      id: editingStatId || crypto.randomUUID(),
      name: data.name,
      description: data.description,
      formula: data.formula,
    };
    
    if (editingStatId) {
      updateStat(editingStatId, stat);
    } else {
      addStat(stat);
    }
    
    setIsDialogOpen(false);
  });

  return {
    config,
    currentStats,
    availableSkillCodes,
    isDialogOpen,
    setIsDialogOpen,
    editingStatId,
    form,
    handleAdd,
    handleEdit,
    handleDelete,
    handleSave,
  };
}
