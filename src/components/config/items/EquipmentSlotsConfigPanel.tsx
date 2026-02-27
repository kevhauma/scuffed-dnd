/**
 * Equipment Slots Configuration Panel
 * 
 * Manages equipment slot types with CRUD operations.
 * 
 * **Validates: Requirements 7.5, 21.1-21.5**
 */

import { useEquipmentSlotManager } from './useEquipmentSlotManager';
import { EquipmentSlotCard } from './EquipmentSlotCard';
import { EquipmentSlotFormDialog } from './EquipmentSlotFormDialog';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';

export function EquipmentSlotsConfigPanel() {
  const {
    config,
    equipmentSlots,
    isDialogOpen,
    setIsDialogOpen,
    editingSlotType,
    form,
    handleAdd,
    handleEdit,
    handleDelete,
    handleSave,
  } = useEquipmentSlotManager();

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
            <Text variant="h4" as="h2" className="mb-2">Equipment Slots</Text>
            <Text variant="body-secondary">
              Define where items can be equipped on characters
            </Text>
          </div>
          <Button variant="primary" onClick={handleAdd}>
            Add Equipment Slot
          </Button>
        </div>

        <div className="p-4 bg-parchment-100 border border-stone-200 rounded">
          <Text variant="body-small" className="text-ink-700">
            Equipment slots define where items can be equipped (e.g., helmet, main_hand, off_hand).
            Items can optionally be assigned to an equipment slot type.
          </Text>
        </div>
      </Card>

      {/* Equipment Slots List */}
      {equipmentSlots.length === 0 ? (
        <Card className="p-6">
          <Text variant="body-secondary" className="text-center">
            No equipment slots configured yet. Click 'Add Equipment Slot' to create your first slot.
          </Text>
        </Card>
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

      {/* Form Dialog */}
      <EquipmentSlotFormDialog
        isOpen={isDialogOpen}
        isEditing={!!editingSlotType}
        form={form}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
