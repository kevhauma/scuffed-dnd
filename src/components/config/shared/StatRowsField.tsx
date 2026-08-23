/**
 * Stat Rows Field
 *
 * A titled block of "one row per configured stat", with the empty state for a ruleset that has no
 * stats yet. Both the race stat block (TICKET-RACE-01) and the archetype affinity table
 * (TICKET-ARC-01) are this shape, and for the same reason: **the ruleset's stats decide what the
 * entity has an opinion about**. It cannot have one about a stat that does not exist, and cannot
 * decline to have one about a stat that does — so there is no add/remove control, and adding a stat
 * grows every entity's block rather than leaving it half-defined.
 *
 * The control itself is the caller's — a number box for a race, a select for an archetype — passed
 * as a render prop with the id the row's label points at, so the association is made here rather
 * than left to each caller to remember.
 *
 * **Validates: Concept 03; Concept 04; Requirements 21.1-21.5**
 */

import type { ReactNode } from 'react';
import type { Stat } from '../../../types';
import { Label } from '../../ui/Label/Label';
import { Text } from '../../ui/Text/Text';

export interface StatRowsFieldProps {
  /** What the block is called — "Stat Block", "Stat Affinity" */
  title: string;
  /** One line saying what the rows mean */
  description: string;
  /** What to say instead when the ruleset defines no stats */
  emptyMessage: string;
  /** The ruleset's stats, in display order — the block has exactly these rows */
  availableStats: Stat[];
  /** Prefix for each row's control id, so two blocks on one page cannot collide */
  idPrefix: string;
  /** One stat's control, bound to `controlId` by the caller */
  renderControl: (stat: Stat, controlId: string) => ReactNode;
}

export function StatRowsField({
  title,
  description,
  emptyMessage,
  availableStats,
  idPrefix,
  renderControl,
}: StatRowsFieldProps) {
  return (
    <div className="space-y-3">
      {/* Both as `p`: `Text` renders a `span` by default, and the wrapper's `space-y-3` only
          spaces block children — the title and its description were running together on one line */}
      <Text variant="body-small" as="p" className="font-semibold">
        {title}
      </Text>
      <Text variant="body-small-secondary" as="p">
        {description}
      </Text>

      {availableStats.length === 0 ? (
        <div className="p-3 bg-parchment-100 rounded">
          <Text variant="body-small-secondary">{emptyMessage}</Text>
        </div>
      ) : (
        <div className="space-y-2">
          {availableStats.map((stat) => {
            const controlId = `${idPrefix}-${stat.id}`;
            return (
              <div key={stat.id} className="flex items-center gap-2 p-2 bg-parchment-50 rounded">
                <Label htmlFor={controlId} className="flex-1">
                  {stat.name} ({stat.abbreviation})
                </Label>
                {renderControl(stat, controlId)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
