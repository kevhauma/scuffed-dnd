/**
 * Character Sheet Header
 *
 * Identity block: name, races, level, experience, and the way back to the character list.
 *
 * Level and XP sit together because since TICKET-RES-01 one *is* the other: the level is read
 * backwards out of the `xp_thresholds` curve, so showing the level without the number it came from
 * would leave a Player unable to tell "one more session" from "one more campaign".
 *
 * **Validates: Concept 20; Requirements 8.5, 21.1-21.5**
 */

import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { CharacterSummaryLine } from '../shared/CharacterSummaryLine';
import type { DerivedValue } from '../shared/derivedValue';
import { PointBudgetSummary } from '../shared/PointBudgetSummary';
import type { PointBudgetView } from '../shared/pointBudgetView';
import { ExperienceControl } from './ExperienceControl';

export interface SheetHeaderProps {
  name: string;
  /**
   * The pool every invested stat spends from, or null when there is none to show
   *
   * Here rather than in the stats section's own header, where it started. It is the character's
   * headline state — "you have three points to spend" is the reason a Player opens the sheet after
   * a level — and it governs the controls in *two* sections now that resources have their own, so
   * sitting inside one of them made it look like it belonged to that one.
   */
  budget: PointBudgetView | null;
  raceNames: string[];
  /** Curve-derived, so it can fail — a ruleset with no `xp_thresholds` curve chips here */
  level: DerivedValue;
  experience: number;
  /** The character's archetype, by name — what replaced the focus stat (TICKET-ARC-03) */
  archetypeName?: string;
  onBack: () => void;
  onAwardExperience: (amount: number) => void;
  onDeductExperience: (amount: number) => void;
}

export function SheetHeader({
  name,
  budget,
  raceNames,
  level,
  experience,
  archetypeName,
  onBack,
  onAwardExperience,
  onDeductExperience,
}: SheetHeaderProps) {
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {/*
            An arrow beside the title rather than a labelled button in the corner. Back is the one
            control on this page nobody needs to read to understand, and the corner it occupied is
            where the character's point budget belongs. The accessible name is unchanged, so it is
            still "Back to Characters" to anyone who cannot see the arrow.
          */}
          <Button
            variant="secondary"
            size="sm"
            aria-label="Back to Characters"
            onClick={onBack}
            className="mt-1 shrink-0"
          >
            ←
          </Button>

          <div className="min-w-0">
            <Text variant="h2" as="h1" className="mb-1">
              {name}
            </Text>
            <CharacterSummaryLine
              level={level}
              raceNames={raceNames}
              experience={experience}
              archetypeName={archetypeName}
              noRacesLabel="No races"
            />
          </div>
        </div>

        {budget && (
          <PointBudgetSummary
            pointsSpent={budget.pointsSpent}
            pointBudget={budget.pointBudget}
            pointsRemaining={budget.pointsRemaining}
            isOverBudget={budget.isOverBudget}
          />
        )}
      </div>

      <ExperienceControl onAward={onAwardExperience} onDeduct={onDeductExperience} />
    </Card>
  );
}
