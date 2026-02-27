/**
 * Stat Card Component
 * 
 * Displays a stat with its formula and preview calculation.
 */

import { useState, useMemo } from 'react';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { Input } from '../../ui/Input/Input';
import type { Stat } from '../../../types';
import { parseFormula } from '../../../engine/formula/parser';
import { evaluateFormula } from '../../../engine/formula/evaluator';
import { validateFormula } from '../../../engine/formula/validator';

interface StatCardProps {
  stat: Stat;
  availableSkillCodes: string[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function StatCard({ stat, availableSkillCodes, onEdit, onDelete }: StatCardProps) {
  // Sample input values for preview (default to 10 for each skill)
  const [sampleValues, setSampleValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    availableSkillCodes.forEach(code => {
      initial[code] = 10;
    });
    return initial;
  });

  // Validate formula
  const validation = useMemo(() => {
    return validateFormula(stat.formula, new Set(availableSkillCodes));
  }, [stat.formula, availableSkillCodes]);

  // Calculate preview value
  const previewValue = useMemo(() => {
    if (!validation.isValid) return null;
    
    try {
      const ast = parseFormula(stat.formula);
      const value = evaluateFormula(ast, { variables: sampleValues });
      return Math.round(value * 100) / 100; // Round to 2 decimal places
    } catch (error) {
      return null;
    }
  }, [stat.formula, sampleValues, validation.isValid]);

  return (
    <Card variant="bordered" className="p-4">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <Text variant="h5" as="h3" className="mb-1">{stat.name}</Text>
          {stat.description && (
            <Text variant="body-small-secondary" as="p" className="mb-2">
              {stat.description}
            </Text>
          )}
        </div>
        <div className="flex gap-2">
          <Button 
            variant="secondary" 
            onClick={() => onEdit(stat.id)}
            className="text-sm px-2 py-1"
          >
            Edit
          </Button>
          <Button 
            variant="danger" 
            onClick={() => onDelete(stat.id)}
            className="text-sm px-2 py-1"
          >
            Delete
          </Button>
        </div>
      </div>
      
      {/* Formula Display */}
      <div className="mb-3">
        <Text variant="body-small-secondary" className="mb-1">Formula:</Text>
        <Text variant="body-small" className="font-mono bg-parchment-100 px-2 py-1 rounded">
          {stat.formula}
        </Text>
      </div>

      {/* Validation Errors */}
      {!validation.isValid && (
        <div className="mb-3 p-2 bg-crimson/10 border border-crimson rounded">
          <Text variant="body-small" className="text-crimson">
            {validation.errors.join(', ')}
          </Text>
        </div>
      )}

      {/* Preview Section */}
      {validation.isValid && validation.referencedVariables.length > 0 && (
        <div className="mt-4 pt-4 border-t border-stone-200">
          <Text variant="body-small-secondary" className="mb-2">Preview with sample values:</Text>
          
          {/* Sample Input Controls */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {validation.referencedVariables.map(code => (
              <div key={code} className="flex items-center gap-2">
                <Text variant="body-small" className="w-12">{code}:</Text>
                <Input
                  type="number"
                  value={sampleValues[code] || 0}
                  onChange={(e) => setSampleValues(prev => ({
                    ...prev,
                    [code]: Number(e.target.value) || 0,
                  }))}
                  className="flex-1 text-sm"
                />
              </div>
            ))}
          </div>

          {/* Calculated Result */}
          <div className="flex justify-between items-center p-2 bg-forest/10 border border-forest rounded">
            <Text variant="body-small-secondary">Calculated Value:</Text>
            <Text variant="body" className="font-semibold text-forest">
              {previewValue !== null ? previewValue : 'Error'}
            </Text>
          </div>
        </div>
      )}
    </Card>
  );
}
