/**
 * Form Dialog Actions
 *
 * The Cancel/submit row every configuration form dialog ends with (CR-23). Thirteen dialogs carried
 * a verbatim copy of it, differing only in the submit label — and in their spacing, which had drifted
 * into two: `gap-3 mt-6` in the newer generation and `gap-2 pt-4` in the older one. This is the
 * newer spacing, applied to all of them.
 *
 * A component rather than a `Dialog` prop because the row belongs *inside* the `<form>` — the
 * submit button's whole job is to submit it, and a footer rendered by `Dialog` would sit outside.
 *
 * **Validates: Requirements 21.1-21.5**
 */

import { Button } from '../../ui/Button/Button';

export interface FormDialogActionsProps {
  /** What the submit button says — "Update Stat", "Add Tier" */
  submitLabel: string;
  onCancel: () => void;
}

export function FormDialogActions({ submitLabel, onCancel }: FormDialogActionsProps) {
  return (
    <div className="flex justify-end gap-3 mt-6">
      <Button type="button" variant="secondary" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" variant="primary">
        {submitLabel}
      </Button>
    </div>
  );
}
