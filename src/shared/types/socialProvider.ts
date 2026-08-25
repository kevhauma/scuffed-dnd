/**
 * Which identity providers this application knows (TICKET-AUTH-02)
 *
 * **In the Kernel because both roots name the same two strings.** The server reads
 * `GOOGLE_CLIENT_ID` and configures Better Auth with `google`; the client renders *Continue with
 * Google* and posts `provider: 'google'`. A second copy of that set in `client/` would be a set
 * that drifts, and the boundary
 * ([D14](../../../docs/v3.0_backend/overview.md#d14--three-roots-client-server-shared)) says a rule
 * both sides need lives here.
 *
 * **It is a closed set of two, not a registry.** Better Auth already owns the *n*-provider layer,
 * and v3 Req 31.7 asks for a shared **rule path**, not a plugin system — so this is the vocabulary
 * and nothing else. What each provider is *called* on a button is presentation and stays in the
 * component that renders it.
 *
 * **Validates: v3 Req 31.1, 31.7**
 */

/** The providers a visitor may sign in with, when the operator has configured them */
export const SOCIAL_PROVIDER = {
  GOOGLE: 'google',
  DISCORD: 'discord',
} as const;

export type SocialProvider = (typeof SOCIAL_PROVIDER)[keyof typeof SOCIAL_PROVIDER];

/**
 * Both providers, in the order a surface should offer them
 *
 * Derived from {@link SOCIAL_PROVIDER} rather than written twice, so adding a third provider is one
 * edit. Google first because it is the one most visitors already have; Discord second because it is
 * the one this application's audience is most likely to *want* (D3).
 */
export const SOCIAL_PROVIDERS: readonly SocialProvider[] = Object.values(SOCIAL_PROVIDER);

/**
 * Whether a string names a provider this build knows
 *
 * The narrowing the client needs when it reads the configured list off the wire: what arrives is
 * `string[]`, and anything not in the set is a provider this build cannot render a button for.
 *
 * @param value Anything
 * @returns True when it is one of {@link SOCIAL_PROVIDERS}
 */
export function isSocialProvider(value: unknown): value is SocialProvider {
  return typeof value === 'string' && SOCIAL_PROVIDERS.includes(value as SocialProvider);
}
