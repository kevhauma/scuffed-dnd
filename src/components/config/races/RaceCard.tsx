/**
 * Race Card Component
 *
 * One race's stat block, plus the total the sheet checks against (Concept 04, Concept 01's
 * six-core total). Every configured stat gets a cell, at 0 when the race says nothing about it,
 * so two races read as comparable blocks rather than as two differently-shaped lists.
 *
 * **Validates: Concept 04; Requirements 8.1, 8.2, 21.1-21.5**
 */

import { useMemo } from 'react';
import type { Race, Stat } from '../../../types';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';

interface RaceCardProps {
  race: Race;
  /** The ruleset's stats, in display order */
  availableStats: Stat[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function RaceCard({ race, availableStats, onEdit, onDelete }: RaceCardProps) {
  /**
   * The block's total, and the total over just the stats the ruleset counts
   *
   * `countsTowardTotal` is the six-core rule Concept 01 confirms — it is what makes "human 60,
   * elf 64" checkable against the sheet rather than a number only this app agrees with.
   */
  const totals = useMemo(() => {
    const all = availableStats.reduce((sum, stat) => sum + (race.statValues[stat.id] ?? 0), 0);
    const counted = availableStats
      .filter((stat) => stat.countsTowardTotal)
      .reduce((sum, stat) => sum + (race.statValues[stat.id] ?? 0), 0);
    return { all, counted };
  }, [race.statValues, availableStats]);

  return (
    <Card variant="bordered" className="p-4">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <Text variant="h5" as="h3" className="mb-1">
            {race.name}
          </Text>
          {race.description && (
            <Text variant="body-small-secondary" as="p" className="mb-2">
              {race.description}
            </Text>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => onEdit(race.id)} className="text-sm px-2 py-1">
            Edit
          </Button>
          <Button variant="danger" onClick={() => onDelete(race.id)} className="text-sm px-2 py-1">
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
          <Text variant="body-small-secondary" className="mb-2">
            Stat Block:
          </Text>
          <div className="grid grid-cols-2 gap-2">
            {availableStats.map((stat) => (
              <div
                key={stat.id}
                className="flex justify-between items-center p-2 bg-parchment-100 rounded"
              >
                <Text variant="body-small">{stat.name}</Text>
                <Text variant="body-small" className="font-semibold text-ink-700">
                  {race.statValues[stat.id] ?? 0}
                </Text>
              </div>
            ))}
          </div>
        </div>
      )}

      {availableStats.length > 0 && (
        <div className="mt-4 pt-4 border-t border-stone-200">
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <Text variant="body-small-secondary">Counted total:</Text>
              <Text variant="body-small" className="font-semibold text-forest">
                {totals.counted}
              </Text>
            </div>
            <div className="flex items-center gap-2">
              <Text variant="body-small-secondary">All stats:</Text>
              <Text variant="body-small" className="font-semibold text-ink-700">
                {totals.all}
              </Text>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
