/**
 * Passive Card
 *
 * One entry of the catalog: what the ability is called and what it does (v4 systems/14,
 * TICKET-PAS-01).
 *
 * **One flat card rather than an expander**, `SpellCard`'s reasoning and more strongly: a passive
 * has *two* fields and nothing nested, so there is nothing a fold could hide except the very text a
 * User is reading down the list for. Twenty-six of them fit on a page.
 *
 * **The effect is drawn as written, braces included.** This is the authoring list, and what an
 * author needs to see here is their own template — the *resolved* reading belongs where there is a
 * character to resolve it against, which is the dialog's preview and the Player's sheet. A card that
 * resolved it would have to invent sample values to do so.
 *
 * **Validates: v4 systems/14; Requirements 21.1-21.5**
 */

import type { Passive } from '#shared/types';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';

interface PassiveCardProps {
  passive: Passive;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function PassiveCard({ passive, onEdit, onDelete }: PassiveCardProps) {
  return (
    <Card variant="elevated" className="p-3">
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1">
          <Text variant="body" className="font-semibold">
            {passive.name}
          </Text>

          {/* An absent effect is a state, not a blank — `SpellCard`'s rule for the same field */}
          {passive.effectText === '' ? (
            <Text variant="body-small-secondary" as="p" className="mt-1 italic">
              No effect text.
            </Text>
          ) : (
            <Text variant="body-small" as="p" className="mt-1 whitespace-pre-wrap">
              {passive.effectText}
            </Text>
          )}
        </div>

        <div className="flex shrink-0 gap-2">
          <Button
            variant="secondary"
            onClick={() => onEdit(passive.id)}
            aria-label={`Edit ${passive.name}`}
            className="text-xs px-2 py-1"
          >
            Edit
          </Button>
          <Button
            variant="danger"
            onClick={() => onDelete(passive.id)}
            aria-label={`Delete ${passive.name}`}
            className="text-xs px-2 py-1"
          >
            Delete
          </Button>
        </div>
      </div>
    </Card>
  );
}
