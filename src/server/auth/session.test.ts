/**
 * Auth_Session lifetimes, renewal and revocation, end to end (TICKET-AUTH-04)
 *
 * **The clock is driven, not waited on.** Every claim here is about something that happens after
 * days or months — an idle session ageing out, an active one hitting its ceiling, an identifier
 * rotating — so `vi.useFakeTimers({ toFake: ['Date'] })` moves time and the real Better Auth
 * handler runs against a real migrated database at whatever moment it is told. Only `Date` is
 * faked: faking timers as well would suspend the promises this file `await`s.
 *
 * Criterion 3's *"asserted by driving the clock, so 'renew forever' cannot pass"* is the reason the
 * file exists in this shape rather than as a set of assertions about configuration values.
 *
 * **Validates: v3 Req 48.1-48.7**
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authSession } from '../db/authSchema';
import { handleApiRequest } from '../http/apiRouter';
import type { Database } from '../testing';
import { withTestDatabase } from '../testing';
import { resetSignInFailures } from './signInRateLimit';

const EMAIL = 'ada@example.com';
const PASSWORD = 'correct-horse-battery';

/** The documented defaults this file is written against — see `.env.example` */
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const IDLE_DAYS = 30;
const ABSOLUTE_DAYS = 90;
const GRACE_SECONDS = 30;

/** A fixed moment to start from, so a failure reads as a date rather than as "today" */
const SIGNED_IN_AT = new Date('2026-01-01T00:00:00.000Z');

/** A different client per request, for the reason `auth.test.ts` records */
let clientNumber = 0;
function nextClientIp(): string {
  clientNumber += 1;
  return `10.2.${Math.floor(clientNumber / 250)}.${(clientNumber % 250) + 1}`;
}

/** Ask the router, and insist it claimed the path */
async function callAuth(
  path: string,
  init: { method?: string; body?: unknown; cookie?: string } = {}
): Promise<Response> {
  const request = new Request(`http://localhost/api/auth${path}`, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': nextClientIp(),
      ...(init.cookie ? { cookie: init.cookie } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  const response = await handleApiRequest(request);
  if (!response) throw new Error(`${path} was not claimed by the API router`);
  return response;
}

/** The whole `Set-Cookie` header, attributes and all */
function setCookieHeader(response: Response): string {
  const header = response.headers.getSetCookie().find((value) => value.includes('session_token'));
  if (!header) throw new Error('no session cookie on that response');
  return header;
}

/** Just the `name=value` a browser would send back */
function cookieFrom(response: Response): string {
  return setCookieHeader(response).split(';')[0] as string;
}

/** Create an Account and hand back the cookie it was signed in with */
async function signUp(email = EMAIL): Promise<string> {
  const response = await callAuth('/sign-up/email', {
    body: { email, password: PASSWORD, name: email },
  });
  if (response.status !== 200) throw new Error(`sign-up failed: ${await response.text()}`);
  return cookieFrom(response);
}

/** Sign in again, optionally asking for a session that ends with the browser */
async function signIn(options: { rememberMe?: boolean } = {}): Promise<Response> {
  return callAuth('/sign-in/email', {
    body: { email: EMAIL, password: PASSWORD, ...options },
  });
}

/** Who the server says a cookie is, or null */
async function whoIs(cookie: string): Promise<string | null> {
  const response = await callAuth('/get-session', { cookie });
  const body = (await response.json()) as { user?: { email: string } } | null;
  return body?.user?.email ?? null;
}

/** Every session row, for the tests that count rather than look one up */
function sessions(database: Database) {
  return database.db.select().from(authSession).all();
}

/** Move the clock, leaving timers alone */
function advanceTo(moment: number | Date): void {
  vi.setSystemTime(moment);
}

beforeEach(() => {
  resetSignInFailures();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(SIGNED_IN_AT);
});

afterEach(() => {
  vi.useRealTimers();
  resetSignInFailures();
});

describe('the cookie itself', () => {
  it('carries an expiry, so closing the browser does not sign you out (v3 Req 48.1)', () =>
    withTestDatabase(async () => {
      const response = await callAuth('/sign-up/email', {
        body: { email: EMAIL, password: PASSWORD, name: EMAIL },
      });

      // A cookie with neither attribute is a *session* cookie, which the browser drops on exit —
      // asserted on the header rather than on the configuration that produces it
      expect(setCookieHeader(response)).toMatch(/max-age|expires/i);
    }));

  it('offers a browser-lifetime session for a device that is not yours (v3 Req 48.11)', () =>
    withTestDatabase(async () => {
      await signUp();

      const response = await signIn({ rememberMe: false });

      // No persisted expiry at all: this one really does end with the browser
      expect(setCookieHeader(response)).not.toMatch(/max-age|expires/i);
    }));
});

describe('the idle lifetime', () => {
  it('renews a session used inside its window, and keeps it working past the original expiry', () =>
    withTestDatabase(async (database) => {
      const cookie = await signUp();
      const originalExpiry = sessions(database)[0]?.expiresAt.getTime() ?? 0;

      // Used a day in — past `updateAge`, so this is the renewal
      advanceTo(SIGNED_IN_AT.getTime() + 25 * HOUR);
      const renewed = await requestAsBrowserWould(cookie);
      expect(renewed.who).toBe(EMAIL);

      const renewedExpiry = sessions(database)[0]?.expiresAt.getTime() ?? 0;
      expect(renewedExpiry).toBeGreaterThan(originalExpiry);

      // …and it is still good after the moment it would originally have died. The *renewed* cookie,
      // because a renewal rotates the identifier — carrying the original one here would be testing
      // the grace window instead.
      advanceTo(originalExpiry + HOUR);
      expect(await whoIs(renewed.cookie)).toBe(EMAIL);
    }));

  it('refuses one left unused past its idle window', () =>
    withTestDatabase(async () => {
      const cookie = await signUp();

      advanceTo(SIGNED_IN_AT.getTime() + (IDLE_DAYS + 1) * DAY);

      expect(await whoIs(cookie)).toBeNull();
    }));
});

describe('the absolute lifetime (v3 Req 48.3)', () => {
  it('refuses a session past its ceiling however continuously it was used', () =>
    withTestDatabase(async () => {
      let cookie = await signUp();

      // Used every twenty days — comfortably inside a thirty-day idle window, so nothing here ever
      // ages out. **This is the case a "renew forever" implementation passes and this one must not.**
      for (let day = 20; day < ABSOLUTE_DAYS; day += 20) {
        advanceTo(SIGNED_IN_AT.getTime() + day * DAY);
        const used = await requestAsBrowserWould(cookie);
        expect(used.who, `still signed in on day ${day}`).toBe(EMAIL);
        cookie = used.cookie;
      }

      advanceTo(SIGNED_IN_AT.getTime() + (ABSOLUTE_DAYS + 1) * DAY);

      expect(await whoIs(cookie)).toBeNull();
    }));

  it('measures the ceiling from the first sign-in, not from the last renewal', () =>
    withTestDatabase(async (database) => {
      const cookie = await signUp();

      advanceTo(SIGNED_IN_AT.getTime() + 25 * HOUR);
      await whoIs(cookie);

      // `createdAt` is what the ceiling is measured from, so a renewal must not touch it
      expect(sessions(database)[0]?.createdAt.getTime()).toBe(SIGNED_IN_AT.getTime());
    }));

  it('never renews past the ceiling, even on the last day', () =>
    withTestDatabase(async (database) => {
      let cookie = await signUp();

      // Kept alive up to the last day — a single jump would land past the *idle* window and the
      // row would be gone before the ceiling had anything to say
      for (const day of [20, 40, 60, 80, ABSOLUTE_DAYS - 1]) {
        advanceTo(SIGNED_IN_AT.getTime() + day * DAY);
        cookie = (await requestAsBrowserWould(cookie)).cookie;
      }

      // A full idle window from here would reach day 119; the chain ends at day 90
      const ceiling = SIGNED_IN_AT.getTime() + ABSOLUTE_DAYS * DAY;
      expect(sessions(database)[0]?.expiresAt.getTime()).toBe(ceiling);
    }));
});

describe('rotation (v3 Req 48.5)', () => {
  it('replaces the identifier on renewal', () =>
    withTestDatabase(async (database) => {
      const cookie = await signUp();
      const originalToken = sessions(database)[0]?.token;

      advanceTo(SIGNED_IN_AT.getTime() + 25 * HOUR);
      await whoIs(cookie);

      const rotated = sessions(database)[0];
      expect(rotated?.token).not.toBe(originalToken);
      expect(rotated?.previousToken).toBe(originalToken);
    }));

  it('hands the browser the new identifier', () =>
    withTestDatabase(async (database) => {
      const cookie = await signUp();

      advanceTo(SIGNED_IN_AT.getTime() + 25 * HOUR);
      const response = await callAuth('/get-session', { cookie });

      expect(cookieFrom(response)).not.toBe(cookie);
      expect(decodeURIComponent(cookieFrom(response))).toContain(
        sessions(database)[0]?.token ?? 'no token'
      );
    }));

  it('keeps the previous identifier working for the grace window, so two tabs cannot fight', () =>
    withTestDatabase(async () => {
      const cookie = await signUp();

      advanceTo(SIGNED_IN_AT.getTime() + 25 * HOUR);
      await whoIs(cookie);

      // **The amended criterion 4.** The ticket asked for the old cookie to stop working
      // *immediately*; its own notes asked for this window in the same breath, and the notes are
      // right — without it the tab that loses a renewal race presents a token the server has never
      // heard of, and Better Auth clears the cookie for *every* tab.
      expect(await whoIs(cookie)).toBe(EMAIL);
    }));

  it('stops honouring the previous identifier once the window closes', () =>
    withTestDatabase(async () => {
      const cookie = await signUp();

      advanceTo(SIGNED_IN_AT.getTime() + 25 * HOUR);
      await whoIs(cookie);

      advanceTo(SIGNED_IN_AT.getTime() + 25 * HOUR + (GRACE_SECONDS + 1) * 1000);

      // Otherwise rotation would be decorative: the replaced identifier would work for ever
      expect(await whoIs(cookie)).toBeNull();
    }));

  it('rotates at most once per update window, even once the ceiling is binding', () =>
    withTestDatabase(async (database) => {
      let cookie = await signUp();

      // Get the session into the last month of its chain, where `expiresAt` is pinned at the
      // ceiling and stops moving
      for (const day of [20, 40, 60, 70]) {
        advanceTo(SIGNED_IN_AT.getTime() + day * DAY);
        cookie = (await requestAsBrowserWould(cookie)).cookie;
      }

      const settled = sessions(database)[0]?.token;

      // **Three requests an hour apart, well inside the update window.** Better Auth's own
      // once-per-`updateAge` test is `expiresAt - idle + updateAge <= now`, which assumes
      // `expiresAt` tracks the last renewal — capping breaks that, so from the moment the ceiling
      // binds it would say *yes* to every single request. Rotating on each one would turn the grace
      // window from a rare race into every concurrent pair.
      for (const hour of [1, 2, 3]) {
        advanceTo(SIGNED_IN_AT.getTime() + 70 * DAY + hour * HOUR);
        await requestAsBrowserWould(cookie);
      }

      expect(sessions(database)[0]?.token).toBe(settled);
    }));

  it('survives two requests renewing in the same instant', () =>
    withTestDatabase(async () => {
      const cookie = await signUp();

      advanceTo(SIGNED_IN_AT.getTime() + 25 * HOUR);

      // The two-tab case, made deterministic: both start from the same pre-rotation cookie
      const [first, second] = await Promise.all([whoIs(cookie), whoIs(cookie)]);

      expect([first, second]).toEqual([EMAIL, EMAIL]);
    }));
});

describe('revocation (v3 Req 48.6, 48.7)', () => {
  it('invalidates on sign-out, and renewal cannot resurrect it', () =>
    withTestDatabase(async () => {
      const cookie = await signUp();

      await callAuth('/sign-out', { body: {}, cookie });
      expect(await whoIs(cookie)).toBeNull();

      // Past `updateAge`, so this is the moment a renewal would fire if anything could
      advanceTo(SIGNED_IN_AT.getTime() + 25 * HOUR);
      expect(await whoIs(cookie)).toBeNull();
    }));

  it('signs out by the cookie that was presented, even after a rotation', () =>
    withTestDatabase(async (database) => {
      const original = await signUp();

      advanceTo(SIGNED_IN_AT.getTime() + 25 * HOUR);
      await whoIs(original);

      // **Better Auth deletes by the token the *cookie* carried, not the one it resolved to** — and
      // inside the grace window those differ. Left alone the delete matched nothing: the browser's
      // cookie was cleared, the person believed they had signed out, and the row stayed live for
      // whoever held the current identifier. Which would make a liar of the whole reason sign-out
      // deletes a row rather than clearing a cookie.
      await callAuth('/sign-out', { body: {}, cookie: original });

      expect(sessions(database)).toHaveLength(0);
      expect(await whoIs(original)).toBeNull();
    }));

  it('lists an Account its own sessions, with enough to recognise each', () =>
    withTestDatabase(async () => {
      const first = await signUp();
      const second = cookieFrom(await signIn());

      const listed = (await (await callAuth('/list-sessions', { cookie: second })).json()) as {
        id: string;
        createdAt: string;
      }[];

      expect(listed).toHaveLength(2);
      for (const session of listed) {
        expect(session.id).toBeTruthy();
        expect(session.createdAt).toBeTruthy();
      }
      expect(await whoIs(first)).toBe(EMAIL);
    }));

  it('shows one Account nothing of another’s', () =>
    withTestDatabase(async () => {
      await signUp();
      const stranger = await signUp('grace@example.com');

      const listed = (await (
        await callAuth('/list-sessions', { cookie: stranger })
      ).json()) as unknown[];

      expect(listed).toHaveLength(1);
    }));

  it('revokes one session and leaves the others working', () =>
    withTestDatabase(async () => {
      const first = await signUp();
      const second = cookieFrom(await signIn());
      const listed = (await (await callAuth('/list-sessions', { cookie: second })).json()) as {
        token: string;
      }[];
      const other = listed.find((session) => !decodeURIComponent(second).includes(session.token));

      await callAuth('/revoke-session', { body: { token: other?.token }, cookie: second });

      expect(await whoIs(first)).toBeNull();
      expect(await whoIs(second)).toBe(EMAIL);
    }));

  it('signs out everywhere when asked (v3 Req 48.7)', () =>
    withTestDatabase(async (database) => {
      const first = await signUp();
      const second = cookieFrom(await signIn());

      await callAuth('/revoke-sessions', { body: {}, cookie: second });

      expect(await whoIs(first)).toBeNull();
      expect(await whoIs(second)).toBeNull();
      expect(sessions(database)).toHaveLength(0);
    }));
});

/**
 * Use a session, and keep whatever cookie the browser would now be holding
 *
 * A renewal replaces the identifier, so a test that goes on presenting the *original* cookie is
 * testing the grace window rather than the renewal — and past that window it is testing nothing at
 * all. This is what a browser does: send what you have, keep what you are given.
 *
 * **Not named `use…`**, for the reason `setProcessDatabase` records: in a React codebase Biome's
 * `useHookAtTopLevel` reads that prefix as a hook and refuses to see it called in a loop.
 */
async function requestAsBrowserWould(
  cookie: string
): Promise<{ who: string | null; cookie: string }> {
  const response = await callAuth('/get-session', { cookie });
  const body = (await response.clone().json()) as { user?: { email: string } } | null;

  return {
    who: body?.user?.email ?? null,
    cookie: response.headers.getSetCookie().length > 0 ? cookieFrom(response) : cookie,
  };
}
