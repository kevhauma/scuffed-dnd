/**
 * Skill Breakdown Row
 *
 * One skill's total alongside the contributions that make it up, shown separately rather than
 * pre-summed so a Player can see what their equipment, races and spent points are actually doing
 * (Requirement 13.4).
 *
 * **Validates: Requirements 13.4, 8.5, 16.6, 21.1-21.5**
 */

import { ErrorChip } from '../../ui/ErrorChip/ErrorChip';
import { Text } from '../../ui/Text/Text';
import type { DerivedValue } from './derivedValue';
import { readable, signed } from './readableNumber';

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
  /**
   * The short spelling shown beside the name, when the entity has one.
   *
   * Optional since TICKET-SKL-02: a `Skill` is named and nothing else — its code retired with the
   * flat-space spelling it existed for — while a stat still carries an abbreviation.
   */
  code?: string;
  /**
   * The number this row leads with, and the one an error chips.
   *
   * Whichever of the entity's numbers is the one to act on rather than the finer one behind it: a
   * stat's composed value, and a skill's **bonus** — the integer a Player adds to a roll — with the
   * level behind it in `secondary`. Either can be an error since TICKET-FORM-05 (a derived stat's
   * formula, or a skill weighted on one), which renders as a chip in place of the number.
   */
  total: DerivedValue;
  /** Contributions in display order; zero-valued ones are dropped */
  contributions: SkillContribution[];
  /**
   * A second labelled number shown before the total, for a row that has two (TICKET-SKL-03).
   *
   * A skill is the case that needs it: its *level* is the fine-grained derivation and its *bonus*
   * is the integer a Player actually rolls with, and Concept 02 wants both on the row rather than
   * making the Player divide. A stat row leaves it out and is unchanged.
   */
  secondary?: { label: string; value: DerivedValue };
}

export function SkillBreakdownRow({
  name,
  code,
  total,
  contributions,
  secondary,
}: SkillBreakdownRowProps) {
  const shown = contributions.filter(
    (contribution) => contribution.alwaysShow || contribution.value !== 0
  );

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-stone-200 py-2 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-2">
        <Text variant="body-small" as="span">
          {code === undefined ? name : `${name} (${code})`}
        </Text>
      </div>

      <div className="flex flex-wrap items-baseline gap-2">
        {/* Keyed by position as well as label: two weight rows may name one stat at one weight */}
        {shown.map((contribution, index) => (
          <Text key={`${index}-${contribution.label}`} variant="caption" as="span">
            {contribution.label} {signed(contribution.value)}
          </Text>
        ))}
        {/*
          A failed secondary is left to the total's chip rather than chipping twice — the two come
          from one derivation, so one explanation is the honest count (STAT-03's precedent).
        */}
        {secondary !== undefined && secondary.value.error === null && (
          <Text variant="caption" as="span">
            {secondary.label} {readable(secondary.value.value)}
          </Text>
        )}
        {total.error !== null ? (
          <ErrorChip label="unavailable" detail={total.error} />
        ) : (
          <Text variant="highlight" as="span">
            {readable(total.value)}
          </Text>
        )}
      </div>
    </div>
  );
}
