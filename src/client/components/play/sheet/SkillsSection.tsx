/**
 * Skills Section
 *
 * Each skill's two numbers together (Concept 02, TICKET-SKL-03): the **level** it derives to, and
 * the **bonus** — the integer a Player actually adds to a roll — with the terms that produced them
 * spelled out beside the name.
 *
 * The weighted stats *are* itemised here, unlike before this ticket. They are a property of the
 * ruleset rather than something the Player changed, but a Player reading `+3` has no way to tell a
 * high stat from spent points without them, which is the question the breakdown exists to answer.
 * Every number comes from the calculator; this section multiplies nothing and — since
 * TICKET-SKL-04 moved the level's ceiling into the engine — rounds nothing either.
 *
 * **The spend handler is optional since TICKET-DM-05**, `StatsSection`'s change out of the same pool:
 * `invest-skill-points` is behind `requireCharacterPlayer`, so the table's DM reads all forty-odd
 * levels and bonuses with no way to move any of them.
 *
 * **Validates: Concept 02; Requirements 13.4, 21.1-21.5; v3 Req 42.7, 49.10; v4 systems/06 gap 3**
 */

import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { CountRow } from '../shared/CountRow';
import { NoControlsNotice, POINTS_ARE_THE_PLAYERS } from '../shared/NoControlsNotice';
import type { PointBudgetView } from '../shared/pointBudgetView';
import type { SkillBreakdown } from './useCharacterSheet';

export interface SkillsSectionProps {
  skills: SkillBreakdown[];
  /**
   * The pool a point spent here comes out of — the very same one the stats spend (TICKET-RES-05)
   *
   * Null when there is none to show. It is *stated* in the sheet header rather than here, for
   * `StatsSection`'s reason: one pool governing three sections cannot sit inside one of them.
   */
  budget: PointBudgetView | null;
  /**
   * Spend or unspend a point on one skill, or absent when this reader may not (TICKET-DM-05)
   *
   * Budgeted since TICKET-RES-05, so these rows carry the same `canSpend` the stats do — the note
   * that used to stand here said this would happen the moment a ticket gave skills a pool, and this
   * is that ticket. **Absent for the table's DM**, for `StatsSection`'s reason and out of the same
   * pool: one budget pays for both, and neither half of it is the DM's to spend.
   */
  onChangeInvestedPoints?: (skillId: string, points: number) => void;
}

export function SkillsSection({ skills, budget, onChangeInvestedPoints }: SkillsSectionProps) {
  return (
    <Card className="p-6">
      <Text variant="h4" as="h2" className="mb-3">
        Skills
      </Text>

      {/* `StatsSection`'s sentence from `StatsSection`'s constant — the pool is one pool */}
      {onChangeInvestedPoints === undefined && (
        <NoControlsNotice message={POINTS_ARE_THE_PLAYERS} />
      )}

      {skills.length === 0 ? (
        <Text variant="body-small-secondary">This ruleset defines no skills.</Text>
      ) : (
        // A grid, because the sheet keeps its skills as a table and a ruleset has a lot of them —
        // the Ducklets sheet has 48, which as one column is most of a page of scrolling to find
        // one row. `gap-x-8` and the rows' own rules keep the columns readable as columns.
        <div className="grid gap-x-8 md:grid-cols-2 xl:grid-cols-3">
          {skills.map((skill) => (
            <CountRow
              key={skill.id}
              size="sm"
              name={skill.name}
              // The **level** leads the row, and it arrives whole: `STR × 0.2 + DEX × 0.1` lands on
              // 2.4 and the engine rounds it up to 3, because the sheet's own formula does
              // (`ROUNDUP(…) + invested`, TICKET-SKL-04). This row used to do that ceiling itself,
              // at the display edge, while the engine kept the fraction — the note that stood here
              // said moving it into the engine would be a rules change rather than a formatting
              // one, and SKL-04 is that rules change. **Nothing is rounded here.**
              total={skill.total}
              // The bonus is in the breakdown rather than on the row. It is the integer a Player
              // adds to a roll, but it is also `ceil(level / 5)` — so on a page of forty skills
              // it is a column of small numbers, where the level is what actually moves.
              secondary={{ label: 'bonus', value: skill.bonus }}
              invested={skill.invested}
              // No budget to spend from, or no standing to spend it — two reasons, one absence
              onAdjust={
                budget && onChangeInvestedPoints
                  ? (points) => onChangeInvestedPoints(skill.id, points)
                  : undefined
              }
              // `StatsSection`'s line, for the same pool and the same reason: an empty pool closes
              // `+` and leaves `−` open, because a point can always be taken back
              canSpend={(budget?.pointsRemaining.value ?? 0) > 0}
              contributions={[
                ...skill.statContributions,
                { label: 'invested', value: skill.invested, alwaysShow: true },
              ]}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
