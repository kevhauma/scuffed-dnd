/**
 * Combat Skill Card Component
 * 
 * Displays a combat skill with dice configuration and bonus formula.
 */

import { Button } from '../../../ui/Button/Button';
import { Card } from '../../../ui/Card/Card';
import { Text } from '../../../ui/Text/Text';
import type { CombatSkill } from '../../../../types';

interface CombatSkillCardProps {
  skill: CombatSkill;
  onEdit: (code: string) => void;
  onDelete: (code: string) => void;
}

export function CombatSkillCard({ skill, onEdit, onDelete }: CombatSkillCardProps) {
  return (
    <Card variant="bordered" className="p-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <Text variant="highlight" className="mb-2">
            {skill.code}
          </Text>
          <Text variant="h5" as="h3">{skill.name}</Text>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="secondary" 
            onClick={() => onEdit(skill.code)}
            className="text-sm px-2 py-1"
          >
            Edit
          </Button>
          <Button 
            variant="danger" 
            onClick={() => onDelete(skill.code)}
            className="text-sm px-2 py-1"
          >
            Delete
          </Button>
        </div>
      </div>
      
      {skill.description && (
        <Text variant="body-small-secondary" as="p" className="mb-3">
          {skill.description}
        </Text>
      )}
      
      <div className="space-y-2">
        <div>
          <Text variant="body-small-secondary">Dice:</Text>
          <div className="flex flex-wrap gap-2 mt-1">
            {Object.entries(skill.dice).map(([die, count]) => 
              count > 0 && (
                <Text key={die} variant="caption" className="bg-parchment-200 px-2 py-1 rounded">
                  {count}{die}
                </Text>
              )
            )}
          </div>
        </div>
        <div>
          <Text variant="body-small-secondary">Bonus Formula:</Text>
          <Text variant="code" as="div" className="mt-1">
            {skill.bonusFormula || 'None'}
          </Text>
        </div>
      </div>
    </Card>
  );
}
