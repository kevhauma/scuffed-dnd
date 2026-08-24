/**
 * Entity Dialog Hook
 *
 * The open/edit/close lifecycle every configuration manager repeats (CR-24): is the dialog
 * showing, which entity is being edited, and the `form.reset` that has to happen with each. Nine
 * managers held their own copy of it, so every refinement to the lifecycle — a dirty-check on
 * close, say — was nine edits.
 *
 * **Deliberately not a generic `useEntityManager<T>`.** The review's judgment, and it holds up: the
 * save paths genuinely differ — identifier and uniqueness rules for constants and curves,
 * `validateFormulaChange` for stats and rolls, sparse-pruning for races and archetypes, index-based
 * levels for materials — and folding them into one hook would produce parameter soup in exchange
 * for the fifteen lines below. What is *identical* everywhere is the lifecycle, and that is all
 * this takes.
 *
 * Modelled on `useGuardedDelete`, which is the same shape of extraction at the other end of the
 * entity's life: one implementation, one-line callers, complete adoption.
 *
 * **Validates: Requirements 21.1-21.5**
 */

import { useState } from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';

export interface EntityDialog<TForm extends FieldValues> {
  /** Whether the dialog is showing */
  isOpen: boolean;
  /** Which entity is being edited, or `null` when the dialog is adding a new one */
  editingId: string | null;
  /** Open on a blank form */
  openForAdd: (defaults: TForm) => void;
  /** Open on an existing entity's values */
  openForEdit: (id: string, values: TForm) => void;
  /** Put the dialog away, leaving the form exactly as it is */
  close: () => void;
}

/**
 * Hold one entity dialog's lifecycle, resetting the form as it opens
 *
 * The reset belongs here rather than in each caller because it is the half that is easy to forget:
 * a dialog opened for an add after an edit shows the edited entity's values unless something clears
 * them.
 *
 * @param form - The dialog's form, whose values follow what is being opened
 * @returns The dialog's state and the three transitions it has
 */
export function useEntityDialog<TForm extends FieldValues>(
  form: UseFormReturn<TForm>
): EntityDialog<TForm> {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return {
    isOpen,
    editingId,

    openForAdd: (defaults: TForm) => {
      setEditingId(null);
      form.reset(defaults);
      setIsOpen(true);
    },

    openForEdit: (id: string, values: TForm) => {
      setEditingId(id);
      form.reset(values);
      setIsOpen(true);
    },

    // `editingId` is deliberately left alone: the dialog unmounts its fields, and clearing it here
    // would blank the title of a closing dialog mid-transition for no gain
    close: () => setIsOpen(false),
  };
}
