/**
 * Character Card
 *
 * One saved character in the list: name, races, level, and the actions available on it.
 *
 * **Validates: Requirements 11.1, 21.1-21.5**
 */

import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import type { CharacterListEntry } from './useCharacterListManager';

export interface CharacterCardProps {
  entry: CharacterListEntry;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  className?: string;
}

export function CharacterCard({ entry, onOpen, onDelete, className = '' }: CharacterCardProps) {
  const { character, raceNames, level } = entry;

  return (
    <Card className={`p-5 ${className}`.trim()}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Text variant="h5" as="h3" className="mb-1">
            {character.name}
          </Text>
          <Text variant="body-small-secondary">
            Level {level}
            {raceNames.length > 0 && ` · ${raceNames.join(', ')}`}
          </Text>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button variant="primary" onClick={() => onOpen(character.id)}>
            Open
          </Button>
          <Button variant="danger" onClick={() => onDelete(character.id)}>
            Delete
          </Button>
        </div>
      </div>
    </Card>
  );
}
