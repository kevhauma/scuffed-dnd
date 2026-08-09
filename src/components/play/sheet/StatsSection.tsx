/**
 * Stats Section
 *
 * Every configured stat (Concept 01). A **resource** gets a `StatEditor`, because its value is a
 * maximum the Player spends against; anything else gets a `SkillBreakdownRow`, which shows the
 * contributions apart from the total (Requirement 13.4) — the treatment main skills used to get,
 * inherited by the concept that replaced them. That gating is TICKET-STAT-01's: v1 gave every
 * stat an editable current value, which is how "current Strength" became a thing.
 *
 * The layout rework is TICKET-STAT-03; this is the mechanical carry-across.
 *
 * **Validates: Concept 01; Requirements 13.4, 14.1, 14.2, 21.1-21.5**
 */

import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { SkillBreakdownRow } from './SkillBreakdownRow';
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
        stats.map((stat) =>
          stat.isResource ? (
            <StatEditor
              key={stat.id}
              name={stat.name}
              current={stat.current}
              max={stat.max}
              onChange={(value) => onChangeStatValue(stat.id, value)}
            />
          ) : (
            <SkillBreakdownRow
              key={stat.id}
              name={stat.name}
              code={stat.abbreviation}
              total={stat.max}
              contributions={[
                { label: 'invested', value: stat.invested, alwaysShow: true },
                { label: 'racial', value: stat.racial },
                { label: 'equipment', value: stat.equipment },
                { label: 'focus', value: stat.focus },
              ]}
            />
          )
        )
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
