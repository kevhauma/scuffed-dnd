/**
 * Where sign-in sends people back to, and what it refuses to (TICKET-AUTH-03)
 *
 * Half of this file is the open-redirect table, and it is the half that matters. A destination
 * arrives on a query string, so an attacker writes it — and a sign-in page that will forward to any
 * URL is a phishing page wearing our domain. Each rejected shape below is a real technique rather
 * than a hypothetical.
 *
 * **Validates: v3 Req 32.7**
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DESTINATION,
  REDIRECT_PARAM,
  safeDestination,
  signInSearch,
} from './signInDestination';

describe('safeDestination', () => {
  it.each([
    '/account',
    '/config/stats',
    '/play/character/aria',
    '/account?tab=identities',
    '/play/character/aria#skills',
  ])('keeps %s, which is a path on this origin', (destination) => {
    expect(safeDestination(destination)).toBe(destination);
  });

  it.each([
    ['https://evil.example', 'an absolute URL on somebody else’s origin'],
    ['http://evil.example/account', 'the same, dressed as a path'],
    ['//evil.example', 'protocol-relative — the browser reads it as an origin'],
    ['/\\evil.example', 'a backslash some parsers normalise into protocol-relative'],
    ['javascript:alert(1)', 'a scheme, not a path'],
    ['account', 'not a path at all — it would resolve relative to wherever we are'],
    ['/\t/evil.example', 'a tab the URL parser strips, leaving protocol-relative'],
    ['/\n/evil.example', 'the same with a line feed'],
    ['/\r/evil.example', 'the same with a carriage return'],
    ['/\t\\evil.example', 'a tab in front of the backslash form'],
    ['\t//evil.example', 'a leading tab, so it does not even look like a path'],
  ])('refuses %s (%s)', (destination) => {
    expect(safeDestination(destination)).toBe(DEFAULT_DESTINATION);
  });

  it.each(['/\t/evil.example', '/\n/evil.example', '/\r/evil.example', '\t//evil.example'])(
    'agrees with the URL parser about %s, which is the whole point',
    (destination) => {
      // The bug this closes was a check that judged the string a browser is *given* rather than the
      // one it will *read*. Asserted against the real parser so the two cannot drift.
      const wouldReach = new URL(destination, 'https://app.test').origin;
      const afterGuard = new URL(safeDestination(destination), 'https://app.test').origin;

      expect(wouldReach).not.toBe('https://app.test');
      expect(afterGuard).toBe('https://app.test');
    }
  );

  it('strips control characters from a destination it does keep', () => {
    // Not merely refused-or-passed: what comes back is what the browser will read, so a path with
    // a stray tab in the middle cannot mean one thing here and another there
    expect(safeDestination('/acc\tount')).toBe('/account');
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a number', 42],
    ['an object', { to: '/account' }],
    ['an empty string', ''],
  ])('falls back to home for %s', (_label, raw) => {
    // A query string is untyped; anything at all can arrive here
    expect(safeDestination(raw)).toBe(DEFAULT_DESTINATION);
  });

  it.each(['/signin', '/signup', '/signin?redirect=%2Faccount', '/signin/anything'])(
    'refuses %s, because returning there after signing in is a loop',
    (destination) => {
      // The second lock on the redirect loop this ticket's browser check found: the cause was a
      // live-read destination in `RequireAccount`, and this makes the *symptom* unreachable for any
      // future caller that assembles a destination another way
      expect(safeDestination(destination)).toBe(DEFAULT_DESTINATION);
    }
  );

  it('is idempotent, so applying it twice is safe', () => {
    // Both ends apply it — the route at the door and the page on the way out — and that is only
    // sound if the second application changes nothing
    for (const value of ['/account', 'https://evil.example', '//evil.example']) {
      expect(safeDestination(safeDestination(value))).toBe(safeDestination(value));
    }
  });
});

describe('signInSearch', () => {
  it('spells the key once, where both callers read it', () => {
    expect(signInSearch('/account')).toEqual({ [REDIRECT_PARAM]: '/account' });
  });

  it('refuses an off-origin destination on the way out as well as on the way in', () => {
    // A destination assembled from a current location deserves no more trust than one that arrived
    // in a link — a page can be at a URL an attacker chose
    expect(signInSearch('https://evil.example')).toEqual({
      [REDIRECT_PARAM]: DEFAULT_DESTINATION,
    });
  });
});
