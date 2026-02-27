/**
 * Material Card Component
 * 
 * Displays a material with its levels, bonuses, and values.
 */

import { useState } from 'react';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import type { Material, CurrencyTier } from '../../../types';

interface MaterialCardProps {
  material: Material;
  availableSkillCodes: string[];
  currencyTiers: CurrencyTier[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onAddLevel: (materialId: string) => void;
  onEditLevel: (materialId: string, levelIndex: number) => void;
  onDeleteLevel: (materialId: string, levelIndex: number) => void;
}

export function MaterialCard({
  material,
  currencyTiers,
  onEdit,
  onDelete,
  onAddLevel,
  onEditLevel,
  onDeleteLevel,
}: MaterialCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getCurrencyTierName = (tierId: string) => {
    return currencyTiers.find(t => t.id === tierId)?.name || 'Unknown';
  };

  return (
    <Card variant="elevated" className="p-3">
      {/* Material Header */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs px-1 py-0.5"
            >
              {isExpanded ? '▼' : '▶'}
            </Button>
            <Text variant="body" className="font-semibold">{material.name}</Text>
            <Text variant="body-small-secondary" className="ml-2">
              ({material.levels.length} level{material.levels.length !== 1 ? 's' : ''})
            </Text>
          </div>
          {material.description && (
            <Text variant="body-small-secondary" as="p" className="ml-8 mt-1">
              {material.description}
            </Text>
          )}
        </div>
        <div className="flex gap-2">
          <Button 
            variant="secondary" 
            onClick={() => onAddLevel(material.id)}
            className="text-xs px-2 py-1"
          >
            Add Level
          </Button>
          <Button 
            variant="secondary" 
            onClick={() => onEdit(material.id)}
            className="text-xs px-2 py-1"
          >
            Edit
          </Button>
          <Button 
            variant="danger" 
            onClick={() => onDelete(material.id)}
            className="text-xs px-2 py-1"
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Material Levels */}
      {isExpanded && (
        <div className="ml-8 mt-3 space-y-2">
          {material.levels.length === 0 ? (
            <Text variant="body-small-secondary" className="italic">
              No levels defined yet.
            </Text>
          ) : (
            material.levels.map((level, index) => (
              <div 
                key={index}
                className="p-3 bg-parchment-50 border border-stone-200 rounded"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <Text variant="body-small" className="font-semibold">
                      Level {level.level}: {level.name}
                    </Text>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="secondary" 
                      onClick={() => onEditLevel(material.id, index)}
                      className="text-xs px-2 py-0.5"
                    >
                      Edit
                    </Button>
                    <Button 
                      variant="danger" 
                      onClick={() => onDeleteLevel(material.id, index)}
                      className="text-xs px-2 py-0.5"
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                {/* Bonuses */}
                {level.bonuses.length > 0 && (
                  <div className="mb-2">
                    <Text variant="body-small-secondary" className="mb-1">Bonuses:</Text>
                    <div className="flex flex-wrap gap-2">
                      {level.bonuses.map((bonus, bonusIdx) => (
                        <span 
                          key={bonusIdx}
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

                {/* Value */}
                <div>
                  <Text variant="body-small-secondary">Value:</Text>
                  <Text variant="body-small" className="ml-2">
                    {level.value.amount} {getCurrencyTierName(level.value.tierId)}
                  </Text>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </Card>
  );
}
