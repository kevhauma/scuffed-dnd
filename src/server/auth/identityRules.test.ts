/**
 * The shared identity rules, as one table (TICKET-AUTH-02)
 *
 * v3 Req 31.7's real content is *the two providers cannot diverge*, and the cheapest honest proof
 * is a table run once per provider against the same function. That is this file for the rules
 * themselves; [`socialSignIn.test.ts`](./socialSignIn.test.ts) runs the same shape end to end
 * through the real handler, where the *outcome* of a refusal can be observed rather than its
 * return value.
 *
 * **Validates: v3 Req 31.2, 31.4, 31.7**
 */

import { describe, expect, it } from 'vitest';
import { SOCIAL_PROVIDERS } from '#shared/types/socialProvider';
import { IDENTITY_REFUSAL, refuseIdentity } from './identityRules';

describe('refuseIdentity', () => {
  describe.each(SOCIAL_PROVIDERS)('for %s', (providerId) => {
    it('lets a verified address through', () => {
      expect(
        refuseIdentity({ providerId, email: 'ada@example.com', emailVerified: true })
      ).toBeNull();
    });

    it('refuses an unverified address (v3 Req 31.4)', () => {
      // The rule the whole linking decision rests on: without it, anyone able to set an arbitrary
      // unverified address on a provider account could claim somebody's password Account
      expect(
        refuseIdentity({ providerId, email: 'ada@example.com', emailVerified: false })
      ).toEqual(expect.objectContaining({ error: IDENTITY_REFUSAL.EMAIL_UNVERIFIED }));
    });

    it('refuses an address the provider said nothing about, rather than assuming it is fine', () => {
      // A provider that stops sending the flag must fail closed — `!== true`, not `!falsy`
      expect(refuseIdentity({ providerId, email: 'ada@example.com' })).toEqual(
        expect.objectContaining({ error: IDENTITY_REFUSAL.EMAIL_UNVERIFIED })
      );
    });

    it.each([
      ['absent', undefined],
      ['null', null],
      ['blank', '   '],
    ])('refuses a profile whose email is %s (v3 Req 31.4)', (_label, email) => {
      // Discord's `identify` scope alone returns a profile with no email at all, which is why this
      // is a case of its own rather than a variation of "unverified"
      expect(refuseIdentity({ providerId, email, emailVerified: true })).toEqual(
        expect.objectContaining({ error: IDENTITY_REFUSAL.EMAIL_MISSING })
      );
    });

    it('says something a person could act on, not only a code', () => {
      const refusal = refuseIdentity({ providerId, email: null, emailVerified: true });

      expect(refusal?.errorDescription.length ?? 0).toBeGreaterThan(20);
    });
  });

  it('has nothing to say about an identity no provider asserted', () => {
    // Email/password sign-up runs through this same gate, and v3 Req 30 already decided that path.
    // A second opinion here would be a second place to change it — and would refuse every
    // password Account, since D12 means none is ever email-verified.
    expect(refuseIdentity({ email: 'ada@example.com', emailVerified: false })).toBeNull();
    expect(refuseIdentity({ email: null, emailVerified: false })).toBeNull();
  });

  it('refuses on a provider it has never heard of, rather than only the two it knows', () => {
    // Keyed on "a provider said so", not on the provider list. A rule keyed on the list is a rule
    // that forgets the third provider on the day someone adds one.
    expect(refuseIdentity({ providerId: 'github', email: 'ada@example.com' })).toEqual(
      expect.objectContaining({ error: IDENTITY_REFUSAL.EMAIL_UNVERIFIED })
    );
  });
});
