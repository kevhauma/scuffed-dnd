/**
 * Which providers this deployment offers, and how Better Auth is told (TICKET-AUTH-02)
 *
 * **Two providers configured side by side is data; an abstraction for *n* providers is a
 * framework** — and Better Auth already owns that layer. So this module is a translation from
 * `env.ts`'s credential map into the block `betterAuth` takes, plus the list the sign-in surface
 * asks for. There is no registry, no plugin shape and no `register(provider)` call.
 *
 * **Each provider is independently optional** (v3 Req 31.6). An absent pair leaves that key off
 * the object entirely rather than passing empty strings, because Better Auth treats a configured
 * provider with a blank client id as a broken one rather than an absent one — and the visible
 * difference is a button that exists and fails.
 *
 * What is *not* here is the identity rule. Creating, linking and refusing live in
 * [`identityRules.ts`](./identityRules.ts) as one path both providers run through, which is what
 * v3 Req 31.7 asks for — a shared rule, not a shared plugin.
 *
 * **Validates: v3 Req 31.1, 31.6, 31.8**
 */

import { SOCIAL_PROVIDERS, type SocialProvider } from '#shared/types/socialProvider';
import type { ServerEnv } from '../env';

/** What one provider is handed to Better Auth as */
interface ProviderBlock {
  clientId: string;
  clientSecret: string;
}

/**
 * The providers an operator has actually configured, in offer order
 *
 * The one thing the client is told about this module — `/api/auth-providers` returns exactly this,
 * and it is names only: a provider id is public the moment its button is on the page.
 *
 * @param env The resolved environment
 * @returns The configured providers, possibly none
 */
export function configuredSocialProviders(env: ServerEnv): SocialProvider[] {
  return SOCIAL_PROVIDERS.filter((provider) => env.socialProviders[provider] !== null);
}

/**
 * The `socialProviders` block for `betterAuth`
 *
 * **PKCE is not configured here because it is not optional in this library** — Better Auth's Google
 * provider throws without a `codeVerifier`, and both providers go through the same
 * authorization-code exchange (v3 Req 31.1). Writing a flag for it would suggest there is a way to
 * turn it off.
 *
 * @param env The resolved environment
 * @returns One key per configured provider, and no key at all for an absent one
 */
export function socialProviderConfig(
  env: ServerEnv
): Partial<Record<SocialProvider, ProviderBlock>> {
  const config: Partial<Record<SocialProvider, ProviderBlock>> = {};

  for (const provider of configuredSocialProviders(env)) {
    const credentials = env.socialProviders[provider];
    if (credentials) config[provider] = { ...credentials };
  }

  return config;
}
