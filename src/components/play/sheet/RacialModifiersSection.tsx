/**
 * Racial Modifiers Section
 *
 * The combined skill modifiers granted by every race the character has. Multiple races combine
 * additively — the combining happens in `calculateRacialSkillModifiers`, this only displays it.
 *
 * **Validates: Requirements 8.3, 8.4, 8.5, 21.1-21.5**
 */

import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';

export interface RacialModifiersSectionProps {
  raceNames: string[];
  /** Skill code to combined modifier, from the engine */
  racialModifiers: Record<string, number>;
}

export function RacialModifiersSection({
  raceNames,
  racialModifiers,
}: RacialModifiersSectionProps) {
  const entries = Object.entries(racialModifiers).filter(([, modifier]) => modifier !== 0);

  return (
    <Card className="p-6">
      <Text variant="h4" as="h2" className="mb-3">
        Racial Modifiers
      </Text>

      {raceNames.length === 0 ? (
        <Text variant="body-small-secondary">This character has no races.</Text>
      ) : entries.length === 0 ? (
        <Text variant="body-small-secondary">{raceNames.join(', ')} — no skill modifiers.</Text>
      ) : (
        <div className="flex flex-wrap gap-2">
          {entries.map(([skillCode, modifier]) => (
            <Text key={skillCode} variant="highlight" as="span">
              {skillCode} {modifier > 0 ? `+${modifier}` : modifier}
            </Text>
          ))}
        </div>
      )}
    </Card>
  );
}
