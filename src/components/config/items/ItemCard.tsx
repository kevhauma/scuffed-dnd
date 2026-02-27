/**
 * Item Card Component
 * 
 * Displays an item with its material, equipment slot, and category information.
 */

import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import type { Item, Material, EquipmentSlot } from '../../../types';

interface ItemCardProps {
  item: Item;
  materials: Material[];
  equipmentSlots: EquipmentSlot[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ItemCard({
  item,
  materials,
  equipmentSlots,
  onEdit,
  onDelete,
}: ItemCardProps) {
  const material = item.materialId 
    ? materials.find(m => m.id === item.materialId)
    : null;
  
  const materialLevel = material && item.materialLevel
    ? material.levels.find(l => l.level === item.materialLevel)
    : null;

  const equipmentSlot = item.equipmentSlotType
    ? equipmentSlots.find(s => s.type === item.equipmentSlotType)
    : null;

  return (
    <Card variant="elevated" className="p-4">
      {/* Item Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <Text variant="body" className="font-semibold">{item.name}</Text>
          {item.description && (
            <Text variant="body-small-secondary" as="p" className="mt-1">
              {item.description}
            </Text>
          )}
        </div>
        <div className="flex gap-2">
          <Button 
            variant="secondary" 
            onClick={() => onEdit(item.id)}
            className="text-xs px-2 py-1"
          >
            Edit
          </Button>
          <Button 
            variant="danger" 
            onClick={() => onDelete(item.id)}
            className="text-xs px-2 py-1"
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Item Details */}
      <div className="space-y-2">
        {/* Category */}
        {item.categoryId && (
          <div className="flex items-center gap-2">
            <Text variant="body-small-secondary">Category:</Text>
            <span className="text-xs px-2 py-1 bg-stone-100 border border-stone-200 rounded">
              {item.categoryId}
            </span>
          </div>
        )}

        {/* Material */}
        {material && materialLevel && (
          <div className="flex items-center gap-2">
            <Text variant="body-small-secondary">Material:</Text>
            <span className="text-xs px-2 py-1 bg-amber/10 border border-amber rounded">
              {material.name} - {materialLevel.name}
            </span>
          </div>
        )}

        {/* Equipment Slot */}
        {equipmentSlot && (
          <div className="flex items-center gap-2">
            <Text variant="body-small-secondary">Equipment Slot:</Text>
            <span className="text-xs px-2 py-1 bg-royal/10 border border-royal rounded">
              {equipmentSlot.name}
            </span>
          </div>
        )}

        {/* Material Bonuses */}
        {materialLevel && materialLevel.bonuses.length > 0 && (
          <div>
            <Text variant="body-small-secondary" className="mb-1">Bonuses:</Text>
            <div className="flex flex-wrap gap-2">
              {materialLevel.bonuses.map((bonus, idx) => (
                <span 
                  key={idx}
                  className={`text-xs px-2 py-1 rounded ${
                    bonus.modifier >= 0 
                      ? 'bg-forest/10 text-forest border border-forest' 
                      : 'bg-crimson/10 text-crimson border border-crimson'
                  }`}
                >
                  {bonus.skillCode}: {bonus.modifier >= 0 ? '+' : ''}{bonus.modifier}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
