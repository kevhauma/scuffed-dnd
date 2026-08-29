/**
 * Inlay Card
 *
 * One gem family and its tier ladder (v4 systems/10, TICKET-INL-01) — `MaterialCard`'s counterpart
 * for the other ingredient a composed item is made of.
 *
 * **A missing rung is drawn as missing.** The card lists the tiers the family *has*, each labelled
 * with its own number, so Zircon's nine rows read `Tier 1 … Tier 9` and nothing renders a tenth at
 * zero. Inventing the row would be inventing data the sheet does not have — and the rows are sorted
 * by rung for display, since the ladder is stored in the order the User added to it.
 *
 * **Validates: v4 systems/10; Requirements 21.1-21.5**
 */

import { useState } from 'react';
import type { Inlay, Stat } from '#shared/types';
import { StatModifierBadges } from '../../shared/StatModifierBadges';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';

interface InlayCardProps {
  inlay: Inlay;
  /** The ruleset's stats, for spelling each tier bonus's target */
  stats: Stat[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onAddTier: (inlayId: string) => void;
  onEditTier: (inlayId: string, tierIndex: number) => void;
  onDeleteTier: (inlayId: string, tierIndex: number) => void;
}

export function InlayCard({
  inlay,
  stats,
  onEdit,
  onDelete,
  onAddTier,
  onEditTier,
  onDeleteTier,
}: InlayCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const tierCount = inlay.tiers.length;

  // **Drawn in rung order, stored in the order the User added them.** Adding tier 5 to a family
  // holding 1 and 9 would otherwise draw `Tier 1, Tier 9, Tier 5`. The **stored** index travels
  // with each row, because that is what the edit and delete handlers address — and the `map` copies
  // before the `sort`, so this never reorders the store's own array in a render pass (CR-15).
  const orderedTiers = inlay.tiers
    .map((tier, index) => ({ tier, index }))
    .sort((first, second) => first.tier.tier - second.tier.tier);

  return (
    <Card variant="elevated" className="p-3">
      <div className="flex justify-between items-start mb-2 gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${inlay.name}`}
              className="text-xs px-1 py-0.5"
            >
              {isExpanded ? '▼' : '▶'}
            </Button>
            <Text variant="body" className="font-semibold">
              {inlay.name}
            </Text>
            <Text variant="body-small-secondary" className="ml-2">
              ({tierCount} tier{tierCount === 1 ? '' : 's'})
            </Text>
          </div>
          {inlay.description && (
            <Text variant="body-small-secondary" as="p" className="ml-8 mt-1">
              {inlay.description}
            </Text>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="secondary"
            onClick={() => onAddTier(inlay.id)}
            className="text-xs px-2 py-1"
          >
            Add Tier
          </Button>
          <Button
            variant="secondary"
            onClick={() => onEdit(inlay.id)}
            className="text-xs px-2 py-1"
          >
            Edit
          </Button>
          <Button variant="danger" onClick={() => onDelete(inlay.id)} className="text-xs px-2 py-1">
            Delete
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="ml-8 mt-3 space-y-2">
          {tierCount === 0 ? (
            <Text variant="body-small-secondary" className="italic">
              No tiers defined yet.
            </Text>
          ) : (
            orderedTiers.map(({ tier, index }) => (
              <div key={tier.tier} className="p-3 bg-parchment-50 border border-stone-200 rounded">
                <div className="flex justify-between items-start mb-2 gap-2">
                  <Text variant="body-small" className="font-semibold">
                    Tier {tier.tier}
                  </Text>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => onEditTier(inlay.id, index)}
                      aria-label={`Edit tier ${tier.tier} of ${inlay.name}`}
                      className="text-xs px-2 py-0.5"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => onDeleteTier(inlay.id, index)}
                      aria-label={`Delete tier ${tier.tier} of ${inlay.name}`}
                      className="text-xs px-2 py-0.5"
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                {tier.bonuses.length === 0 ? (
                  <Text variant="body-small-secondary" className="italic">
                    Grants nothing.
                  </Text>
                ) : (
                  <StatModifierBadges modifiers={tier.bonuses} stats={stats} />
                )}
              </div>
            ))
          )}
        </div>
      )}
    </Card>
  );
}
