/**
 * The one way an Event is written, and the reason it always reaches the table (TICKET-LIVE-02)
 *
 * Every ticket from PLY-01 onward has been writing Events that nothing read. This is where they go:
 * **the write and the broadcast are one path**, so an Event cannot be persisted without being
 * published, and no future action can be added that changes a character in silence.
 *
 * ## Why the write is injected rather than performed here
 *
 * `queries-belong-to-repositories` forbids anything outside `db/`, `repositories/` and `testing/`
 * from touching Drizzle or the connection — this module included — so it cannot open the
 * transaction, and a transaction is exactly what two of the three writers need: a player action
 * writes the character *and* its Event, a Snapshot refresh writes the session *and* its Event, and
 * either half landing alone is a corruption of the log (`recordPlayerAction`'s own docblock has the
 * argument).
 *
 * So the shape is inverted: the repository keeps its transaction and is handed an
 * {@link AppendEvent} — this Event, bound, waiting for a `tx` — and hands back both rows. That is
 * not a workaround for the rule; it is what makes the rule's own goal provable. **After it,
 * `appendEvent(` and `appendEventWithin(` appear at exactly one call site in `src/server/`, and
 * [`eventFanOut.test.ts`](./eventFanOut.test.ts) walks the tree and says so.** An allow-list of
 * modules permitted to append would have been a list somebody adds a line to.
 *
 * ## The broadcast happens after the write, and cannot fail it
 *
 * `better-sqlite3` is synchronous, so a repository that has returned is a transaction that has
 * committed — which is why {@link recordEvent} publishes *after* `write` rather than inside it. A
 * write that wrote nothing publishes nothing.
 *
 * And the publish is wrapped: **a failed fan-out must never fail a committed write.** The row is
 * already in the log by the time anything is sent; throwing here would turn "nobody was notified"
 * into "the caller believes their action was refused", which is strictly worse — they would retry a
 * change that already happened. `rooms.ts` already guards each recipient's `send` for the same
 * reason one dead socket must not swallow a room; this guards the frame itself.
 *
 * **Validates: v3 Req 44.4, 44.5, 45.1**
 */

import { SERVER_MESSAGE_TYPE } from '#shared/types/liveSocket';
import type { AppendEvent, EventRow, NewEvent, Recorded } from '../repositories/eventRepository';
import { appendEvent, appendEventWithin } from '../repositories/eventRepository';
import { liveRooms, type SocketRooms } from '../ws/rooms';

/** A repository write that appends the Event it is handed, in the same transaction as its own row */
export type EventfulWrite<T> = (append: AppendEvent) => Recorded<T>;

/** …and one that may find nothing to write at all, in which case there is no Event either */
export type NullableWrite<T> = (append: AppendEvent) => Recorded<T> | null;

/**
 * Turn a stored row into the frame the room reads (v3 Req 44.4, 44.5)
 *
 * The session is on the message rather than in the event, because the frame already names the room
 * it was sent to and two spellings of *which table* is one more than a reader needs. The payload is
 * parsed here — our own bytes, written by this server, the same call `playerStateOf` makes.
 *
 * @param row The Event as the log holds it
 * @returns The frame, as text
 */
function frameFor(row: EventRow): string {
  const payload: unknown = JSON.parse(row.payload);

  return JSON.stringify({
    type: SERVER_MESSAGE_TYPE.EVENT,
    sessionId: row.sessionId,
    event: {
      id: row.id,
      seq: row.seq,
      type: row.type,
      actorAccountId: row.actorAccountId,
      at: row.createdAt,
      payload,
    },
  });
}

/**
 * Send one Event to its session's room, and to no other (v3 Req 44.3)
 *
 * @param row The Event that was just written
 * @param rooms Where the connections are
 */
function publish(row: EventRow, rooms: SocketRooms): void {
  try {
    const frame = frameFor(row);
    rooms.broadcast(row.sessionId, frame);
  } catch (error) {
    // The row is committed and the caller's action succeeded. See the module note: failing here
    // would report a change that happened as one that did not.
    console.error('[live] an Event was written but could not be broadcast', error);
  }
}

/**
 * Append one Event and tell its table about it
 *
 * The **only** path from `src/server/` to a row in `event`. A caller with something else to write
 * passes the repository call that writes both; a caller with nothing else passes {@link eventAlone}.
 *
 * @param input The Event to append — `seq` is the log's to assign, not the caller's
 * @param write What actually writes it, inside whatever transaction the rest of the fact needs
 * @param rooms Where to publish it; defaults to this process's rooms
 * @returns Both rows, or `null` when the write found nothing to write
 */
export function recordEvent<T>(
  input: NewEvent,
  write: EventfulWrite<T>,
  rooms?: SocketRooms
): Recorded<T>;
export function recordEvent<T>(
  input: NewEvent,
  write: NullableWrite<T>,
  rooms?: SocketRooms
): Recorded<T> | null;
export function recordEvent<T>(
  input: NewEvent,
  write: NullableWrite<T>,
  rooms: SocketRooms = liveRooms()
): Recorded<T> | null {
  const append: AppendEvent = (tx) =>
    tx === undefined ? appendEvent(input) : appendEventWithin(tx, input);

  const recorded = write(append);

  // Nothing written is nothing to announce — the Snapshot refresh's missing-session race, where the
  // update matched no row and the transaction rolled back to exactly what it found
  if (!recorded) return null;

  publish(recorded.event, rooms);

  return recorded;
}

/**
 * The write for a caller with nothing else to record — a roll, which changes no stored state
 *
 * Calling the appender **bare** is what takes `appendEvent`'s own `immediate` transaction, since
 * there is no caller's to join. One line, but it is a named one so that a route reads
 * `recordEvent(input, eventAlone)` — *this Event and nothing else* — rather than an inline closure
 * whose shape a reader has to work out.
 *
 * @param append The bound appender
 * @returns The Event row, as both halves of the answer
 */
export const eventAlone: EventfulWrite<EventRow> = (append) => {
  const row = append();

  return { event: row, written: row };
};
