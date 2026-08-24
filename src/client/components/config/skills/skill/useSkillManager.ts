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

import { useForm } from 'react-hook-form';
import type { Skill, StatWeight } from '#shared/types';
import { useConfigStore } from '../../../../stores/configStore';
import { useEntityDialog } from '../../shared/useEntityDialog';
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

  const { blocked, attemptDelete, dismissBlocked } = useGuardedDelete();

  const form = useForm<SkillFormData>({ defaultValues: EMPTY_FORM });
  const dialog = useEntityDialog(form);

  const currentSkills = config?.skills ?? [];

  /** Every stat, in the User's order — any of them may govern a skill, derived ones included */
  const weightableStats = [...(config?.stats ?? [])].sort((a, b) => a.order - b.order);

  const handleAdd = () => {
    dialog.openForAdd(EMPTY_FORM);
  };

  const handleEdit = (id: string) => {
    const skill = currentSkills.find((candidate) => candidate.id === id);
    if (!skill) return;

    dialog.openForEdit(id, {
      name: skill.name,
      description: skill.description,
      statWeights: skill.statWeights,
    });
  };

  const handleDelete = (id: string) => {
    const skill = currentSkills.find((candidate) => candidate.id === id);
    attemptDelete(`Skill ${skill?.name ?? id}`, (options) => deleteSkill(id, options));
  };

  const handleSave = form.handleSubmit((data) => {
    if (!config) return;

    const skill: Skill = {
      id: dialog.editingId ?? crypto.randomUUID(),
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

    if (dialog.editingId) {
      updateSkill(dialog.editingId, skill);
    } else {
      addSkill(skill);
    }

    dialog.close();
  });

  return {
    config,
    currentSkills,
    weightableStats,
    isDialogOpen: dialog.isOpen,
    closeDialog: dialog.close,
    // `…Id`, like every sibling manager (CR-42): it holds the id being edited, not the skill
    editingSkillId: dialog.editingId,
    blocked,
    dismissBlocked,
    form,
    handleAdd,
    handleEdit,
    handleDelete,
    handleSave,
  };
}
