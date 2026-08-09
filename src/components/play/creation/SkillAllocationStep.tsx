/**
 * Creation Step 2 — Stats
 *
 * Allocates points across the ruleset's **invested** stats within the configured budget, showing
 * each stat's racial modifier separately from the points spent, and the base level per speciality
 * skill. A **derived** stat takes no points, so it previews read-only and moves as the invested
 * ones do — that split is Concept 01's, wired here by TICKET-STAT-03.
 *
 * The budget arithmetic comes from `validateStatAllocation` and every derived number from
 * `calculateCharacter`; nothing is summed or evaluated here.
 *
 * **Validates: Concept 01; Requirements 11.3, 8.4, 16.6, 21.1-21.5**
 */

import type { StatAllocationResult } from '../../../engine/skillAllocation';
import type { SpecialitySkill, Stat } from '../../../types/config';
import { Card } from '../../ui/Card/Card';
import { Input } from '../../ui/Input/Input';
import { Label } from '../../ui/Label/Label';
import { Text } from '../../ui/Text/Text';
import { SkillBreakdownRow } from '../shared/SkillBreakdownRow';
import type { DerivedStatPreview } from './useCharacterCreation';

export interface SkillAllocationStepProps {
  investableStats: Stat[];
  /** The stats a formula decides — shown, never edited */
  derivedStatPreviews: DerivedStatPreview[];
  specialitySkills: SpecialitySkill[];
  investedStatPoints: Record<string, number>;
  specialitySkillBaseLevels: Record<string, number>;
  /** What the chosen races supply, per stat id (TICKET-RACE-01) */
  raceBases: Record<string, number>;
  allocation: StatAllocationResult | null;
  onChangeInvestedStatPoints: (statId: string, points: number) => void;
  onChangeSpecialityBaseLevel: (code: string, level: number) => void;
}

/** Parse a number input, treating a cleared field as zero rather than NaN */
function toLevel(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function SkillAllocationStep({
  investableStats,
  derivedStatPreviews,
  specialitySkills,
  investedStatPoints,
  specialitySkillBaseLevels,
  raceBases,
  allocation,
  onChangeInvestedStatPoints,
  onChangeSpecialityBaseLevel,
}: SkillAllocationStepProps) {
  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <Text variant="h4" as="h2">
            Stats
          </Text>
          {allocation && allocation.pointBudget !== null && (
            <Text variant={allocation.isOverBudget ? 'error' : 'body-small-secondary'} as="p">
              {allocation.pointsSpent} of {allocation.pointBudget} points spent ·{' '}
              {allocation.pointsRemaining} remaining
            </Text>
          )}
          {allocation && allocation.pointBudget === null && (
            <Text variant="body-small-secondary" as="p">
              {allocation.pointsSpent} points spent · no budget set
            </Text>
          )}
        </div>

        {investableStats.length === 0 ? (
          <Text variant="body-small-secondary">This ruleset defines no invested stats.</Text>
        ) : (
          <div className="space-y-3">
            {investableStats.map((stat) => {
              const allocated = investedStatPoints[stat.id] ?? 0;
              const racial = raceBases[stat.id] ?? 0;

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
                    {racial !== 0 && (
                      <>
                        {' · '}
                        <Text variant="highlight" as="span">
                          {racial > 0 ? `+${racial}` : racial} racial
                        </Text>
                        {` · total ${allocated + racial}`}
                      </>
                    )}
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

      {specialitySkills.length > 0 && (
        <Card className="p-6">
          <Text variant="h4" as="h2" className="mb-4">
            Speciality Skills
          </Text>
          <Text variant="body-small-secondary" className="mb-3">
            Base levels. The formula bonus is added on top and shown in the review.
          </Text>

          <div className="space-y-3">
            {specialitySkills.map((skill) => (
              <div key={skill.code} className="flex flex-wrap items-center gap-3">
                <Label htmlFor={`spec-${skill.code}`} className="w-40 shrink-0">
                  {skill.name} ({skill.code})
                </Label>
                <Input
                  id={`spec-${skill.code}`}
                  type="number"
                  min="0"
                  max={skill.maxBaseLevel}
                  value={specialitySkillBaseLevels[skill.code] ?? 0}
                  onChange={(event) =>
                    onChangeSpecialityBaseLevel(skill.code, toLevel(event.target.value))
                  }
                  className="w-24"
                />
                <Text variant="body-small-secondary" as="span">
                  max base {skill.maxBaseLevel}
                </Text>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
