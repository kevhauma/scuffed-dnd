/**
 * Items Configuration Panel
 *
 * Manages items with filtering, material assignment, and equipment slot selection.
 *
 * **Slots are defined in `EquipmentSlotsConfigPanel`, not here** (CR-20). This panel used to carry
 * its own slot list, its own "Add Equipment Slot" button and its own dialog, all of it a second
 * copy of what that panel already does — and `/config/items` mounted both, so the page showed each
 * of those things twice. What is left is the one thing an item needs from a slot: to name it, with
 * a prerequisite note pointing at the page that defines them. Since TICKET-INV-02 that is
 * `/config/equipment` rather than the panel below, so the note names the section by its nav label.
 *
 * **Templates are listed under the shop that sells them** (v4 systems/11, TICKET-ITEM-01). The
 * headings are the ruleset's own words — nine in the source workbook, three or none in somebody
 * else's — and a ruleset that names no shops gets the one flat grid it always had, grouped and
 * filtered by category exactly as before. The category filter still narrows the list; the shops
 * re-head whatever survives it, so a filter cannot leave an empty heading standing.
 *
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 21.1-21.5; v4 systems/11**
 */

import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Select } from '../../ui/Select/Select';
import { Text } from '../../ui/Text/Text';
import { ConfigEmptyState } from '../shared/ConfigEmptyState';
import { ConfigPanelShell, NoConfigurationNotice } from '../shared/ConfigPanelShell';
import { ItemCard } from './ItemCard';
import { ItemFormDialog } from './ItemFormDialog';
import { useItemManager } from './useItemManager';

export function ItemsConfigPanel() {
  const {
    config,
    filteredItems,
    shopGroups,
    materials,
    equipmentSlots,
    stats,
    skills,
    skillOptions,
    itemCategories,
    categoryFilter,
    setCategoryFilter,
    isItemDialogOpen,
    setIsItemDialogOpen,
    editingItemId,
    itemForm,
    handleAddItem,
    handleEditItem,
    handleDeleteItem,
    handleSaveItem,
    blocked,
    dismissBlocked,
  } = useItemManager();

  if (!config) {
    return <NoConfigurationNotice />;
  }

  return (
    <ConfigPanelShell
      title="Items"
      description="Define items, what they are made of, and where they are worn"
      actions={
        <Button variant="primary" onClick={handleAddItem}>
          Add Item
        </Button>
      }
      prerequisites={[
        ...(materials.length === 0
          ? ['No materials configured yet. Add materials first to assign them to items.']
          : []),
        ...(equipmentSlots.length === 0
          ? [
              'No equipment slots configured yet. Add them under Configuration → Equipment to make items equippable.',
            ]
          : []),
      ]}
      blocked={blocked}
      onCloseBlocked={dismissBlocked}
    >
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <Text variant="body" className="font-semibold">
            Items
          </Text>

          {/* Category Filter */}
          {itemCategories.length > 0 && (
            <div className="flex items-center gap-2">
              <Text variant="body-small-secondary">Filter by category:</Text>
              <Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'All Categories' },
                  ...itemCategories.map((cat) => ({
                    value: cat || '',
                    label: cat || 'Uncategorized',
                  })),
                ]}
                className="w-48"
              />
            </div>
          )}
        </div>

        {/* Items List */}
        {filteredItems.length === 0 ? (
          // The shared card, with the message parameterised (CR-43) — the filter changes what
          // "empty" means here, which is a different sentence rather than a different component
          <ConfigEmptyState
            message={
              categoryFilter === 'all'
                ? "No items configured yet. Click 'Add Item' to create your first item."
                : `No items in category "${categoryFilter}".`
            }
          />
        ) : (
          <div className="space-y-6">
            {shopGroups.map((shop) => (
              <div key={shop.label ?? ''} className="space-y-2">
                {/* An unnamed group carries no heading: it is the templates the ruleset put in no
                    shop, and a blank one would be a heading nobody asked for */}
                {shop.label && (
                  <Text variant="h5" as="h3">
                    {shop.label}
                  </Text>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {shop.members.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      materials={materials}
                      equipmentSlots={equipmentSlots}
                      stats={stats}
                      skills={skills}
                      onEdit={handleEditItem}
                      onDelete={handleDeleteItem}
                    />
                  ))}
                </div>
              </div>
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
        skillOptions={skillOptions}
        onClose={() => setIsItemDialogOpen(false)}
        onSave={handleSaveItem}
      />
    </ConfigPanelShell>
  );
}
