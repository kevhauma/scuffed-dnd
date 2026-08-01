/**
 * Stats Section
 *
 * Every configured stat's current and maximum value, each editable through a `StatEditor`.
 *
 * **Validates: Requirements 14.1, 14.2, 21.1-21.5**
 */

import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { StatEditor } from './StatEditor';
import type { StatBreakdown } from './useCharacterSheet';

export interface StatsSectionProps {
  stats: StatBreakdown[];
  onChangeStatValue: (statId: string, value: number) => void;
}

export function StatsSection({ stats, onChangeStatValue }: StatsSectionProps) {
  return (
    <Card className="p-6">
      <Text variant="h4" as="h2" className="mb-3">
        Stats
      </Text>

      {stats.length === 0 ? (
        <Text variant="body-small-secondary">This ruleset defines no stats.</Text>
      ) : (
        stats.map((stat) => (
          <StatEditor
            key={stat.id}
            name={stat.name}
            current={stat.current}
            max={stat.max}
            onChange={(value) => onChangeStatValue(stat.id, value)}
          />
        ))
      )}
    </Card>
  );
}
