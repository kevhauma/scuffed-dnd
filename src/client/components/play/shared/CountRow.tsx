/**
 * Count Row
 *
 * One tracked number on the sheet, inline: what the thing is **worth**, its name, and the points
 * the Player has **put in** — with the arithmetic between the two on hover.
 *
 * ```
 * [ 14 ]  Strenght (STR)          [−]  5  [+]
 *   ↑                                  ↑
 *   worth, and the hover target         spent, and what the buttons move
 * ```
 *
 * **The number between the controls is the one they change.** It read the composed value at first,
 * with the points hidden in a badge — so `−` and `+` flanked a number they moved indirectly and by
 * a varying amount, because an archetype's affinity decides what a point buys. Pressing `+` on a
 * non-type stat moved a `15` to a `15`. Now the buttons flank the points themselves, and the value
 * they buy sits apart where it can change by whatever the curve says.
 *
 * It replaced a two-row-per-stat arrangement — a breakdown row with every contribution spelled out
 * across it, and a whole second row underneath carrying a labelled number box. Ten stats came to
 * twenty rows and ten text fields, which is a form rather than a character sheet.
 *
 * **No text field.** The old box accepted a typed number, which needed a commit-on-blur draft to
 * stop `20` persisting as `2` on the way past (TICKET-RES-03). Stepping by one removes the whole
 * class of problem: every press is a complete, valid intent, so there is nothing to hold half-typed
 * and nothing to refuse.
 *
 * **The breakdown is hover-only**, on the value itself, with a help cursor — there is no separate
 * `?` control any more. The panel is nonetheless always in the DOM rather than mounted on hover, so
 * a screen reader meets the contributions in reading order instead of depending on a pointer. A
 * keyboard user with sight is the case this does not serve; it is a deliberate trade for a row that
 * carries no button it does not need, forty times over in the skills grid.
 *
 * **Validates: Requirements 11.3, 13.4, 16.6, 21.1-21.5, 22.1-22.6**
 */

import { Button } from '../../ui/Button/Button';
import { ErrorChip } from '../../ui/ErrorChip/ErrorChip';
import { Text } from '../../ui/Text/Text';
import type { DerivedValue } from './derivedValue';
import { readable, signed } from './readableNumber';
import type { SkillContribution } from './SkillBreakdownRow';

export interface CountRowProps {
  name: string;
  /** The short spelling beside the name, where the entity has one */
  code?: string;
  /**
   * What the thing is worth — a stat's composed value, a resource's maximum, a skill's level.
   *
   * Leads the row, carries the breakdown on hover, and chips in place when it cannot be computed.
   */
  total: DerivedValue;
  /** A second labelled number for the breakdown panel — a skill's bonus beside its level */
  secondary?: { label: string; value: DerivedValue };
  /** What makes up the total, revealed by hovering it */
  contributions: SkillContribution[];
  /** Points already spent here — the number the controls move, and what `−` at zero is zero of */
  invested?: number;
  /** Whether another point can be afforded. Ignored when `onAdjust` is absent. */
  canSpend?: boolean;
  /**
   * Whether *any* point can be moved, in either direction
   *
   * Separate from `canSpend` because they fail for different reasons. `canSpend` is "the pool is
   * empty", which still allows taking a point back. This is "the pool has no number at all" — a
   * ruleset with no `xp_thresholds` curve cannot price the budget, and the store then refuses
   * every write including a refund. A live `−` there is a click that silently does nothing.
   */
  canAdjust?: boolean;
  /**
   * Spend or unspend a point. Absent for anything the Player cannot invest in — a derived stat
   * takes no points, so it gets no controls at all rather than disabled ones.
   */
  onAdjust?: (points: number) => void;
  /** `sm` for the skills grid, where there are forty-odd of these and they are secondary */
  size?: 'sm' | 'md';
}

const sizeStyles = {
  sm: { row: 'py-1', gap: 'gap-x-2', name: 'body-small', value: 'min-w-9 text-sm' },
  md: { row: 'py-2', gap: 'gap-x-3', name: 'body', value: 'min-w-11 text-base' },
} as const;

/**
 * The points the controls move
 *
 * A fixed minimum width so a 1 and a 12 keep the `+` in the same place down a column — the same
 * reason the value beside the name has one.
 */
const investedStyles = 'min-w-5 shrink-0 text-center font-mono text-xs tabular-nums text-ink-700';

export function CountRow({
  name,
  code,
  total,
  secondary,
  contributions,
  invested = 0,
  canSpend = true,
  canAdjust = true,
  onAdjust,
  size = 'md',
}: CountRowProps) {
  const scale = sizeStyles[size];

  const shown = contributions.filter(
    (contribution) => contribution.alwaysShow || contribution.value !== 0
  );

  return (
    <div
      className={`flex flex-wrap items-center justify-between ${scale.gap} gap-y-1 border-b border-ink-700/15 ${scale.row} last:border-b-0`}
    >
      <div className="flex min-w-0 grow items-center gap-2">
        {/*
          The value, in front of the name, and the thing the breakdown hangs off. Right-aligned
          with a fixed minimum so a 9 and a 130 leave their names on the same column: a ragged left
          edge down forty rows is harder to scan than the extra width costs.
        */}
        <span className="group/hint relative shrink-0">
          {total.error !== null ? (
            <ErrorChip label="unavailable" detail={total.error} />
          ) : (
            <Text
              variant="highlight"
              as="span"
              className={`cursor-help text-center tabular-nums ${scale.value}`}
            >
              {readable(total.value)}
            </Text>
          )}

          <span
            role="tooltip"
            className="pointer-events-none absolute left-0 top-full z-20 mt-1 flex w-max max-w-56 flex-wrap gap-x-2 gap-y-0.5 rounded border border-ink-700/40 bg-parchment-50 px-2 py-1.5 opacity-0 shadow-parchment-lg transition-opacity group-hover/hint:opacity-100"
          >
            {/* Keyed by position as well as label: two weight rows may name one stat at one weight */}
            {shown.map((contribution, index) => (
              <Text key={`${index}-${contribution.label}`} variant="caption" as="span">
                {contribution.label} {signed(contribution.value)}
              </Text>
            ))}
            {/* A failed secondary is left to the total's chip rather than chipping twice — the two
                come from one derivation, so one explanation is the honest count */}
            {secondary !== undefined && secondary.value.error === null && (
              <Text variant="caption" as="span">
                {secondary.label} {readable(secondary.value.value)}
              </Text>
            )}
            {shown.length === 0 && secondary === undefined && (
              <Text variant="caption" as="span">
                nothing contributes to this
              </Text>
            )}
          </span>
        </span>

        <Text variant={scale.name} as="span" className="min-w-0 truncate">
          {code === undefined ? name : `${name} (${code})`}
        </Text>
      </div>

      {onAdjust && (
        <div className={`flex shrink-0 items-center ${scale.gap}`}>
          <Button
            variant="secondary"
            size="xs"
            aria-label={`Remove a point from ${name}`}
            disabled={!canAdjust || invested <= 0}
            onClick={() => onAdjust(invested - 1)}
          >
            −
          </Button>

          {/* The whole phrase for a screen reader and the digits alone for the eye: a bare number
              between two unlabelled buttons is not self-describing out loud */}
          <span className={investedStyles}>
            <span className="sr-only">{`${invested} points spent`}</span>
            <span aria-hidden="true">{invested}</span>
          </span>

          <Button
            variant="secondary"
            size="xs"
            aria-label={`Spend a point on ${name}`}
            disabled={!canAdjust || !canSpend}
            onClick={() => onAdjust(invested + 1)}
          >
            +
          </Button>
        </div>
      )}
    </div>
  );
}
