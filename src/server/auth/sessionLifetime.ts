/**
 * How long an Auth_Session lives, and what renewing one does to it (TICKET-AUTH-04)
 *
 * D13 asked for a persistent cookie with **rolling renewal** rather than an access/refresh pair:
 * an idle window that a use extends, an absolute ceiling it cannot pass, and a rotated identifier
 * each time. Better Auth supplies the first of those and none of the other two, so this module is
 * the second and third — as pure functions, so the rules can be tested by driving a clock rather
 * than by waiting three months.
 *
 * ## One column carries both lifetimes
 *
 * The trick the whole design rests on: renewal writes
 * **`expiresAt = min(now + idle, createdAt + absolute)`**. That turns the ceiling into an ordinary
 * expiry, which means the library's own *is this expired?* check enforces it on `/get-session`, on
 * LIVE-01's socket upgrade, and on every route that ever resolves a cookie — with no second check
 * to remember and no path that can forget one. `createdAt` is never rewritten; it is the start of
 * the **chain**, not of the current window.
 *
 * ## Rotation, and why the previous identifier survives for a moment
 *
 * Without rotation a cookie captured once is good for the whole absolute lifetime; with it, the
 * window closes at the legitimate browser's next request (D13). But rotating *in place* has a
 * failure this ticket found before shipping it: two tabs whose `useSession` polls land on the same
 * renewal boundary both read the old row, one wins the update, and the loser presents a token the
 * server has never heard of — at which point Better Auth **deletes the cookie**, signing every tab
 * out. So the previous identifier stays resolvable for {@link SessionPolicy.graceSeconds}.
 *
 * **This is a deliberate amendment to the ticket's fourth criterion**, which asked that the
 * pre-renewal cookie stop working *immediately*; the ticket's own notes asked for the grace window
 * in the same breath. The window is what makes rotation safe to turn on at all, and it is seconds
 * against an absolute lifetime of months.
 *
 * ## Where they are applied
 *
 * `db/authAdapter.ts` wraps Better Auth's adapter and calls {@link sessionRules}' four operations —
 * it is the only seam with the stored row and the pending write in hand at once. The *type* of that
 * interface is declared there rather than here, so `db/` needs no import of `auth/`; this module
 * imports it, which is the direction that already existed.
 *
 * **Validates: v3 Req 48.2, 48.3, 48.4, 48.5**
 */

import type { SessionRotation, SessionRules, StoredSession } from '../db/authAdapter';

/** The lifetimes a deployment is configured with, in seconds */
export interface SessionPolicy {
  /** How long an unused session survives — a use pushes this out again */
  idleSeconds: number;
  /** How long a session may live from first sign-in, however continuously it is used */
  absoluteSeconds: number;
  /** How often a session in use is renewed and rotated */
  updateSeconds: number;
  /** How long the identifier a rotation replaced stays resolvable */
  graceSeconds: number;
}

/**
 * The fields the session table carries beyond Better Auth's own
 *
 * Declared to the library through `session.additionalFields` so that `getAuthTables()` knows about
 * them — which is what lets `authSchema.test.ts` go on comparing the library's expectations against
 * our Drizzle tables instead of being told to ignore two columns.
 *
 * `required: false` on both: a session that has never been renewed has neither, and a `NOT NULL`
 * column would make the first write of a *new* session need a value it has no meaning for.
 */
export const SESSION_ADDITIONAL_FIELDS = {
  previousToken: { type: 'string', required: false, input: false },
  previousTokenExpiresAt: { type: 'date', required: false, input: false },
} as const;

/**
 * When a session should next expire
 *
 * @param createdAt When the chain began — the row's own `createdAt`, never rewritten
 * @param now The moment being renewed at
 * @param policy The configured lifetimes
 * @returns The earlier of the fresh idle window and the absolute ceiling
 */
export function cappedExpiry(createdAt: Date, now: Date, policy: SessionPolicy): Date {
  const idle = now.getTime() + policy.idleSeconds * 1000;
  const ceiling = createdAt.getTime() + policy.absoluteSeconds * 1000;

  return new Date(Math.min(idle, ceiling));
}

/**
 * Whether a session in use is due to be renewed and rotated
 *
 * **This exists because capping the expiry breaks the library's own answer to the same question.**
 * Better Auth decides with `expiresAt - idle + updateAge <= now`, which assumes `expiresAt` is
 * always `lastRenewal + idle`. Once the ceiling binds — the last month of a ninety-day chain —
 * `expiresAt` stops moving and that test is permanently true, so *every* request would renew and
 * rotate. Measuring from `updatedAt` asks what the library meant to ask.
 *
 * @param updatedAt When the row was last written
 * @param now The moment of the request
 * @param policy The configured lifetimes
 * @returns True when an update window has passed since the last write
 */
export function isDueForRenewal(updatedAt: Date, now: Date, policy: SessionPolicy): boolean {
  return now.getTime() - updatedAt.getTime() >= policy.updateSeconds * 1000;
}

/**
 * Replace a session's identifier, keeping the old one alive for the grace window
 *
 * @param currentToken The identifier being replaced
 * @param nextToken The identifier to replace it with
 * @param now The moment of the rotation
 * @param policy The configured lifetimes
 * @returns The three columns a rotation sets
 */
export function rotate(
  currentToken: string,
  nextToken: string,
  now: Date,
  policy: SessionPolicy
): SessionRotation {
  return {
    token: nextToken,
    previousToken: currentToken,
    previousTokenExpiresAt: new Date(now.getTime() + policy.graceSeconds * 1000),
  };
}

/**
 * Whether a presented identifier is this session's previous one, still inside its window
 *
 * **Both halves matter and the second is the whole point.** A `previousToken` with no expiry, or
 * one whose expiry has passed, is a rotation that has finished — honouring it would make rotation
 * decorative.
 *
 * @param session The row being considered
 * @param presented The identifier the cookie carried
 * @param now The moment of the request
 * @returns True when the old identifier should still be honoured
 */
export function isWithinGrace(
  session: Pick<StoredSession, 'previousToken' | 'previousTokenExpiresAt'>,
  presented: string,
  now: Date
): boolean {
  if (!session.previousToken || session.previousToken !== presented) return false;
  if (!session.previousTokenExpiresAt) return false;

  return session.previousTokenExpiresAt.getTime() > now.getTime();
}

/**
 * The four operations `db/authAdapter.ts` applies, bound to one deployment's lifetimes
 *
 * The adapter asks *what should this write say*; this answers. Keeping the two apart is what lets
 * the arithmetic above be tested by driving a clock rather than by driving a database.
 *
 * @param policy The configured lifetimes
 * @param nextToken Where a rotated-in identifier comes from
 * @returns The rules, in the shape the adapter takes
 */
export function sessionRules(policy: SessionPolicy, nextToken: () => string): SessionRules {
  return {
    isDueForRenewal: (session, now) => isDueForRenewal(session.updatedAt, now, policy),
    expiryFor: (createdAt, now) => cappedExpiry(createdAt, now, policy),
    // `null` rather than an empty object when the grace is off, so the adapter spreads nothing
    // rather than writing two columns nothing will ever read
    rotationFor: (currentToken, now) =>
      policy.graceSeconds > 0 ? rotate(currentToken, nextToken(), now, policy) : null,
    resolvesPrevious: (session, presented, now) => isWithinGrace(session, presented, now),
  };
}
