/**
 * What a reconnecting client missed, or the instruction to stop asking (TICKET-LIVE-03)
 *
 * v3 Req 44.6, and the whole of it: *replay the Events it missed from its last-seen sequence
 * number, or instruct it to resynchronise fully when the gap is too large*.
 *
 * ## Why this is gapless, and what would silently break it
 *
 * A `subscribe` carrying a sequence number is handled in **one synchronous turn** — `requireMember`,
 * `rooms.join`, {@link latestEventSeq} and {@link eventsSince} are all synchronous, because
 * `better-sqlite3` is — and every broadcast that could compete with it originates in an HTTP
 * handler, which is a *later* turn of the event loop. So there is no instant between the join and
 * the query at which an Event can be written: a client cannot be admitted-then-missed (a gap) and
 * cannot be replayed-then-sent-again (a duplicate).
 *
 * **That property is a consequence of nothing on this path being `async`, and it would die
 * silently.** Make one of those four calls return a Promise and the room join and the log read fall
 * into different turns, with a window between them exactly as wide as the await — and every test
 * here would still pass, because none of them can schedule a broadcast into a window that does not
 * exist yet. `subscription.test.ts` asserts the shape instead: the join and the replay have both
 * *happened by the time `handleClientMessage` returns*, which is the observable form of "there is no
 * interleaving point".
 *
 * ## The window, and why exceeding it is a normal outcome
 *
 * {@link REPLAY_WINDOW_EVENTS} is a ceiling on catching-up, not an error condition. A client gone
 * for a minute should be replayed; one gone for an hour should read the session again, because
 * replaying two thousand Events to arrive at the state one `GET` returns is slower, and every one of
 * them is a chance to apply something wrong. The log is never trimmed — a resynchronise is the
 * client being told the *cheaper* answer, not the only one.
 *
 * ## The frames are the log's own
 *
 * Every Event sent from here is `liveEventFrame`'s projection of a row — the same function
 * `recordEvent` publishes through. Nothing is composed here that the log does not already hold,
 * which is why replay does not weaken TICKET-LIVE-02's rule that an Event frame is a claim the log
 * carries. It is the same claim, delivered late.
 *
 * **Validates: v3 Req 44.6**
 */

import type { ServerSocketMessage } from '#shared/types/liveSocket';
import { SERVER_MESSAGE_TYPE } from '#shared/types/liveSocket';
import { liveEventFrame } from '../events/liveEventFrame';
import { eventsSince, latestEventSeq } from '../repositories/eventRepository';
import type { LiveConnection } from './rooms';

/**
 * How far back this server will catch a client up, in Events
 *
 * **A documented constant rather than an environment variable**, deliberately. `env.ts`'s contract
 * is that every variable it reads is a thing an *operator* decides and is justified in
 * `.env.example`; nobody deploying this has a reason to tune the number, and a setting with no
 * decided meaning is what that module's own docblock warns against. TICKET-POL-03 owns deployment
 * knobs, and promoting this to one is a line of code the day somebody asks.
 *
 * **200 is chosen against what a table actually produces.** A busy session — a fight, six players,
 * a DM adjusting pools between every turn — writes on the order of one Event every few seconds, so
 * two hundred is roughly the last ten to twenty minutes of play: a lunch break, a train tunnel, a
 * laptop lid. Beyond that the client has been gone long enough that reading the session again is
 * both cheaper and more likely to be right.
 */
export const REPLAY_WINDOW_EVENTS = 200;

/**
 * Send one message to one connection
 *
 * The same two lines `subscription.ts` calls `say`, and deliberately **not** shared with it: that
 * would be an abstraction at its second caller, and the two modules cannot import each other's
 * anyway — `subscription.ts` imports this one. Extract it when a third appears.
 *
 * @param connection Where to send it
 * @param message What to say
 */
function say(connection: LiveConnection, message: ServerSocketMessage): void {
  const frame = JSON.stringify(message);
  connection.send(frame);
}

/**
 * Which rooms each connection has already been caught up on
 *
 * **The bound on *repetition*, which the validation of the value could not give** (LIVE-03's review).
 * Everything about `afterSeq` as a *number* is checked by `subscription.ts` — non-integer, negative
 * and non-numeric refuse the whole frame, and the session is the one `requireMember` approved. What
 * that leaves unbounded is how often a Member of one table may ask: `rooms.join` is idempotent, but a
 * replay is not, and a ~60-byte frame repeated buys an index read plus up to
 * {@link REPLAY_WINDOW_EVENTS} row reads, parses and sends — **synchronously, on the single process
 * serving every other table**. That is a two-hundred-fold amplification on a channel that used to
 * cost one indexed lookup per frame, which is the same class of thing
 * `subscription.ts`'s `MAX_SESSION_ID_LENGTH` reasons about one field over.
 *
 * **Once per room per connection is all a legitimate client needs**, because a reconnect is a *new*
 * connection and therefore a new entry: `liveSocketServer.ts` builds one `LiveConnection` per
 * accepted socket. A client that unsubscribes and resubscribes on the same socket asks for no replay
 * at all — it drops the room from its own map, so the second subscribe is a first subscribe.
 *
 * A `WeakMap` rather than a cleared registry: the key is the connection object itself, so an entry
 * goes when the socket does, with nothing to remember to clean up.
 */
const caughtUp = new WeakMap<LiveConnection, Set<string>>();

/**
 * Whether this connection has already been caught up on this room, recording it if not
 *
 * @param connection Who is asking
 * @param sessionId Which table
 * @returns True when a replay has already been sent for that pair
 */
function alreadyCaughtUp(connection: LiveConnection, sessionId: string): boolean {
  const rooms = caughtUp.get(connection);

  if (!rooms) {
    const first = new Set([sessionId]);
    caughtUp.set(connection, first);
    return false;
  }

  if (rooms.has(sessionId)) return true;

  rooms.add(sessionId);
  return false;
}

/**
 * Catch one connection up on one room, or tell it to read the session again (v3 Req 44.6)
 *
 * Called **after** `requireMember` has approved this connection for this session and after the room
 * has been joined — both of which matter. The guard is what makes the query safe, since the only
 * session id that reaches here is one the caller is a Member of; and joining first is what makes the
 * result gapless, per the module note.
 *
 * @param connection Who is catching up
 * @param sessionId Which table — already approved by `requireMember`
 * @param afterSeq The last `seq` they saw, validated as a non-negative integer by the decoder
 * @param latest Where the log stands; defaulted so a caller that has not already read it need not,
 *   and passed by `subscription.ts`, which reads it once and spends it on the acknowledgement too
 */
export function replayTo(
  connection: LiveConnection,
  sessionId: string,
  afterSeq: number,
  latest: number = latestEventSeq(sessionId)
): void {
  // **Once per room per connection** — see {@link caughtUp}. Silent rather than refused: a second
  // ask is not an error a legitimate client can make, and answering it with anything at all would
  // be a reply worth repeating.
  if (alreadyCaughtUp(connection, sessionId)) return;

  // Nothing missed. Also the answer for a client claiming a number *ahead* of the log, which is not
  // an error worth a reply: they have seen everything there is, whatever they think they saw.
  if (afterSeq >= latest) return;

  const gap = latest - afterSeq;

  if (gap > REPLAY_WINDOW_EVENTS) {
    // The current head goes with the instruction, so the client resumes from the right place after
    // its refetch instead of guessing low and asking for the gap it was just told to skip
    say(connection, { type: SERVER_MESSAGE_TYPE.RESYNC, sessionId, seq: latest });
    return;
  }

  const missed = eventsSince(sessionId, afterSeq);

  // In `seq` order, which is `eventsSince`'s own ordering — the log's order rather than the
  // network's. Sent before any live frame can reach this connection, because a broadcast is a later
  // turn, which is what lets the client treat "not greater than the last seq I saw" as a duplicate.
  for (const row of missed) {
    const frame = liveEventFrame(row);
    connection.send(frame);
  }
}
