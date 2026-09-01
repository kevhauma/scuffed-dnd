/**
 * Stats Section
 *
 * One grid over every configured stat (Concept 01), in the order the User arranged them in the
 * stats panel. Each stat gets the same treatment — its value beside the contributions that make it
 * up, shown apart rather than pre-summed (Requirement 13.4) — because after TICKET-STAT-01 there
 * is one kind of stat, whether the number came from points or from a formula.
 *
 * Each stat is **one line**: its name, the controls that spend points on it, its value, and a `?`
 * holding the arithmetic. It used to be two — a breakdown row with every contribution spelled out
 * across it, and a second row underneath carrying a labelled number box — so ten stats came to
 * twenty rows and ten text fields. `CountRow` is that line, and the same one the skills grid uses.
 *
 * A **derived** stat gets no spend controls at all rather than two permanently disabled ones: it
 * takes no points, and a disabled button says "not now" where the truth is "not ever".
 *
 * A **resource** is not here at all — it lives in `ResourcesSection`. A stat is a fact about the
 * character that changes when they level; a pool is a number that moves every few minutes at the
 * table. Mixed together, each pool also had to carry a second row for its current value, which
 * broke the one-line rhythm of every stat around it.
 *
 * The **stat total** stays here even though a resource can count toward it, because it is the
 * ruleset's total over every stat rather than a total of the rows above it.
 *
 * **The rows are laid out in the ruleset's own groups** (TICKET-STAT-04) — the source sheet keeps
 * its stats under *Physical*, *Mental* and *Vitals*, and a ruleset that names groups gets a column
 * per distinct name. One that names none is the flat list it has always been. The section itself
 * names no group and lays no column out: `shared/labelledGroups.ts` decides what the columns *are*
 * and `StatGroupColumns` draws them, so this file still only knows how to draw a stat.
 *
 * **The spend handler is optional since TICKET-DM-05.** `invest-stat-points` is behind
 * `requireCharacterPlayer`, so the table's DM gets no handler and every row loses its two buttons
 * while keeping its value, its breakdown and **what is already invested in it** — a DM reading
 * somebody's sheet is reading exactly those numbers. The pool itself is granted from the quick
 * actions, which is what the section says in place of the controls.
 *
 * **Validates: Concept 01; Concept 06; Requirements 11.3, 13.4, 16.6, 21.1-21.5; v3 Req 42.7, 49.10**
 */

import { groupByLabel } from '../../shared/labelledGroups';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { CountRow } from '../shared/CountRow';
import { NoControlsNotice, POINTS_ARE_THE_PLAYERS } from '../shared/NoControlsNotice';
import type { PointBudgetView } from '../shared/pointBudgetView';
import { investedContribution } from './investedContribution';
import { StatGroupColumns } from './StatGroupColumns';
import type { StatBreakdown } from './useCharacterSheet';

export interface StatsSectionProps {
  /** The non-resource stats, in the ruleset's order */
  stats: StatBreakdown[];
  /** Sum of the stats the ruleset flags as counting toward the total — resources included */
  statTotal: number;
  /** The pool every invested stat below spends from, or null when there is none to show */
  budget: PointBudgetView | null;
  /**
   * Spend or unspend a point on one stat, or absent when this reader may not (TICKET-DM-05)
   *
   * Absent for the table's DM, whose `invest-stat-points` request meets a 404 — the rows keep every
   * number and lose both buttons, which is *absent* rather than *present and disabled*.
   */
  onChangeInvestedPoints?: (statId: string, points: number) => void;
}

export function StatsSection({
  stats,
  statTotal,
  budget,
  onChangeInvestedPoints,
}: StatsSectionProps) {
  const groups = groupByLabel(stats, (stat) => stat.group);

  return (
    <Card className="p-6">
      {/* The pool itself is stated once, in the sheet header: it governs the controls here *and*
          in the resources section, so sitting in one of them made it look like it belonged to it */}
      <Text variant="h4" as="h2" className="mb-3">
        Stats
      </Text>

      {/* The same sentence `SkillsSection` says, from the same constant: one pool pays for both since
          TICKET-RES-05, so two spellings would be telling a reader two things about one budget */}
      {onChangeInvestedPoints === undefined && (
        <NoControlsNotice message={POINTS_ARE_THE_PLAYERS} />
      )}

      {stats.length === 0 ? (
        <Text variant="body-small-secondary">This ruleset defines no stats.</Text>
      ) : (
        <StatGroupColumns groups={groups}>
          {(group) =>
            group.members.map((stat) => (
              <CountRow
                key={stat.id}
                name={stat.name}
                code={stat.abbreviation}
                total={stat.max}
                invested={stat.invested}
                // A derived stat takes no points, so it gets no controls at all rather than two
                // permanently disabled ones — and since TICKET-DM-05 neither does a reader who may
                // not spend, which is a different reason for the same absence
                onAdjust={
                  stat.isDerived || !budget || !onChangeInvestedPoints
                    ? undefined
                    : (points) => onChangeInvestedPoints(stat.id, points)
                }
                // An empty pool closes `+` and leaves `−` open — a point can always be taken
                // back, and since TICKET-RES-05 that is the Kernel's rule too rather than only
                // this row's manners. A pool with no *number* is `?? 0`, so it closes `+` by the
                // same line; it no longer closes `−`, because the store now honours a refund
                // whatever state the sheet is in.
                canSpend={(budget?.pointsRemaining.value ?? 0) > 0}
                // The spend and what it bought are one row, spelled in one place so this section
                // and `ResourcesSection` cannot describe the same term differently — and since
                // TICKET-ARC-04 that spelling has a branch in it, because a stat with nothing
                // invested can still carry a gain
                contributions={[
                  investedContribution(stat),
                  { label: 'race', value: stat.race },
                  { label: 'equipment', value: stat.equipment },
                ]}
              />
            ))
          }
        </StatGroupColumns>
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
