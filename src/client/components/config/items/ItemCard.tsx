/**
 * Item Card Component
 *
 * Displays a **template** — its equipment slot, category and shop, plus the per-skill vector
 * wielding it applies (TICKET-ITEM-01).
 *
 * **What it is made of is not on the card any more** (TICKET-INV-05). A template named a material
 * tier until v4.0, and the card showed that tier's stat bonuses under a second heading; both went
 * with the fused pair. What a thing is made of is a fact about the thing a Player *built*, so the
 * material tier, the inlay tier and the stat bonuses they add up to belong to the composed item on a
 * character sheet — TICKET-INV-06's surface.
 *
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.6, 21.1-21.5; v4 systems/11, systems/12**
 */

import type { EquipmentSlot, Item, Skill } from '#shared/types';
import { SkillBonusBadges } from '../../shared/SkillBonusBadges';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';

interface ItemCardProps {
  item: Item;
  equipmentSlots: EquipmentSlot[];
  /** The ruleset's skills, for spelling the template's own bonuses (TICKET-ITEM-01) */
  skills: Skill[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ItemCard({ item, equipmentSlots, skills, onEdit, onDelete }: ItemCardProps) {
  const equipmentSlot = item.equipmentSlotType
    ? equipmentSlots.find((s) => s.type === item.equipmentSlotType)
    : null;

  return (
    <Card variant="elevated" className="p-4">
      {/* Item Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <Text variant="body" className="font-semibold">
            {item.name}
          </Text>
          {item.description && (
            <Text variant="body-small-secondary" as="p" className="mt-1">
              {item.description}
            </Text>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => onEdit(item.id)} className="text-xs px-2 py-1">
            Edit
          </Button>
          <Button variant="danger" onClick={() => onDelete(item.id)} className="text-xs px-2 py-1">
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

        {/* Shop */}
        {item.shop && (
          <div className="flex items-center gap-2">
            <Text variant="body-small-secondary">Shop:</Text>
            <span className="text-xs px-2 py-1 bg-stone-100 border border-stone-200 rounded">
              {item.shop}
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

        {/* The template's own skill vector — the only bonus list a template has since INV-05 */}
        {item.skillBonuses && item.skillBonuses.length > 0 && (
          <div>
            <Text variant="body-small-secondary" className="mb-1">
              Skill Bonuses:
            </Text>
            <SkillBonusBadges bonuses={item.skillBonuses} skills={skills} />
          </div>
        )}
      </div>
    </Card>
  );
}
