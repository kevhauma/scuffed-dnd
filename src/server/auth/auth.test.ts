/**
 * Accounts, Auth_Sessions and the refusals around them (TICKET-AUTH-01)
 *
 * These drive the **real** Better Auth handler over a real migrated database, through the same
 * `handleApiRequest` the server uses. Nothing here is mocked, which is the only way the criteria
 * that matter can be checked at all: that the stored credential is a hash rather than the password,
 * that a wrong password and an unknown email are byte-identical, and that a captured cookie stops
 * working after sign-out. Every one of those is a claim about the *library's* behaviour under our
 * configuration, and a mock would be asserting our own assumptions back at us.
 *
 * **Validates: v3 Req 30.1-30.7, 30.9, 32.1, 48.1**
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { authAccount, authSession, authUser } from '../db/authSchema';
import { handleApiRequest } from '../http/apiRouter';
import { defineHandler } from '../http/pipeline';
import { withTestDatabase } from '../testing';
import { resetSignInFailures } from './signInRateLimit';

const EMAIL = 'ada@example.com';
const PASSWORD = 'correct-horse-battery';

/**
 * A different client for every request, unless a test says otherwise
 *
 * Better Auth's own limiter keys on IP, and in a test environment it falls back to localhost for
 * *every* request — so without this the whole file is one client, and its default rule for
 * `/sign-up*` (three per ten seconds) refuses the fourth test in the file. That is an artifact of
 * having no network, not a property worth asserting around: in production these are separate
 * people. `x-forwarded-for` is the header it reads by default.
 *
 * It also makes the per-address cases below say something stronger than they otherwise could —
 * every attempt comes from a different address, so what refuses them is unambiguously the *email*
 * limit rather than a flood limit that happens to fire first.
 */
let clientNumber = 0;
function nextClientIp(): string {
  clientNumber += 1;
  return `10.0.${Math.floor(clientNumber / 250)}.${(clientNumber % 250) + 1}`;
}

/** A request at the app's own origin — there is never a second one (D1) */
function authRequest(path: string, body: unknown, ip: string): Request {
  return new Request(`http://localhost/api/auth${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

/** Ask the router and insist it claimed the path */
async function callAuth(
  path: string,
  body: unknown,
  options: { cookie?: string; ip?: string } = {}
): Promise<Response> {
  const request = authRequest(path, body, options.ip ?? nextClientIp());
  if (options.cookie) request.headers.set('cookie', options.cookie);

  const response = await handleApiRequest(request);
  if (!response) throw new Error(`POST /api/auth${path} was not claimed by the API router`);
  return response;
}

/** Sign up, and hand back the `Set-Cookie` value a browser would keep */
async function signUp(email = EMAIL, password = PASSWORD): Promise<Response> {
  return callAuth('/sign-up/email', { email, password, name: 'Ada' });
}

async function signIn(email = EMAIL, password = PASSWORD): Promise<Response> {
  return callAuth('/sign-in/email', { email, password });
}

/** The cookie header a browser would send back, taken from a `Set-Cookie` */
function cookieFrom(response: Response): string {
  const header = response.headers.get('set-cookie');
  if (!header) throw new Error('no Set-Cookie on that response');
  // One cookie is what we care about; `name=value` is everything before the first `;`
  return header.split(';')[0] as string;
}

beforeEach(() => {
  resetSignInFailures();
});

afterEach(() => {
  resetSignInFailures();
});

describe('sign-up', () => {
  it('creates an Account', () =>
    withTestDatabase(async (database) => {
      const response = await signUp();

      expect(response.status).toBe(200);
      const rows = database.db.select().from(authUser).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.email).toBe(EMAIL);
    }));

  it('stores the password as a salted hash and nowhere in the clear', () =>
    withTestDatabase(async (database) => {
      await signUp();

      const credential = database.db.select().from(authAccount).all()[0];

      // Read off the row rather than inspected by eye — v3 Req 30.3 is about what is *in the
      // database*, and the only way to know is to look
      expect(credential?.password).toBeTruthy();
      expect(credential?.password).not.toContain(PASSWORD);

      // …and nowhere else in the file either. A hash that happened to be stored beside a plaintext
      // copy on another table would pass the assertion above and fail the requirement.
      const everything = JSON.stringify([
        database.db.select().from(authUser).all(),
        database.db.select().from(authAccount).all(),
        database.db.select().from(authSession).all(),
      ]);
      expect(everything).not.toContain(PASSWORD);
    }));

  it('refuses a second sign-up on a registered email', () =>
    withTestDatabase(async (database) => {
      await signUp();

      const second = await signUp(EMAIL, 'a-different-password');

      expect(second.status).toBeGreaterThanOrEqual(400);
      expect(database.db.select().from(authUser).all()).toHaveLength(1);
    }));

  it('says nothing about how the existing account signs in', () =>
    withTestDatabase(async () => {
      await signUp();

      const body = await (await signUp(EMAIL, 'a-different-password')).text();

      // v3 Req 30.2: the refusal must not reveal whether that account has a password or a linked
      // identity, because that is a fact about somebody else
      for (const leak of ['password', 'credential', 'google', 'discord', 'provider']) {
        expect(body.toLowerCase(), `refusal mentions ${leak}`).not.toContain(leak);
      }
    }));

  it('signs the new Account in, so nobody types their password twice', () =>
    withTestDatabase(async (database) => {
      const response = await signUp();

      expect(response.headers.get('set-cookie')).toBeTruthy();
      expect(database.db.select().from(authSession).all()).toHaveLength(1);
    }));
});

describe('sign-in', () => {
  it('issues an Auth_Session for the right password', () =>
    withTestDatabase(async (database) => {
      await signUp();

      const response = await signIn();

      expect(response.status).toBe(200);
      // Two: one from sign-up, one from this
      expect(database.db.select().from(authSession).all()).toHaveLength(2);
    }));

  it('answers a wrong password and an unknown email identically', () =>
    withTestDatabase(async () => {
      await signUp();

      const wrongPassword = await signIn(EMAIL, 'not-the-password');
      const unknownEmail = await signIn('nobody@example.com', PASSWORD);

      // v3 Req 30.6, and the byte-identical half of it: same status, same body. Anything less and
      // the sign-in form is an oracle for which addresses are registered.
      expect(wrongPassword.status).toBe(unknownEmail.status);
      expect(await wrongPassword.text()).toBe(await unknownEmail.text());
    }));

  it('spends comparable time on an unknown email as on a wrong password', () =>
    withTestDatabase(async () => {
      await signUp();

      /** The median of three, so one scheduling hiccup does not decide the result */
      const median = async (run: () => Promise<unknown>): Promise<number> => {
        const samples: number[] = [];
        for (let sample = 0; sample < 3; sample += 1) {
          const started = performance.now();
          await run();
          samples.push(performance.now() - started);
        }
        return samples.sort((a, b) => a - b)[1] as number;
      };

      const wrongPassword = await median(() => signIn(EMAIL, 'not-the-password'));
      const unknownEmail = await median(() => signIn('nobody@example.com', PASSWORD));

      // The second half of v3 Req 30.6, and the half no assertion about *bodies* can reach. Better
      // Auth hashes against a dummy credential when the address is unknown, so both paths pay for
      // one argon2 hash; without it an unknown address would return in a couple of milliseconds
      // against a hundred-odd, and the sign-in form would be an enumeration oracle whatever its
      // body said. The bound is deliberately loose — a tenth of the time, not a tenth of a
      // percent — because what would break this is the dummy hash *disappearing* in an upgrade,
      // which is a hundred-fold difference, not a subtle one. `authSchema.test.ts` is the
      // precedent: assert the library's behaviour rather than cite it.
      expect(unknownEmail).toBeGreaterThan(wrongPassword / 10);
    }));

  it('does not set a session cookie on a failure', () =>
    withTestDatabase(async (database) => {
      await signUp();

      const failed = await signIn(EMAIL, 'not-the-password');

      expect(failed.headers.get('set-cookie')).toBeNull();
      // Still only sign-up's
      expect(database.db.select().from(authSession).all()).toHaveLength(1);
    }));
});

describe('the sign-in limit, end to end', () => {
  it('refuses an address that has spent its attempts, without checking the password', () =>
    withTestDatabase(async () => {
      await signUp();

      // Enough wrong guesses to spend the budget. `serverEnv()`'s documented default is 5 and the
      // suite runs at it — the limiter's own arithmetic is `signInRateLimit.test.ts`'s subject.
      let last = await signIn(EMAIL, 'wrong');
      for (let attempt = 1; attempt < 6; attempt += 1) last = await signIn(EMAIL, 'wrong');

      expect(last.status).toBe(429);
      expect(last.headers.get('retry-after')).toBeTruthy();

      // And the **right** password is refused too, which is what "without checking" means: the
      // limit is on the address, so it cannot be walked past by finally guessing correctly
      expect((await signIn()).status).toBe(429);
    }));

  it('counts an attempt before it is tried, so a burst cannot outrun the limit', () =>
    withTestDatabase(async () => {
      await signUp();

      // The case a check-then-act limiter gets wrong: every one of these reads the counter before
      // any of them has finished, so counting on the way *out* would give all twelve a password
      // check. Counting on the way in means at most MAX are tried.
      const attempts = await Promise.all(Array.from({ length: 12 }, () => signIn(EMAIL, 'wrong')));

      const refusedWithoutTrying = attempts.filter((response) => response.status === 429).length;
      expect(refusedWithoutTrying).toBeGreaterThanOrEqual(12 - 5);
    }));

  it('says which code it refused with, at the top level the client reads', () =>
    withTestDatabase(async () => {
      await signUp();
      for (let attempt = 0; attempt < 6; attempt += 1) await signIn(EMAIL, 'wrong');

      const body = (await (await signIn(EMAIL, 'wrong')).json()) as {
        code?: string;
        message?: string;
      };

      // Not wrapped in `{ error: … }`: Better Auth serialises its own refusals flat and the client
      // spreads them into `result.error`, so a nested key would leave `result.error.message`
      // undefined — and somebody locked out for fifteen minutes would be told to check their
      // details. Shape asserted here because no test crosses that boundary otherwise.
      expect(body.code).toBe('TOO_MANY_ATTEMPTS');
      expect(body.message).toMatch(/too many sign-in attempts/i);
    }));

  it('leaves the library’s own flood limit on for everything it does not own', () =>
    withTestDatabase(async () => {
      // The per-address limit covers `/sign-in/email` and nothing else, so `rateLimit` stays
      // **enabled** and carves that one path out rather than being switched off. Without this
      // assertion, "we turned the library's limiter off because ours is better" would silently mean
      // sign-up, password reset and every AUTH-02 OAuth route have no flood protection at all.
      //
      // One client, so the IP-keyed limit applies. Better Auth's default for `/sign-up*` is three
      // per ten seconds.
      const ip = '203.0.113.7';
      const attempts: number[] = [];
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await callAuth(
          '/sign-up/email',
          { email: `flood-${attempt}@example.com`, password: PASSWORD, name: 'Flood' },
          { ip }
        );
        attempts.push(response.status);
      }

      expect(attempts).toContain(429);
    }));

  it('does not apply that flood limit to sign-in, which the address limit owns', () =>
    withTestDatabase(async () => {
      await signUp();

      // The carve-out. Four wrong guesses from *one* client would trip the library's three-per-ten
      // rule if it still applied here, and the fourth would be a 429 from the wrong limiter — which
      // is precisely the ambiguity that made an earlier draft turn the library's limiter off
      // wholesale. `AUTH_SIGNIN_MAX_ATTEMPTS` is 5, so four attempts stay under our own limit too.
      const ip = '203.0.113.8';
      const statuses: number[] = [];
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const response = await callAuth(
          '/sign-in/email',
          { email: EMAIL, password: 'wrong' },
          { ip }
        );
        statuses.push(response.status);
      }

      expect(statuses).not.toContain(429);
    }));

  it('is not bypassed by a trailing slash on the sign-in path', () =>
    withTestDatabase(async () => {
      await signUp();
      for (let attempt = 0; attempt < 6; attempt += 1) await signIn(EMAIL, 'wrong');

      const response = await callAuth('/sign-in/email/', { email: EMAIL, password: PASSWORD });

      // Better Auth 404s a trailing-slash mismatch rather than routing it, so the variant reaches
      // no sign-in handler at all. Asserted rather than assumed: if it ever *did* route, this path
      // would skip our limiter, which only matches the exact pathname.
      expect(response.status).not.toBe(200);
    }));

  it('does not limit a different address', () =>
    withTestDatabase(async () => {
      await signUp();
      await signUp('grace@example.com');

      for (let attempt = 0; attempt < 6; attempt += 1) await signIn(EMAIL, 'wrong');

      expect((await signIn('grace@example.com')).status).toBe(200);
    }));

  it('forgets an address that signs in successfully', () =>
    withTestDatabase(async () => {
      await signUp();

      // One short of the limit, then a success
      for (let attempt = 0; attempt < 4; attempt += 1) await signIn(EMAIL, 'wrong');
      expect((await signIn()).status).toBe(200);

      // …and the budget is whole again rather than one away from locking them out
      for (let attempt = 0; attempt < 4; attempt += 1) await signIn(EMAIL, 'wrong');
      expect((await signIn()).status).toBe(200);
    }));
});

describe('the Auth_Session cookie', () => {
  it('is HttpOnly, SameSite-restricted and given an explicit expiry', () =>
    withTestDatabase(async () => {
      const header = (await signUp()).headers.get('set-cookie') ?? '';

      // v3 Req 30.4 — HttpOnly is what keeps it out of any client-readable store
      expect(header.toLowerCase()).toContain('httponly');
      expect(header.toLowerCase()).toContain('samesite');
      // v3 Req 48.1 — an expiry that outlives the browser process, so closing the tab does not
      // sign you out. A session cookie would have neither of these.
      expect(header.toLowerCase()).toMatch(/max-age|expires/);
    }));

  it('is not Secure in development, because a dev server is plain HTTP', () =>
    withTestDatabase(async () => {
      const header = (await signUp()).headers.get('set-cookie') ?? '';

      // A Secure cookie over http:// is a cookie the browser drops silently, which reads as "sign
      // in does nothing". Production sets it — see `authServer.ts`.
      expect(header.toLowerCase()).not.toContain('secure');
    }));
});

describe('the request context', () => {
  /** A route that reports who the pipeline decided was asking */
  const whoAmI = defineHandler((context) => ({ account: context.account?.id ?? null }));

  it('resolves a signed-in Account from the cookie', () =>
    withTestDatabase(async () => {
      const cookie = cookieFrom(await signUp());

      const response = await whoAmI(
        new Request('http://localhost/api/whoami', { headers: { cookie } })
      );

      expect((await response.json()).account).toEqual(expect.any(String));
    }));

  it('resolves nobody when there is no cookie', () =>
    withTestDatabase(async () => {
      const response = await whoAmI(new Request('http://localhost/api/whoami'));

      expect((await response.json()).account).toBeNull();
    }));

  it('resolves nobody for a cookie that does not verify', () =>
    withTestDatabase(async () => {
      await signUp();

      const response = await whoAmI(
        new Request('http://localhost/api/whoami', {
          headers: { cookie: 'better-auth.session_token=forged.value' },
        })
      );

      // A forged cookie is *nobody*, not a 500 — the visitor with no session is the normal case
      expect(response.status).toBe(200);
      expect((await response.json()).account).toBeNull();
    }));
});

describe('sign-out', () => {
  it('invalidates the Auth_Session server-side, so a captured cookie stops working', () =>
    withTestDatabase(async (database) => {
      const cookie = cookieFrom(await signUp());
      const whoAmI = defineHandler((context) => ({ account: context.account?.id ?? null }));

      // It works before
      const before = await whoAmI(
        new Request('http://localhost/api/whoami', { headers: { cookie } })
      );
      expect((await before.json()).account).toEqual(expect.any(String));

      await callAuth('/sign-out', {}, { cookie });

      // …and replaying the *same* cookie afterwards is nobody. Tested by replay rather than by
      // checking the client was told to clear it, which proves nothing about a stolen copy.
      const after = await whoAmI(
        new Request('http://localhost/api/whoami', { headers: { cookie } })
      );
      expect((await after.json()).account).toBeNull();
      expect(database.db.select().from(authSession).all()).toHaveLength(0);
    }));
});

describe('the mail-dependent flows', () => {
  it('does not gate sign-in behind an address nobody can verify', () =>
    withTestDatabase(async () => {
      await signUp();

      // D12: `requireEmailVerification` is false, so a fresh Account can sign in immediately. If it
      // were true, every Account would be permanently locked out — there is no verification email.
      expect((await signIn()).status).toBe(200);
    }));

  it('refuses a password reset rather than pretending to send one', () =>
    withTestDatabase(async () => {
      await signUp();

      const response = await callAuth('/forget-password', {
        email: EMAIL,
        redirectTo: 'http://localhost/',
      });

      // The surface must not exist rather than silently do nothing (D12). Better Auth refuses
      // because no `sendResetPassword` is configured; what matters is that it does not answer 200.
      expect(response.status).toBeGreaterThanOrEqual(400);
    }));
});
