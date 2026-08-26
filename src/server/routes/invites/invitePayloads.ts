/**
 * Turning a typed code into a table, or into the right refusal (TICKET-GAM-02)
 *
 * **v3 Req 38.4 asks for a distinct message for each way this can fail**, and that is most of what
 * this module is. *Never existed*, *taken back*, *ran out* and *the game has ended* are four
 * different situations with four different things for the person holding the code to do, and a
 * shared "invalid code" would leave all four of them guessing.
 *
 * **The two handlers beside this one never name a session id**, and that is deliberate rather than
 * incidental: `routes/routeGuards.test.ts` reads a handler naming one as *this route had better call
 * a resource guard*, and redeeming a code is precisely the act that cannot — you are not a Member
 * yet, which is the point. So {@link resolveInviteFor} hands back the loaded session and the
 * handlers work from `session.id`. The detector stays blunt and the routes stay honest.
 *
 * **Validates: v3 Req 38.1, 38.4**
 */

import { SESSION_STATUS } from '#shared/types/api';
import { AppError, conflict, notFound, tooManyRequests } from '../../http/appError';
import { findGameSession, type GameSessionRow } from '../../repositories/gameSessionRepository';
import {
  findInviteByCode,
  type SessionInviteRow,
} from '../../repositories/sessionInviteRepository';
import { normalizeInviteCode } from './inviteCode';
import { isRedemptionLimited, recordRedemptionFailure } from './redemptionLimit';

/** The collection every code sits one segment under */
const INVITES_PREFIX = '/api/invites/';

/**
 * How long an invitation lives, of either kind
 *
 * Long enough that a DM can hand one out on Monday for a game on Saturday and nobody has to think
 * about it; short enough that a code pasted into a group chat two years ago is not a way in. It is
 * not configurable for `redemptionLimit`'s reason — nobody tunes this, and a variable is one more
 * thing to set wrong.
 *
 * **One number for the shared code and the addressed letter** (TICKET-GAM-03). It moved here from
 * `issueInvite.ts` when the second kind arrived: two constants would be two answers to *how long
 * does an invitation last*, and the day they disagreed nothing would say which was meant.
 */
export const INVITE_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Which code a path named, in the form a stored one is comparable to
 *
 * Normalised here rather than at each caller, so there is no path on which a raw string reaches a
 * lookup. **Two shapes are real** — `/api/invites/:code` and `/api/invites/:code/<action>` — and
 * nothing deeper is, matching `rulesetIdFrom` and `sessionIdFrom`.
 *
 * **The percent-decode is guarded**, which the first draft's was not: `decodeURIComponent` throws
 * `URIError` on a lone `%` or a truncated escape, and a `URIError` is not an `AppError` — so the
 * pipeline logged it as a bug and answered **500**, letting any signed-in caller emit an unbounded
 * stream of them where the honest answer is the 404 an unknown code gets (the GAM-02 review).
 *
 * Removing the decode outright was the first attempt and was wrong: a code typed with a space
 * arrives as `%20`, and `normalizeInviteCode` would keep the `20` as digits rather than dropping a
 * separator. Falling back to the raw segment gives a malformed path the 404 it deserves while a
 * well-formed encoding still decodes.
 *
 * @param url The request URL
 * @returns The normalised code, or an empty string when the path carries none
 */
export function inviteCodeFrom(url: URL): string {
  if (!url.pathname.startsWith(INVITES_PREFIX)) return '';

  const [code, ...rest] = url.pathname.slice(INVITES_PREFIX.length).split('/');

  return rest.length <= 1 ? normalizeInviteCode(decoded(code)) : '';
}

/**
 * One path segment, percent-decoded when it can be
 *
 * @param segment The raw segment
 * @returns The decoded form, or the segment itself when it is not a valid encoding
 */
function decoded(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** An invitation that is still good, and the table it opens */
export interface ResolvedInvite {
  invite: SessionInviteRow;
  session: GameSessionRow;
}

/**
 * Look a code up on somebody's behalf, spending one of their attempts if it fails (v3 Req 38.1)
 *
 * **Both routes go through here, and the GAM-02 review is why.** The limiter was consulted by
 * `redeemInvite` alone, which left `GET /api/invites/:code` as an unmetered oracle over the same
 * code space: sign-up is open, so any Account could walk it at whatever rate the process serves and
 * read three distinguishable answers — 404, a 409 that says *revoked* or *expired*, or a 200
 * carrying the session's name — never touching either bucket, and spend a single `POST` on the hit.
 * The per-code bucket was defeated the same way by a pool of accounts probing over `GET`.
 *
 * That contradicted this feature's whole security argument: fifty bits makes brute force expensive
 * and **the limiter is what makes it impossible to pay for**. One entry point is what makes the
 * argument true rather than true of one route.
 *
 * **The buckets are shared, deliberately.** Two limiters — one per route — would be defeated by
 * alternating between them.
 *
 * @param accountId Who is asking
 * @param code The normalised code
 * @param now Epoch milliseconds
 * @returns The invitation and its session
 * @throws {AppError} 429 when either bucket is spent, 404 for a code nothing carries, 409 for one
 *   taken back or run out
 */
export function resolveInviteFor(accountId: string, code: string, now: number): ResolvedInvite {
  // **Before the lookup**, so being refused says nothing about whether the guess was a real code
  if (isRedemptionLimited(accountId, code, now)) {
    throw tooManyRequests(
      'Too many attempts at an invitation code. Wait a minute and try again — and check the code ' +
        'against what you were sent rather than retyping it.'
    );
  }

  try {
    return resolveInvite(code, now);
  } catch (error) {
    // **Every refusal counts, not only the unknown-code one.** An attacker learns as much from
    // *expired* as from *no such code* — both say a code existed — so a limiter that only counted
    // misses would have a hole in exactly the shape of a hit.
    if (error instanceof AppError) recordRedemptionFailure(accountId, code, now);
    throw error;
  }
}

/**
 * The table a code opens, or the reason it does not (v3 Req 38.4)
 *
 * **Archived is *not* refused here**, which is the one asymmetry worth stating: the preview route
 * wants to say *this game has ended* on a page rather than as an error, and the redeem route refuses
 * it with `requireJoinable` below. Splitting them that way is what lets one function answer both
 * without either lying.
 *
 * **Deliberately not exported.** Reaching this directly is reaching past the limiter, which is the
 * hole the GAM-02 review found — so the module keeps it to itself and `resolveInviteFor` above is
 * the only door. fallow spotted the export as dead the moment the second caller went away.
 *
 * @param code The normalised code
 * @param now Epoch milliseconds
 * @returns The invitation and its session
 * @throws {AppError} 404 for a code nothing carries, 409 for one taken back or run out
 */
function resolveInvite(code: string, now: number): ResolvedInvite {
  const invite = code === '' ? null : findInviteByCode(code);

  if (!invite) {
    throw notFound(
      'No invitation matches that code. Check it against what you were sent — the letter O and ' +
        'the digit zero are the same here, so that is not the problem.'
    );
  }

  if (invite.revokedAt !== null) {
    throw conflict(
      'That invitation was taken back. Ask whoever runs the game for the current code — issuing a ' +
        'new one is what retires the old.'
    );
  }

  if (invite.expiresAt <= now) {
    throw conflict('That invitation has expired. Ask whoever runs the game for a new code.');
  }

  const session = findGameSession(invite.sessionId);

  // A live invitation whose session is gone should be impossible — the row cascades with the
  // session — so this is the same 404 an unknown code gets rather than a 500 about our own schema
  if (!session) throw notFound('No invitation matches that code.');

  return { invite, session };
}

/**
 * Whether a resolved invitation can actually be taken up (v3 Req 37.5)
 *
 * @param session The table the code opens
 * @returns True while the game is still running
 */
export function isJoinable(session: GameSessionRow): boolean {
  return session.status !== SESSION_STATUS.ARCHIVED;
}

/**
 * The same, as a refusal
 *
 * A **409**, matching every other write refused by a session's state: the caller's code is good and
 * their request is well formed, and what stops them is that the game is over.
 *
 * @param session The table the code opens
 * @throws {AppError} 409 when the session has been archived
 */
export function requireJoinable(session: GameSessionRow): void {
  if (isJoinable(session)) return;

  throw conflict(
    'That game session has been archived, so nobody new can join it. Everything in it is still ' +
      'there to read for the people who were at the table.'
  );
}
