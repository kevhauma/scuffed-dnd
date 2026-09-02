/**
 * Putting a roll into a log, in the log's own order and never twice (TICKET-ROLL-07, TICKET-LIVE-02)
 *
 * Hoisted out of [`useTableRollLog`](./useTableRollLog.ts) by TICKET-DM-04 at its genuine second
 * caller: the session roster reads the table's *whole* log rather than one character's, from the same
 * three-sources-one-order problem this solves. Extracted rather than copied because both properties
 * are subtle and neither is visible in a call site.
 *
 * **A row cannot appear twice.** A roll a browser made arrives as the answer to its own `POST` *and*
 * as the broadcast to its own room, and whichever lands second must add nothing. The key is the
 * **Event's id**, which the route minted — not a client-side one, which the two arrivals would not
 * share.
 *
 * **Rows cannot be out of order.** They are sorted by **`seq`**, which is the log's order
 * (`UNIQUE(session_id, seq)`, DB-01), rather than by arrival, which is the network's.
 *
 * **Validates: v3 Req 41.6, 44.7**
 */

import type { SessionRoll } from '#shared/types/api';

/**
 * One roll into a log, in the log's own order and never twice
 *
 * Shaped as a reducer on purpose — a read that comes back with a page of rows folds it over them
 * with `rows.reduce(withRoll, current)`, and a single frame calls it once.
 *
 * @param history The log as it stands, newest first
 * @param logged The roll to put in it
 * @returns The log with it, or the log unchanged when it was already there
 */
export function withRoll(history: SessionRoll[], logged: SessionRoll): SessionRoll[] {
  const seen = history.some((roll) => roll.id === logged.id);

  if (seen) return history;

  const combined = [logged, ...history];

  return combined.sort((first, second) => second.seq - first.seq);
}
