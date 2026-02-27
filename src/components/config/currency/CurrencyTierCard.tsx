/**
 * Currency Tier Card
 * 
 * Displays a single currency tier with reorder controls and edit/delete actions.
 */

import type { CurrencyTier } from '../../../types';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';

interface CurrencyTierCardProps {
  tier: CurrencyTier;
  isFirst: boolean;
  isLast: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function CurrencyTierCard({
  tier,
  isFirst,
  isLast,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: CurrencyTierCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        {/* Reorder Controls */}
        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onMoveUp}
            disabled={isFirst}
            className="px-2"
          >
            ▲
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onMoveDown}
            disabled={isLast}
            className="px-2"
          >
            ▼
          </Button>
        </div>

        {/* Tier Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Text variant="body-small" className="text-ink-600">
              Order: {tier.order}
            </Text>
            <Text variant="h5" as="h3">{tier.name}</Text>
          </div>
          
          {!isLast && (
            <Text variant="body-small" className="text-ink-600">
              Conversion: {tier.conversionToNext} {tier.name} = 1 (next tier)
            </Text>
          )}
          
          {isLast && (
            <Text variant="body-small" className="text-ink-600 italic">
              Highest value tier
            </Text>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => onEdit(tier.id)}>
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(tier.id)}>
            Delete
          </Button>
        </div>
      </div>
    </Card>
  );
}
