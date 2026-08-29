/**
 * Resources Section
 *
 * The pools a Player spends against during play — health, mana, anything else the ruleset flags
 * `isResource` (Concept 20).
 *
 * They are here rather than among the stats because they are read for a different reason. A stat
 * is a fact about the character that changes when they level; a resource is a number that moves
 * every few minutes at the table, and it is the one thing on the sheet somebody looks at mid-fight.
 * Mixed into the stat list, each pool also had to carry two rows — its maximum and its current
 * value — which broke the one-line rhythm of every stat around it.
 *
 * Each pool keeps both numbers and both sets of controls: `CountRow` for the maximum, which is
 * composed from points and race and equipment like any other stat, and `StatEditor` for where the
 * pool currently stands, which is player state and nothing else (TICKET-STAT-03).
 *
 * **The pools are laid out in the ruleset's own groups too** (TICKET-STAT-04), through the same
 * `statGroups.ts` the stats use. The sheet's *Vitals* column holds Health, Mana and Speed, and
 * this app puts the first two here and the third among the stats — so a group that spans the split
 * draws a column on each side rather than one section quietly swallowing the other's rows.
 *
 * **Validates: Concept 20; Requirements 11.3, 13.4, 14.1, 14.2, 14.3, 14.4, 16.6, 21.1-21.5**
 */

import { Fragment } from 'react';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { CountRow } from '../shared/CountRow';
import type { PointBudgetView } from '../shared/pointBudgetView';
import { investedContribution } from './investedContribution';
import { StatEditor } from './StatEditor';
import { StatGroupColumns } from './StatGroupColumns';
import { groupStats } from './statGroups';
import type { StatBreakdown } from './useCharacterSheet';

export interface ResourcesSectionProps {
  /** The `isResource` stats, in the ruleset's order */
  resources: StatBreakdown[];
  /** The pool every invested stat spends from, or null when there is none to show */
  budget: PointBudgetView | null;
  onChangeStatValue: (statId: string, value: number) => void;
  onAdjustStatValue: (statId: string, delta: number) => void;
  onResetStatValueToMax: (statId: string) => void;
  onChangeInvestedPoints: (statId: string, points: number) => void;
}

export function ResourcesSection({
  resources,
  budget,
  onChangeStatValue,
  onAdjustStatValue,
  onResetStatValueToMax,
  onChangeInvestedPoints,
}: ResourcesSectionProps) {
  if (resources.length === 0) return null;

  const groups = groupStats(resources);

  return (
    <Card className="p-6">
      <Text variant="h4" as="h2" className="mb-3">
        Resources
      </Text>

      <StatGroupColumns groups={groups}>
        {(group) =>
          // A `Fragment` rather than a wrapper: `CountRow`'s `last:border-b-0` reads its
          // siblings, so boxing each pool would drop every row's rule
          group.stats.map((resource) => (
            <Fragment key={resource.id}>
              <CountRow
                name={resource.name}
                code={resource.abbreviation}
                total={resource.max}
                invested={resource.invested}
                onAdjust={
                  resource.isDerived || !budget
                    ? undefined
                    : (points) => onChangeInvestedPoints(resource.id, points)
                }
                canSpend={(budget?.pointsRemaining.value ?? 0) > 0}
                canAdjust={budget?.pointsRemaining.value !== null}
                // The same row `StatsSection` draws, from the same function — a pool's maximum is
                // composed exactly like a stat, so the two must not disagree about the spelling
                contributions={[
                  investedContribution(resource),
                  { label: 'race', value: resource.race },
                  { label: 'equipment', value: resource.equipment },
                ]}
              />

              <StatEditor
                name={resource.name}
                current={resource.current}
                max={resource.max}
                isOverMax={resource.isOverMax}
                onChange={(value) => onChangeStatValue(resource.id, value)}
                onAdjust={(delta) => onAdjustStatValue(resource.id, delta)}
                onResetToMax={() => onResetStatValueToMax(resource.id)}
              />
            </Fragment>
          ))
        }
      </StatGroupColumns>
    </Card>
  );
}
