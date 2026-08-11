/**
 * Constants Configuration Panel
 *
 * The named tunable numbers a ruleset is balanced with (Concept 05) — `bonus_divider`,
 * `apt_value` — each shown with what it is worth and which formulas depend on it. Layout and
 * composition only; the decisions live in `useConstantManager`.
 *
 * **Validates: Concept 05; Requirements 21.1-21.5**
 */

import { Button } from '../../ui/Button/Button';
import { Text } from '../../ui/Text/Text';
import { ConfigEmptyState } from '../shared/ConfigEmptyState';
import { ConfigPanelShell, NoConfigurationNotice } from '../shared/ConfigPanelShell';
import { ConstantCard } from './ConstantCard';
import { ConstantFormDialog } from './ConstantFormDialog';
import { useConstantManager } from './useConstantManager';

export function ConstantsConfigPanel() {
  const {
    config,
    constants,
    usages,
    isDialogOpen,
    setIsDialogOpen,
    editingConstantId,
    form,
    handleAdd,
    handleEdit,
    handleDelete,
    handleSave,
    blocked,
    dismissBlocked,
  } = useConstantManager();

  if (!config) {
    return <NoConfigurationNotice />;
  }

  return (
    <ConfigPanelShell
      title="Constants"
      description="Named numbers your formulas share, so rebalancing is one edit rather than a hunt"
      actions={
        <Button variant="primary" onClick={handleAdd}>
          Add Constant
        </Button>
      }
      headerExtra={
        <div className="mt-4 p-4 bg-parchment-100 border border-stone-200 rounded">
          <Text variant="body-small" className="text-ink-700">
            <strong>Tip:</strong> A formula reaches a constant as{' '}
            <span className="font-mono">const.bonus_divider</span>. Each card lists what currently
            depends on it, so you can see what a change will move before you make it.
          </Text>
        </div>
      }
      blocked={blocked}
      onCloseBlocked={dismissBlocked}
    >
      {constants.length === 0 ? (
        <ConfigEmptyState message="No constants configured yet. Click 'Add Constant' to create your first one." />
      ) : (
        <ul className="space-y-3">
          {constants.map((constant) => (
            <li key={constant.id}>
              <ConstantCard
                constant={constant}
                usages={usages.get(constant.id) ?? []}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </li>
          ))}
        </ul>
      )}

      <ConstantFormDialog
        isOpen={isDialogOpen}
        isEditing={!!editingConstantId}
        form={form}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSave}
      />
    </ConfigPanelShell>
  );
}
