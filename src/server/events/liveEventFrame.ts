/**
 * One `event` row, as the room reads it (TICKET-LIVE-02, TICKET-LIVE-03)
 *
 * **Hoisted out of `recordEvent.ts` by TICKET-LIVE-03, and the reason is the whole of why it is its
 * own module.** There are now two ways an Event reaches a client — broadcast the instant it is
 * written, and **replayed** to a connection that missed it — and the two must be byte-identical.
 * They are the same rows, so a client that applied one and refetched over the other would be
 * reconciling two spellings of one fact. Two projections that have to agree is a drift with a date
 * on it; one function is the fix.
 *
 * The session is on the message rather than inside the event, because the frame already names the
 * room and two spellings of *which table* is one more than a reader needs. The payload is parsed
 * here — our own bytes, written by this server, the same call `playerStateOf` makes.
 *
 * **This is the only module in `src/server/` that composes a `SERVER_MESSAGE_TYPE.EVENT` frame**,
 * and `eventFanOut.test.ts` asserts exactly that by walking the tree. That guard is deliberately
 * about *composition* rather than about who calls `broadcast`: an Event frame is a claim about the
 * table, and a second place that could build one is a second place that could make a claim the log
 * does not carry.
 *
 * **Validates: v3 Req 44.4, 44.5, 44.6**
 */

import { type LiveEvent, SERVER_MESSAGE_TYPE } from '#shared/types/liveSocket';
import type { EventRow } from '../repositories/eventRepository';

/**
 * The Event, as the contract declares it
 *
 * @param row The Event as the log holds it
 * @returns The event half of the frame
 */
function liveEventOf(row: EventRow): LiveEvent {
  const payload: unknown = JSON.parse(row.payload);

  return {
    id: row.id,
    seq: row.seq,
    type: row.type,
    actorAccountId: row.actorAccountId,
    at: row.createdAt,
    payload,
  };
}

/**
 * One Event, ready to send
 *
 * @param row The Event as the log holds it
 * @returns The frame, as text
 */
export function liveEventFrame(row: EventRow): string {
  const event = liveEventOf(row);

  return JSON.stringify({
    type: SERVER_MESSAGE_TYPE.EVENT,
    sessionId: row.sessionId,
    event,
  });
}
