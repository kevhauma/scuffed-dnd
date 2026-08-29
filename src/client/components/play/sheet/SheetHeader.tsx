/**
 * Character Sheet Header
 *
 * Identity block: name, races, level, dream level, experience, and the way back to the character
 * list — the fields the workbook's own `Character Sheet` A1:B6 prints together.
 *
 * Level and XP sit together because since TICKET-RES-01 one *is* the other: the level is read
 * backwards out of the `xp_thresholds` curve, so showing the level without the number it came from
 * would leave a Player unable to tell "one more session" from "one more campaign".
 *
 * **Validates: Concept 20; Requirements 8.5, 21.1-21.5**
 */

import { DEFAULT_DREAM_LEVEL } from '#shared/engine/dreamLevel';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { AdjustmentField } from '../shared/AdjustmentField';
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
  /** How far the character stands in their dream — stored, never derived (TICKET-RES-04) */
  dreamLevel: number;
  experience: number;
  /** The character's archetype, by name — what replaced the focus stat (TICKET-ARC-03) */
  archetypeName?: string;
  onBack: () => void;
  /**
   * How experience is changed, or **absent at a table** (TICKET-PLY-01)
   *
   * At a game session experience is the DM's to award (D9, v3 Req 42.1), so the Player's own sheet
   * has no route to write it and the control is not drawn at all. Absent rather than disabled: a
   * greyed-out control says *not now*, and this is *not yours*. TICKET-DM-01 brings the DM's.
   */
  onAwardExperience?: (amount: number) => void;
  onDeductExperience?: (amount: number) => void;
  /**
   * How the dream level is raised, or **absent at a table** — `onAwardExperience`'s rule
   * (TICKET-RES-04)
   *
   * The User ruled that the DM raises it, so at a table this sheet only *shows* the number and
   * `DmControlsPanel` carries the control. Signed out there is no DM and the Player keeps their own
   * sheet, which is the same one-person-plays-both-parts the experience control is drawn on.
   */
  onSetDreamLevel?: (level: number) => void;
}

export function SheetHeader({
  name,
  budget,
  raceNames,
  level,
  dreamLevel,
  experience,
  archetypeName,
  onBack,
  onAwardExperience,
  onDeductExperience,
  onSetDreamLevel,
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
              dreamLevel={dreamLevel}
              experience={experience}
              archetypeName={archetypeName}
              noRacesLabel="No races"
            />
          </div>
        </div>

        {/* The view is the props — see the note at the other call site */}
        {budget && <PointBudgetSummary {...budget} />}
      </div>

      {onAwardExperience && onDeductExperience && (
        <ExperienceControl onAward={onAwardExperience} onDeduct={onDeductExperience} />
      )}

      {/* The DM's own control, on the Player's sheet — `DmControlsPanel` borrows `ExperienceControl`
          the same way in the other direction, because the act is identical and only the store action
          behind it differs. Nothing is on a wire here, so there is no busy state to pass. */}
      {onSetDreamLevel && (
        <div className="mt-4">
          <AdjustmentField
            label="Dream level"
            actionLabel="Set dream level"
            current={`${dreamLevel} now — your archetype's gains grow with it`}
            min={DEFAULT_DREAM_LEVEL}
            onSubmit={onSetDreamLevel}
          />
        </div>
      )}
    </Card>
  );
}
