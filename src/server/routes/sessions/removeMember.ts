/**
 * `DELETE /api/sessions/:id/members/:accountId` — a seat is given up (TICKET-GAM-04)
 *
 * **Removing and leaving are one route, because they are one act with two actors** (v3 Req 39.3,
 * 39.5). What happens to the table is identical either way — the seat goes, the Characters stay —
 * and two routes would be two places for the retention rule to drift. What differs is only *who may
 * ask*, which is three lines here rather than a second file:
 *
 * - The **DM** may take any player's seat away.
 * - A **player** may give up their own, and nobody else's.
 * - The **DM may not take their own** (v3 Req 39.6). A table with no DM has nobody who can invite,
 *   archive or transfer, so the way out is `POST /api/sessions/:id/dm` first — and the refusal says
 *   so, because *no* without a next step is a dead end.
 *
 * **A player asking about somebody else's seat gets the same 404 a stranger gets**, not a 403: they
 * already know the session exists, but which refusal they meet should not depend on how much they
 * know (v3 Req 32.5).
 *
 * **The Characters are not touched, and that is the criterion rather than an omission.**
 * `removeSessionMember` deletes one `session_member` row and nothing else, so a departed Member's
 * Characters keep their `session_id` and their `owner_account_id` — readable by the remaining
 * Members, writable by nobody (`requireCharacterWriter`), and writable again by that Account the
 * moment they rejoin, with nothing to repair.
 *
 * **Allowed on an archived session.** `requireActive` is deliberately not called: leaving a game
 * that has ended is exactly the tidying-up somebody wants to do, and refusing it would be a rule
 * pointed the wrong way — the same reasoning `revokeInvite` records.
 *
 * **The seat going takes the live connections with it** (TICKET-LIVE-01, v3 Req 39.3). A socket is
 * admitted to a room because `requireMember` said so at subscribe time; once that stops being true
 * the room has somebody in it the guard would now refuse, and nothing would re-ask — a subscribe is
 * checked once. So the removal closes them here, in the same act, rather than leaving a connection
 * that outlives its own authorization.
 *
 * **…and it tells everybody else** (TICKET-LIVE-04, v3 Req 44.3). `evictMember` is one half of that
 * conversation and was never the whole of it: it tells the *removed* connection it lost the room and
 * tells nobody else that the roster changed. The Event is the other half, and the two are ordered —
 * the broadcast happens inside `recordEvent`, before the eviction, so the Member being removed is
 * told **why** their room closed rather than merely that it did.
 *
 * **Two Event types for one route** (v3 Req 39.3, 39.5). The write is identical either way and the
 * history is not: *the DM removed Bob* and *Bob left* are the same seat and different stories, and
 * the log is read by a person months later. The comparison that tells them apart is the same one the
 * authorization above already made.
 *
 * **Validates: v3 Req 32.1, 32.3, 32.5, 39.3, 39.5, 39.6, 44.3, 44.4**
 */

import type { MembershipEventPayload } from '#shared/types/api';
import { MEMBER_ROLE, SESSION_EVENT } from '#shared/types/api';
import { requireMember } from '../../auth/guards';
import { recordEvent } from '../../events/recordEvent';
import { conflict, notFound } from '../../http/appError';
import { defineHandler } from '../../http/pipeline';
import type { NewEvent } from '../../repositories/eventRepository';
import { findSessionMember, removeSessionMember } from '../../repositories/gameSessionRepository';
import { liveRooms } from '../../ws/rooms';
import { memberAccountIdFrom, sessionIdFrom } from './sessionPayloads';

/**
 * The handler is `removeMember` and the query it calls is `removeSessionMember`
 *
 * Two exports sharing one spelling is the duplicate `sessionPayloads.ts` records; the route takes
 * the shorter name, which it can afford inside a folder called `sessions/`.
 */
export const removeMember = defineHandler((context): undefined => {
  const sessionId = sessionIdFrom(context.url);
  const targetAccountId = memberAccountIdFrom(context.url);

  // The caller's own seat *is* the authorization, and it comes back carrying the role — so what
  // follows is three comparisons rather than three queries
  const asking = requireMember(context, sessionId);

  // A player may only ever be talking about themselves. Refused **before** the target is looked up,
  // so being refused says nothing about whether that Account is at this table.
  if (asking.role !== MEMBER_ROLE.DM && asking.accountId !== targetAccountId) {
    throw notFound();
  }

  const target = findSessionMember(sessionId, targetAccountId);

  if (!target) throw notFound();

  // Only ever the caller themselves — there is one DM per session by constraint — so this is the
  // DM trying to walk away from their own table (v3 Req 39.6)
  if (target.role === MEMBER_ROLE.DM) {
    throw conflict(
      'You run this game, so you cannot leave it. Hand it to another member first, or archive it ' +
        'if you are finished with it.'
    );
  }

  // Who gave the seat up says which of the two this was — the comparison the authorization above
  // already made, read a second time for a different question
  const isOwnSeat = asking.accountId === targetAccountId;
  const payload: MembershipEventPayload = { accountId: targetAccountId };

  const departure: NewEvent = {
    id: crypto.randomUUID(),
    sessionId,
    actorAccountId: asking.accountId,
    type: isOwnSeat ? SESSION_EVENT.MEMBER_LEFT : SESSION_EVENT.MEMBER_REMOVED,
    // The id and nothing else: a name written here would be a copy taken now, and a rename
    // afterwards would leave the log calling somebody by a name they no longer have
    payload: JSON.stringify(payload),
    now: Date.now(),
  };

  const recorded = recordEvent(departure, (append) =>
    removeSessionMember(sessionId, targetAccountId, append)
  );

  // The seat was there a moment ago, so this is another writer having taken it in between — the
  // same answer they would have got had they arrived a moment later
  if (!recorded) throw notFound();

  // After the row is gone, not before: if the delete threw, the connections were still entitled to
  // be where they are, and closing them first would have been a refusal nobody made
  const rooms = liveRooms();
  rooms.evictMember(sessionId, targetAccountId);

  // Nothing to say — the pipeline turns `undefined` into a 204
  return undefined;
});
