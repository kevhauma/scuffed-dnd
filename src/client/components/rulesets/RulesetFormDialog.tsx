/**
 * Naming a ruleset — on creation and on rename (TICKET-RUL-01)
 *
 * One dialog for both, because they edit the same single field and differ only in their title and
 * their verb. A second dialog would be a second place for the name rules to drift.
 *
 * **Validates: v3 Req 33.2**
 */

import type { UseFormReturn } from 'react-hook-form';
import { FormDialogActions } from '../config/shared/FormDialogActions';
import { Dialog } from '../ui/Dialog/Dialog';
import { FormField } from '../ui/FormField/FormField';
import type { RulesetFormData } from './useRulesetManager';

export interface RulesetFormDialogProps {
  isOpen: boolean;
  /** True when renaming an existing ruleset rather than creating one */
  isRenaming: boolean;
  form: UseFormReturn<RulesetFormData>;
  onClose: () => void;
  onSave: () => void;
}

export function RulesetFormDialog({
  isOpen,
  isRenaming,
  form,
  onClose,
  onSave,
}: RulesetFormDialogProps) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title={isRenaming ? 'Rename ruleset' : 'New ruleset on your account'}
    >
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
        <FormDialogActions submitLabel={isRenaming ? 'Rename' : 'Create'} onCancel={onClose} />
      </form>
    </Dialog>
  );
}
