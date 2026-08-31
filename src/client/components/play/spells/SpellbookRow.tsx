/**
 * Spellbook Row
 *
 * One learned spell as the workbook's `Spellbook` sheet lays it out: name, mana cost, range/time and
 * effect — plus the two controls the app adds, *Cast* and *Unlearn* (v4 systems/13, TICKET-SPL-02).
 *
 * **The effect is stored text and is rendered as text.** 326 of the sheet's 418 effect cells are
 * formulas concatenating prose around computed numbers, and turning those into evaluated
 * placeholders is TICKET-SPL-03's `spell-effect` attachment point (v4 D4). Until then nothing here
 * may treat a `{` in the string as syntax — which is why this draws the raw value rather than
 * reaching for the formula engine.
 *
 * **A row whose spell the ruleset has lost is still a row.** `spellbookOf` resolves such an id to an
 * entry with no spell behind it rather than dropping it, and drawing it is what makes it clearable:
 * the Player is the only one who can take it out of their book, and *Cast* is the one control that
 * goes away, because there is nothing left to price.
 *
 * **Validates: v4 systems/13 gaps 2, 3; Requirements 21.1-21.5**
 */

import type { SpellbookEntry } from '#shared/engine/spellbook';
import { Button } from '../../ui/Button/Button';
import { Text } from '../../ui/Text/Text';

export interface SpellbookRowProps {
  entry: SpellbookEntry;
  /** Whether there is a pool to spend from — `false` disables *Cast* rather than hiding it */
  canCast: boolean;
  onCast: (spellId: string) => void;
  onUnlearn: (spellId: string) => void;
}

/** What the row says a cast costs — an unpriced spell says so rather than showing a 0 */
function costLabel(manaCost: number | undefined): string {
  return manaCost === undefined ? 'unpriced' : `${manaCost} mana`;
}

export function SpellbookRow({ entry, canCast, onCast, onUnlearn }: SpellbookRowProps) {
  const { spell } = entry;

  return (
    <div className="border-stone-200 border-b py-2 last:border-b-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <Text variant="body-small" as="span">
            {spell?.name ?? 'A spell this ruleset no longer has'}
          </Text>
          {spell && (
            <Text variant="caption" as="span">
              {costLabel(spell.manaCost)}
              {spell.rangeTime === '' ? '' : ` · ${spell.rangeTime}`}
            </Text>
          )}
        </div>

        <div className="flex gap-2">
          {/* Offered even when the spell is unpriced: the Kernel's refusal names *why* it cannot be
              cast, which is a sentence the Player can act on where a missing button is not */}
          {spell && (
            <Button
              variant="secondary"
              size="sm"
              disabled={!canCast}
              onClick={() => onCast(entry.spellId)}
            >
              Cast
            </Button>
          )}
          <Button variant="danger" size="sm" onClick={() => onUnlearn(entry.spellId)}>
            Unlearn
          </Button>
        </div>
      </div>

      {spell && spell.effectTemplate !== '' && (
        <Text variant="body-small-secondary" className="mt-1">
          {spell.effectTemplate}
        </Text>
      )}
    </div>
  );
}
