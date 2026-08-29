/**
 * Stat Group Columns
 *
 * The sheet's stats laid out under the ruleset's own group names (TICKET-STAT-04) — one column per
 * distinct group, with the rows themselves supplied by the caller.
 *
 * It exists because **both** stat sections need the identical frame and neither should own it:
 * `StatsSection` draws a `CountRow` per stat and `ResourcesSection` draws a `CountRow` plus a
 * `StatEditor` per pool, but the grid, the heading and the *which column* decision are the same
 * either way. `fallow` measured the two copies as a clone the moment they existed. The rows arrive
 * as a render prop, which is the shape `config/shared/StatRowsField` already uses for the same
 * reason: the container knows the arrangement, the caller knows the control.
 *
 * **The column count follows the data.** `grid-flow-col` + `auto-cols-fr` means three groups are
 * three equal columns and a fourth would be a fourth, with no breakpoint naming a number and no
 * list of group names anywhere. Below `md` the flow falls back to rows, so a narrow screen reads
 * one group at a time.
 *
 * A ruleset that names **no** groups comes back from `groupByLabel` as one unlabelled column, and
 * that draws neither a grid nor a heading — it is the flat list the sheet has always shown.
 *
 * **Validates: Requirements 13.4, 21.1-21.5**
 */

import type { ReactNode } from 'react';
import type { LabelledGroup } from '../../shared/labelledGroups';
import { hasNamedGroups } from '../../shared/labelledGroups';
import { Text } from '../../ui/Text/Text';
import type { StatBreakdown } from './useCharacterSheet';

/** One column of the sheet's stats — the shared grouping, narrowed to what this draws */
export type StatGroup = LabelledGroup<StatBreakdown>;

export interface StatGroupColumnsProps {
  /** The columns to draw, as `groupByLabel` produced them */
  groups: StatGroup[];
  /** The rows for one column — a `CountRow` per stat, plus whatever else the section adds */
  children: (group: StatGroup) => ReactNode;
}

export function StatGroupColumns({ groups, children }: StatGroupColumnsProps) {
  const isGrouped = hasNamedGroups(groups);

  return (
    <div className={isGrouped ? 'grid gap-x-8 md:grid-flow-col md:auto-cols-fr' : undefined}>
      {groups.map((group) => (
        <div key={group.label ?? ''}>
          {/* An unnamed group carries no heading: it is the stats the ruleset grouped nowhere,
              and a blank label would be a column it never asked for */}
          {group.label !== null && (
            <Text variant="h5" as="h3" className="mb-1 border-b border-ink-700/30 pb-1">
              {group.label}
            </Text>
          )}

          {children(group)}
        </div>
      ))}
    </div>
  );
}
