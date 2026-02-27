/**
 * Race Card Component
 * 
 * Displays a race with its skill modifiers and total modifier preview.
 */

import { useMemo } from 'react';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import type { Race, MainSkill } from '../../../types';

interface RaceCardProps {
  race: Race;
  availableMainSkills: MainSkill[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function RaceCard({ race, availableMainSkills, onEdit, onDelete }: RaceCardProps) {
  // Calculate total modifiers
  const totalModifiers = useMemo(() => {
    const positive = race.skillModifiers.filter(m => m.modifier > 0).length;
    const negative = race.skillModifiers.filter(m => m.modifier < 0).length;
    const sum = race.skillModifiers.reduce((acc, m) => acc + m.modifier, 0);
    return { positive, negative, sum };
  }, [race.skillModifiers]);

  // Get skill name from code
  const getSkillName = (code: string) => {
    const skill = availableMainSkills.find(s => s.code === code);
    return skill ? skill.name : code;
  };

  return (
    <Card variant="bordered" className="p-4">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <Text variant="h5" as="h3" className="mb-1">{race.name}</Text>
          {race.description && (
            <Text variant="body-small-secondary" as="p" className="mb-2">
              {race.description}
            </Text>
          )}
        </div>
        <div className="flex gap-2">
          <Button 
            variant="secondary" 
            onClick={() => onEdit(race.id)}
            className="text-sm px-2 py-1"
          >
            Edit
          </Button>
          <Button 
            variant="danger" 
            onClick={() => onDelete(race.id)}
            className="text-sm px-2 py-1"
          >
            Delete
          </Button>
        </div>
      </div>
      
      {/* Skill Modifiers */}
      {race.skillModifiers.length === 0 ? (
        <div className="p-3 bg-parchment-100 rounded">
          <Text variant="body-small-secondary">No skill modifiers configured</Text>
        </div>
      ) : (
        <div className="space-y-2">
          <Text variant="body-small-secondary" className="mb-2">Skill Modifiers:</Text>
          <div className="grid grid-cols-2 gap-2">
            {race.skillModifiers.map((modifier, index) => (
              <div 
                key={index}
                className="flex justify-between items-center p-2 bg-parchment-100 rounded"
              >
                <Text variant="body-small">{getSkillName(modifier.skillCode)}</Text>
                <Text 
                  variant="body-small" 
                  className={`font-semibold ${
                    modifier.modifier > 0 
                      ? 'text-forest' 
                      : modifier.modifier < 0 
                      ? 'text-crimson' 
                      : 'text-ink-700'
                  }`}
                >
                  {modifier.modifier > 0 ? '+' : ''}{modifier.modifier}
                </Text>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Total Modifiers Preview */}
      {race.skillModifiers.length > 0 && (
        <div className="mt-4 pt-4 border-t border-stone-200">
          <Text variant="body-small-secondary" className="mb-2">Total Modifiers:</Text>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <Text variant="body-small-secondary">Bonuses:</Text>
              <Text variant="body-small" className="font-semibold text-forest">
                {totalModifiers.positive}
              </Text>
            </div>
            <div className="flex items-center gap-2">
              <Text variant="body-small-secondary">Penalties:</Text>
              <Text variant="body-small" className="font-semibold text-crimson">
                {totalModifiers.negative}
              </Text>
            </div>
            <div className="flex items-center gap-2">
              <Text variant="body-small-secondary">Net:</Text>
              <Text 
                variant="body-small" 
                className={`font-semibold ${
                  totalModifiers.sum > 0 
                    ? 'text-forest' 
                    : totalModifiers.sum < 0 
                    ? 'text-crimson' 
                    : 'text-ink-700'
                }`}
              >
                {totalModifiers.sum > 0 ? '+' : ''}{totalModifiers.sum}
              </Text>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
