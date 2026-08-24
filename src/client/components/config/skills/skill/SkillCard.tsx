/**
 * Skill Card Component
 *
 * Displays a skill and the weight rows its level is derived from (Concept 02).
 *
 * A skill's numbers are stated as the weights themselves — `Char × 0.3` — rather than as a formula
 * string, because that is what the entity holds since TICKET-SKL-02: the arithmetic around them is
 * the calculator's and is the same for every skill.
 *
 * **Validates: Concept 02; Requirements 21.1-21.5**
 */

import type { Skill, Stat } from '#shared/types';
import { Button } from '../../../ui/Button/Button';
import { Card } from '../../../ui/Card/Card';
import { Text } from '../../../ui/Text/Text';

interface SkillCardProps {
  skill: Skill;
  /** The ruleset's stats, for spelling each weight row's target */
  stats: Stat[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function SkillCard({ skill, stats, onEdit, onDelete }: SkillCardProps) {
  const abbreviationById = new Map(stats.map((stat) => [stat.id, stat.abbreviation]));

  return (
    <Card variant="bordered" className="p-4">
      <div className="flex justify-between items-start mb-3">
        <Text variant="h5" as="h3">
          {skill.name}
        </Text>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => onEdit(skill.id)}
            className="text-sm px-2 py-1"
          >
            Edit
          </Button>
          <Button variant="danger" onClick={() => onDelete(skill.id)} className="text-sm px-2 py-1">
            Delete
          </Button>
        </div>
      </div>

      {skill.description && (
        <Text variant="body-small-secondary" as="p" className="mb-3">
          {skill.description}
        </Text>
      )}

      <Text variant="body-small-secondary">Derived from:</Text>
      {skill.statWeights.length === 0 ? (
        <Text variant="body-small" as="p" className="mt-1">
          No stats — this skill is worth whatever the Player invests in it.
        </Text>
      ) : (
        <div className="flex flex-wrap gap-2 mt-1">
          {/* Keyed by position as well as stat: nothing stops two rows naming the same stat */}
          {skill.statWeights.map((row, index) => (
            <Text key={`${index}-${row.statId}`} variant="highlight" as="span">
              {abbreviationById.get(row.statId) ?? row.statId} × {row.weight}
            </Text>
          ))}
        </div>
      )}
    </Card>
  );
}
