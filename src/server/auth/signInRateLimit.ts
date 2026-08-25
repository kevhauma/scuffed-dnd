/**
 * Failed sign-ins, counted per email address (TICKET-AUTH-01)
 *
 * **Per address rather than per IP, which is why this exists at all.** Better Auth ships a rate
 * limiter and it keys on IP and path — good against a flood, useless against the attack v3 Req 30.7
 * names: guessing *one person's* password, which nobody does from a single address. So the
 * library's limiter is switched off in `authServer.ts` and this one answers the requirement.
 *
 * **In memory, and that is a decision with a stated limit** (see *Not in this milestone*: one
 * process, one SQLite file, in-memory socket rooms). A second process would count separately. The
 * alternative — a `rateLimit` table — would put a write on the failure path of an unauthenticated
 * route, which is a denial-of-service amplifier rather than a defence.
 *
 * **Only failures count.** A successful sign-in clears the address, so somebody who mistypes twice
 * and then gets it right is not carrying a strike into next week.
 *
 * **Validates: v3 Req 30.7**
 */

import { serverEnv } from '../env';

/** What one address has done lately */
interface Attempts {
  /** Failures inside the current window */
  count: number;
  /** When the window this count belongs to began, in epoch milliseconds */
  windowStartedAt: number;
}

/**
 * Every address with a failure against it
 *
 * Keyed by the **lower-cased** address, because `Ada@example.com` and `ada@example.com` are one
 * account to Better Auth and must be one bucket here — otherwise the limit is bypassed by holding
 * down shift.
 */
const attempts = new Map<string, Attempts>();

/** The address as a key */
function keyFor(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Whether this address has spent its attempts
 *
 * @param email The address being signed in as
 * @param now Epoch milliseconds; passed in so a test is not a race
 * @returns True when the next attempt should be refused without being tried
 */
export function isSignInLimited(email: string, now: number = Date.now()): boolean {
  const { signInMaxAttempts, signInWindowSeconds } = serverEnv();
  if (signInMaxAttempts === 0) return false;

  const record = attempts.get(keyFor(email));
  if (!record) return false;

  // An expired window is not a limit, and is cleaned up on the way past rather than by a timer
  if (now - record.windowStartedAt >= signInWindowSeconds * 1000) {
    attempts.delete(keyFor(email));
    return false;
  }

  return record.count >= signInMaxAttempts;
}

/**
 * Count one failed sign-in against an address
 *
 * @param email The address that was tried
 * @param now Epoch milliseconds
 */
export function recordSignInFailure(email: string, now: number = Date.now()): void {
  const { signInWindowSeconds } = serverEnv();
  const key = keyFor(email);
  const record = attempts.get(key);

  // A fixed window rather than a sliding one: the count resets when the window it began in has
  // passed, which is the cheapest thing that satisfies the requirement and is easy to explain to
  // the person locked out
  if (!record || now - record.windowStartedAt >= signInWindowSeconds * 1000) {
    attempts.set(key, { count: 1, windowStartedAt: now });
    return;
  }

  record.count += 1;
}

/**
 * Forget an address, because it just signed in successfully
 *
 * @param email The address that got in
 */
export function clearSignInFailures(email: string): void {
  attempts.delete(keyFor(email));
}

/**
 * Forget every address
 *
 * The counter is module state, so a test that fills it would otherwise leak into the next one —
 * the same reason `withTestDatabase` exists. Exported for tests and called by nothing else.
 */
export function resetSignInFailures(): void {
  attempts.clear();
}
