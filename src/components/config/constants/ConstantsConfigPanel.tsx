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
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { BlockedDeleteDialog } from '../shared/BlockedDeleteDialog';
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
    return (
      <Card className="p-6">
        <Text variant="body-secondary">
          No configuration loaded. Please initialize a configuration first.
        </Text>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <Text variant="h4" as="h2" className="mb-2">
              Constants
            </Text>
            <Text variant="body-secondary">
              Named numbers your formulas share, so rebalancing is one edit rather than a hunt
            </Text>
          </div>
          <Button variant="primary" onClick={handleAdd}>
            Add Constant
          </Button>
        </div>

        <div className="mt-4 p-4 bg-parchment-100 border border-stone-200 rounded">
          <Text variant="body-small" className="text-ink-700">
            <strong>Tip:</strong> A formula reaches a constant as{' '}
            <span className="font-mono">const.bonus_divider</span>. Each card lists what currently
            depends on it, so you can see what a change will move before you make it.
          </Text>
        </div>
      </Card>

      {/* Constants list */}
      {constants.length === 0 ? (
        <Card className="p-6">
          <Text variant="body-secondary" className="text-center">
            No constants configured yet. Click 'Add Constant' to create your first one.
          </Text>
        </Card>
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
      <BlockedDeleteDialog blocked={blocked} onClose={dismissBlocked} />
    </div>
  );
}
