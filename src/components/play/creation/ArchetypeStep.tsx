/**
 * Creation Step 2 — Archetype
 *
 * Exactly one archetype (Concept 03, TICKET-ARC-03), replacing the focus-stat step it deletes. The
 * choice is not cosmetic: it decides the **exchange rate** between the points spent on the next
 * step and the stats they buy, so the card shows which stats this archetype favours rather than
 * only its name.
 *
 * It sits *before* the allocation step for that reason — a Player choosing where to spend needs to
 * know what a point is worth first.
 *
 * A ruleset may define no archetypes at all, the same way it may define no races (TICKET-RACE-02).
 * That is said plainly rather than blocking the wizard.
 *
 * **Validates: Concept 03; Requirements 21.1-21.5**
 *
 * (Requirement 11.4 — "select a Focus_Stat" — is what this step *replaces*, so it is deliberately
 * not cited: nothing implements it any more. See TICKET-ARC-03.)
 */

import type { Archetype, Stat } from '../../../types';
import { groupStatsByAffinity } from '../../shared/affinityGroups';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';

export interface ArchetypeStepProps {
  archetypes: Archetype[];
  /** The ruleset's stats, in display order — for spelling each archetype's favoured ones */
  stats: Stat[];
  selectedArchetypeId: string;
  onSelectArchetype: (archetypeId: string) => void;
}

export function ArchetypeStep({
  archetypes,
  stats,
  selectedArchetypeId,
  onSelectArchetype,
}: ArchetypeStepProps) {
  if (archetypes.length === 0) {
    return (
      <Card className="p-6">
        <Text variant="h4" as="h2" className="mb-1">
          Archetype
        </Text>
        <Text variant="body-small-secondary">
          This ruleset defines no archetypes, so every stat grows at the same rate. You can continue
          without one.
        </Text>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <Text variant="h4" as="h2" className="mb-1">
        Archetype
      </Text>
      <Text variant="body-small-secondary" className="mb-4">
        What your character is good at growing. This decides what each point you spend on the next
        step is worth — a point on a main-type stat buys more than one on a non-type stat.
      </Text>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {archetypes.map((archetype) => {
          const isSelected = archetype.id === selectedArchetypeId;

          return (
            // Selection is the primitive's own `primary`/`secondary` variants rather than a
            // border this component paints — the picked archetype reads as the pressed control it
            // is, and the step contributes layout only.
            //
            // The stacking lives on an inner wrapper rather than on the Button's own className:
            // `Button` is `inline-flex items-center`, and a same-property utility passed from
            // outside loses to it on stylesheet order rather than on the order written here.
            // Everything inside is a `span`, because a button's content model is phrasing only.
            <Button
              key={archetype.id}
              variant={isSelected ? 'primary' : 'secondary'}
              aria-pressed={isSelected}
              onClick={() => onSelectArchetype(archetype.id)}
              className="w-full"
            >
              <span className="flex w-full flex-col items-start gap-1 text-left">
                <Text variant="body-small" as="span" className="font-semibold">
                  {archetype.name}
                </Text>
                {archetype.description && (
                  <Text variant="body-small-secondary" as="span">
                    {archetype.description}
                  </Text>
                )}

                {groupStatsByAffinity(archetype, stats).map((group) => (
                  <Text key={group.affinity} variant="caption" as="span">
                    {`${group.label}: ${group.stats.map((stat) => stat.abbreviation).join(', ')}`}
                  </Text>
                ))}
              </span>
            </Button>
          );
        })}
      </div>
    </Card>
  );
}
