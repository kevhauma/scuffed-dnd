/**
 * `DELETE /api/invitations/:id` — the DM takes one letter back (TICKET-GAM-03)
 *
 * **Per-invitation, which is the thing GAM-02 deliberately did not build.** The shared code is
 * revoked wholesale — `DELETE /api/sessions/:id/invite` — because there is only ever one of it. An
 * addressed invitation is one person, so taking it back is about one row, and doing it must leave
 * the session's code and every other pending letter working (GAM-03's fifth criterion).
 * `revokeInviteById` works by id and `revokeSessionInvites` filters `email IS NULL`, so neither can
 * reach the other's rows.
 *
 * **Guarded by the DM of the invitation's own session**, not by an id in the path — the path names
 * an invitation, and which table it belongs to is the row's business rather than the caller's claim.
 * `requireAccount` runs **first** so an anonymous caller is refused before any lookup happens
 * (v3 Req 32.5); everything after that is the same 404.
 *
 * **Answers 204 whether or not there was anything live to take back**, which is `revokeInvite`'s
 * rule and is right for the same reason: the DM asked for that invitation not to be open, and
 * afterwards it is not. Reporting *there was nothing to revoke* would report the state before their
 * request rather than after it — and a declined or expired row is deliberately **left saying so**
 * rather than restamped `revoked`, because *they turned you down* is the more useful of the two
 * facts and overwriting it would lose it (v3 Req 38.4).
 *
 * **Allowed on an archived session**, matching `revokeInvite` for its reason: archiving already
 * refuses every acceptance, so revoking afterwards changes nothing about who can join — and a rule
 * that stops a DM tidying up after themselves is a rule pointed the wrong way.
 *
 * **Validates: v3 Req 32.1, 32.3, 32.5, 38.4**
 */

import { requireAccount, requireDM } from '../../auth/guards';
import { notFound } from '../../http/appError';
import { defineHandler } from '../../http/pipeline';
import { findSessionInvite, revokeInviteById } from '../../repositories/sessionInviteRepository';
import { invitationIdFrom } from './invitationPayloads';

export const revokeInvitation = defineHandler((context): undefined => {
  // 401 before any lookup, so being refused says nothing about whether the id names anything
  requireAccount(context);

  const invite = findSessionInvite(invitationIdFrom(context.url));

  // The same 404 a non-DM gets: from outside, an id that names nothing and one that names somebody
  // else's table are one fact
  if (!invite) throw notFound();

  // **A shared code is not this route's to take back**, and `findSessionInvite` returns either kind
  // by design. Without this, handing a DM's own session-code row id to this path would close the
  // table's door through the addressed route — the exact crossing GAM-03's fifth criterion is about,
  // and the mirror of `requireInvitee` refusing a shared code on the way in. The id never crosses
  // the wire today, which makes this defence in depth rather than a patch; it is one line, and the
  // day some listing grows an id is the day it would have stopped being true.
  if (invite.email === null) throw notFound();

  requireDM(context, invite.sessionId);

  revokeInviteById(invite.id, Date.now());

  // Nothing to say — the pipeline turns `undefined` into a 204
  return undefined;
});
