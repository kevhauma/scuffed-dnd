/**
 * `POST /api/invitations/:id/accept` — take the seat you were offered (TICKET-GAM-03)
 *
 * `redeemInvite`'s addressed twin, and the differences are the whole of what an *addressed*
 * invitation is:
 *
 * - **There is no code and no limiter**, because there is nothing to guess. `requireInvitee` matches
 *   the row's address against the one this Account registered, so holding the id is not enough — the
 *   thing that would make a rate limiter necessary is the thing this route does not have.
 * - **It is used up.** A shared code seats everybody who types it; this one seats one person, and
 *   `redeemInviteById` stamps the row in the same statement that checks it was still pending.
 *
 * **Accepting twice succeeds, and answers `joined: false`** — v3 Req 38.8, and the same rule
 * `redeemInvite` follows for a code. A first draft of this route refused it with a 409 on the
 * reasoning that an addressed invitation is *spent* by the first acceptance, which is true of the
 * row and beside the point for the person: they clicked twice, they are at the table, and telling
 * them *no* about the thing that already worked is exactly the *you are not welcome* reading GAM-02
 * was careful to avoid. The requirement says so in as many words, and the requirement is right.
 *
 * **Only for the Account that redeemed it.** `requireInvitee` has already matched the address, so
 * the only other Account that could reach this line is one that registered the same address after
 * the first redeemed it — and they are told the invitation is used up rather than seated on
 * somebody else's acceptance.
 *
 * **Declined, revoked and expired are three different refusals**, not one (v3 Req 38.4).
 *
 * **Validates: v3 Req 32.1, 32.5, 37.5, 38.3, 38.4, 38.8**
 */

import type { InviteRedemption } from '#shared/types/api';
import { MEMBER_ROLE } from '#shared/types/api';
import { requireAccount, requireInvitee } from '../../auth/guards';
import { notFound } from '../../http/appError';
import { defineHandler } from '../../http/pipeline';
import { findGameSession, seatSessionMember } from '../../repositories/gameSessionRepository';
import { redeemInviteById } from '../../repositories/sessionInviteRepository';
import { requireJoinable } from '../invites/invitePayloads';
import { toSessionSummary } from '../sessions/sessionPayloads';
import { invitationIdFrom, settledRefusal } from './invitationPayloads';

export const acceptInvitation = defineHandler((context): InviteRedemption => {
  const account = requireAccount(context);
  // The guard *is* the authorization: it refuses a missing id, a shared code and anybody the letter
  // is not addressed to, all with the same 404 (v3 Req 32.5)
  const invite = requireInvitee(context, invitationIdFrom(context.url));

  const session = findGameSession(invite.sessionId);

  // A live invitation whose session is gone should be impossible — the row cascades with it — so
  // this is the same 404 an unaddressed id gets rather than a 500 about our own schema
  if (!session) throw notFound();

  // **Before the row is spent**, so a DM who archived the game has not also burned the invitation
  requireJoinable(session);

  const now = Date.now();
  const claimed = redeemInviteById(invite.id, account.id, now);

  // Not pending any more. If **this** Account is the one that took it, that is v3 Req 38.8 and the
  // answer is the membership they already have; anything else is one of the three refusals.
  if (!claimed && invite.redeemedByAccountId !== account.id) throw settledRefusal(invite, now);

  const seat = seatSessionMember({
    id: crypto.randomUUID(),
    session,
    accountId: account.id,
    role: MEMBER_ROLE.PLAYER,
    now,
  });

  return { session: toSessionSummary(session, seat.membership.role), joined: seat.joined };
});
