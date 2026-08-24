/**
 * Every query that touches an `event` row (TICKET-DB-01)
 *
 * The log LIVE-02 fans out and LIVE-03 replays from. Two properties everything downstream rests on,
 * and both are held by the database rather than by callers being careful:
 *
 * - **`seq` is unique per session** — a `UNIQUE(session_id, seq)` index. Two writers cannot both
 *   claim number 7: one of them is refused by the constraint, and **the caller is what retries** —
 *   nothing here does, deliberately, because a repository that silently retries hides a write it
 *   did not make.
 * - **Append-only** — there is no update and no delete here. An event is what happened, and
 *   editing it is editing the past.
 *
 * **Validates: v3 Req 46.5, 44.5, 44.6**
 */

import { and, desc, eq, gt } from 'drizzle-orm';
import type { Database } from '../db/client';
import { event } from '../db/schema';

/**
 * An event row as the server holds it — `payload` is still JSON text
 *
 * Inferred rather than restated, for the reason `RulesetRow` gives.
 */
export type EventRow = typeof event.$inferSelect;

/** What appending an event needs to be told — note that `seq` is *not* among them */
export interface NewEvent {
  id: string;
  sessionId: string;
  /** Who did it, or `null` when the server itself acted */
  actorAccountId: string | null;
  type: string;
  /** The event's own shape as JSON text */
  payload: string;
  /** Epoch milliseconds */
  now: number;
}

/**
 * Append one event, taking the next sequence number for its session
 *
 * The read of the current maximum and the insert are one **immediate** transaction, and the word
 * matters. A default (deferred) `BEGIN` takes a read lock and upgrades on the `INSERT`; under WAL,
 * a second writer arriving in that window makes the upgrade fail with `SQLITE_BUSY_SNAPSHOT`,
 * which `busy_timeout` deliberately does *not* retry. `immediate` takes the write lock up front,
 * so a competing writer waits instead of failing.
 *
 * Within this process none of that is reachable — `better-sqlite3` is synchronous on one
 * connection — but "correct because nothing else is running" stops being true the first time a
 * backup job or a CLI opens the same file, and that is not a thing to discover from a support
 * report. The unique index remains the backstop: if the transaction were ever removed, the
 * constraint would still refuse the duplicate rather than let two events share a number.
 *
 * @param database The connection
 * @param input The event
 * @returns The stored row, with the sequence number it was given
 */
export function appendEvent(database: Database, input: NewEvent): EventRow {
  return database.db.transaction(
    (tx) => {
      const latest = tx
        .select({ seq: event.seq })
        .from(event)
        .where(eq(event.sessionId, input.sessionId))
        .orderBy(desc(event.seq))
        .limit(1)
        .get();

      return tx
        .insert(event)
        .values({
          id: input.id,
          sessionId: input.sessionId,
          seq: (latest?.seq ?? 0) + 1,
          actorAccountId: input.actorAccountId,
          type: input.type,
          payload: input.payload,
          createdAt: input.now,
        })
        .returning()
        .get();
    },
    { behavior: 'immediate' }
  );
}

/**
 * Everything that happened in a session after a given sequence number
 *
 * What a client reconnecting asks for (LIVE-03): "I saw up to 41, what have I missed?"
 *
 * @param database The connection
 * @param sessionId Which session
 * @param afterSeq The last sequence number the caller has; `0` for everything
 * @returns The events in order
 */
export function eventsSince(database: Database, sessionId: string, afterSeq: number): EventRow[] {
  return database.db
    .select()
    .from(event)
    .where(and(eq(event.sessionId, sessionId), gt(event.seq, afterSeq)))
    .orderBy(event.seq)
    .all();
}
