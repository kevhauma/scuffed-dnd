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
import { ExperienceControl } from './ExperienceControl';

export interface SheetHeaderProps {
  name: string;
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
        <div>
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
        <Button variant="secondary" onClick={onBack}>
          Back to Characters
        </Button>
      </div>

      <ExperienceControl onAward={onAwardExperience} onDeduct={onDeductExperience} />
    </Card>
  );
}
