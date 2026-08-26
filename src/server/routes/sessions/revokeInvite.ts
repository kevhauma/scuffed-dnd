/**
 * `DELETE /api/sessions/:id/invite` — take the code back (TICKET-GAM-02)
 *
 * The half of revoke-and-reissue that stands on its own: a DM who wants the code to stop working and
 * does *not* want a replacement — a link that reached the wrong group chat, or a table that has
 * finished recruiting.
 *
 * **Allowed on an archived session**, which is the one write that is. `requireActive` is not called
 * here, deliberately: archiving already refuses every redemption, so revoking afterwards changes
 * nothing about who can join — and refusing it would mean a DM who archived a game first can never
 * invalidate the link they posted publicly. A rule that stops somebody tidying up after themselves
 * is a rule pointed the wrong way.
 *
 * **Answers 204 whether or not there was anything to revoke.** The DM asked for there to be no live
 * code; afterwards there is none. Reporting *there was nothing to take back* would be reporting the
 * state before their request rather than after it.
 *
 * **Validates: v3 Req 32.1, 32.3, 32.5, 38.2**
 */

import { requireDM } from '../../auth/guards';
import { notFound } from '../../http/appError';
import { defineHandler } from '../../http/pipeline';
import { findGameSession } from '../../repositories/gameSessionRepository';
import { revokeSessionInvites } from '../../repositories/sessionInviteRepository';
import { sessionIdFrom } from './sessionPayloads';

export const revokeInvite = defineHandler((context): undefined => {
  const sessionId = sessionIdFrom(context.url);
  requireDM(context, sessionId);

  const row = findGameSession(sessionId);
  if (!row) throw notFound();

  revokeSessionInvites(sessionId, Date.now());

  // Nothing to say — the pipeline turns `undefined` into a 204
  return undefined;
});
