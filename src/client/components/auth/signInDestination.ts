/**
 * Where to send somebody back to after they sign in (TICKET-AUTH-03)
 *
 * **One mechanism taking a destination, not a redirect that happens to work.** It has two callers
 * from the day it lands — [`RequireAccount`](./RequireAccount.tsx) sending an unauthenticated
 * visitor away, and `/signin` bringing them back — and TICKET-AUTH-04 adds a third when a session
 * expiring mid-use routes through exactly this path, so that *you were signed out* and *you were
 * never signed in* land the User in the same place rather than in two surfaces that drifted.
 *
 * ## The refusal is the point
 *
 * A destination arrives on the query string, which means **an attacker controls it**: a link to
 * `/signin?redirect=https://evil.example` turns our own sign-in page into a credible way to hand
 * somebody to a phishing site, wearing our domain in the address bar right up to the moment it
 * matters. {@link safeDestination} refuses everything except a path on this origin, and refuses it
 * by *shape* rather than by blocklist:
 *
 * | Rejected | Why |
 * |---|---|
 * | `https://evil.example` | absolute — a different origin |
 * | `//evil.example` | protocol-relative; the browser reads it as an origin |
 * | `/\evil.example` | some parsers normalise the backslash to `/`, making it protocol-relative |
 * | `/⇥/evil.example` | **the URL parser strips tab, LF and CR before parsing anything** |
 * | `javascript:…` | a scheme, not a path |
 * | anything not starting `/` | not a path at all |
 *
 * **The fourth row was a live hole and is why the stripping happens first.** `/<TAB>/evil.example`
 * starts with exactly one `/`, is not `//` and is not `/\` — it passed every shape check — and then
 * `new URL()` removed the tab and produced `//evil.example`, an origin. Verified against the real
 * parser: `new URL('/\t/evil.example', 'https://app.test').href` is `https://evil.example/`. A
 * check that judges the string a browser was *given* rather than the one it will *read* is not a
 * check.
 *
 * There is deliberately no allow-list of known routes. A destination is checked for being *ours*,
 * not for being one we have heard of — a list would have to be edited by every future route, and
 * the one that forgot would silently stop returning people.
 *
 * **Validates: v3 Req 32.7**
 */

/** The query-string key a destination travels on */
export const REDIRECT_PARAM = 'redirect';

/**
 * The query-string key that says *you were signed out, you did not fail to sign in* (TICKET-AUTH-04)
 *
 * v3 Req 48.9 asks that a session expiring while the app is open be presented as an expired session
 * rather than as a permission error or a silently failed action — and the difference is entirely in
 * the wording, because the destination and the redirect are AUTH-03's and are reused unchanged.
 * *One mechanism taking a destination* was built for exactly this second caller.
 */
export const EXPIRED_PARAM = 'expired';

/** Where somebody with no particular destination lands */
export const DEFAULT_DESTINATION = '/';

/**
 * Destinations that are never the answer, however same-origin they are
 *
 * Returning somebody to a sign-in page *after they signed in* is a loop, and one arrived by
 * accident during this ticket — a live-read destination compounded `?redirect=` into itself until
 * it filled the address bar. The cause is fixed in `RequireAccount`; this is the second lock, so
 * that a future caller assembling a destination some other way cannot reintroduce it.
 */
const NEVER_RETURN_TO = ['/signin', '/signup'];

/**
 * A destination this application will actually navigate to
 *
 * @param raw Whatever arrived on the query string
 * @returns A same-origin path, or {@link DEFAULT_DESTINATION} when it is anything else
 */
export function safeDestination(raw: unknown): string {
  if (typeof raw !== 'string' || raw === '') return DEFAULT_DESTINATION;

  // **First, and before any judgement**: the WHATWG parser removes every tab, LF and CR from a URL
  // before it looks at it, so these characters change what the string *means* rather than how it
  // reads. Judging `raw` and returning `raw` would let `/⇥/evil.example` through as a path and
  // arrive as an origin. What is judged and what is returned are both the normalised form.
  const candidate = raw.replace(/[\t\n\r]/g, '');
  if (candidate === '') return DEFAULT_DESTINATION;

  // A path on this origin starts with exactly one `/`. `//` is protocol-relative and `/\` is what
  // a browser may normalise into it — both are somebody else's origin wearing a path's clothes.
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.startsWith('/\\')) {
    return DEFAULT_DESTINATION;
  }

  // The path part only — `/signin?redirect=…` must be refused as readily as `/signin`
  const path = candidate.split(/[?#]/)[0] as string;
  if (NEVER_RETURN_TO.some((route) => path === route || path.startsWith(`${route}/`))) {
    return DEFAULT_DESTINATION;
  }

  return candidate;
}

/**
 * A destination read off a route's search, validated at the door (TICKET-GAM-02)
 *
 * **Both auth surfaces need this, and one of them did not have it.** `/signin` has validated its
 * `redirect` since AUTH-03; `/signup` did not, and *Create one* dropped the destination on the
 * floor — so somebody following an invitation who has no account yet reached sign-up, created one,
 * and landed on the home page with the invitation gone. That is the common case for an invite link
 * rather than an edge of it (v3 Req 32.7, TICKET-GAM-02's criterion six).
 *
 * Extracted rather than copied for the reason `entityName.ts` gives, with one more: this is the
 * function that refuses an off-origin destination, and a second copy of a security check is a second
 * thing to get subtly wrong.
 *
 * @param search Whatever the router parsed out of the query string
 * @returns The `redirect` key, present only when one arrived — absent rather than `/`, so that
 *   every navigation to these pages does not start carrying a pointless `?redirect=/`
 */
export function destinationSearch(search: Record<string, unknown>): { redirect?: string } {
  const raw = search[REDIRECT_PARAM];

  return raw === undefined ? {} : { [REDIRECT_PARAM]: safeDestination(raw) };
}

/**
 * The search object a link to sign-in carries
 *
 * A function rather than a literal at each call site, so the key is spelled once and
 * {@link safeDestination} is applied on the way *out* as well as on the way in — a destination
 * assembled from a current location should be no more trusted than one that arrived in a link.
 *
 * @param destination Where to return afterwards
 * @returns The `search` for a navigation to `/signin`
 */
export function signInSearch(
  destination: string,
  options: { expired?: boolean } = {}
): { redirect: string; expired?: true } {
  return {
    [REDIRECT_PARAM]: safeDestination(destination),
    // Absent rather than `false` when it is not an expiry: a query string should say what happened,
    // not enumerate what did not
    ...(options.expired ? { [EXPIRED_PARAM]: true as const } : {}),
  };
}
