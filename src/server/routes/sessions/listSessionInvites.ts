/**
 * `GET /api/sessions/:id/invitations` — who this table has written to (TICKET-GAM-03)
 *
 * **The DM's outbox, including the invitations that are over.** A list of only the pending ones
 * would make *they declined* look identical to *I never invited them*, and those are the two facts a
 * DM is actually deciding between when they wonder whether to ask somebody again (v3 Req 38.4).
 *
 * **The DM's alone.** A player who could read it would learn every address the DM has written to,
 * which is other people's contact details rather than the table's business — and it is the same
 * reason `readSession` hands the shared code to the DM only.
 *
 * **It does not ride on `GET /api/sessions/:id` the way the shared code does**, and that asymmetry
 * is deliberate. The code is one string and part of *what a DM sees when they look at their table*;
 * this is an unbounded list that grows for the life of the game, and putting it on the session read
 * would make every player's page load carry a query written for one person.
 *
 * **Validates: v3 Req 32.1, 32.3, 32.5, 38.4**
 */

import type { AddressedInviteListing } from '#shared/types/api';
import { requireDM } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { listAddressedInvites } from '../../repositories/sessionInviteRepository';
import { toAddressedInvite } from '../invitations/invitationPayloads';
import { sessionIdFrom } from './sessionPayloads';

export const listSessionInvites = defineHandler((context): AddressedInviteListing => {
  const sessionId = sessionIdFrom(context.url);
  requireDM(context, sessionId);

  const now = Date.now();

  // **Readable on an archived session**, like every other read: archiving refuses writes, and a
  // record of who was invited is exactly the sort of thing a finished game is still worth having
  return { invites: listAddressedInvites(sessionId).map((row) => toAddressedInvite(row, now)) };
});
