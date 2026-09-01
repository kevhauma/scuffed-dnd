/**
 * `GET /api/sessions/:id/rolls` — the table's roll log (v3 Req 41.6, TICKET-ROLL-07)
 *
 * **A projection of the Event log, not a second store of truth.** That is the whole reason the
 * history stops being `useUIStore`'s in-memory list: a roll is a *shared* event, so it has to
 * survive the tab that made it and be readable by everybody at the table — neither of which a
 * client-side array can do.
 *
 * **Every Member reads it**, like `listCharacters`, and for the same reason: a game is played out
 * loud. A roll nobody else can see is the number-you-report this ticket exists to replace.
 *
 * **Readable on an archived session**, like every other read — a finished campaign's rolls are most
 * of what it was.
 *
 * **Names are resolved at read time rather than stored in the payload**, so a character or an
 * Account that gets renamed does not leave the history calling somebody by a name they no longer
 * have. A missing profile reads as `null` rather than as a guess.
 *
 * **Validates: v3 Req 32.1, 32.3, 32.5, 37.5, 41.6**
 */

import { ROLL_EVENT, type RollLogPayload, type SessionRollListing } from '#shared/types/api';
import { requireMember } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { findAccountById } from '../../repositories/accountRepository';
import { latestEventsOfType } from '../../repositories/eventRepository';
import { charactersInSession } from '../../repositories/gameSessionRepository';
import { sessionIdFrom } from '../sessions/sessionPayloads';
import { toSessionRoll } from './rollPayloads';

/**
 * How much of the log one read answers
 *
 * A table's log is unbounded and a page of it is not, so this is a ceiling rather than a paging
 * story: LIVE-03 is the ticket that gives a client a cursor, and inventing one here would be an
 * option nothing passes.
 */
const LOG_LIMIT = 100;

/**
 * Whose rolls a request asked for, if it narrowed at all
 *
 * **`?rolledBy=` narrows in the query, before the cap.** The review found the alternative: the
 * server capping at the table's hundred most recent and the sheet filtering that window to one
 * character, so on a busy table a Player's own rolls dropped off their own sheet with nothing
 * saying so. Optional, because the *table's* log is what a Member reads and what DM-04 will render.
 */
function rolledByFrom(url: URL): string | null {
  return url.searchParams.get('rolledBy');
}

export const listRolls = defineHandler((context): SessionRollListing => {
  const sessionId = sessionIdFrom(context.url);
  requireMember(context, sessionId);

  const rows = latestEventsOfType(sessionId, ROLL_EVENT, rolledByFrom(context.url), LOG_LIMIT);

  // One lookup for the table rather than one per roll — a busy session's log is a hundred rolls
  // over a handful of characters
  const characterNames = new Map(
    charactersInSession(sessionId).map((character) => [character.id, character.name])
  );
  const accountNames = new Map<string, string | null>();

  return {
    rolls: rows.map((row) => {
      const payload = JSON.parse(row.payload) as RollLogPayload;

      if (row.actorAccountId !== null && !accountNames.has(row.actorAccountId)) {
        accountNames.set(row.actorAccountId, findAccountById(row.actorAccountId)?.name ?? null);
      }

      return toSessionRoll(row, payload, {
        // A character deleted since the roll keeps its roll in the log — the event is what happened,
        // and editing it is editing the past (`eventRepository`'s append-only rule)
        characterName: characterNames.get(payload.characterId) ?? 'A departed character',
        rolledBy:
          row.actorAccountId === null ? null : (accountNames.get(row.actorAccountId) ?? null),
      });
    }),
  };
});
