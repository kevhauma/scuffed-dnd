/**
 * `POST /api/account/upload-prompt` (TICKET-IO-04)
 *
 * One rule, and the whole file is about proving it holds under the conditions that would break a
 * read-then-write: v3 Req 36.6's *once per Account, and never again*.
 *
 * **The concurrency case is the one worth reading.** Two tabs restoring the same session ask at the
 * same moment, and the failure it guards against is being prompted twice on the one occasion the
 * requirement is about. Firing the calls in parallel and counting the `true`s is the only shape that
 * can catch it — sequential calls pass whether the claim is atomic or not.
 *
 * **Validates: v3 Req 32.1, 36.6**
 */

import { describe, expect, it } from 'vitest';
import type { UploadPromptClaim } from '#shared/types/api';
import { type CallOptions, callRoute, seedAccount, withTestDatabase } from '../testing';
import { uploadPrompt } from './uploadPrompt';

/** Claim the prompt as somebody */
function claim(as: CallOptions['as']) {
  return callRoute<UploadPromptClaim>(uploadPrompt, {
    as,
    method: 'POST',
    path: '/api/account/upload-prompt',
    body: {},
  });
}

describe('POST /api/account/upload-prompt', () => {
  it('refuses an anonymous caller', () =>
    withTestDatabase(async () => {
      expect((await claim(null)).status).toBe(401);
    }));

  it('offers the prompt to an Account that has never been asked', () =>
    withTestDatabase(async () => {
      const response = await claim(seedAccount());

      expect(response.status).toBe(200);
      expect(response.body.shouldPrompt).toBe(true);
    }));

  it('never offers it again to that Account', () =>
    withTestDatabase(async () => {
      const account = seedAccount();

      expect((await claim(account)).body.shouldPrompt).toBe(true);
      expect((await claim(account)).body.shouldPrompt).toBe(false);
      expect((await claim(account)).body.shouldPrompt).toBe(false);
    }));

  it('asks each Account on the same machine separately', () =>
    withTestDatabase(async () => {
      const first = seedAccount();
      const second = seedAccount();

      expect((await claim(first)).body.shouldPrompt).toBe(true);
      // The second Account has its own claim to make — a browser-side flag would have swallowed it
      expect((await claim(second)).body.shouldPrompt).toBe(true);
      expect((await claim(first)).body.shouldPrompt).toBe(false);
    }));

  it('hands the offer to exactly one of two calls made at once', () =>
    withTestDatabase(async () => {
      const account = seedAccount();

      const answers = await Promise.all([claim(account), claim(account), claim(account)]);

      expect(answers.filter(({ body }) => body.shouldPrompt)).toHaveLength(1);
    }));
});
