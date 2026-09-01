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
 * **Since TICKET-LIVE-02 the two append functions have exactly one caller** —
 * [`events/recordEvent.ts`](../events/recordEvent.ts), which publishes every row it writes to that
 * session's room. Nothing else in `src/server/` may call them, and `events/eventFanOut.test.ts`
 * walks the tree to say so: an Event that is written without being published is an action nobody at
 * the table is told about, which is the failure the whole live feed exists to rule out. A caller
 * composing an Event with another write takes an {@link AppendEvent} rather than importing one.
 * The **read** functions below have no such rule and are called from wherever a log is projected.
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
 * One Event, already decided, waiting to be written (TICKET-LIVE-02)
 *
 * **What a repository is handed instead of importing {@link appendEventWithin} itself.** The two
 * writes that carry an Event alongside something else — a player action and its character, a
 * Snapshot refresh and its session — used to reach for the append directly, which meant three
 * modules could put a row in `event` and only one of them could be watched. Now `recordEvent`
 * binds the Event into one of these and passes it down, so **the append has exactly one call site
 * in `src/server/`** and `events/eventFanOut.test.ts` can say so by walking the tree.
 *
 * **The transaction is optional and that is the whole flexibility it needs**: a caller that has
 * opened one passes it, so the Event lands or fails with the rest of its fact; a caller with
 * nothing else to write calls it bare and {@link appendEvent} takes its own `immediate`
 * transaction. Two types, one for each, would have made every writer decide which kind it was.
 *
 * The type lives here rather than beside `recordEvent` because a repository naming it must not
 * import from `server/events/` — that module imports *this* one, and the pair would be a cycle
 * `no-circular` refuses.
 */
export type AppendEvent = (tx?: EventWriter) => EventRow;

/**
 * What a write that carried an Event hands back (TICKET-LIVE-02)
 *
 * Both rows: `written` is the rest of the fact — the character, the session — and `event` is what
 * `recordEvent` publishes. Declared here beside {@link AppendEvent} rather than beside its
 * publisher, so that a repository returning one is not importing a type from a layer above it.
 */
export interface Recorded<T> {
  event: EventRow;
  written: T;
}

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
 * How far a session's log has got (TICKET-LIVE-03)
 *
 * **Asked *before* {@link eventsSince}, and that ordering is the whole point.** A reconnecting
 * client names the number it got to; the server has to decide whether the distance from there to
 * here is worth replaying at all, and it cannot decide that by fetching the rows and counting them
 * — a client gone for an hour would have the server read two thousand rows in order to conclude it
 * should not have. This answers the question with the index and no rows.
 *
 * It is also what a `resync` instruction carries, so a client that refetches knows where to resume
 * from rather than guessing low and asking for the gap it was just told to skip.
 *
 * @param sessionId Which session
 * @param database The connection; defaults to the process's
 * @returns The highest `seq` in that session, or `0` for a session nothing has happened in
 */
export function latestEventSeq(sessionId: string, database: Database = getDatabase()): number {
  const latest = database.db
    .select({ seq: event.seq })
    .from(event)
    .where(eq(event.sessionId, sessionId))
    .orderBy(desc(event.seq))
    .limit(1)
    .get();

  // Zero rather than `null`: *nothing has happened here* and *I have seen nothing* are the same
  // number on both sides of the comparison the replay makes, and an optional would make every
  // caller restate that
  return latest?.seq ?? 0;
}

/**
 * Everything that happened in a session after a given sequence number
 *
 * What a client reconnecting asks for (LIVE-03): "I saw up to 41, what have I missed?"
 *
 * **Uncapped, deliberately, and bounded by its caller instead.** `ws/replay.ts` asks
 * {@link latestEventSeq} first and refuses to call this at all when the gap exceeds the replay
 * window — so the row count here is bounded by that window rather than by a `limit` clause. A cap
 * *here* would be worse than none: it would silently return a prefix of the answer, which is the
 * one thing a gapless replay cannot survive, where the caller's refusal is visible and says so.
 *
 * @param sessionId Which session
 * @param afterSeq The last sequence number the caller has; `0` for everything
 * @param database The connection
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
