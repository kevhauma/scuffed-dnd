/**
 * How long to wait before trying the socket again (TICKET-LIVE-03)
 *
 * Pure, and separate from the connection that uses it, because the property this has to hold is
 * about **fifty browsers at once** and not about any one of them: a server that restarts drops every
 * connected client in the same instant, and fifty clients that all wait exactly one second produce
 * the same stampede they were dropped by — one second later, against a server that is still starting.
 *
 * ## Equal jitter, rather than none or full
 *
 * The delay is **half fixed, half random**: `ceiling / 2 + random × ceiling / 2`, where the ceiling
 * doubles per attempt up to {@link RECONNECT_CAP_MS}. The two rejected alternatives are rejected for
 * opposite reasons. *No jitter* is the stampede. *Full jitter* — `random × ceiling` — spreads best
 * but lets a client retry after almost no wait at all, which on a server that is refusing because it
 * is busy is the one client that keeps asking.
 *
 * The floor is what makes it testable as well as polite: every delay for a given attempt lands in a
 * known half-open band, so `liveBackoff.test.ts` can assert the spread of fifty of them without
 * asserting any particular one.
 *
 * **Validates: v3 Req 44.6**
 */

/**
 * The first ceiling — a hiccup costs about a second
 *
 * Short enough that a wifi blip is invisible to somebody watching the screen, long enough that a
 * server refusing connections is not being asked ten times a second.
 */
export const RECONNECT_BASE_MS = 1_000;

/**
 * …and the longest a client will ever wait between attempts
 *
 * Thirty seconds, so a browser left open overnight against a server that is down is making two
 * attempts a minute rather than thousands — and comes back on its own within half a minute of the
 * server returning, with nobody reloading anything.
 */
export const RECONNECT_CAP_MS = 30_000;

/**
 * How long a connection has to last before it counts as having worked
 *
 * **The defence against a *shutting-down* server**, which is a real state rather than a hypothetical
 * one: a process going away accepts a connection and closes it a moment later, so a client that
 * reset its attempt counter on every `open` would sit at the base delay forever and fifty of them
 * would do it together. Five seconds is far longer than accept-then-close and far shorter than any
 * session worth counting.
 */
export const CONNECTION_STABLE_MS = 5_000;

/**
 * How long to wait before attempt number `attempt`
 *
 * @param attempt Which try this is, counting from 1 for the first retry after a drop
 * @param random A source in `[0, 1)` — `Math.random` in the app, a fake in a test
 * @returns The delay in whole milliseconds, inside `[ceiling / 2, ceiling]`
 */
export function backoffDelay(attempt: number, random: () => number): number {
  // Counting from 1 means the first retry uses the base ceiling rather than half of it. A caller
  // passing 0 or less is asking for the first retry, and answering that rather than computing a
  // fractional ceiling keeps the band claim above true for every input.
  const tries = attempt < 1 ? 1 : attempt;
  const doubled = RECONNECT_BASE_MS * 2 ** (tries - 1);
  const ceiling = Math.min(RECONNECT_CAP_MS, doubled);
  const floor = ceiling / 2;
  const spread = random() * floor;

  return Math.round(floor + spread);
}
