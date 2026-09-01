/**
 * Passive Manager Hook
 *
 * Owns the passives panel's store selectors, its dialog's form state and the CRUD handlers (v4
 * systems/14, TICKET-PAS-01). The panel renders; this decides.
 *
 * **No search and no page**, deliberately — the two things `useSpellManager` has and this does not.
 * The source workbook's catalog is **26 rows**, so the whole list fits on a screen and narrowing it
 * would be controls between a User and a table they can already read. The convention is *a panel
 * whose entity arrives in the hundreds narrows before it draws*; this one does not arrive in the
 * hundreds, and growing the machinery anyway would be the speculative generality the house rules
 * name.
 *
 * **Validates: v4 systems/14; Requirements 21.1-21.5**
 */

import { useForm } from 'react-hook-form';
import type { Passive } from '#shared/types';
import { useConfigStore } from '../../../stores/configStore';
import { useEntityDialog } from '../shared/useEntityDialog';
import { useGuardedDelete } from '../shared/useGuardedDelete';

export interface PassiveFormData {
  name: string;
  /** Prose, with `{formula}` wherever a number is computed — blank is a real state */
  effectText: string;
}

/** The form value standing for "nothing written here yet" */
const UNSTATED = '';

/** A blank passive, which is what the dialog opens on for an add */
const EMPTY_PASSIVE_FORM: PassiveFormData = {
  name: UNSTATED,
  effectText: UNSTATED,
};

export function usePassiveManager() {
  const config = useConfigStore((state) => state.config);
  const addPassive = useConfigStore((state) => state.addPassive);
  const updatePassive = useConfigStore((state) => state.updatePassive);
  const deletePassive = useConfigStore((state) => state.deletePassive);

  const { blocked, attemptDelete, dismissBlocked } = useGuardedDelete();

  const passiveForm = useForm<PassiveFormData>({ defaultValues: EMPTY_PASSIVE_FORM });
  const dialog = useEntityDialog(passiveForm);

  const passives = config?.passives ?? [];

  const handleAddPassive = () => {
    dialog.openForAdd(EMPTY_PASSIVE_FORM);
  };

  const handleEditPassive = (id: string) => {
    const passive = passives.find((candidate) => candidate.id === id);
    if (!passive) return;

    dialog.openForEdit(id, { name: passive.name, effectText: passive.effectText });
  };

  const handleDeletePassive = (id: string) => {
    const passive = passives.find((candidate) => candidate.id === id);
    attemptDelete(`Passive ${passive?.name ?? id}`, (options) => deletePassive(id, options));
  };

  const handleSavePassive = passiveForm.handleSubmit((data) => {
    const passive: Passive = {
      id: dialog.editingId ?? crypto.randomUUID(),
      name: data.name,
      // Not trimmed and not defaulted: the workbook's own wording is the ruleset's, and an empty
      // effect is a passive somebody has named but not yet described (v4 D1)
      effectText: data.effectText,
    };

    if (dialog.editingId) {
      updatePassive(dialog.editingId, passive);
    } else {
      addPassive(passive);
    }

    dialog.close();
  });

  return {
    config,
    passives,
    isPassiveDialogOpen: dialog.isOpen,
    closePassiveDialog: dialog.close,
    editingPassiveId: dialog.editingId,
    passiveForm,
    handleAddPassive,
    handleEditPassive,
    handleDeletePassive,
    handleSavePassive,
    blocked,
    dismissBlocked,
  };
}
