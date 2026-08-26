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
 * **Validates: v3 Req 32.1, 32.3, 32.5, 39.3, 39.5, 39.6**
 */

import { MEMBER_ROLE } from '#shared/types/api';
import { requireMember } from '../../auth/guards';
import { conflict, notFound } from '../../http/appError';
import { defineHandler } from '../../http/pipeline';
import { findSessionMember, removeSessionMember } from '../../repositories/gameSessionRepository';
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

  removeSessionMember(sessionId, targetAccountId);

  // Nothing to say — the pipeline turns `undefined` into a 204
  return undefined;
});
