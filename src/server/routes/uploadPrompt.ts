/**
 * `POST /api/account/upload-prompt` — the one unprompted offer an Account is owed (TICKET-IO-04)
 *
 * v3 Req 36.6 asks that the upload be offered **once** on an Account's first sign-in and never
 * again, while the action itself stays reachable from the ruleset list forever. Two facts, and only
 * the first of them needs somewhere to live.
 *
 * **A `POST` that claims rather than a `GET` that reports**, which is the design decision here. A
 * read followed by a write is a race two restored tabs win together, and being asked twice is
 * precisely the failure this requirement is about — so the claim is one `INSERT … ON CONFLICT DO
 * NOTHING` and the answer is whether it inserted. The client calls it once it knows there is an
 * Account, and acts on `true`.
 *
 * **Server-side rather than a LocalStorage flag**, for the reason the ticket gives: two Accounts on
 * one machine must each be asked, and a browser-side flag would be cleared by exactly the
 * housekeeping that makes people sign in fresh.
 *
 * **Validates: v3 Req 32.1, 36.6**
 */

import type { UploadPromptClaim } from '#shared/types/api';
import { requireAccount } from '../auth/guards';
import { defineHandler } from '../http/pipeline';
import { claimUploadPrompt } from '../repositories/accountPromptRepository';

export const uploadPrompt = defineHandler((context): UploadPromptClaim => {
  const account = requireAccount(context);

  return { shouldPrompt: claimUploadPrompt(account.id, Date.now()) };
});
