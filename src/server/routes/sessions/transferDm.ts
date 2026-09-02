/**
 * `POST /api/sessions/:id/dm` — hand the table over (TICKET-GAM-04)
 *
 * **The role moves; the Account does not leave.** After a transfer the outgoing DM is a `player` at
 * the same table with the same characters (v3 Req 39.4) — which is what makes this the way out of
 * `removeSessionMember`'s refusal rather than a separate favour.
 *
 * **One transaction over three rows**, and the ordering inside it is load-bearing rather than
 * stylistic: `session_member_one_dm` is a **partial unique index** allowing one `dm` row per
 * session, so the demotion has to land before the promotion. A failure anywhere rolls the whole
 * thing back to exactly one DM, which is the criterion — there is no window in which a table has
 * two DMs or none.
 *
 * **The incoming DM must already be a Member.** Promoting a stranger would be an invitation wearing
 * a different name, and invitations have two routes of their own with two different sets of rules
 * about who may take one up.
 *
 * **Refused on an archived session** through the same `requireActive` every other write uses: a game
 * that has ended has nothing left to run.
 *
 * **The fourth write in that transaction is the Event** (TICKET-LIVE-04, v3 Req 44.3). Every other
 * Member's roster draws the DM's badge from the member listing, so a handover nobody was told about
 * leaves that badge on the wrong person until they reload — and the badge is what says who may act.
 *
 * **Validates: v3 Req 32.1, 32.3, 32.5, 37.5, 39.2, 39.4, 44.3, 44.4**
 */

import type {
  DmTransferEventPayload,
  GameSessionSummary,
  TransferDmRequest,
} from '#shared/types/api';
import { MEMBER_ROLE, SESSION_EVENT } from '#shared/types/api';
import { requireDM } from '../../auth/guards';
import { recordEvent } from '../../events/recordEvent';
import { badRequest, conflict, notFound } from '../../http/appError';
import { defineHandler } from '../../http/pipeline';
import type { NewEvent } from '../../repositories/eventRepository';
import {
  findGameSession,
  findSessionMember,
  transferDungeonMaster,
} from '../../repositories/gameSessionRepository';
import { requireActive, sessionIdFrom, toSessionSummary } from './sessionPayloads';

/** Who a request asked to hand the table to, or a refusal */
function recipientFrom(body: TransferDmRequest): string {
  if (typeof body?.accountId !== 'string' || body.accountId === '') {
    throw badRequest('Handing a game over needs somebody to hand it to.');
  }

  return body.accountId;
}

export const transferDm = defineHandler(async (context): Promise<GameSessionSummary> => {
  const sessionId = sessionIdFrom(context.url);
  const asking = requireDM(context, sessionId);

  const row = findGameSession(sessionId);
  if (!row) throw notFound();

  requireActive(row);

  const recipient = recipientFrom(await context.json<TransferDmRequest>());

  // **A 409 rather than a 404**, and it is the one refusal here that names something: the caller is
  // the DM, so they already know who is at their own table — `GET .../members` told them. What
  // refuses this is the state of the request, and a bare *not found* would leave them guessing
  // whether the id was wrong or the person had left.
  if (recipient === asking.accountId) {
    throw conflict('You already run this game.');
  }

  if (!findSessionMember(sessionId, recipient)) {
    throw conflict(
      'That person is not at this table, so the game cannot be handed to them. Invite them first.'
    );
  }

  const now = Date.now();

  // **Both ids, and no name** — the rule every payload on this log keeps. Both, rather than the
  // incoming DM alone, because a reader applying this moves two rows and should not have to infer
  // one of them from the list it is patching.
  const payload: DmTransferEventPayload = {
    accountId: recipient,
    previousAccountId: asking.accountId,
  };

  const handover: NewEvent = {
    id: crypto.randomUUID(),
    sessionId,
    actorAccountId: asking.accountId,
    type: SESSION_EVENT.DM_TRANSFERRED,
    payload: JSON.stringify(payload),
    now,
  };

  // The row **as the transaction left it**, not the one read above: that one still names the old DM
  // and carries the old `updated_at`, and answering with it would put a stale summary on the wire
  const recorded = recordEvent(handover, (append) =>
    transferDungeonMaster(sessionId, asking.accountId, recipient, now, append)
  );

  // The caller's own role, which is what they now hold: they stayed at the table and became a player
  return toSessionSummary(recorded.written, MEMBER_ROLE.PLAYER);
});
