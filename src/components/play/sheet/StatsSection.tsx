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
 * **Validates: Concept 01; Requirements 13.4, 14.1, 14.2, 16.6, 21.1-21.5**
 */

import { Fragment } from 'react';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { SkillBreakdownRow } from '../shared/SkillBreakdownRow';
import { StatEditor } from './StatEditor';
import type { StatBreakdown } from './useCharacterSheet';

export interface StatsSectionProps {
  stats: StatBreakdown[];
  /** Sum of the stats the ruleset flags as counting toward the total */
  statTotal: number;
  onChangeStatValue: (statId: string, value: number) => void;
}

export function StatsSection({ stats, statTotal, onChangeStatValue }: StatsSectionProps) {
  return (
    <Card className="p-6">
      <Text variant="h4" as="h2" className="mb-3">
        Stats
      </Text>

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
                // A derived stat takes no points, so a forced `invested +0` would only mislead;
                // an invested one shows the zero, so "spent nothing" reads apart from "no such
                // contribution"
                { label: 'invested', value: stat.invested, alwaysShow: !stat.isDerived },
                { label: 'racial', value: stat.racial },
                { label: 'equipment', value: stat.equipment },
                { label: 'focus', value: stat.focus },
              ]}
            />

            {stat.isResource && (
              <StatEditor
                name={stat.name}
                current={stat.current}
                max={stat.max}
                onChange={(value) => onChangeStatValue(stat.id, value)}
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
