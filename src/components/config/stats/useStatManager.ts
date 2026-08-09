/**
 * Stat Manager Hook
 *
 * Manages stat CRUD operations and form state.
 *
 * Carries the unified stat's fields mechanically (TICKET-STAT-01): an empty `formula` means the
 * stat is **invested** rather than derived, which is why it is stripped rather than stored as an
 * empty string — the two are different stats, not different spellings of one. The real editor,
 * with the flags and bounds laid out properly, is TICKET-STAT-02.
 *
 * Two rules moved here with the merge. **An abbreviation is a formula spelling**, and it shares
 * one flat namespace with the speciality and combat skill codes, so it has to be identifier-shaped
 * and unique against all three — the rule the skill managers already enforce from their side.
 * **A rename has a character half**: `focusStatCode` is keyed by the abbreviation, so re-spelling
 * one carries into the characters through `useSkillCodeRename`, exactly as the skill managers do.
 *
 * **Validates: Concept 01; Concept 00 §6; Requirements 2.3, 16.5, 16.6**
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { validateFormulaChange } from '../../../engine/formula/formulaChange';
import { useConfigStore } from '../../../stores/configStore';
import type { Stat } from '../../../types';
import { useGuardedDelete } from '../shared/useGuardedDelete';
import { useSkillCodeRename } from '../skills/shared/skillIdentity';

/** What a spelling in the flat formula space must look like — `STR`, never `Str Total` */
const ABBREVIATION_PATTERN = /^[A-Z][A-Z0-9_]*$/;

interface StatFormData {
  name: string;
  abbreviation: string;
  description: string;
  formula: string;
  countsTowardTotal: boolean;
  isResource: boolean;
}

const EMPTY_FORM: StatFormData = {
  name: '',
  abbreviation: '',
  description: '',
  formula: '',
  countsTowardTotal: true,
  isResource: false,
};

export function useStatManager() {
  const config = useConfigStore((state) => state.config);
  const addStat = useConfigStore((state) => state.addStat);
  const updateStat = useConfigStore((state) => state.updateStat);
  const deleteStat = useConfigStore((state) => state.deleteStat);

  const { blocked, attemptDelete, dismissBlocked } = useGuardedDelete();
  const applyAbbreviationRename = useSkillCodeRename();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStatId, setEditingStatId] = useState<string | null>(null);

  const form = useForm<StatFormData>({ defaultValues: EMPTY_FORM });

  const currentStats = config?.stats || [];
  // What a derived stat's formula may name in the flat space — stat abbreviations, now that
  // stats are the invested atom (TICKET-STAT-01)
  const availableSkillCodes = currentStats.map((stat) => stat.abbreviation.toUpperCase());

  const handleAdd = () => {
    setEditingStatId(null);
    form.reset(EMPTY_FORM);
    setIsDialogOpen(true);
  };

  const handleEdit = (id: string) => {
    const stat = currentStats.find((s) => s.id === id);
    if (!stat) return;

    setEditingStatId(id);
    form.reset({
      name: stat.name,
      abbreviation: stat.abbreviation,
      description: stat.description,
      formula: stat.formula ?? '',
      countsTowardTotal: stat.countsTowardTotal,
      isResource: stat.isResource,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    const stat = config?.stats.find((candidate) => candidate.id === id);
    attemptDelete(`Stat ${stat?.name ?? id}`, (options) => deleteStat(id, options));
  };

  /**
   * What refuses a stat save, and on which field — or nothing, when it may go through
   *
   * Kept apart from the save itself so the two rules read as two rules: the abbreviation is a
   * formula spelling free in the one flat space, and the formula computes.
   */
  const statFormError = (
    id: string,
    abbreviation: string,
    formula: string
  ): { field: keyof StatFormData; message: string } | null => {
    if (!config) return null;

    if (!ABBREVIATION_PATTERN.test(abbreviation)) {
      return {
        field: 'abbreviation',
        message: 'Use letters, digits and underscores, starting with a letter',
      };
    }

    // One flat space, shared with the two skill code spaces (CLAUDE.md): a collision would split
    // a formula's identity from the value it reads
    const taken =
      currentStats.some(
        (stat) => stat.abbreviation.toUpperCase() === abbreviation && stat.id !== editingStatId
      ) ||
      [...config.specialitySkills, ...config.combatSkills].some(
        (skill) => skill.code.toUpperCase() === abbreviation
      );

    if (taken) {
      return { field: 'abbreviation', message: `${abbreviation} is already in use` };
    }

    // An empty formula is not a broken one — it is an invested stat, with nothing to validate
    if (!formula) return null;

    const validation = validateFormulaChange(config, {
      owner: 'stat',
      id,
      formula,
      previousId: editingStatId ?? undefined,
    });

    return validation.isValid ? null : { field: 'formula', message: validation.errors.join(' ') };
  };

  const handleSave = form.handleSubmit((data) => {
    if (!config) return;

    const id = editingStatId || crypto.randomUUID();
    const abbreviation = data.abbreviation.trim().toUpperCase();
    const formula = data.formula.trim();

    // Refuses the save rather than persisting it (Req 16.5, 16.6)
    const refusal = statFormError(id, abbreviation, formula);
    if (refusal) {
      form.setError(refusal.field, { type: 'validate', message: refusal.message });
      return;
    }

    const existing = currentStats.find((candidate) => candidate.id === editingStatId);
    const stat: Stat = {
      id,
      name: data.name,
      abbreviation,
      description: data.description,
      order: existing?.order ?? currentStats.length,
      countsTowardTotal: data.countsTowardTotal,
      isResource: data.isResource,
      // Absent rather than empty: absence is what makes the stat invested
      ...(formula ? { formula } : {}),
      ...(existing?.min !== undefined ? { min: existing.min } : {}),
      ...(existing?.max !== undefined ? { max: existing.max } : {}),
      rounding: existing?.rounding ?? 'none',
    };

    if (editingStatId) {
      // Spelled out rather than merged: `formula` and the bounds are optional, and a shallow
      // merge would keep a formula the User just cleared
      updateStat(editingStatId, { ...stat, formula: formula || undefined });
      // The configuration half is rename-safe on its own; this is the character half
      applyAbbreviationRename(existing?.abbreviation ?? null, abbreviation);
    } else {
      addStat(stat);
    }

    setIsDialogOpen(false);
  });

  return {
    blocked,
    dismissBlocked,
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
