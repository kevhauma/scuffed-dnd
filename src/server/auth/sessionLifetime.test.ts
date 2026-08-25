/**
 * The two lifetimes and the rotation rule, as arithmetic (TICKET-AUTH-04)
 *
 * **Driving a clock rather than waiting three months** is the only way criterion 3 is checkable at
 * all, and pure functions are what make the clock a parameter. The same rules are exercised end to
 * end against the real Better Auth handler in [`session.test.ts`](./session.test.ts); this file is
 * where the *edges* live — the moment the ceiling bites, the moment the grace window closes.
 *
 * **Validates: v3 Req 48.2, 48.3, 48.4, 48.5**
 */

import { describe, expect, it } from 'vitest';
import {
  cappedExpiry,
  isDueForRenewal,
  isWithinGrace,
  rotate,
  type SessionPolicy,
} from './sessionLifetime';

/** Small round numbers, so a failure reads as arithmetic rather than as a date */
const POLICY: SessionPolicy = {
  idleSeconds: 100,
  absoluteSeconds: 1000,
  updateSeconds: 20,
  graceSeconds: 10,
};

const SIGNED_IN_AT = new Date(0);

/** A moment, in seconds after the session began */
function at(seconds: number): Date {
  return new Date(seconds * 1000);
}

describe('cappedExpiry', () => {
  it('gives a fresh idle window while the ceiling is far away', () => {
    // The ordinary renewal: used at t=500, so good until t=600
    expect(cappedExpiry(SIGNED_IN_AT, at(500), POLICY)).toEqual(at(600));
  });

  it('stops at the ceiling rather than past it (v3 Req 48.3)', () => {
    // Used at t=950, and a full idle window would reach t=1050 — but the chain ends at t=1000.
    // **This one line is the whole of how the absolute lifetime is enforced**: it makes the
    // ceiling an ordinary expiry, which the library already refuses everywhere.
    expect(cappedExpiry(SIGNED_IN_AT, at(950), POLICY)).toEqual(at(1000));
  });

  it('is at the ceiling exactly, for a use at the last possible moment', () => {
    expect(cappedExpiry(SIGNED_IN_AT, at(1000), POLICY)).toEqual(at(1000));
  });

  it('never moves backwards past the ceiling, however late the use', () => {
    // A renewal attempted after the chain is over produces an expiry already in the past, so the
    // very next read treats it as expired rather than as renewed
    expect(cappedExpiry(SIGNED_IN_AT, at(2000), POLICY)).toEqual(at(1000));
  });

  it('measures the ceiling from when the chain began, not from the last renewal', () => {
    // The property rotation would otherwise quietly destroy: `createdAt` is never rewritten, so a
    // session renewed a hundred times still ends where it always was going to
    const renewals = [200, 400, 600, 800].map((t) => cappedExpiry(SIGNED_IN_AT, at(t), POLICY));

    expect(renewals.at(-1)).toEqual(at(900));
    expect(cappedExpiry(SIGNED_IN_AT, at(999), POLICY)).toEqual(at(1000));
  });

  it('lets an absolute lifetime shorter than the idle one simply win', () => {
    // A misconfiguration rather than a mode, but the arithmetic should not need to know that
    const inverted: SessionPolicy = { ...POLICY, idleSeconds: 5000 };

    expect(cappedExpiry(SIGNED_IN_AT, at(10), inverted)).toEqual(at(1000));
  });
});

describe('isDueForRenewal', () => {
  it('is false inside the update window', () => {
    expect(isDueForRenewal(at(100), at(119), POLICY)).toBe(false);
  });

  it('is true once a whole window has passed', () => {
    expect(isDueForRenewal(at(100), at(120), POLICY)).toBe(true);
  });

  it('stays false near the ceiling, where the library’s own test would say true for ever', () => {
    // **The reason this function exists.** Better Auth asks `expiresAt - idle + updateAge <= now`,
    // which assumes `expiresAt` is always `lastRenewal + idle`. Capping breaks that assumption, so
    // from the moment the ceiling binds its answer is permanently *yes* — and every request would
    // renew and rotate. Measuring from `updatedAt` asks what it meant to ask.
    const cappedAndRecentlyWritten = at(990);

    expect(isDueForRenewal(cappedAndRecentlyWritten, at(995), POLICY)).toBe(false);
  });
});

describe('rotate', () => {
  it('moves the outgoing identifier aside and opens its window', () => {
    expect(rotate('old', 'new', at(500), POLICY)).toEqual({
      token: 'new',
      previousToken: 'old',
      previousTokenExpiresAt: at(510),
    });
  });

  it('opens no window at all when the grace is configured to zero', () => {
    expect(rotate('old', 'new', at(500), { ...POLICY, graceSeconds: 0 })).toMatchObject({
      previousTokenExpiresAt: at(500),
    });
  });
});

describe('isWithinGrace', () => {
  const rotated = { previousToken: 'old', previousTokenExpiresAt: at(510) };

  it('honours the previous identifier inside the window', () => {
    // The two-tab case: the request that lost the race presents `old` and must still be somebody
    expect(isWithinGrace(rotated, 'old', at(505))).toBe(true);
  });

  it('stops honouring it the moment the window closes', () => {
    // Without this rotation would be decorative — the replaced identifier would work for ever
    expect(isWithinGrace(rotated, 'old', at(510))).toBe(false);
    expect(isWithinGrace(rotated, 'old', at(511))).toBe(false);
  });

  it('honours nothing but that exact identifier', () => {
    expect(isWithinGrace(rotated, 'some-other-token', at(505))).toBe(false);
  });

  it('honours nothing on a session that has never been rotated', () => {
    expect(isWithinGrace({}, 'old', at(505))).toBe(false);
    expect(isWithinGrace({ previousToken: 'old' }, 'old', at(505))).toBe(false);
    expect(isWithinGrace({ previousToken: null, previousTokenExpiresAt: at(510) }, '', at(1))).toBe(
      false
    );
  });
});
