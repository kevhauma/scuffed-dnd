/**
 * Archetype Card
 *
 * One archetype's affinity table, grouped by affinity rather than listed per stat (Concept 03).
 * "Strong: main STR, CON · sub DEX" is the shape a User is choosing between; a per-stat list of
 * fifteen rows saying `non` fourteen times is not.
 *
 * Every configured stat appears in exactly one group, with the untagged ones falling into `non` —
 * which is what the stored record already means, shown rather than hidden.
 *
 * **Validates: Concept 03; Requirements 21.1-21.5**
 */

import type { Archetype, Stat } from '#shared/types';
import { groupStatsByAffinity } from '../../shared/affinityGroups';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';

export interface ArchetypeCardProps {
  archetype: Archetype;
  /** The ruleset's stats, in display order */
  availableStats: Stat[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ArchetypeCard({ archetype, availableStats, onEdit, onDelete }: ArchetypeCardProps) {
  return (
    <Card variant="bordered" className="p-4">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <Text variant="h5" as="h3" className="mb-1">
            {archetype.name}
          </Text>
          {archetype.description && (
            <Text variant="body-small-secondary" as="p" className="mb-2">
              {archetype.description}
            </Text>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => onEdit(archetype.id)}
            className="text-sm px-2 py-1"
          >
            Edit
          </Button>
          <Button
            variant="danger"
            onClick={() => onDelete(archetype.id)}
            className="text-sm px-2 py-1"
          >
            Delete
          </Button>
        </div>
      </div>

      {availableStats.length === 0 ? (
        <div className="p-3 bg-parchment-100 rounded">
          <Text variant="body-small-secondary">This ruleset defines no stats.</Text>
        </div>
      ) : (
        <div className="space-y-2">
          {groupStatsByAffinity(archetype, availableStats).map((group) => (
            <div
              key={group.affinity}
              className="flex items-baseline gap-2 p-2 bg-parchment-100 rounded"
            >
              <Text variant="body-small-secondary" className="w-12 shrink-0">
                {group.label}
              </Text>
              <Text variant="body-small" className="font-semibold text-ink-700">
                {group.stats.map((stat) => stat.abbreviation).join(', ')}
              </Text>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
