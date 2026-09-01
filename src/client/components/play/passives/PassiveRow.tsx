/**
 * Passive Row
 *
 * One passive ability on a sheet: what it is called, what it does, and — for whoever may take it
 * back — a *Revoke* button (v4 systems/14, TICKET-PAS-01).
 *
 * **The effect is resolved for this character.** Two of the workbook's 26 passives are live
 * formulas — Blindsight's range is `perception level × 10` feet and darkvision's is `× 5` — so an
 * effect is template text whose `{placeholders}` are evaluated against the person holding it, the
 * same way a spell effect is (v4 D4). The resolution is the hook's; this component is handed
 * segments and hands them to `ResolvedTemplate`, the one rendering the config panel's preview also
 * uses, so what an author saw is what a Player reads.
 *
 * **A row whose passive the ruleset has lost is still a row**, `SpellbookRow`'s rule: `passivesOf`
 * resolves such an id to an entry with nothing behind it rather than dropping it, and drawing it is
 * what makes it clearable — a row nobody can see is a row nobody can revoke.
 *
 * **`onRevoke` is optional, and its absence is the message.** A Player at a table is shown their
 * passives and no control, because a passive there is the DM's to take back (v4 systems/14); an
 * absent button says *not yours* where a disabled one would say *not now*. That is the sheet's own
 * treatment of the purse and the experience controls.
 *
 * **Validates: v4 systems/14; Requirements 21.1-21.5**
 */

import type { ResolvedSegment } from '#shared/engine/formula/template';
import type { PassiveEntry } from '#shared/engine/passives';
import { ResolvedTemplate } from '../../shared/ResolvedTemplate';
import { Button } from '../../ui/Button/Button';
import { Text } from '../../ui/Text/Text';

export interface PassiveRowProps {
  entry: PassiveEntry;
  /**
   * The effect with its placeholders filled in for this character, or none when there is nothing
   * to say
   *
   * Passed in rather than resolved here for `SpellbookRow`'s reason: the numbers come from the
   * character, the component draws a row, and a component that reached for the engine would be a
   * second place deciding what an ability does.
   */
  effect: ResolvedSegment[];
  /** Omitted for a reader who may not take this passive back — see the module header */
  onRevoke?: (passiveId: string) => void;
}

export function PassiveRow({ entry, effect, onRevoke }: PassiveRowProps) {
  const { passive } = entry;

  return (
    <div className="border-stone-200 border-b py-2 last:border-b-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Text variant="body-small" as="span">
          {passive?.name ?? 'A passive this ruleset no longer has'}
        </Text>

        {onRevoke && (
          <Button variant="danger" size="sm" onClick={() => onRevoke(entry.passiveId)}>
            Revoke
          </Button>
        )}
      </div>

      {effect.length > 0 && <ResolvedTemplate segments={effect} className="mt-1" />}
    </div>
  );
}
