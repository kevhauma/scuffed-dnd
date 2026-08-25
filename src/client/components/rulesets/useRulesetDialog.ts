/**
 * The one dialog that names a ruleset (TICKET-RUL-01, TICKET-RUL-03)
 *
 * Create, rename and copy all edit the same single field and differ only in their title, their verb
 * and what they do on submit — so there is one dialog, and this is the state behind it. A second
 * component per verb would have been a second home for the name rules to drift in.
 *
 * **Its own hook because it is its own concern**, the way `useRulesetDeletion` is. `useRulesetManager`
 * composes the two homes; this owns a form and three modes, and putting both in one function is what
 * took that hook past its complexity threshold when copy arrived.
 *
 * **Validates: v3 Req 33.2, 34.5**
 */

import { useCallback, useState } from 'react';
import { type UseFormReturn, useForm } from 'react-hook-form';
import { copyName } from '#shared/services/copyConfiguration';
import type { RulesetSummary } from '#shared/types/api';
import type { AccountRulesetsState } from './useAccountRulesets';

/**
 * What the naming dialog is being used for (TICKET-RUL-03)
 *
 * Three, since copy joined create and rename — which is what retired the `isRenaming` boolean it
 * used to be. A second boolean beside it would have made *creating* and *copying* representable at
 * once, and one dialog cannot be both.
 */
export const RULESET_DIALOG = {
  CREATE: 'create',
  RENAME: 'rename',
  COPY: 'copy',
} as const;

export type RulesetDialogMode = (typeof RULESET_DIALOG)[keyof typeof RULESET_DIALOG];

/** The one field the dialog edits, whichever thing it is doing */
export interface RulesetFormData {
  name: string;
}

/**
 * What the dialog is open for, as a shape that cannot be wrong
 *
 * A discriminated union rather than `{ mode, ruleset?: RulesetSummary }`, and the difference is not
 * cosmetic: the optional form made *rename with no ruleset* representable, and the only answer the
 * code could give that combination was **to create a ruleset the User never asked for**. That is
 * the same class of invalid state the const object above exists to rule out, one level down. Making
 * it unrepresentable deletes the branch rather than deciding what it should do.
 */
type RulesetDialog =
  | { mode: typeof RULESET_DIALOG.CREATE }
  | { mode: typeof RULESET_DIALOG.RENAME | typeof RULESET_DIALOG.COPY; ruleset: RulesetSummary };

/** Just the account actions the dialog can invoke */
type DialogActions = Pick<AccountRulesetsState, 'create' | 'rename' | 'copy'>;

/** What a surface needs in order to render the dialog and drive it */
export interface RulesetDialogState {
  /** What it is doing, or `null` while it is closed */
  mode: RulesetDialogMode | null;
  form: UseFormReturn<RulesetFormData>;
  openCreate: () => void;
  openRename: (ruleset: RulesetSummary) => void;
  openCopy: (ruleset: RulesetSummary) => void;
  close: () => void;
  save: () => void;
}

/**
 * Do what the dialog was opened to do
 *
 * **A `switch` rather than a `Record` table**, which is the one place this file departs from
 * `RulesetFormDialog`'s `DIALOG_WORDS` beside it, and deliberately: the words are the same *shape*
 * for every mode, so a table fits them, while these three arms need **differently narrowed**
 * dialogs — `create` has no ruleset and the other two must have one. A `Record` cannot express that,
 * and writing one anyway would mean a cast per arm, which is the union's guarantee thrown away to
 * make two files rhyme.
 *
 * It keeps the property a table would have bought: with no `default` and a declared return type, a
 * fourth mode is a **compile error here** until somebody says what it does.
 *
 * @param dialog What is open and what it is about
 * @param name What the User typed
 * @param actions The account home's actions
 * @returns Whether the write landed, which is what decides the dialog closing
 */
function runDialogAction(
  dialog: RulesetDialog,
  name: string,
  actions: DialogActions
): Promise<boolean> {
  switch (dialog.mode) {
    case RULESET_DIALOG.CREATE:
      return actions.create(name);
    case RULESET_DIALOG.RENAME:
      return actions.rename(dialog.ruleset.id, name);
    case RULESET_DIALOG.COPY:
      return actions.copy(dialog.ruleset.id, name);
  }
}

/**
 * Drive the naming dialog
 *
 * @param actions What the account home can do; the dialog decides which of them
 * @returns The dialog's state and the four ways to change it
 */
export function useRulesetDialog(actions: DialogActions): RulesetDialogState {
  const [dialog, setDialog] = useState<RulesetDialog | null>(null);
  const form = useForm<RulesetFormData>({ defaultValues: { name: '' } });

  /** Open it, with the field pre-filled the way that mode wants it */
  const open = useCallback(
    (next: RulesetDialog, name: string) => {
      form.reset({ name });
      setDialog(next);
    },
    [form]
  );

  // The dialog closes only on a write that landed, so a refusal leaves the User's typing in front
  // of them alongside the reason — never a dialog that vanished over a change that did not happen
  const submit = form.handleSubmit(async ({ name }) => {
    if (!dialog) return;

    if (await runDialogAction(dialog, name, actions)) setDialog(null);
  });

  return {
    mode: dialog?.mode ?? null,
    form,
    openCreate: useCallback(() => open({ mode: RULESET_DIALOG.CREATE }, ''), [open]),
    // Pre-filled with the current name, so renaming is an edit rather than a re-type
    openRename: useCallback(
      (ruleset: RulesetSummary) => open({ mode: RULESET_DIALOG.RENAME, ruleset }, ruleset.name),
      [open]
    ),
    // …and with the derivative the server would have chosen anyway, so accepting it is one click
    openCopy: useCallback(
      (ruleset: RulesetSummary) =>
        open({ mode: RULESET_DIALOG.COPY, ruleset }, copyName(ruleset.name)),
      [open]
    ),
    close: useCallback(() => setDialog(null), []),
    save: () => void submit(),
  };
}
