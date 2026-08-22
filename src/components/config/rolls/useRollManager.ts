/**
 * Roll Definition Manager Hook
 *
 * Roll CRUD and form state (Concept 08, TICKET-ROLL-05). A roll is an input expression plus a
 * ladder, so this is the shape the retired combat-skill manager had minus the six hand-typed dice
 * counts — which is the point of the entity.
 *
 * The input is refused at save time if it would not compute, through the same
 * `validateFormulaChange` guard every other formula-owning editor uses; the attachment point is
 * `roll-input`, a row in `scoping.ts` rather than a branch here.
 *
 * **Validates: Concept 08; Requirements 16.5, 16.6**
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { validateFormulaChange } from '../../../engine/formula/formulaChange';
import { scopeFor } from '../../../engine/formula/scoping';
import { useConfigStore } from '../../../stores/configStore';
import type { RollCategory, RollDefinition } from '../../../types';
import { useGuardedDelete } from '../shared/useGuardedDelete';

export interface RollFormData {
  name: string;
  description: string;
  input: string;
  ladderId: string;
  /** Empty string is "no category" — a `<select>` cannot hold `undefined` */
  category: RollCategory | '';
}

const EMPTY_ROLL: RollFormData = {
  name: '',
  description: '',
  input: '',
  ladderId: '',
  category: '',
};

export function useRollManager() {
  const config = useConfigStore((state) => state.config);
  const addRollDefinition = useConfigStore((state) => state.addRollDefinition);
  const updateRollDefinition = useConfigStore((state) => state.updateRollDefinition);
  const deleteRollDefinition = useConfigStore((state) => state.deleteRollDefinition);

  const { blocked, attemptDelete, dismissBlocked } = useGuardedDelete();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRollId, setEditingRollId] = useState<string | null>(null);

  const form = useForm<RollFormData>({ defaultValues: EMPTY_ROLL });

  const availableLadders = config?.diceLadders ?? [];
  const currentRolls = [...(config?.rollDefinitions ?? [])].sort((a, b) => a.order - b.order);

  // The bare codes a roll input may name, for the editor's autocomplete. Read from `scopeFor`
  // rather than mapped by hand (CR-25), so the completions, `FormulaPreview` and the save-time
  // `validateFormulaChange` below all answer from the one scoping table — a new row in
  // `LEGACY_CODE_SCOPES` or `CONTEXT_CODES` for `roll-input` should not be able to make the
  // editor suggest a different set from the one the validator accepts.
  const availableSkillCodes = config
    ? Array.from(scopeFor(config, 'roll-input').codes)
    : ([] as string[]);

  /** The ladder a roll names, or undefined when it points at one that is gone */
  const ladderFor = (ladderId: string) =>
    availableLadders.find((candidate) => candidate.id === ladderId);

  const handleAdd = () => {
    setEditingRollId(null);
    // Pre-selecting the only ladder saves the User a click they have no choice about; with several,
    // picking for them would be a guess
    form.reset({
      ...EMPTY_ROLL,
      ladderId: availableLadders.length === 1 ? availableLadders[0].id : '',
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (id: string) => {
    const roll = currentRolls.find((candidate) => candidate.id === id);
    if (!roll) return;

    setEditingRollId(id);
    form.reset({
      name: roll.name,
      description: roll.description,
      input: roll.input,
      ladderId: roll.ladderId,
      category: roll.category ?? '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    const roll = currentRolls.find((candidate) => candidate.id === id);
    attemptDelete(`Roll ${roll?.name ?? id}`, (options) => deleteRollDefinition(id, options));
  };

  const handleSave = form.handleSubmit((data) => {
    if (!config) return;

    const id = editingRollId || crypto.randomUUID();

    // Refuse the save if the input would not compute (Req 16.5, 16.6)
    const validation = validateFormulaChange(config, {
      owner: 'roll-input',
      id,
      formula: data.input,
      previousId: editingRollId ?? undefined,
    });

    if (!validation.isValid) {
      form.setError('input', { type: 'validate', message: validation.errors.join(' ') });
      return;
    }

    const roll: RollDefinition = {
      id,
      name: data.name,
      description: data.description,
      input: data.input,
      ladderId: data.ladderId,
      // Absent rather than empty, so "no category" round-trips as a missing key
      ...(data.category === '' ? {} : { category: data.category }),
      // A new roll goes last; an edited one keeps the place it had. One past the highest rather
      // than the count, so deleting a roll cannot make the next one collide with an existing order
      order:
        currentRolls.find((candidate) => candidate.id === id)?.order ??
        currentRolls.reduce((highest, roll) => Math.max(highest, roll.order + 1), 0),
    };

    if (editingRollId) {
      // `category` cleared to `undefined` so the store's merge removes the key rather than
      // leaving the previous category behind a spread that never mentions it
      updateRollDefinition(editingRollId, { ...roll, category: roll.category });
    } else {
      addRollDefinition(roll);
    }

    setIsDialogOpen(false);
  });

  return {
    blocked,
    dismissBlocked,
    config,
    currentRolls,
    availableLadders,
    availableSkillCodes,
    ladderFor,
    isDialogOpen,
    setIsDialogOpen,
    editingRollId,
    form,
    handleAdd,
    handleEdit,
    handleDelete,
    handleSave,
  };
}
