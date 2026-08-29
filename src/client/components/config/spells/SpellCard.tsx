/**
 * Spell Card
 *
 * One entry of the compendium: what it is called, what it costs, how far it reaches and what it
 * does (v4 systems/13, TICKET-SPL-01).
 *
 * **Deliberately one flat card rather than an expander.** `InlayCard` and `MaterialCard` collapse
 * because a family hides a ten-rung ladder; a spell has four short fields and nothing nested, and a
 * list of four hundred collapsed rows would hide the very text a User is scanning for. What keeps
 * that list usable is the panel's search and paging, not a fold.
 *
 * **An unstated field is drawn as unstated.** A blank range and a missing mana cost are real states
 * of the source workbook — six range cells are empty and one row's cost column holds a distance —
 * so the card says so instead of drawing a zero the ruleset does not contain.
 *
 * **Validates: v4 systems/13; Requirements 21.1-21.5**
 */

import type { Spell } from '#shared/types';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';

interface SpellCardProps {
  spell: Spell;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

/** What a field the ruleset leaves empty reads as — a statement of absence, not a substitute value */
const UNSTATED_LABEL = 'Not stated';

export function SpellCard({ spell, onEdit, onDelete }: SpellCardProps) {
  const cost = spell.manaCost === undefined ? UNSTATED_LABEL : `${spell.manaCost} mana`;
  const reach = spell.rangeTime === '' ? UNSTATED_LABEL : spell.rangeTime;

  return (
    <Card variant="elevated" className="p-3">
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1">
          <div className="flex items-baseline gap-3 flex-wrap">
            <Text variant="body" className="font-semibold">
              {spell.name}
            </Text>
            <Text variant="body-small-secondary">{cost}</Text>
            <Text variant="body-small-secondary">{reach}</Text>
          </div>

          {spell.description && (
            <Text variant="body-small-secondary" as="p" className="mt-1">
              {spell.description}
            </Text>
          )}

          {/* Raw text until TICKET-SPL-03 turns its numbers into formula placeholders (v4 D4), so
              it is rendered rather than interpreted — and its absence is a state, not a blank */}
          {spell.effectTemplate === '' ? (
            <Text variant="body-small-secondary" as="p" className="mt-2 italic">
              No effect text.
            </Text>
          ) : (
            <Text variant="body-small" as="p" className="mt-2 whitespace-pre-wrap">
              {spell.effectTemplate}
            </Text>
          )}
        </div>

        <div className="flex shrink-0 gap-2">
          <Button
            variant="secondary"
            onClick={() => onEdit(spell.id)}
            aria-label={`Edit ${spell.name}`}
            className="text-xs px-2 py-1"
          >
            Edit
          </Button>
          <Button
            variant="danger"
            onClick={() => onDelete(spell.id)}
            aria-label={`Delete ${spell.name}`}
            className="text-xs px-2 py-1"
          >
            Delete
          </Button>
        </div>
      </div>
    </Card>
  );
}
