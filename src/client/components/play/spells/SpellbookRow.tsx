/**
 * Spellbook Row
 *
 * One learned spell as the workbook's `Spellbook` sheet lays it out: name, mana cost, range/time and
 * effect — plus the two controls the app adds, *Cast* and *Unlearn* (v4 systems/13, TICKET-SPL-02).
 *
 * **The effect is resolved for this caster** (TICKET-SPL-03). 326 of the sheet's 418 effect cells
 * are formulas concatenating prose around computed numbers, so an effect is template text whose
 * `{placeholders}` are evaluated against the character reading it (v4 D4) — *"a 55-foot-radius
 * sphere … takes 11 fire damage"* is 11 **for them**. The resolution is the hook's; this component
 * is handed segments and hands them to `ResolvedTemplate`, the one rendering the config panel's
 * preview also uses, so what an author saw is what a Player reads.
 *
 * A placeholder that cannot be worked out — a stat the ruleset lost — becomes an error chip inside
 * an otherwise intact sentence rather than blanking the row (Concept 00 §7).
 *
 * **A row whose spell the ruleset has lost is still a row.** `spellbookOf` resolves such an id to an
 * entry with no spell behind it rather than dropping it, and drawing it is what makes it clearable:
 * the Player is the only one who can take it out of their book, and *Cast* is the one control that
 * goes away, because there is nothing left to price.
 *
 * **Validates: v4 systems/13 gaps 2, 3; Requirements 21.1-21.5**
 */

import type { ResolvedSegment } from '#shared/engine/formula/template';
import type { SpellbookEntry } from '#shared/engine/spellbook';
import { ResolvedTemplate } from '../../shared/ResolvedTemplate';
import { Button } from '../../ui/Button/Button';
import { Text } from '../../ui/Text/Text';

export interface SpellbookRowProps {
  entry: SpellbookEntry;
  /**
   * The effect with its placeholders filled in for this caster, or none when there is nothing to say
   *
   * Passed in rather than resolved here for the reason `CarriedBuild.label` is: the numbers come
   * from the character, the component draws a row, and a component that reached for the engine
   * would be a second place deciding what a spell does.
   */
  effect: ResolvedSegment[];
  /** Whether there is a pool to spend from — `false` disables *Cast* rather than hiding it */
  canCast: boolean;
  onCast: (spellId: string) => void;
  onUnlearn: (spellId: string) => void;
}

/** What the row says a cast costs — an unpriced spell says so rather than showing a 0 */
function costLabel(manaCost: number | undefined): string {
  return manaCost === undefined ? 'unpriced' : `${manaCost} mana`;
}

export function SpellbookRow({ entry, effect, canCast, onCast, onUnlearn }: SpellbookRowProps) {
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

      {effect.length > 0 && <ResolvedTemplate segments={effect} className="mt-1" />}
    </div>
  );
}
