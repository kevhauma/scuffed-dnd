/**
 * Creation Step 2 — Skills
 *
 * Allocates a level per main skill within the configured point budget, showing each skill's
 * racial modifier separately from the allocated base, and the base level per speciality skill.
 *
 * The budget arithmetic comes from `validateStatAllocation`; nothing is re-summed here.
 *
 * **Validates: Requirements 11.3, 8.4, 21.1-21.5**
 */

import type { StatAllocationResult } from '../../../engine/skillAllocation';
import type { SpecialitySkill, Stat } from '../../../types/config';
import { Card } from '../../ui/Card/Card';
import { Input } from '../../ui/Input/Input';
import { Label } from '../../ui/Label/Label';
import { Text } from '../../ui/Text/Text';

export interface SkillAllocationStepProps {
  investableStats: Stat[];
  specialitySkills: SpecialitySkill[];
  investedStatPoints: Record<string, number>;
  specialitySkillBaseLevels: Record<string, number>;
  racialModifiers: Record<string, number>;
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
  specialitySkills,
  investedStatPoints,
  specialitySkillBaseLevels,
  racialModifiers,
  allocation,
  onChangeInvestedStatPoints,
  onChangeSpecialityBaseLevel,
}: SkillAllocationStepProps) {
  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <Text variant="h4" as="h2">
            Main Skills
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
              const racial = racialModifiers[stat.abbreviation] ?? 0;

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
