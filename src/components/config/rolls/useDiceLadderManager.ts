/**
 * Dice Ladder Manager Hook
 *
 * Ladder CRUD and form state (Concept 07, TICKET-ROLL-03's entity getting its editor in
 * TICKET-ROLL-05). A ladder holds no formula, so there is no save-time formula guard here — what
 * can be wrong with one is the shape of `dieSizes`, which `engine/validator.ts` reports and the
 * form refuses up front.
 *
 * **Validates: Concept 07**
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useConfigStore } from '../../../stores/configStore';
import type { DiceLadder } from '../../../types';
import { useGuardedDelete } from '../shared/useGuardedDelete';

interface LadderFormData {
  name: string;
  description: string;
  /** Comma- or space-separated sizes, exactly as the sheet writes them: `20, 12, 6` */
  dieSizes: string;
  /** Empty string is "no cap" — a number input cannot hold `undefined` */
  maxPerDie: string;
  showZeroTerms: boolean;
}

const EMPTY_LADDER: LadderFormData = {
  name: '',
  description: '',
  dieSizes: '',
  maxPerDie: '',
  showZeroTerms: true,
};

/**
 * Read a typed size list, keeping whatever the User meant by each entry
 *
 * Deliberately permissive about *separators* and strict about *values*: `20, 12, 6` and `20 12 6`
 * are the same list, but a non-numeric entry comes back as `NaN` so the form can refuse it by name
 * rather than silently dropping it — a dropped rung would change the ruleset without saying so.
 */
function parseDieSizes(raw: string): number[] {
  return raw
    .split(/[,\s]+/)
    .filter((part) => part.length > 0)
    .map(Number);
}

/** The stored sizes as the form shows them */
function formatDieSizes(sizes: number[]): string {
  return sizes.join(', ');
}

export function useDiceLadderManager() {
  const config = useConfigStore((state) => state.config);
  const addDiceLadder = useConfigStore((state) => state.addDiceLadder);
  const updateDiceLadder = useConfigStore((state) => state.updateDiceLadder);
  const deleteDiceLadder = useConfigStore((state) => state.deleteDiceLadder);

  const { blocked, attemptDelete, dismissBlocked } = useGuardedDelete();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLadderId, setEditingLadderId] = useState<string | null>(null);

  const form = useForm<LadderFormData>({ defaultValues: EMPTY_LADDER });

  const currentLadders = config?.diceLadders ?? [];

  /**
   * The form's own refusal for a size list, ahead of the validator's report
   *
   * The same three rules `engine/validator.ts` applies, said before the save rather than after it:
   * a list that is empty, holds a non-positive whole number, or is not strictly descending cannot
   * be walked greedily.
   */
  const validateDieSizes = (raw: string): string | true => {
    const sizes = parseDieSizes(raw);

    if (sizes.length === 0) return 'Give at least one die size';
    if (sizes.some((size) => !Number.isInteger(size) || size <= 0)) {
      return 'Every die size must be a positive whole number';
    }
    if (sizes.some((size, index) => index > 0 && size >= sizes[index - 1])) {
      return 'Sizes must go largest first, with no repeats — the walk is greedy';
    }

    return true;
  };

  const handleAdd = () => {
    setEditingLadderId(null);
    form.reset(EMPTY_LADDER);
    setIsDialogOpen(true);
  };

  const handleEdit = (id: string) => {
    const ladder = currentLadders.find((candidate) => candidate.id === id);
    if (!ladder) return;

    setEditingLadderId(id);
    form.reset({
      name: ladder.name,
      description: ladder.description,
      dieSizes: formatDieSizes(ladder.dieSizes),
      maxPerDie: ladder.maxPerDie === undefined ? '' : String(ladder.maxPerDie),
      showZeroTerms: ladder.showZeroTerms,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    const ladder = currentLadders.find((candidate) => candidate.id === id);
    attemptDelete(`Dice ladder ${ladder?.name ?? id}`, (options) => deleteDiceLadder(id, options));
  };

  const handleSave = form.handleSubmit((data) => {
    const ladder: DiceLadder = {
      id: editingLadderId || crypto.randomUUID(),
      name: data.name,
      description: data.description,
      dieSizes: parseDieSizes(data.dieSizes),
      showZeroTerms: data.showZeroTerms,
      // An enum of one until a ruleset needs `smallest_die` or `drop` (Concept 07)
      remainder: 'flat',
      ...(data.maxPerDie === '' ? {} : { maxPerDie: Number(data.maxPerDie) }),
    };

    if (editingLadderId) {
      // `maxPerDie` passed explicitly even when absent: the store's merge deletes a key set to
      // `undefined`, and a spread that omits it would leave the old cap in place
      updateDiceLadder(editingLadderId, { ...ladder, maxPerDie: ladder.maxPerDie });
    } else {
      addDiceLadder(ladder);
    }

    setIsDialogOpen(false);
  });

  return {
    blocked,
    dismissBlocked,
    currentLadders,
    isDialogOpen,
    setIsDialogOpen,
    editingLadderId,
    form,
    validateDieSizes,
    handleAdd,
    handleEdit,
    handleDelete,
    handleSave,
  };
}
