/**
 * Dice Ladder Card
 *
 * One ladder, shown as the sheet shows it — the literal `20 | 12 | 6` row (Concept 07) — plus a
 * worked example, because "what does this ladder do" is a question a list of sizes only half
 * answers. The example runs the **engine's** decomposition and formatter rather than restating the
 * arithmetic, so a card can never disagree with a roll.
 *
 * **Validates: Concept 07; Requirements 21.1-21.5**
 */

import { decomposeValue, formatLadderNotation } from '../../../engine/dice/diceLadder';
import type { DiceLadder } from '../../../types';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';

/**
 * The value the worked example decomposes
 *
 * Concept 07's own headline row, so the card reads `39 → 1D20 + 1D12 + 1D6 + 1` on the seeded
 * ladder — a number a reader can check against the concept page.
 */
const EXAMPLE_VALUE = 39;

export interface DiceLadderCardProps {
  ladder: DiceLadder;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function DiceLadderCard({ ladder, onEdit, onDelete }: DiceLadderCardProps) {
  return (
    <Card variant="bordered" className="p-4">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <Text variant="h5" as="h3" className="mb-1">
            {ladder.name}
          </Text>
          {ladder.description && (
            <Text variant="body-small-secondary" as="p" className="mb-2">
              {ladder.description}
            </Text>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => onEdit(ladder.id)}
            className="text-sm px-2 py-1"
          >
            Edit
          </Button>
          <Button
            variant="danger"
            onClick={() => onDelete(ladder.id)}
            className="text-sm px-2 py-1"
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline gap-2 p-2 bg-parchment-100 rounded">
          <Text variant="body-small-secondary" className="w-20 shrink-0">
            Die sizes
          </Text>
          <Text variant="body-small" className="font-mono font-semibold text-ink-700">
            {ladder.dieSizes.join(' | ')}
          </Text>
        </div>

        <div className="flex items-baseline gap-2 p-2 bg-parchment-100 rounded">
          <Text variant="body-small-secondary" className="w-20 shrink-0">
            {EXAMPLE_VALUE} becomes
          </Text>
          <Text variant="body-small" className="font-mono text-ink-700">
            {formatLadderNotation(decomposeValue(EXAMPLE_VALUE, ladder), ladder)}
          </Text>
        </div>

        {ladder.maxPerDie !== undefined && (
          <div className="flex items-baseline gap-2 p-2 bg-parchment-100 rounded">
            <Text variant="body-small-secondary" className="w-20 shrink-0">
              Cap
            </Text>
            <Text variant="body-small" className="text-ink-700">
              At most {ladder.maxPerDie} of each die; the excess falls down the ladder
            </Text>
          </div>
        )}
      </div>
    </Card>
  );
}
