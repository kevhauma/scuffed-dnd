/**
 * `POST /api/sessions/:id/invitations` — write to one address (TICKET-GAM-03)
 *
 * **A real delivery mechanism that sends no email** (D12). The DM types an address, a row is
 * written, and the Account holding that address sees it the next time it looks. Nothing leaves this
 * process; there is no SMTP configuration, no provider account and no mail port, and there never
 * will be under this decision.
 *
 * **The address is an address book, not a transport.** That is what makes v3 Req 38.6 fall out for
 * free rather than needing a mechanism: nobody has to hold the address today. The row is keyed on
 * the string, and whoever registers it inside the invitation's lifetime finds it waiting.
 *
 * ## The three answers that are not "a new invitation"
 *
 * - **They are already at the table** — a 409 that says so (GAM-03's sixth criterion). Minting an
 *   invitation for somebody who is already a Member would be an invitation that can never be
 *   meaningfully accepted, and a DM who sees it pending forever would reasonably think it had not
 *   arrived.
 * - **They already have a pending one** — the existing row, not a second one. Two live invitations
 *   to one address is one the invitee will decline and one they will not see, and neither of those
 *   is what the DM pressing the button twice meant.
 * - **They declined, or it expired, or it was taken back** — a new row, because those are all
 *   settled and *ask me again next week* is a thing a table does. That is why the duplicate check
 *   is on **pending** rather than on the address.
 *
 * **The DM's alone** (v3 Req 38.1's rule, one invitation kind over), and refused on an archived
 * session through the same `requireActive` every other write uses.
 *
 * **Validates: v3 Req 32.1, 32.3, 32.5, 37.5, 38.3, 38.5, 38.6**
 */

import type { AddressedInvite, AddressedInviteRequest } from '#shared/types/api';
import { requireDM } from '../../auth/guards';
import { badRequest, conflict, notFound } from '../../http/appError';
import { defineHandler } from '../../http/pipeline';
import { findAccountByEmail, normalizeEmailAddress } from '../../repositories/accountRepository';
import { findGameSession, findSessionMember } from '../../repositories/gameSessionRepository';
import {
  insertAddressedInvite,
  pendingInviteFor,
} from '../../repositories/sessionInviteRepository';
import { toAddressedInvite } from '../invitations/invitationPayloads';
import { INVITE_LIFETIME_MS } from '../invites/invitePayloads';
import { requireActive, sessionIdFrom } from './sessionPayloads';

/**
 * The shape an address has to have before it is worth storing
 *
 * **Deliberately the weakest check that is still a check.** The RFC's grammar admits quoted local
 * parts, comments and addresses with no dot in the domain; a regular expression that tried to be
 * right would reject real addresses, which is a worse failure than accepting a typo — nothing is
 * sent, so an unusable address costs a row that expires rather than a bounce. What this catches is
 * the empty box and the obviously-not-an-address, which is what a DM actually mistypes.
 */
const ADDRESS_SHAPE = /^[^\s@]+@[^\s@]+$/;

/**
 * The address a request asked to invite, in the form comparisons are made in
 *
 * @param body What the DM sent
 * @returns The normalised address
 * @throws {AppError} 400 when there is nothing address-shaped in it
 */
function emailFrom(body: AddressedInviteRequest): string {
  const email = typeof body?.email === 'string' ? normalizeEmailAddress(body.email) : '';

  if (!ADDRESS_SHAPE.test(email)) {
    throw badRequest('An invitation needs an email address to be addressed to.');
  }

  return email;
}

export const inviteByEmail = defineHandler(async (context): Promise<AddressedInvite> => {
  const sessionId = sessionIdFrom(context.url);
  requireDM(context, sessionId);

  const row = findGameSession(sessionId);
  if (!row) throw notFound();

  requireActive(row);

  const email = emailFrom(await context.json<AddressedInviteRequest>());
  const now = Date.now();

  // **Only when somebody holds the address.** An unregistered one cannot be a Member, and asking
  // would be a lookup with one possible answer (v3 Req 38.6).
  const holder = findAccountByEmail(email);

  if (holder && findSessionMember(sessionId, holder.id)) {
    throw conflict(`${email} is already at this table, so there is nothing to invite them to.`);
  }

  // Idempotent by intent rather than by constraint: a DM pressing the button twice gets the same
  // invitation back, which is what they meant both times
  const existing = pendingInviteFor(sessionId, email, now);

  if (existing) return toAddressedInvite(existing, now);

  const invite = insertAddressedInvite({
    id: crypto.randomUUID(),
    sessionId,
    email,
    expiresAt: now + INVITE_LIFETIME_MS,
    now,
  });

  return toAddressedInvite(invite, now);
});
