/**
 * Creation Step 3 — Stats
 *
 * Allocates points across the ruleset's **invested** stats within the budget their level grants —
 * `level × const.points_per_level` since TICKET-RES-02, which at creation is level-at-XP-0 — showing
 * each stat's racial modifier separately from the points spent, and the base level per speciality
 * skill. A **derived** stat takes no points, so it previews read-only and moves as the invested
 * ones do — that split is Concept 01's, wired here by TICKET-STAT-03.
 *
 * The budget arithmetic comes from `validateStatAllocation` and every derived number from
 * `calculateCharacter`; nothing is summed or evaluated here.
 *
 * **Validates: Concept 01; Requirements 11.3, 8.4, 16.6, 21.1-21.5**
 */

import type { Skill, Stat } from '../../../types/config';
import { Card } from '../../ui/Card/Card';
import { ErrorChip } from '../../ui/ErrorChip/ErrorChip';
import { Input } from '../../ui/Input/Input';
import { Label } from '../../ui/Label/Label';
import { Text } from '../../ui/Text/Text';
import type { DerivedValue } from '../shared/derivedValue';
import { PointBudgetSummary } from '../shared/PointBudgetSummary';
import type { PointBudgetView } from '../shared/pointBudgetView';
import { SkillBreakdownRow } from '../shared/SkillBreakdownRow';
import type { DerivedStatPreview } from './useCharacterCreation';

export interface SkillAllocationStepProps {
  investableStats: Stat[];
  /** The stats a formula decides — shown, never edited */
  derivedStatPreviews: DerivedStatPreview[];
  skills: Skill[];
  investedStatPoints: Record<string, number>;
  investedSkillPoints: Record<string, number>;
  /** What the chosen races supply, per stat id (TICKET-RACE-01) */
  raceBases: Record<string, number>;
  /** Spent, available and remaining, already spelled for display by the hook */
  budget: PointBudgetView | null;
  /** What each stat's points bought, keyed by stat id — the engine's, never re-derived here */
  gains: Record<string, DerivedValue>;
  onChangeInvestedStatPoints: (statId: string, points: number) => void;
  /** Keyed by skill **id** — the parameter was called `code` until CR-42; skills lost theirs in
   * TICKET-SKL-02 */
  onChangeInvestedSkillPoints: (skillId: string, level: number) => void;
}

/** Parse a number input, treating a cleared field as zero rather than NaN */
function toLevel(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** A stat with no reported gain has bought nothing — the engine reports a row for every one */
const NO_GAIN: DerivedValue = { value: 0, error: null };

export function SkillAllocationStep({
  investableStats,
  derivedStatPreviews,
  skills,
  investedStatPoints,
  investedSkillPoints,
  raceBases,
  budget,
  gains,
  onChangeInvestedStatPoints,
  onChangeInvestedSkillPoints,
}: SkillAllocationStepProps) {
  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
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

        {investableStats.length === 0 ? (
          <Text variant="body-small-secondary">This ruleset defines no invested stats.</Text>
        ) : (
          <div className="space-y-3">
            {investableStats.map((stat) => {
              const allocated = investedStatPoints[stat.id] ?? 0;
              const racial = raceBases[stat.id] ?? 0;
              // What those points *bought*, from the engine (TICKET-ARC-02). The step used to add
              // `allocated + racial`, which was right only while the term was 1:1.
              const bought = gains[stat.id] ?? NO_GAIN;

              return (
                <div key={stat.id} className="flex flex-wrap items-center gap-3">
                  <Label htmlFor={`stat-${stat.id}`} className="w-40 shrink-0">
                    {stat.name} ({stat.abbreviation})
                  </Label>
                  <Input
                    id={`stat-${stat.id}`}
                    type="number"
                    min="0"
                    value={allocated}
                    onChange={(event) =>
                      onChangeInvestedStatPoints(stat.id, toLevel(event.target.value))
                    }
                    error={allocated < 0}
                    className="w-24"
                  />
                  <Text variant="body-small-secondary" as="span">
                    {/* The exchange rate, shown whenever it is not 1:1 — a Player choosing where
                        to spend needs to see that their archetype makes this stat cheaper */}
                    {bought.error === null && bought.value !== allocated && (
                      <Text variant="highlight" as="span">
                        {`→ +${bought.value}`}
                      </Text>
                    )}
                    {bought.error !== null && (
                      <ErrorChip label="unavailable" detail={bought.error} />
                    )}
                    {racial !== 0 && (
                      <>
                        {' · '}
                        <Text variant="highlight" as="span">
                          {racial > 0 ? `+${racial}` : racial} racial
                        </Text>
                      </>
                    )}
                    {bought.error === null && ` · total ${bought.value + racial}`}
                  </Text>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {derivedStatPreviews.length > 0 && (
        <Card className="p-6">
          <Text variant="h4" as="h2" className="mb-1">
            Derived Stats
          </Text>
          <Text variant="body-small-secondary" className="mb-3">
            Calculated from the points above — they take no allocation of their own.
          </Text>

          {derivedStatPreviews.map(({ stat, value }) => (
            // The sheet's row, so a derived stat reads the same in both places. It takes no
            // points, so there are no contributions to break out — just the value or its chip.
            <SkillBreakdownRow
              key={stat.id}
              name={stat.name}
              code={stat.abbreviation}
              total={value}
              contributions={[]}
            />
          ))}
        </Card>
      )}

      {skills.length > 0 && (
        <Card className="p-6">
          <Text variant="h4" as="h2" className="mb-4">
            Skills
          </Text>
          <Text variant="body-small-secondary" className="mb-3">
            Points invested. Each skill's governing stats are added on top and shown in the review.
          </Text>

          <div className="space-y-3">
            {skills.map((skill) => (
              <div key={skill.id} className="flex flex-wrap items-center gap-3">
                <Label htmlFor={`skill-${skill.id}`} className="w-40 shrink-0">
                  {skill.name}
                </Label>
                <Input
                  id={`skill-${skill.id}`}
                  type="number"
                  min="0"
                  value={investedSkillPoints[skill.id] ?? 0}
                  onChange={(event) =>
                    onChangeInvestedSkillPoints(skill.id, toLevel(event.target.value))
                  }
                  className="w-24"
                />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
