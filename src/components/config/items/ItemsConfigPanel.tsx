/**
 * Items Configuration Panel
 * 
 * Manages items and equipment slots with filtering, material assignment, and equipment slot selection.
 * 
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 21.1-21.5**
 */

import { useItemManager } from './useItemManager';
import { ItemCard } from './ItemCard';
import { ItemFormDialog } from './ItemFormDialog';
import { EquipmentSlotFormDialog } from './EquipmentSlotFormDialog';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Select } from '../../ui/Select/Select';
import { Text } from '../../ui/Text/Text';

export function ItemsConfigPanel() {
  const {
    config,
    filteredItems,
    materials,
    equipmentSlots,
    itemCategories,
    categoryFilter,
    setCategoryFilter,
    isItemDialogOpen,
    setIsItemDialogOpen,
    isEquipmentSlotDialogOpen,
    setIsEquipmentSlotDialogOpen,
    editingItemId,
    editingEquipmentSlotType,
    itemForm,
    equipmentSlotForm,
    handleAddItem,
    handleEditItem,
    handleDeleteItem,
    handleSaveItem,
    handleAddEquipmentSlot,
    handleEditEquipmentSlot,
    handleDeleteEquipmentSlot,
    handleSaveEquipmentSlot,
  } = useItemManager();

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
            <Text variant="h4" as="h2" className="mb-2">Items & Equipment</Text>
            <Text variant="body-secondary">
              Define items with materials and equipment slots
            </Text>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleAddEquipmentSlot}>
              Add Equipment Slot
            </Button>
            <Button variant="primary" onClick={handleAddItem}>
              Add Item
            </Button>
          </div>
        </div>

        {/* Warnings */}
        {materials.length === 0 && (
          <div className="mt-4 p-4 bg-amber/10 border border-amber rounded">
            <Text variant="body-small" className="text-ink-700">
              No materials configured yet. Add materials first to assign them to items.
            </Text>
          </div>
        )}

        {equipmentSlots.length === 0 && (
          <div className="mt-4 p-4 bg-amber/10 border border-amber rounded">
            <Text variant="body-small" className="text-ink-700">
              No equipment slots configured yet. Add equipment slots to make items equippable.
            </Text>
          </div>
        )}
      </Card>

      {/* Equipment Slots Section */}
      {equipmentSlots.length > 0 && (
        <Card className="p-6">
          <Text variant="body" className="font-semibold mb-3">Equipment Slots</Text>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {equipmentSlots.map((slot) => (
              <div 
                key={slot.type}
                className="p-3 bg-parchment-50 border border-stone-200 rounded"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <Text variant="body-small" className="font-semibold">{slot.name}</Text>
                    <Text variant="body-small-secondary" className="text-xs">
                      ({slot.type})
                    </Text>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      variant="secondary" 
                      onClick={() => handleEditEquipmentSlot(slot.type)}
                      className="text-xs px-2 py-0.5"
                    >
                      Edit
                    </Button>
                    <Button 
                      variant="danger" 
                      onClick={() => handleDeleteEquipmentSlot(slot.type)}
                      className="text-xs px-2 py-0.5"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                {slot.description && (
                  <Text variant="body-small-secondary" className="text-xs">
                    {slot.description}
                  </Text>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Items Section */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <Text variant="body" className="font-semibold">Items</Text>
          
          {/* Category Filter */}
          {itemCategories.length > 0 && (
            <div className="flex items-center gap-2">
              <Text variant="body-small-secondary">Filter by category:</Text>
              <Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'All Categories' },
                  ...itemCategories.map(cat => ({ value: cat || '', label: cat || 'Uncategorized' }))
                ]}
                className="w-48"
              />
            </div>
          )}
        </div>

        {/* Items List */}
        {filteredItems.length === 0 ? (
          <Text variant="body-secondary" className="text-center py-8">
            {categoryFilter === 'all' 
              ? "No items configured yet. Click 'Add Item' to create your first item."
              : `No items in category "${categoryFilter}".`
            }
          </Text>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                materials={materials}
                equipmentSlots={equipmentSlots}
                onEdit={handleEditItem}
                onDelete={handleDeleteItem}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Item Form Dialog */}
      <ItemFormDialog
        isOpen={isItemDialogOpen}
        isEditing={!!editingItemId}
        form={itemForm}
        materials={materials}
        equipmentSlots={equipmentSlots}
        onClose={() => setIsItemDialogOpen(false)}
        onSave={handleSaveItem}
      />

      {/* Equipment Slot Form Dialog */}
      <EquipmentSlotFormDialog
        isOpen={isEquipmentSlotDialogOpen}
        isEditing={!!editingEquipmentSlotType}
        form={equipmentSlotForm}
        onClose={() => setIsEquipmentSlotDialogOpen(false)}
        onSave={handleSaveEquipmentSlot}
      />
    </div>
  );
}
