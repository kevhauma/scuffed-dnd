/**
 * Race Stat Block Section
 *
 * What the character's races supply, per stat. Since TICKET-RACE-01 a race is a **stat block** —
 * absolute values, not deltas — so the numbers here are stated plainly rather than signed: a dwarf
 * has Strength 14, they are not "+14 Strength". The combining happens in `calculateRaceStatBases`;
 * this only displays it.
 *
 * **Validates: Concept 04; Requirements 8.3, 8.4, 8.5, 21.1-21.5**
 */

import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import type { RaceContribution } from './useCharacterSheet';

export interface RaceStatBlockSectionProps {
  raceNames: string[];
  /** Per-stat contributions in display order, already labelled and filtered by the hook */
  raceContributions: RaceContribution[];
}

export function RaceStatBlockSection({ raceNames, raceContributions }: RaceStatBlockSectionProps) {
  return (
    <Card className="p-6">
      <Text variant="h4" as="h2" className="mb-3">
        Race Stat Block
      </Text>

      {raceNames.length === 0 ? (
        <Text variant="body-small-secondary">This character has no races.</Text>
      ) : raceContributions.length === 0 ? (
        <Text variant="body-small-secondary">{raceNames.join(', ')} — no stat values.</Text>
      ) : (
        <div className="flex flex-wrap gap-2">
          {raceContributions.map((contribution) => (
            <Text key={contribution.statId} variant="highlight" as="span">
              {contribution.abbreviation} {contribution.value}
            </Text>
          ))}
        </div>
      )}
    </Card>
  );
}
