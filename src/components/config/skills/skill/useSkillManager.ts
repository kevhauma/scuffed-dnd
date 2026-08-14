/**
 * Skill Manager Hook
 *
 * Manages skill CRUD operations and form state (Concept 02, TICKET-SKL-02).
 *
 * A skill is **weight rows**, not a formula string, so there is no formula to validate on save and
 * no code to keep unique: what a skill has is a name, and the weights that derive its level. That
 * is the entity's whole argument — a rebalance is one constant, not 48 edits.
 *
 * The weight rows are the whole editor (TICKET-SKL-03 covered them with tests and closed the
 * `NaN` hole below). `Skill.category` exists on the type and nothing edits it yet — that wants a
 * ticket rather than a promise in a comment.
 *
 * **Validates: Concept 02**
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useConfigStore } from '../../../../stores/configStore';
import type { Skill, StatWeight } from '../../../../types';
import { useGuardedDelete } from '../../shared/useGuardedDelete';

export interface SkillFormData {
  name: string;
  description: string;
  statWeights: StatWeight[];
}

const EMPTY_FORM: SkillFormData = { name: '', description: '', statWeights: [] };

export function useSkillManager() {
  const config = useConfigStore((state) => state.config);
  const addSkill = useConfigStore((state) => state.addSkill);
  const updateSkill = useConfigStore((state) => state.updateSkill);
  const deleteSkill = useConfigStore((state) => state.deleteSkill);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<string | null>(null);
  const { blocked, attemptDelete, dismissBlocked } = useGuardedDelete();

  const form = useForm<SkillFormData>({ defaultValues: EMPTY_FORM });

  const currentSkills = config?.skills ?? [];

  /** Every stat, in the User's order — any of them may govern a skill, derived ones included */
  const weightableStats = [...(config?.stats ?? [])].sort((a, b) => a.order - b.order);

  const handleAdd = () => {
    setEditingSkill(null);
    form.reset(EMPTY_FORM);
    setIsDialogOpen(true);
  };

  const handleEdit = (id: string) => {
    const skill = currentSkills.find((candidate) => candidate.id === id);
    if (!skill) return;

    setEditingSkill(id);
    form.reset({
      name: skill.name,
      description: skill.description,
      statWeights: skill.statWeights,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    const skill = currentSkills.find((candidate) => candidate.id === id);
    attemptDelete(`Skill ${skill?.name ?? id}`, (options) => deleteSkill(id, options));
  };

  const handleSave = form.handleSubmit((data) => {
    if (!config) return;

    const skill: Skill = {
      id: editingSkill ?? crypto.randomUUID(),
      name: data.name,
      description: data.description,
      // A weight row pointing at nothing is dropped rather than stored: the picker only offers
      // real stats, so an empty target means the row was added and never filled in.
      //
      // An emptied weight box reads back as `NaN` through `valueAsNumber`, which would persist and
      // then poison every level the skill feeds — so it is read as the 0 the empty box looks like
      // rather than stored as a number that is not one (TICKET-SKL-03).
      statWeights: data.statWeights
        .filter((row) => row.statId !== '')
        .map((row) => ({ ...row, weight: Number.isFinite(row.weight) ? row.weight : 0 })),
    };

    if (editingSkill) {
      updateSkill(editingSkill, skill);
    } else {
      addSkill(skill);
    }

    setIsDialogOpen(false);
  });

  return {
    config,
    currentSkills,
    weightableStats,
    isDialogOpen,
    setIsDialogOpen,
    editingSkill,
    blocked,
    dismissBlocked,
    form,
    handleAdd,
    handleEdit,
    handleDelete,
    handleSave,
  };
}
