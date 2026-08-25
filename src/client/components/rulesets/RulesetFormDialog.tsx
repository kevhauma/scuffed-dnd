/**
 * Naming a ruleset — on creation, on rename and on copy (TICKET-RUL-01, TICKET-RUL-03)
 *
 * One dialog for all three, because they edit the same single field and differ only in their title
 * and their verb. A second dialog would be a second place for the name rules to drift — and RUL-03
 * arriving as one extra row in a table rather than as another component is the evidence that the
 * shape was right.
 *
 * **Validates: v3 Req 33.2, 34.5**
 */

import type { UseFormReturn } from 'react-hook-form';
import { FormDialogActions } from '../config/shared/FormDialogActions';
import { Dialog } from '../ui/Dialog/Dialog';
import { FormField } from '../ui/FormField/FormField';
import { RULESET_DIALOG, type RulesetDialogMode, type RulesetFormData } from './useRulesetDialog';

/** What each mode calls itself, in the words the User reads */
const DIALOG_WORDS: Record<RulesetDialogMode, { title: string; submit: string }> = {
  [RULESET_DIALOG.CREATE]: { title: 'New ruleset on your account', submit: 'Create' },
  [RULESET_DIALOG.RENAME]: { title: 'Rename ruleset', submit: 'Rename' },
  [RULESET_DIALOG.COPY]: { title: 'Copy ruleset', submit: 'Copy' },
};

export interface RulesetFormDialogProps {
  /** What the dialog is doing, or `null` while it is closed */
  mode: RulesetDialogMode | null;
  form: UseFormReturn<RulesetFormData>;
  onClose: () => void;
  onSave: () => void;
}

export function RulesetFormDialog({ mode, form, onClose, onSave }: RulesetFormDialogProps) {
  const {
    register,
    formState: { errors },
  } = form;

  // `CREATE`'s words while closed: the `Dialog` renders nothing when `open` is false, and reading
  // them from a `null` mode would need a branch that only exists to be unreachable
  const words = DIALOG_WORDS[mode ?? RULESET_DIALOG.CREATE];

  return (
    <Dialog open={mode !== null} onClose={onClose} title={words.title}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
        className="space-y-4"
      >
        <FormField
          label="Name"
          required
          placeholder="Ducklets"
          error={errors.name?.message}
          {...register('name', { required: 'A ruleset needs a name.' })}
        />

        {/*
          The row thirteen configuration dialogs already end with (CR-23). Reached across feature
          folders on purpose: it lives under `config/shared/` for historical reasons, and copying
          eight lines here to avoid the path would be re-introducing exactly the drift it was
          extracted to end.
        */}
        <FormDialogActions submitLabel={words.submit} onCancel={onClose} />
      </form>
    </Dialog>
  );
}
