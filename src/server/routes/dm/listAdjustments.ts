/**
 * `GET /api/characters/:id/adjustments` — what the DM has done to this sheet (TICKET-DM-01)
 *
 * The second half of v3 Req 42.7: the Client presents DM controls only to the DM, **and shows a
 * Player the Events that changed their own sheet.** Without this, a Player who was awarded 300
 * experience between two page loads sees a level that moved and nothing saying why.
 *
 * **`requireCharacterWriter`, not the DM guard**: the owner is the person this exists for, and the
 * DM reads the same list on the sheet they are adjusting. It is deliberately *not* readable by every
 * Member — the roll log is the table's shared record (TICKET-ROLL-07), and someone else's experience
 * is not.
 *
 * **A projection of the Event log, like `listRolls`.** Nothing is stored twice; `DM_ACTION`'s values
 * are the `type` column's, so the query is *these kinds of event, about this character*. The
 * Account's name is resolved at read time so a rename does not leave the history calling somebody by
 * a name they no longer have.
 *
 * **A character at no table has no log and answers an empty one**, rather than the 409 a *write*
 * gets: nothing is wrong with the request, and an uploaded character genuinely has no adjustments
 * (TICKET-IO-04).
 *
 * **Validates: v3 Req 32.4, 32.5, 42.6, 42.7**
 */

import {
  type CharacterAdjustment,
  type CharacterAdjustmentListing,
  DM_ACTION,
  type DmAction,
  type PlayerActionEvent,
} from '#shared/types/api';
import { requireCharacterWriter } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { findAccountById } from '../../repositories/accountRepository';
import { latestCharacterEvents } from '../../repositories/eventRepository';
import { characterIdFrom } from '../characters/characterPayloads';

/**
 * How much of the history one read answers
 *
 * `listRolls`' ceiling and its reasoning: a sheet's history is unbounded and a panel of it is not,
 * and LIVE-03 is the ticket that gives a client a cursor. Narrowed to this character **in the
 * query**, so the cap cannot silently drop somebody's own adjustments on a busy table.
 */
const LOG_LIMIT = 50;

/** The kinds of Event that count as a DM adjustment — the constant, so a sixth cannot be forgotten */
const ADJUSTMENT_TYPES: DmAction[] = Object.values(DM_ACTION);

export const listAdjustments = defineHandler((context): CharacterAdjustmentListing => {
  const characterId = characterIdFrom(context.url);
  const row = requireCharacterWriter(context, characterId);

  if (row.sessionId === null) return { adjustments: [] };

  const rows = latestCharacterEvents(row.sessionId, characterId, ADJUSTMENT_TYPES, LOG_LIMIT);

  // One lookup per Account rather than one per row — a sheet's history is one or two DMs deep
  const names = new Map<string, string | null>();

  return {
    adjustments: rows.map((entry): CharacterAdjustment => {
      const payload = JSON.parse(entry.payload) as PlayerActionEvent;

      if (entry.actorAccountId !== null && !names.has(entry.actorAccountId)) {
        names.set(entry.actorAccountId, findAccountById(entry.actorAccountId)?.name ?? null);
      }

      return {
        id: entry.id,
        seq: entry.seq,
        // The query asked for these types, so the narrowing is the database's answer rather than a
        // claim about untrusted text — the same reasoning `toCharacterDocument` gives
        action: entry.type as DmAction,
        target: payload.target,
        before: payload.before,
        after: payload.after,
        at: entry.createdAt,
        by: entry.actorAccountId === null ? null : (names.get(entry.actorAccountId) ?? null),
      };
    }),
  };
});
