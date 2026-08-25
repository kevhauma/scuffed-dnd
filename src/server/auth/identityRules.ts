/**
 * The one rule path both providers run through (TICKET-AUTH-02)
 *
 * v3 Req 31.7 asks that every identity rule be applied through **one** provider-agnostic code path,
 * so that Google and Discord cannot drift apart. This is that path, and it is a pure function of
 * the incoming identity — no library types, no database, no request — which is what lets
 * [`identityRules.test.ts`](./identityRules.test.ts) run the same table for both providers instead
 * of two files that agree today.
 *
 * ## What is ours to decide, and what is not
 *
 * Better Auth already refuses an identity that is **bound to a different Account** and already
 * matches a verified provider email onto an existing Account (v3 Req 31.3, 31.5) — those are
 * mechanics, and D3 chose the library precisely so we would not hand-roll them.
 *
 * What it does *not* do is refuse an **unverified** provider email on a *first* sign-in. Its own
 * check fires only when linking onto an Account that already exists, so a profile with an
 * unverified address would happily create a brand-new Account. That is the gap this closes, and it
 * matters because linking-on-matching-email is a trust decision resting entirely on the provider
 * having verified the address: without this, anyone able to set an arbitrary unverified email on a
 * provider account could later claim a password Account with it (v3 Req 31.4).
 *
 * **Discord can also carry no email at all** — the `identify` scope alone returns a profile without
 * one — which is why "absent" is a case of its own rather than a variation of "unverified".
 *
 * **Email/password is deliberately none of this function's business.** It is asked about every
 * incoming identity, including a password sign-up, and it answers `null` for anything no provider
 * asserted: v3 Req 30 already decided that path, and a second opinion here would be a second place
 * to change it. That is also why the check is *"a provider said so"* rather than *"the provider is
 * Google or Discord"* — a rule keyed on the provider list is a rule that forgets the third one.
 *
 * **Validates: v3 Req 31.2, 31.4, 31.7**
 */

/** Why an identity was turned away — machine-readable, and the client may see it */
export const IDENTITY_REFUSAL = {
  /** The provider profile carried no email address */
  EMAIL_MISSING: 'provider_email_missing',
  /** It carried one the provider has not verified */
  EMAIL_UNVERIFIED: 'provider_email_unverified',
} as const;

export type IdentityRefusalCode = (typeof IDENTITY_REFUSAL)[keyof typeof IDENTITY_REFUSAL];

/** A refusal, in the shape Better Auth's `validateUserInfo` gate returns */
export interface IdentityRefusal {
  error: IdentityRefusalCode;
  errorDescription: string;
}

/** What a refusal says out loud, for a person reading it on a redirect */
const REFUSAL_DESCRIPTION: Record<IdentityRefusalCode, string> = {
  [IDENTITY_REFUSAL.EMAIL_MISSING]:
    'That account did not share an email address, and an email address is how accounts here are ' +
    'identified. Add one to your provider account, or sign up with an email and password.',
  [IDENTITY_REFUSAL.EMAIL_UNVERIFIED]:
    'That account’s email address has not been verified with the provider. Verify it there and ' +
    'try again.',
};

/**
 * An identity arriving from somewhere, as much of it as the rules read
 *
 * Structural rather than imported from Better Auth, so a library upgrade that reshapes its context
 * is an adapter change in `authServer.ts` rather than a rewritten rule.
 */
export interface IncomingIdentity {
  /** Which provider asserted this, or `undefined` when none did (email/password, and the like) */
  providerId?: string | undefined;
  email?: string | null | undefined;
  emailVerified?: boolean | null | undefined;
}

/**
 * Whether to turn an incoming identity away
 *
 * @param identity What arrived
 * @returns The refusal, or `null` to let it through
 */
export function refuseIdentity(identity: IncomingIdentity): IdentityRefusal | null {
  // Not asserted by a provider, so not this rule's business — see the module note
  if (!identity.providerId) return null;

  if (typeof identity.email !== 'string' || identity.email.trim() === '') {
    return refusal(IDENTITY_REFUSAL.EMAIL_MISSING);
  }

  // `!== true` rather than falsy: an absent flag is an *unverified* address, not a verified one,
  // and a provider that stops sending the field must fail closed
  if (identity.emailVerified !== true) return refusal(IDENTITY_REFUSAL.EMAIL_UNVERIFIED);

  return null;
}

/** A code, with the words that go with it */
function refusal(error: IdentityRefusalCode): IdentityRefusal {
  return { error, errorDescription: REFUSAL_DESCRIPTION[error] };
}
