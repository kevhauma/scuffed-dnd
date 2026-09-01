/**
 * Adjustment Log
 *
 * What the Dungeon Master has done to this sheet, newest first (TICKET-DM-01, v3 Req 42.7).
 *
 * **Both people read it, and that is deliberate.** For the Player it is the answer to *why did my
 * level move*; for the DM it is what they have already done, which is the thing that stops a table
 * awarding the same 300 experience twice. So the sheet renders one panel rather than a Player's
 * history and a DM's audit that would say the same thing in two voices.
 *
 * It is a **projection of the session's Event log** — there is no second store of what changed —
 * and it says nothing about a Player's own spends: those are on the sheet already, as the numbers
 * they produced.
 *
 * Layout and composition only; every sentence in it comes from `describeAdjustment`.
 *
 * **Validates: v3 Req 42.6, 42.7; Requirements 21.1-21.5**
 */

import type { CharacterAdjustment } from '#shared/types/api';
import { readableMoment } from '../../shared/readableMoment';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { describeAdjustment } from './describeAdjustment';

export interface AdjustmentLogProps {
  adjustments: CharacterAdjustment[];
  /**
   * How each entity id is spelled on this ruleset, for the adjustments that name one
   *
   * One map across every entity kind an adjustment can name — stats and, since TICKET-PAS-01,
   * passives. See `describeAdjustment` for why it is not one map per kind.
   */
  names: Record<string, string>;
}

export function AdjustmentLog({ adjustments, names }: AdjustmentLogProps) {
  return (
    <Card className="p-6">
      <Text variant="h4" as="h2" className="mb-3">
        Dungeon Master's adjustments
      </Text>

      {adjustments.length === 0 ? (
        <Text variant="body-small-secondary">Nothing has been adjusted on this sheet.</Text>
      ) : (
        <ul className="flex flex-col gap-2">
          {adjustments.map((adjustment) => (
            <li
              key={adjustment.id}
              className="flex flex-wrap items-baseline justify-between gap-2 border-b border-stone-200 pb-2 last:border-b-0 last:pb-0"
            >
              <Text variant="body-small" as="span">
                {describeAdjustment(adjustment, names)}
              </Text>
              <Text variant="caption" as="span">
                {/* The Account's name, resolved server-side at read time — `null` is a profile that
                    has gone, which is a fact rather than a blank worth hiding */}
                {`${adjustment.by ?? 'A departed account'} · ${readableMoment(adjustment.at)}`}
              </Text>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
