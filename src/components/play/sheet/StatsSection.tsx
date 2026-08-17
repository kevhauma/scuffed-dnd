/**
 * Stats Section
 *
 * One grid over every configured stat (Concept 01), in the order the User arranged them in the
 * stats panel. Each stat gets the same treatment — its value beside the contributions that make it
 * up, shown apart rather than pre-summed (Requirement 13.4) — because after TICKET-STAT-01 there
 * is one kind of stat, whether the number came from points or from a formula.
 *
 * A **resource** gets one extra row: the `StatEditor` current-value controls, because its value is
 * a maximum the Player spends against. That gating is the point of TICKET-STAT-03 — v1 gave every
 * stat an editable current value, which is how "current Strength" became a thing.
 *
 * An **invested** stat gets its own extra row for the same reason and by the same rule: the
 * `InvestedPointsEditor`, because since TICKET-RES-02 a Player's pool grows with their level and
 * spending it is something they do at the table rather than only at creation.
 *
 * **Validates: Concept 01; Concept 06; Requirements 11.3, 13.4, 14.1, 14.2, 16.6, 21.1-21.5**
 */

import { Fragment } from 'react';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { PointBudgetSummary } from '../shared/PointBudgetSummary';
import type { PointBudgetView } from '../shared/pointBudgetView';
import { SkillBreakdownRow } from '../shared/SkillBreakdownRow';
import { InvestedPointsEditor } from './InvestedPointsEditor';
import { StatEditor } from './StatEditor';
import type { StatBreakdown } from './useCharacterSheet';

export interface StatsSectionProps {
  stats: StatBreakdown[];
  /** Sum of the stats the ruleset flags as counting toward the total */
  statTotal: number;
  /** The pool every invested stat below spends from, or null when there is none to show */
  budget: PointBudgetView | null;
  onChangeStatValue: (statId: string, value: number) => void;
  /** Move a pool by an amount — the steppers and Concept 20's quick entry */
  onAdjustStatValue: (statId: string, delta: number) => void;
  onResetStatValueToMax: (statId: string) => void;
  onChangeInvestedPoints: (statId: string, points: number) => void;
}

export function StatsSection({
  stats,
  statTotal,
  budget,
  onChangeStatValue,
  onAdjustStatValue,
  onResetStatValueToMax,
  onChangeInvestedPoints,
}: StatsSectionProps) {
  return (
    <Card className="p-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <Text variant="h4" as="h2">
          Stats
        </Text>
        {budget && (
          <PointBudgetSummary
            pointsSpent={budget.pointsSpent}
            pointBudget={budget.pointBudget}
            pointsRemaining={budget.pointsRemaining}
            isOverBudget={budget.isOverBudget}
          />
        )}
      </div>

      {stats.length === 0 ? (
        <Text variant="body-small-secondary">This ruleset defines no stats.</Text>
      ) : (
        stats.map((stat) => (
          <Fragment key={stat.id}>
            <SkillBreakdownRow
              name={stat.name}
              code={stat.abbreviation}
              total={stat.max}
              contributions={[
                // The **gain** is the term, not the points: since TICKET-ARC-02 the archetype's
                // affinity decides what a point buys, so `invested 15` against a total of 14 was
                // the breakdown failing to add up. The label carries the price so the exchange
                // rate is legible — `invested 15 → +12` — which is what a Player deciding where
                // to spend actually needs.
                //
                // A derived stat takes no points, so a forced `invested +0` would only mislead;
                // an invested one shows the zero, so "spent nothing" reads apart from "no such
                // contribution"
                {
                  label: stat.invested === 0 ? 'invested' : `invested ${stat.invested} →`,
                  value: stat.gain.value ?? 0,
                  alwaysShow: !stat.isDerived,
                },
                { label: 'race', value: stat.race },
                { label: 'equipment', value: stat.equipment },
              ]}
            />

            {!stat.isDerived && budget && (
              <InvestedPointsEditor
                name={stat.name}
                invested={stat.invested}
                pointsRemaining={budget.pointsRemaining}
                onChange={(points) => onChangeInvestedPoints(stat.id, points)}
              />
            )}

            {stat.isResource && (
              <StatEditor
                name={stat.name}
                current={stat.current}
                max={stat.max}
                isOverMax={stat.isOverMax}
                onChange={(value) => onChangeStatValue(stat.id, value)}
                onAdjust={(delta) => onAdjustStatValue(stat.id, delta)}
                onResetToMax={() => onResetStatValueToMax(stat.id)}
              />
            )}
          </Fragment>
        ))
      )}

      <div className="flex items-baseline justify-between gap-4 pt-3 mt-3 border-t border-stone-200">
        <Text variant="body-small-secondary" as="span">
          Stat total
        </Text>
        <Text variant="h5" as="span">
          {statTotal}
        </Text>
      </div>
    </Card>
  );
}
