/**
 * Equipment Slots Configuration Panel
 *
 * Manages equipment slot types with CRUD operations.
 *
 * **Validates: Requirements 7.5, 21.1-21.5**
 */

import { Button } from '../../ui/Button/Button';
import { Text } from '../../ui/Text/Text';
import { ConfigEmptyState } from '../shared/ConfigEmptyState';
import { ConfigPanelShell, NoConfigurationNotice } from '../shared/ConfigPanelShell';
import { EquipmentSlotCard } from './EquipmentSlotCard';
import { EquipmentSlotFormDialog } from './EquipmentSlotFormDialog';
import { useEquipmentSlotManager } from './useEquipmentSlotManager';

export function EquipmentSlotsConfigPanel() {
  const {
    config,
    equipmentSlots,
    isDialogOpen,
    closeDialog,
    editingSlotType,
    form,
    handleAdd,
    handleEdit,
    handleDelete,
    handleSave,
    blocked,
    dismissBlocked,
  } = useEquipmentSlotManager();

  if (!config) {
    return <NoConfigurationNotice />;
  }

  return (
    <ConfigPanelShell
      title="Equipment Slots"
      description="Define where items can be equipped on characters"
      actions={
        <Button variant="primary" onClick={handleAdd}>
          Add Equipment Slot
        </Button>
      }
      headerExtra={
        <div className="p-4 bg-parchment-100 border border-stone-200 rounded">
          <Text variant="body-small" className="text-ink-700">
            Equipment slots define where items can be equipped (e.g., helmet, main_hand, off_hand).
            Items can optionally be assigned to an equipment slot type.
          </Text>
        </div>
      }
      blocked={blocked}
      onCloseBlocked={dismissBlocked}
    >
      {equipmentSlots.length === 0 ? (
        <ConfigEmptyState message="No equipment slots configured yet. Click 'Add Equipment Slot' to create your first slot." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {equipmentSlots.map((slot) => (
            <EquipmentSlotCard
              key={slot.type}
              slot={slot}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <EquipmentSlotFormDialog
        isOpen={isDialogOpen}
        isEditing={!!editingSlotType}
        form={form}
        onClose={closeDialog}
        onSave={handleSave}
      />
    </ConfigPanelShell>
  );
}
