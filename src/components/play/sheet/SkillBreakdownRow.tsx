/**
 * Skill Breakdown Row
 *
 * One skill's total alongside the contributions that make it up, shown separately rather than
 * pre-summed so a Player can see what their equipment, races and focus stat are actually doing
 * (Requirement 13.4).
 *
 * **Validates: Requirements 13.4, 8.5, 9.3, 21.1-21.5**
 */

import { Text } from '../../ui/Text/Text';

/** One named contribution to a skill's total */
export interface SkillContribution {
  label: string;
  value: number;
  /**
   * Show this contribution even at zero. Set on the allocated base level, which is part of the
   * character's identity, so a Player can tell "no points spent" from "no such contribution".
   */
  alwaysShow?: boolean;
}

export interface SkillBreakdownRowProps {
  name: string;
  code: string;
  total: number;
  /** Contributions in display order; zero-valued ones are dropped */
  contributions: SkillContribution[];
  isFocusStat?: boolean;
}

/** Render a contribution with an explicit sign, so `+2` and `-2` are never ambiguous */
function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export function SkillBreakdownRow({
  name,
  code,
  total,
  contributions,
  isFocusStat = false,
}: SkillBreakdownRowProps) {
  const shown = contributions.filter(
    (contribution) => contribution.alwaysShow || contribution.value !== 0
  );

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-stone-200 py-2 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-2">
        <Text variant="body-small" as="span">
          {name} ({code})
        </Text>
        {isFocusStat && (
          <Text variant="caption" as="span">
            focus stat
          </Text>
        )}
      </div>

      <div className="flex flex-wrap items-baseline gap-2">
        {shown.map((contribution) => (
          <Text key={contribution.label} variant="caption" as="span">
            {contribution.label} {signed(contribution.value)}
          </Text>
        ))}
        <Text variant="highlight" as="span">
          {total}
        </Text>
      </div>
    </div>
  );
}
