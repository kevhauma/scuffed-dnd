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
 * Every number comes from the calculator; this section multiplies nothing.
 *
 * **Validates: Concept 02; Requirements 13.4, 21.1-21.5**
 */

import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { CountRow } from '../shared/CountRow';
import type { DerivedValue } from '../shared/derivedValue';
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
   * Spend or unspend a point on one skill
   *
   * Budgeted since TICKET-RES-05, so these rows carry the same `canSpend` the stats do — the note
   * that used to stand here said this would happen the moment a ticket gave skills a pool, and this
   * is that ticket.
   */
  onChangeInvestedPoints: (skillId: string, points: number) => void;
}

/**
 * A skill level as a whole number
 *
 * Rounded up, and the error carried through untouched — a level that could not be computed still
 * has nothing to round.
 */
function ceilLevel(level: DerivedValue): DerivedValue {
  return level.error === null ? { value: Math.ceil(level.value), error: null } : level;
}

export function SkillsSection({ skills, budget, onChangeInvestedPoints }: SkillsSectionProps) {
  return (
    <Card className="p-6">
      <Text variant="h4" as="h2" className="mb-3">
        Skills
      </Text>

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
              // The **level** leads the row, as a whole number: `STR × 0.2 + DEX × 0.1` lands on
              // 2.4, and nobody at a table has two-and-two-fifths of a level. Rounded up **here,
              // at the display edge, and nowhere else** — the engine keeps the exact value because
              // the bonus derives from it (`round(level / bonus_divider)`) and the golden fixtures
              // pin that chain to the source sheet's own numbers. Moving the ceiling into the
              // engine is a rules change, not a formatting one.
              total={ceilLevel(skill.total)}
              // The bonus is in the breakdown rather than on the row. It is the integer a Player
              // adds to a roll, but it is also `round(level / 5)` — so on a page of forty skills
              // it is a column of 0s and 1s, where the level is what actually moves.
              secondary={{ label: 'bonus', value: skill.bonus }}
              invested={skill.invested}
              onAdjust={budget ? (points) => onChangeInvestedPoints(skill.id, points) : undefined}
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
