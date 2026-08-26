/**
 * `POST /api/invitations/:id/decline` — no, thank you (TICKET-GAM-03)
 *
 * **Declining is a recorded outcome, not a dismissal** (v3 Req 38.4). The invitee stops seeing it
 * and the DM sees `declined` — distinct from an invitation that expired, which says nothing about
 * whether anybody read it, and from one the DM took back, which was their own decision. That
 * distinction is the whole reason this route exists rather than the client simply hiding the card.
 *
 * **The same address may be invited again afterwards.** A declined row is settled, so it no longer
 * counts as the pending one, and the DM's next invitation to that address is a new row rather than a
 * refusal — which is what makes *ask me again next week* a thing a table can do.
 *
 * **Allowed on an archived session**, deliberately, and it is the second write in the milestone that
 * is (`revokeInvite` is the first). Tidying up after a game that has ended is not something to
 * refuse: an invitation to a table nobody can join is exactly the one an invitee wants off their
 * list.
 *
 * **Validates: v3 Req 32.1, 32.5, 38.4, 38.7**
 */

import { requireInvitee } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { declineInvite } from '../../repositories/sessionInviteRepository';
import { invitationIdFrom, settledRefusal } from './invitationPayloads';

export const declineInvitation = defineHandler((context): undefined => {
  const invite = requireInvitee(context, invitationIdFrom(context.url));

  const now = Date.now();

  // Stamped only if it was still pending, so declining something already accepted is the 409 that
  // says *you are at that table* rather than a silent no-op
  if (!declineInvite(invite.id, now)) throw settledRefusal(invite, now);

  // Nothing to say — the pipeline turns `undefined` into a 204
  return undefined;
});
