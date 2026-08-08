/**
 * Usage List
 *
 * "What breaks if you change this?", on the card rather than behind the delete dialog. Concept 05
 * asks for it on constants and Concept 06 wants the same for curves, and it is the same list in
 * both places: the blast radius of a balance lever, from TICKET-REF-01's reference walker rather
 * than from a substring scan.
 *
 * The references are handed in already resolved; this derives nothing.
 *
 * **Validates: Concept 00 §6; Concept 05; Requirements 2.5, 2.6**
 */

import type { EntityReference } from '../../../engine/dependencies';
import { Text } from '../../ui/Text/Text';

interface UsageListProps {
  usages: EntityReference[];
  /** What to say when nothing points at the entity — the sentence names the entity kind */
  emptyMessage: string;
}

export function UsageList({ usages, emptyMessage }: UsageListProps) {
  return (
    <div>
      <Text variant="body-small-secondary" className="mb-1">
        Used by:
      </Text>

      {usages.length === 0 ? (
        <Text variant="muted" as="p">
          {emptyMessage}
        </Text>
      ) : (
        <ul className="flex flex-col gap-1 pl-4 list-disc">
          {usages.map((usage) => (
            <li key={`${usage.holderKind}-${usage.holderId}-${usage.field}`}>
              <Text variant="body-small" as="span">
                {usage.holderKind}: {usage.holderName}{' '}
                <span className="font-mono text-ink-600">({usage.field})</span>
              </Text>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
