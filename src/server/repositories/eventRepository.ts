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

import { and, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import { type Database, getDatabase } from '../db/client';
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
export function appendEvent(input: NewEvent, database: Database = getDatabase()): EventRow {
  return database.db.transaction((tx) => appendEventWithin(tx, input), { behavior: 'immediate' });
}

/**
 * A connection, or a transaction already open on one
 *
 * Derived from the callback `transaction` hands out rather than restated, so an upgrade of
 * `drizzle-orm` that changes the shape is a compile error here rather than a second definition
 * quietly disagreeing with the first.
 */
export type EventWriter = Parameters<Parameters<Database['db']['transaction']>[0]>[0];

/**
 * Append one event **inside a transaction the caller already opened** (TICKET-PLY-01)
 *
 * The reason this is separate from {@link appendEvent} rather than being its whole body: a player
 * action writes the character *and* its Event, and the two have to land together or not at all —
 * GAM-01's review found exactly that pair split across two transactions on the Snapshot path. So
 * `characterRepository.recordPlayerAction` opens one transaction and calls this inside it, and
 * `appendEvent` stays what a caller with nothing else to write reaches for.
 *
 * **The sequence read and the insert are still one atomic unit**, because the caller's transaction
 * is the unit. `appendEvent` opens its own with `immediate` for the reason its docblock gives; a
 * caller composing this is responsible for doing the same.
 *
 * @param tx The open transaction
 * @param input The event
 * @returns The stored row, with the sequence number it was given
 */
export function appendEventWithin(tx: EventWriter, input: NewEvent): EventRow {
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
}

/**
 * The events of one kind in a session, newest first (TICKET-ROLL-07)
 *
 * **The first read of this table, and it is deliberately keyed the way LIVE-03's replay will be**:
 * `(session_id, seq)` is the unique index the schema already carries, so filtering by session and
 * ordering by `seq` costs nothing extra and adds no schema to that ticket. `type` narrows it in
 * memory-cheap fashion after that — a session has one kind of event in quantity and the index is
 * doing the work that matters.
 *
 * **Newest first and capped**, unlike {@link eventsSince}: this answers *what has been happening*
 * for a person reading a log, where the top of the list is what they want; that one answers *what
 * have I missed*, where the order has to be forward and nothing may be dropped.
 *
 * **The actor narrows it *before* the cap**, which the review found mattering: capping at the
 * table's hundred most recent and letting the caller filter afterwards is how one Player's events
 * fall out of their own view on a busy session, with nothing saying they were dropped. `null` asks
 * for the table's.
 *
 * It is `actor_account_id` rather than anything inside the payload because the column is queryable
 * and the JSON is not (D4).
 *
 * @param sessionId Which session
 * @param type Which kind of event
 * @param actorAccountId Whose, or `null` for everybody's
 * @param limit How many at most
 * @param database The connection; defaults to the process's
 * @returns The events, newest first
 */
export function latestEventsOfType(
  sessionId: string,
  type: string,
  actorAccountId: string | null,
  limit: number,
  database: Database = getDatabase()
): EventRow[] {
  return database.db
    .select()
    .from(event)
    .where(
      and(
        eq(event.sessionId, sessionId),
        eq(event.type, type),
        // One function rather than two that differ by a line: `fallow` measured the pair as an
        // eleven-line clone, and they differ in *data* rather than in behaviour — the case the
        // conventions say to share
        ...(actorAccountId === null ? [] : [eq(event.actorAccountId, actorAccountId)])
      )
    )
    .orderBy(desc(event.seq))
    .limit(limit)
    .all();
}

/**
 * The events of any of several kinds that name one character, newest first (TICKET-DM-01)
 *
 * What a Player's own adjustment history is read from (v3 Req 42.7), and the DM's view of the same
 * sheet.
 *
 * ## Why this narrows on the payload, when `latestEventsOfType` deliberately does not
 *
 * That function's docblock states the rule — *`actor_account_id` rather than anything inside the
 * payload, because the column is queryable and the JSON is not* — and this is the case that rule
 * cannot serve. There is no `character_id` column: an Event belongs to a **session**, and which
 * character it moved is a field of `PlayerActionEvent`. The alternative was to cap at the table's
 * hundred most recent adjustments and filter in the handler, which is precisely the bug the
 * `listRolls` review found — on a busy table one character's history falls out of their own view
 * with nothing saying it was dropped. So the narrowing happens **before** the cap, and the only
 * place it can happen before the cap is in the query.
 *
 * `json_extract` is SQLite's own, compiled into `better-sqlite3`, and it reads the same JSON text
 * `JSON.parse` does at the other end. This is not the start of a normalised event schema — nothing
 * joins on it and nothing indexes it — and a second use of it would be the moment to ask whether the
 * column should exist instead.
 *
 * @param sessionId Which session's log
 * @param characterId Whose adjustments — matched against the payload's `characterId`
 * @param types Which kinds of event count as an adjustment
 * @param limit How many at most
 * @param database The connection; defaults to the process's
 * @returns The events, newest first
 */
export function latestCharacterEvents(
  sessionId: string,
  characterId: string,
  types: string[],
  limit: number,
  database: Database = getDatabase()
): EventRow[] {
  return database.db
    .select()
    .from(event)
    .where(
      and(
        eq(event.sessionId, sessionId),
        inArray(event.type, types),
        sql`json_extract(${event.payload}, '$.characterId') = ${characterId}`
      )
    )
    .orderBy(desc(event.seq))
    .limit(limit)
    .all();
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
export function eventsSince(
  sessionId: string,
  afterSeq: number,
  database: Database = getDatabase()
): EventRow[] {
  return database.db
    .select()
    .from(event)
    .where(and(eq(event.sessionId, sessionId), gt(event.seq, afterSeq)))
    .orderBy(event.seq)
    .all();
}
