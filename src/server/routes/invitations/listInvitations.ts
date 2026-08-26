/**
 * `GET /api/invitations` — what is waiting for me (TICKET-GAM-03)
 *
 * **The first route in the app scoped to an Account rather than to a ruleset or a session**, and
 * that is the whole of D12's delivery mechanism: nothing is sent anywhere, and the letter is here
 * when the person it was addressed to next looks.
 *
 * **Scoped by the caller's address, so there is no id to guard** — `listRulesets` and
 * `listSessions` are the precedent, and the scoping is the repository's `WHERE email = ?` rather
 * than a filter applied after a broader read.
 *
 * **Keyed on the address rather than on the account id**, which is what makes v3 Req 38.6 work with
 * no second mechanism: an invitation sent before this Account existed is found by the same query the
 * moment it does, because it was never bound to an account in the first place.
 *
 * **An Account with no registered identity gets an empty list rather than a refusal.** That should
 * be impossible — the cookie names a `user` row — but *nothing is waiting for you* is the honest
 * answer to the question that was asked, and a 500 about our own tables is not.
 *
 * **Validates: v3 Req 32.1, 38.5, 38.6, 38.7**
 */

import type { PendingInvitationListing } from '#shared/types/api';
import { requireAccount } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { findAccountById } from '../../repositories/accountRepository';
import { listPendingInvitationsFor } from '../../repositories/sessionInviteRepository';

export const listInvitations = defineHandler((context): PendingInvitationListing => {
  const account = requireAccount(context);
  const identity = findAccountById(account.id);

  if (!identity) return { invitations: [] };

  return { invitations: listPendingInvitationsFor(identity.email, Date.now()) };
});
