/**
 * The per-address sign-in limit (TICKET-AUTH-01)
 *
 * v3 Req 30.7 asks for a limit **per email address**, and Better Auth's own limiter keys on IP and
 * path — so this is our own code and gets its own tests. The end-to-end half, that a refused
 * address really is refused by the route, is in [`auth.test.ts`](./auth.test.ts); what is pinned
 * here is the counting.
 *
 * **Validates: v3 Req 30.7**
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readEnv } from '../env';
import {
  clearSignInFailures,
  isSignInLimited,
  recordSignInFailure,
  resetSignInFailures,
} from './signInRateLimit';

const EMAIL = 'ada@example.com';

/** The limit the suite runs under — read rather than restated, so a default change reaches here */
const { signInMaxAttempts: MAX, signInWindowSeconds: WINDOW } = readEnv({
  DATABASE_URL: ':memory:',
  BETTER_AUTH_SECRET: 'x',
});

const NOW = 1_700_000_000_000;

beforeEach(resetSignInFailures);
afterEach(resetSignInFailures);

describe('isSignInLimited', () => {
  it('lets an address with no history through', () => {
    expect(isSignInLimited(EMAIL, NOW)).toBe(false);
  });

  it('lets an address through until it has spent its attempts', () => {
    for (let attempt = 1; attempt < MAX; attempt += 1) {
      recordSignInFailure(EMAIL, NOW);
      expect(isSignInLimited(EMAIL, NOW), `after ${attempt}`).toBe(false);
    }

    recordSignInFailure(EMAIL, NOW);
    expect(isSignInLimited(EMAIL, NOW)).toBe(true);
  });

  it('counts one address without touching another', () => {
    for (let attempt = 0; attempt < MAX; attempt += 1) recordSignInFailure(EMAIL, NOW);

    // The whole point of keying on the address: locking out one person must not lock out the rest
    expect(isSignInLimited(EMAIL, NOW)).toBe(true);
    expect(isSignInLimited('someone-else@example.com', NOW)).toBe(false);
  });

  it('treats a differently-cased address as the same one', () => {
    for (let attempt = 0; attempt < MAX; attempt += 1) recordSignInFailure(EMAIL, NOW);

    // Otherwise the limit is bypassed by holding down shift — and Better Auth already considers
    // these one account
    expect(isSignInLimited('ADA@Example.com', NOW)).toBe(true);
    expect(isSignInLimited(`  ${EMAIL}  `, NOW)).toBe(true);
  });

  it('forgets the address once the window has passed', () => {
    for (let attempt = 0; attempt < MAX; attempt += 1) recordSignInFailure(EMAIL, NOW);

    expect(isSignInLimited(EMAIL, NOW + WINDOW * 1000 - 1)).toBe(true);
    expect(isSignInLimited(EMAIL, NOW + WINDOW * 1000)).toBe(false);
  });

  it('starts a fresh window rather than resuming the old count', () => {
    // The assertion below only means anything while more than one attempt is allowed
    expect(MAX).toBeGreaterThan(1);

    for (let attempt = 0; attempt < MAX; attempt += 1) recordSignInFailure(EMAIL, NOW);

    const later = NOW + WINDOW * 1000;
    recordSignInFailure(EMAIL, later);

    // One failure in the new window, not MAX + 1 — a fixed window, which is the cheapest thing
    // that satisfies the requirement and the easiest to explain to the person locked out
    expect(isSignInLimited(EMAIL, later)).toBe(false);
  });
});

describe('a successful sign-in', () => {
  it('clears the failures that came before it', () => {
    for (let attempt = 0; attempt < MAX; attempt += 1) recordSignInFailure(EMAIL, NOW);
    expect(isSignInLimited(EMAIL, NOW)).toBe(true);

    clearSignInFailures(EMAIL);

    // Somebody who mistypes twice and then gets it right is not carrying a strike into next week
    expect(isSignInLimited(EMAIL, NOW)).toBe(false);
  });
});
