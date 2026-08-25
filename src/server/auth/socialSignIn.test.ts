/**
 * Social sign-in, driven end to end for both providers (TICKET-AUTH-02)
 *
 * These run the **real** authorization-code flow — `sign-in/social`, then the callback, through the
 * same `handleApiRequest` the server uses, against a real migrated database — with only the
 * provider's two HTTP endpoints stubbed (see
 * [`testing/oauthProvider.ts`](../testing/oauthProvider.ts)). Nothing about Better Auth is mocked,
 * because every claim worth making here is a claim about what the library does *under our
 * configuration*: that an unverified address creates nothing, that a verified one lands on the
 * Account that already owns it, that a bound identity does not move.
 *
 * **The per-provider block is `describe.each`, and that is v3 Req 31.7 rather than tidiness.** The
 * requirement is that Google and Discord cannot diverge; a file per provider would let them, on the
 * afternoon somebody fixes one of the two.
 *
 * **Validates: v3 Req 31.1-31.7**
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  SOCIAL_PROVIDER,
  SOCIAL_PROVIDERS,
  type SocialProvider,
} from '#shared/types/socialProvider';
import { authAccount, authUser } from '../db/authSchema';
import { providerVariables } from '../env';
import { handleApiRequest } from '../http/apiRouter';
import {
  type Database,
  type ProviderProfile,
  withStubbedProvider,
  withTestDatabase,
} from '../testing';
import { resetSignInFailures } from './signInRateLimit';

/**
 * Configure both providers before anything reads the environment
 *
 * `serverEnv()` resolves lazily on the first call and caches, and nothing calls it at import time —
 * so a top-level assignment here lands before the first request and after the imports above.
 *
 * **What keeps this out of the other files is Vitest's process isolation, not its module registry.**
 * The registry resets `serverEnv()`'s cache per file; `process.env` is process-scoped and would
 * leak. The guarantee is `vitest.config.ts` leaving `pool` and `isolate` at their defaults — a
 * forked worker per file — and it is worth naming because turning either off would make
 * `apiRouter.test.ts`'s *reports no providers when the deployment has configured none* pass alone
 * and fail in a full run, which is the worst shape a flake comes in.
 *
 * `localhost` because a `Request` built from `http://localhost/...` carries no `host` header and
 * Better Auth falls back to the URL's own host.
 */
process.env.AUTH_ALLOWED_HOSTS = 'localhost';
for (const provider of SOCIAL_PROVIDERS) {
  const names = providerVariables(provider);
  process.env[names.id] = `${provider}-client-id`;
  process.env[names.secret] = `${provider}-client-secret`;
}

const PASSWORD = 'correct-horse-battery';

/** Where a successful flow lands — relative, because there is only ever one origin (D1) */
const AFTER_SIGN_IN = '/';

/**
 * A different client per request
 *
 * Better Auth's own limiter keys on IP and its default `/sign-in*` rule is three requests per ten
 * seconds — which `/sign-in/social` matches. In a test environment every request resolves to
 * localhost, so without this the fourth flow in the file is refused by a limiter that has nothing
 * to do with what is being asserted. In production these are separate people.
 */
let clientNumber = 0;
function nextClientIp(): string {
  clientNumber += 1;
  return `10.1.${Math.floor(clientNumber / 250)}.${(clientNumber % 250) + 1}`;
}

/**
 * The cookies a browser would be holding, carried by hand
 *
 * **A flow needs more than the session cookie**, and finding that out is worth writing down:
 * `sign-in/social` sets a signed **state** cookie beside the state it puts in the authorization
 * URL, and the callback refuses — `State not persisted correctly` — if the two do not agree. It is
 * a CSRF binding, so a test that skipped it would be testing a flow no browser performs. A jar,
 * rather than one header, because a link adds a session cookie to the state one.
 *
 * @param existing What is already held, as a `Cookie` header value
 * @param response Whatever the server just set
 * @returns The merged `Cookie` header
 */
function withCookies(existing: string, response: Response): string {
  const jar = new Map<string, string>();

  for (const pair of [
    ...(existing === '' ? [] : existing.split('; ')),
    ...response.headers.getSetCookie().map((header) => header.split(';')[0] as string),
  ]) {
    const separator = pair.indexOf('=');
    if (separator > 0) jar.set(pair.slice(0, separator), pair.slice(separator + 1));
  }

  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
}

/** Ask the router, and insist it claimed the path */
async function callAuth(
  path: string,
  init: { method?: string; body?: unknown; cookies?: string } = {}
): Promise<Response> {
  const request = new Request(`http://localhost/api/auth${path}`, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': nextClientIp(),
      ...(init.cookies ? { cookie: init.cookies } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  const response = await handleApiRequest(request);
  if (!response) throw new Error(`${path} was not claimed by the API router`);
  return response;
}

/** What a step of a flow leaves behind */
interface FlowStep {
  response: Response;
  cookies: string;
}

/** The opaque state Better Auth put in the authorization URL, which the callback is checked against */
function stateFrom(url: string): string {
  const state = new URL(url).searchParams.get('state');
  if (!state) throw new Error(`no state in the authorization URL: ${url}`);
  return state;
}

/** Start a flow and hand back the state the callback needs, plus the cookie that binds it */
async function beginFlow(
  path: string,
  provider: SocialProvider,
  cookies: string
): Promise<{ state: string; cookies: string }> {
  const response = await callAuth(path, {
    body: { provider, callbackURL: AFTER_SIGN_IN },
    cookies,
  });
  const body = (await response.json()) as { url?: string };
  if (!body.url) throw new Error(`${path} gave no authorization URL: ${JSON.stringify(body)}`);
  return { state: stateFrom(body.url), cookies: withCookies(cookies, response) };
}

/** Come back from the provider, with that provider answering */
async function completeFlow(
  provider: SocialProvider,
  state: string,
  profile: ProviderProfile,
  cookies: string
): Promise<FlowStep> {
  const response = await withStubbedProvider(provider, profile, () =>
    callAuth(`/callback/${provider}?code=a-test-code&state=${encodeURIComponent(state)}`, {
      method: 'GET',
      cookies,
    })
  );

  return { response, cookies: withCookies(cookies, response) };
}

/** A whole sign-in, from the button to the cookie */
async function signInThrough(
  provider: SocialProvider,
  profile: ProviderProfile,
  cookies = ''
): Promise<FlowStep> {
  const begun = await beginFlow('/sign-in/social', provider, cookies);
  return completeFlow(provider, begun.state, profile, begun.cookies);
}

/** A whole link, from an already-signed-in Account */
async function linkThrough(
  provider: SocialProvider,
  profile: ProviderProfile,
  cookies: string
): Promise<FlowStep> {
  const begun = await beginFlow('/link-social', provider, cookies);
  return completeFlow(provider, begun.state, profile, begun.cookies);
}

/** Create a password Account, and hand back the cookies it was signed in with */
async function signUpWithPassword(email: string): Promise<string> {
  const response = await callAuth('/sign-up/email', {
    body: { email, password: PASSWORD, name: email },
  });
  if (response.status !== 200) throw new Error(`sign-up failed: ${await response.text()}`);
  return withCookies('', response);
}

/**
 * What a callback response means
 *
 * Every outcome is a redirect — that is what an OAuth callback *is* — so success and refusal are
 * told apart by where it points. A refusal carries `error` on the query string of the error URL;
 * a success goes to the `callbackURL` the flow started with.
 */
function outcomeOf(response: Response): { ok: boolean; error: string | null; location: string } {
  const location = response.headers.get('location') ?? '';
  const error = location.includes('?')
    ? new URL(location, 'http://localhost').searchParams.get('error')
    : null;
  return { ok: error === null && location.endsWith(AFTER_SIGN_IN), error, location };
}

/** Every user row, for the tests that assert nothing was created */
function users(database: Database): (typeof authUser.$inferSelect)[] {
  return database.db.select().from(authUser).all();
}

/** Every stored credential and provider identity */
function accounts(database: Database): (typeof authAccount.$inferSelect)[] {
  return database.db.select().from(authAccount).all();
}

beforeEach(() => {
  resetSignInFailures();
});

describe.each(SOCIAL_PROVIDERS)('signing in with %s', (provider) => {
  const email = `ada-${provider}@example.com`;
  const verified: ProviderProfile = {
    id: `${provider}-subject-1`,
    email,
    emailVerified: true,
    name: 'Ada Lovelace',
  };

  it('creates exactly one Account from the verified profile (v3 Req 31.2)', () =>
    withTestDatabase(async (database) => {
      const { response } = await signInThrough(provider, verified);

      expect(outcomeOf(response)).toMatchObject({ ok: true });

      const rows = users(database);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.email).toBe(email);
      expect(rows[0]?.name).toBe('Ada Lovelace');

      // One provider identity, bound to that Account and to the provider's own subject id
      const identities = accounts(database);
      expect(identities).toHaveLength(1);
      expect(identities[0]).toMatchObject({ providerId: provider, accountId: verified.id });
    }));

  it('signs the same Account back in on a second visit rather than making another', () =>
    withTestDatabase(async (database) => {
      await signInThrough(provider, verified);
      await signInThrough(provider, verified);

      expect(users(database)).toHaveLength(1);
      expect(accounts(database)).toHaveLength(1);
    }));

  it('links onto an existing password Account with the same address (v3 Req 31.3)', () =>
    withTestDatabase(async (database) => {
      await signUpWithPassword(email);

      const { response } = await signInThrough(provider, verified);
      expect(outcomeOf(response)).toMatchObject({ ok: true });

      // **One Account, two ways in.** This is the criterion D12 makes load-bearing: with no
      // password reset, linking a provider is the only way back into an Account whose password is
      // gone — so a second Account here would be a lost one.
      const rows = users(database);
      expect(rows).toHaveLength(1);

      const identities = accounts(database);
      expect(identities).toHaveLength(2);
      expect(identities.map((row) => row.providerId).sort()).toEqual(
        [provider, 'credential'].sort()
      );
      expect(new Set(identities.map((row) => row.userId))).toEqual(new Set([rows[0]?.id]));
    }));

  it('refuses an unverified address, creating no Account (v3 Req 31.4)', () =>
    withTestDatabase(async (database) => {
      const { response } = await signInThrough(provider, { ...verified, emailVerified: false });

      expect(outcomeOf(response).ok).toBe(false);
      expect(users(database)).toHaveLength(0);
      expect(accounts(database)).toHaveLength(0);
    }));

  it('refuses a profile with no email at all, creating no Account (v3 Req 31.4)', () =>
    withTestDatabase(async (database) => {
      const { response } = await signInThrough(provider, { ...verified, email: null });

      expect(outcomeOf(response).ok).toBe(false);
      expect(users(database)).toHaveLength(0);
      expect(accounts(database)).toHaveLength(0);
    }));

  it('refuses to link an unverified address onto an Account that already exists', () =>
    withTestDatabase(async (database) => {
      const cookies = await signUpWithPassword(email);

      const { response } = await linkThrough(
        provider,
        { ...verified, emailVerified: false },
        cookies
      );

      expect(outcomeOf(response).ok).toBe(false);
      // The password credential and nothing else — the provider identity was not written
      expect(accounts(database).map((row) => row.providerId)).toEqual(['credential']);
    }));
});

describe('one Account holding both identities (v3 Req 31.5)', () => {
  const email = 'grace@example.com';
  const google: ProviderProfile = {
    id: 'google-subject-2',
    email,
    emailVerified: true,
    name: 'Grace Hopper',
  };
  const discord: ProviderProfile = { ...google, id: 'discord-subject-2' };

  it('signs in with Google, links Discord, and signs in with Discord to the same Account', () =>
    withTestDatabase(async (database) => {
      const first = await signInThrough(SOCIAL_PROVIDER.GOOGLE, google);

      const linked = await linkThrough(SOCIAL_PROVIDER.DISCORD, discord, first.cookies);
      expect(outcomeOf(linked.response)).toMatchObject({ ok: true });

      // The whole of the requirement: coming back through the *other* provider reaches the same
      // Account, which is what makes both identities a recovery path rather than two accounts
      const again = await signInThrough(SOCIAL_PROVIDER.DISCORD, discord);
      expect(outcomeOf(again.response)).toMatchObject({ ok: true });

      const rows = users(database);
      expect(rows).toHaveLength(1);
      expect(
        accounts(database)
          .map((row) => row.providerId)
          .sort()
      ).toEqual(['discord', 'google']);
    }));
});

describe('an identity already bound to another Account (v3 Req 31.5)', () => {
  it('is refused rather than moved', () =>
    withTestDatabase(async (database) => {
      // Ada signs in with Google and owns that identity
      const owner: ProviderProfile = {
        id: 'google-subject-3',
        email: 'ada@example.com',
        emailVerified: true,
        name: 'Ada',
      };
      await signInThrough(SOCIAL_PROVIDER.GOOGLE, owner);
      const ada = users(database)[0];

      // Grace holds a separate password Account. The provider profile then arrives claiming
      // *Grace's* address while carrying Ada's subject id — the shape a takeover would have, and
      // the only way this door is reachable, since two Accounts cannot share an email.
      const grace = await signUpWithPassword('grace@example.com');
      const moved: ProviderProfile = { ...owner, email: 'grace@example.com' };

      const attempt = await linkThrough(SOCIAL_PROVIDER.GOOGLE, moved, grace);
      expect(outcomeOf(attempt.response).ok).toBe(false);

      // Still Ada's, and Grace gained nothing but the credential she signed up with
      const identities = accounts(database);
      expect(identities.find((row) => row.accountId === owner.id)?.userId).toBe(ada?.id);
      expect(identities).toHaveLength(2);
    }));
});
