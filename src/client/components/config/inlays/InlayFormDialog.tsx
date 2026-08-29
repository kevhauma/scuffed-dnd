/**
 * Inlay Form Dialog
 *
 * The gem family itself — its name, what it is, and which heading it is listed under (v4
 * systems/10, TICKET-INL-01). The tiers are the other dialog's; a family and its ladder are edited
 * apart for the same reason a material and its levels are.
 *
 * **Validates: v4 systems/10; Requirements 21.1-21.5**
 */

import type { UseFormReturn } from 'react-hook-form';
import { Dialog } from '../../ui/Dialog/Dialog';
import { FormField } from '../../ui/FormField/FormField';
import { FormDialogActions } from '../shared/FormDialogActions';
import type { InlayFormData } from './useInlayManager';

interface InlayFormDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  form: UseFormReturn<InlayFormData>;
  onClose: () => void;
  onSave: () => void;
}

export function InlayFormDialog({
  isOpen,
  isEditing,
  form,
  onClose,
  onSave,
}: InlayFormDialogProps) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <Dialog open={isOpen} onClose={onClose} title={`${isEditing ? 'Edit' : 'Add'} Inlay`}>
      <form onSubmit={onSave} className="space-y-4">
        <FormField
          label="Name"
          required
          placeholder="Diamond"
          error={errors.name?.message}
          {...register('name', { required: 'Name is required' })}
        />

        <FormField
          label="Description"
          placeholder="A precious stone, socketed for mana"
          {...register('description')}
        />

        {/* A free word, not a picked one: the sheet writes Common and Precious, and a ruleset that
            sorts its gems some other way is not wrong (`Stat.group`'s rule, TICKET-STAT-04) */}
        <FormField label="Group" placeholder="Precious Gems" {...register('group')} />

        <FormDialogActions
          submitLabel={`${isEditing ? 'Update' : 'Add'} Inlay`}
          onCancel={onClose}
        />
      </form>
    </Dialog>
  );
}
