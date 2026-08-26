/**
 * `GET /api/invites/:code` — what am I about to join? (TICKET-GAM-02)
 *
 * The to-be asks that following a link while signed in **shows what is being joined before
 * joining**, and this is that. Somebody pasted a string into a group chat; the person clicking it
 * deserves to see the table's name before they are seated at it.
 *
 * **Thin on purpose.** The name and whether the game is still running — nothing about who is at it.
 * A code has not been redeemed yet, so a preview that listed the members would turn an unredeemed
 * invitation into a way to read a roster.
 *
 * **An Account is required**, which is not about protecting the name: it is that the client route is
 * protected, so a signed-out visitor is taken to sign-in and brought back (v3 Req 32.7), and a
 * public preview would be a second answer to *what happens when you follow a link signed out*.
 *
 * **Archived is a 200, not a refusal** — see `invitePayloads`. This page is where *the game has
 * ended* is a sentence to read rather than an error to decode; `redeemInvite` is where it refuses.
 *
 * **Validates: v3 Req 32.1, 38.1, 38.4**
 */

import type { InvitePreview } from '#shared/types/api';
import { requireAccount } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { inviteCodeFrom, isJoinable, resolveInviteFor } from './invitePayloads';

export const previewInvite = defineHandler((context): InvitePreview => {
  const account = requireAccount(context);

  // **Through the limiter, sharing `redeemInvite`'s buckets** (the GAM-02 review). A preview that
  // looked codes up unmetered would be an oracle over the same space: three distinguishable answers,
  // at whatever rate the process serves, with a single `POST` spent only on the hit.
  const { session } = resolveInviteFor(account.id, inviteCodeFrom(context.url), Date.now());

  return { sessionName: session.name, isJoinable: isJoinable(session) };
});
