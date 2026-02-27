/**
 * Material Category Card Component
 * 
 * Displays a material category with nested materials and their levels.
 */

import { useState } from 'react';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { MaterialCard } from './MaterialCard';
import type { MaterialCategory, Material, CurrencyTier } from '../../../types';

interface MaterialCategoryCardProps {
  category: MaterialCategory;
  materials: Material[];
  availableSkillCodes: string[];
  currencyTiers: CurrencyTier[];
  onEditCategory: (id: string) => void;
  onDeleteCategory: (id: string) => void;
  onAddMaterial: () => void;
  onEditMaterial: (id: string) => void;
  onDeleteMaterial: (id: string) => void;
  onAddLevel: (materialId: string) => void;
  onEditLevel: (materialId: string, levelIndex: number) => void;
  onDeleteLevel: (materialId: string, levelIndex: number) => void;
}

export function MaterialCategoryCard({
  category,
  materials,
  availableSkillCodes,
  currencyTiers,
  onEditCategory,
  onDeleteCategory,
  onAddMaterial,
  onEditMaterial,
  onDeleteMaterial,
  onAddLevel,
  onEditLevel,
  onDeleteLevel,
}: MaterialCategoryCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <Card variant="bordered" className="p-4">
      {/* Category Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-sm px-2 py-1"
            >
              {isExpanded ? '▼' : '▶'}
            </Button>
            <Text variant="h5" as="h3">{category.name}</Text>
            <Text variant="body-small-secondary" className="ml-2">
              ({materials.length} material{materials.length !== 1 ? 's' : ''})
            </Text>
          </div>
          {category.description && (
            <Text variant="body-small-secondary" as="p" className="ml-10 mt-1">
              {category.description}
            </Text>
          )}
        </div>
        <div className="flex gap-2">
          <Button 
            variant="secondary" 
            onClick={onAddMaterial}
            className="text-sm px-2 py-1"
          >
            Add Material
          </Button>
          <Button 
            variant="secondary" 
            onClick={() => onEditCategory(category.id)}
            className="text-sm px-2 py-1"
          >
            Edit
          </Button>
          <Button 
            variant="danger" 
            onClick={() => onDeleteCategory(category.id)}
            className="text-sm px-2 py-1"
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Materials List */}
      {isExpanded && (
        <div className="ml-10 mt-4 space-y-3">
          {materials.length === 0 ? (
            <Text variant="body-small-secondary" className="italic">
              No materials in this category yet.
            </Text>
          ) : (
            materials.map((material) => (
              <MaterialCard
                key={material.id}
                material={material}
                availableSkillCodes={availableSkillCodes}
                currencyTiers={currencyTiers}
                onEdit={onEditMaterial}
                onDelete={onDeleteMaterial}
                onAddLevel={onAddLevel}
                onEditLevel={onEditLevel}
                onDeleteLevel={onDeleteLevel}
              />
            ))
          )}
        </div>
      )}
    </Card>
  );
}
