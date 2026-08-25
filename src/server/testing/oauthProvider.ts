/**
 * A provider that is not there, answering as if it were (TICKET-AUTH-02)
 *
 * v3 Req 31.7 asks that both providers obey the same rules, and the only way to *prove* that is to
 * run the same table through both — which means driving a real authorization-code exchange for
 * each, against endpoints that do not exist. So this stubs the two calls the callback makes and
 * nothing else:
 *
 * | Provider | Token endpoint | Profile |
 * |---|---|---|
 * | Google | `oauth2.googleapis.com/token` | the `id_token`'s own claims, decoded |
 * | Discord | `discord.com/api/oauth2/token` | `discord.com/api/users/@me` |
 *
 * **It replaces `globalThis.fetch`, which is what `betterFetch` resolves per call.** No module
 * mocking, so the code under test is the shipped code — and an *unexpected* URL throws rather than
 * returning something plausible, because a test that silently reached the real internet is a test
 * that will fail on a train.
 *
 * **The Google id_token is unsigned on purpose.** Its callback path calls `decodeJwt`, which reads
 * claims without verifying a signature — signature verification belongs to the separate id-token
 * sign-in route, which this application does not use. A fixture that minted a real RS256 token
 * would be asserting `jose` works.
 *
 * **Validates: v3 Req 31.1, 31.7, 45.3**
 */

import { SOCIAL_PROVIDER, type SocialProvider } from '#shared/types/socialProvider';

/** What a provider says about the person who just signed in */
export interface ProviderProfile {
  /** The provider's own subject id — the thing an identity is bound by */
  id: string;
  /** Absent or null models a Discord profile with no email at all (v3 Req 31.4) */
  email?: string | null;
  emailVerified: boolean;
  name?: string;
}

/** The endpoints each provider is answered on, so nothing is spelled twice */
const ENDPOINTS: Record<SocialProvider, { token: string; profile?: string }> = {
  [SOCIAL_PROVIDER.GOOGLE]: { token: 'https://oauth2.googleapis.com/token' },
  [SOCIAL_PROVIDER.DISCORD]: {
    token: 'https://discord.com/api/oauth2/token',
    profile: 'https://discord.com/api/users/@me',
  },
};

/** Base64url without padding, which is what a JWT segment is */
function base64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

/**
 * An id_token carrying the claims Google's `getUserInfo` reads
 *
 * @param profile What the provider is pretending to know
 * @returns A structurally valid, deliberately unsigned JWT
 */
function idToken(profile: ProviderProfile): string {
  const header = base64Url(JSON.stringify({ alg: 'RS256', kid: 'test', typ: 'JWT' }));
  const claims = base64Url(
    JSON.stringify({
      sub: profile.id,
      email: profile.email ?? undefined,
      email_verified: profile.emailVerified,
      name: profile.name ?? 'Test Person',
    })
  );
  return `${header}.${claims}.not-a-signature`;
}

/** What a Discord profile response looks like, as much of it as the provider reads */
function discordProfile(profile: ProviderProfile): Record<string, unknown> {
  return {
    id: profile.id,
    username: profile.name ?? 'test-person',
    global_name: profile.name ?? 'Test Person',
    discriminator: '0',
    // **Set rather than null on purpose.** Discord's provider computes a *default* avatar from
    // `BigInt(profile.id)`, which requires a numeric snowflake — so a null avatar would force every
    // fixture id in this suite to be a number, and `discord-subject-1` in a failure message is
    // worth more than realism about a picture nothing here looks at.
    avatar: 'a-test-avatar',
    email: profile.email ?? null,
    verified: profile.emailVerified,
  };
}

/** A JSON response, the way an OAuth endpoint would give one */
function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

/** The token-endpoint answer for one provider */
function tokenResponse(provider: SocialProvider, profile: ProviderProfile): Response {
  return json({
    access_token: `access-token-for-${profile.id}`,
    token_type: 'Bearer',
    expires_in: 3600,
    scope: 'identify email',
    // Google reads the profile straight out of this; Discord ignores it and is asked separately
    ...(provider === SOCIAL_PROVIDER.GOOGLE ? { id_token: idToken(profile) } : {}),
  });
}

/**
 * Run something with one provider's endpoints answering
 *
 * ```ts
 * await withStubbedProvider(SOCIAL_PROVIDER.DISCORD, { id: 'd-1', email: 'a@b.c', emailVerified: true },
 *   () => signInThrough(SOCIAL_PROVIDER.DISCORD));
 * ```
 *
 * @param provider Which provider is being impersonated
 * @param profile What it claims about the person
 * @param run What to do while it is answering; may be sync or async, and its value is returned
 * @returns Whatever `run` returned
 */
export function withStubbedProvider<T>(
  provider: SocialProvider,
  profile: ProviderProfile,
  run: () => T
): T {
  const endpoints = ENDPOINTS[provider];
  const original = globalThis.fetch;

  globalThis.fetch = ((input: RequestInfo | URL): Promise<Response> => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    // Decoded before matching: betterFetch normalises the URL, and Discord's profile endpoint comes
    // through as `/users/%40me`. Matching the encoded spelling would work today and break the day
    // it stops encoding.
    const url = decodeURIComponent(raw);

    if (url.startsWith(endpoints.token)) return Promise.resolve(tokenResponse(provider, profile));
    if (endpoints.profile && url.startsWith(endpoints.profile)) {
      return Promise.resolve(json(discordProfile(profile)));
    }

    // Loud rather than plausible: a request to anywhere else means the flow changed shape, and
    // answering it with a 404 would surface three layers later as "unable to get user info"
    return Promise.reject(
      new Error(`No provider stub for ${url}. withStubbedProvider only answers ${provider}.`)
    );
  }) as typeof fetch;

  /** Put the real one back, on both the success and the failure path */
  const release = () => {
    globalThis.fetch = original;
  };

  let result: T;
  try {
    result = run();
  } catch (error) {
    release();
    throw error;
  }

  // Same shape as `withTestDatabase`: an async body has not finished when `run` returns, and
  // restoring `fetch` here would pull the stub out from under it
  if (result instanceof Promise) {
    return result.then(
      (value) => {
        release();
        return value;
      },
      (error: unknown) => {
        release();
        throw error;
      }
    ) as T;
  }

  release();
  return result;
}
