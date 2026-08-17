/**
 * Roll Definition Card
 *
 * One roll: what it reads, and down which ladder (Concept 08). Both are the whole entity, so both
 * are on the card rather than behind the edit dialog — "melee reads STR down Standard" is the
 * sentence a User is scanning for.
 *
 * **Validates: Concept 08; Requirements 21.1-21.5**
 */

import type { DiceLadder, RollDefinition } from '../../../types';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';

export interface RollDefinitionCardProps {
  roll: RollDefinition;
  /** The ladder this roll names, or undefined when it points at one that is gone */
  ladder?: DiceLadder;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function RollDefinitionCard({ roll, ladder, onEdit, onDelete }: RollDefinitionCardProps) {
  return (
    <Card variant="bordered" className="p-4">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-baseline gap-2 mb-1">
            <Text variant="h5" as="h3">
              {roll.name}
            </Text>
            {roll.category && (
              <Text variant="body-small-secondary" className="capitalize">
                {roll.category}
              </Text>
            )}
          </div>
          {roll.description && (
            <Text variant="body-small-secondary" as="p" className="mb-2">
              {roll.description}
            </Text>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => onEdit(roll.id)} className="text-sm px-2 py-1">
            Edit
          </Button>
          <Button variant="danger" onClick={() => onDelete(roll.id)} className="text-sm px-2 py-1">
            Delete
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline gap-2 p-2 bg-parchment-100 rounded">
          <Text variant="body-small-secondary" className="w-16 shrink-0">
            Input
          </Text>
          <Text variant="body-small" className="font-mono text-ink-700">
            {roll.input}
          </Text>
        </div>
        <div className="flex items-baseline gap-2 p-2 bg-parchment-100 rounded">
          <Text variant="body-small-secondary" className="w-16 shrink-0">
            Ladder
          </Text>
          {/* A missing ladder is said in words rather than left blank — the validator reports it
              too, but the card is where the User is looking when they broke it */}
          {ladder ? (
            <Text variant="body-small" className="font-semibold text-ink-700">
              {`${ladder.name} — ${ladder.dieSizes.join(' | ')}`}
            </Text>
          ) : (
            <Text variant="error">No such ladder</Text>
          )}
        </div>
      </div>
    </Card>
  );
}
