/**
 * Character Sheet Header
 *
 * Identity block: name, races, level, and the way back to the character list.
 *
 * **Validates: Requirements 8.5, 21.1-21.5**
 */

import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';

export interface SheetHeaderProps {
  name: string;
  raceNames: string[];
  level: number;
  focusStatCode?: string;
  onBack: () => void;
}

export function SheetHeader({ name, raceNames, level, focusStatCode, onBack }: SheetHeaderProps) {
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Text variant="h2" as="h1" className="mb-1">
            {name}
          </Text>
          <Text variant="body-small-secondary" as="p">
            Level {level}
            {' · '}
            {raceNames.length > 0 ? raceNames.join(', ') : 'No races'}
            {focusStatCode && ` · focus: ${focusStatCode}`}
          </Text>
        </div>
        <Button variant="secondary" onClick={onBack}>
          Back to Characters
        </Button>
      </div>
    </Card>
  );
}
