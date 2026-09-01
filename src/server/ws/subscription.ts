/**
 * The only thing a client may say, and the guard that answers it (TICKET-LIVE-01)
 *
 * **This module is the socket's whole inbound surface.** Everything arriving on a connection is
 * decoded here, and exactly two verbs are accepted — *listen to this room* and *stop*. Anything
 * else is dropped and logged, which is
 * [D8](../../../docs/v3.0_backend/overview.md#d8--websockets-notify-http-mutates) as code: every
 * state-changing action is an HTTP request, so a mutation on this channel would be a mutation with
 * no route, no guard call site, and no test that can reach it without a socket.
 *
 * ## Authorization is the existing rule, applied — not a second scheme
 *
 * *Who is this* was decided **once, on the upgrade**, by the same `accountFromRequest` the HTTP
 * pipeline uses (`liveSocketServer.ts`'s `accountForUpgrade`). By the time anything here runs,
 * {@link LiveConnection.accountId} is settled and nothing a client sends can restate it.
 *
 * *May they* is decided **per subscribe**, by `requireMember` in `auth/guards.ts` — the same
 * function `GET /api/sessions/:id/rolls` calls, unmodified. There is no `findSessionMember` call
 * anywhere under `ws/`, deliberately: the moment a socket answers *may they* for itself, the
 * milestone has two authorization implementations and only one of them is the one people review.
 * `guards.ts`'s `Asking` interface exists for exactly this caller.
 *
 * **A refusal says nothing** (v3 Req 32.5). `requireMember` answers the identical `notFound()` for
 * *no such session* and *you are not a Member of it*, and this maps every one of its refusals onto
 * one payload carrying no reason and no code. The real reason is logged by `guards.ts` itself,
 * server-side, where an operator can read it and a client cannot.
 *
 * **A refused subscribe does not close the connection.** One socket may hold several rooms, so
 * closing on a bad id would cost a client its good rooms — and, worse, would let a caller read the
 * outcome off the connection state, re-leaking exactly what the indistinguishable payload just hid.
 * Closes are for connection-level facts; see `SOCKET_CLOSE_CODE`.
 *
 * **Validates: v3 Req 32.3, 32.5, 44.2, 44.4**
 */

import {
  CLIENT_MESSAGE_TYPE,
  type ClientSocketMessage,
  SERVER_MESSAGE_TYPE,
  type ServerSocketMessage,
} from '#shared/types/liveSocket';
import type { Asking } from '../auth/guards';
import { requireMember } from '../auth/guards';
import { AppError } from '../http/appError';
import type { LiveConnection, SocketRooms } from './rooms';

/** How much of an unrecognised message's verb is worth repeating into the log */
const LOGGED_TYPE_LIMIT = 40;

/**
 * The longest `sessionId` this socket will carry
 *
 * **Rejected rather than truncated, and that is the point.** A session id is
 * `crypto.randomUUID()` — 36 characters — so anything longer is not a session id, and the only
 * question is whether the server passes it on. It does: `requireMember` refuses unknown ids by
 * *logging them* (`auth/guards.ts`'s `refuse`), so an authenticated Member sending a frame full of
 * chosen text would be writing that text into the operator's log, a megabyte at a time. Truncating
 * would cap the volume and still log attacker-chosen bytes; refusing means **the id that reaches a
 * log is always one this server was willing to treat as real**.
 *
 * 64 rather than 36, so a future id scheme does not silently break the socket before anybody
 * notices this constant.
 */
const MAX_SESSION_ID_LENGTH = 64;

/**
 * Send one message to one connection
 *
 * @param connection Where to send it
 * @param message What to say
 */
function say(connection: LiveConnection, message: ServerSocketMessage): void {
  const frame = JSON.stringify(message);
  connection.send(frame);
}

/**
 * What one frame turned out to be
 *
 * A discriminated union rather than a nullable message plus a separate description, because the
 * two halves are never both meaningful and a caller should not be able to read the one that is not.
 */
type DecodedFrame =
  | { accepted: true; message: ClientSocketMessage }
  | { accepted: false; rejection: string };

/** This frame is one of the two verbs */
function accepted(message: ClientSocketMessage): DecodedFrame {
  return { accepted: true, message };
}

/** …and this one is not, described in words safe to put in a log */
function rejected(rejection: string): DecodedFrame {
  return { accepted: false, rejection };
}

/** The two fields this socket looks for, still entirely untrusted */
interface FrameBody {
  type?: unknown;
  sessionId?: unknown;
}

/**
 * Turn the bytes into an object, **once**
 *
 * The transport half, split from {@link decodeFrame}'s rules half. An earlier shape parsed the
 * frame in the happy path and *again* in a `describeRejected` helper — two decodes of the same
 * attacker-supplied bytes, which is both wasted work on every bad frame and two places for the
 * reading of it to drift apart. There is one `JSON.parse` on this path and this is it.
 *
 * @param raw The frame, as text
 * @returns The decoded object, or a string saying why there is not one
 */
function readFrameBody(raw: string): FrameBody | string {
  let value: unknown;

  try {
    value = JSON.parse(raw);
  } catch {
    return 'unparseable';
  }

  if (typeof value !== 'object' || value === null) return 'not an object';

  return value as FrameBody;
}

/**
 * What this socket will act on, if anything
 *
 * The two accepted shapes are matched **literally, one branch each**, rather than by looking the
 * `type` up in {@link CLIENT_MESSAGE_TYPE} and trusting the result: a lookup would widen the return
 * to the union of both and lose the discrimination the caller switches on.
 *
 * **Everything in a `rejection` is bounded**: the verb is truncated to {@link LOGGED_TYPE_LIMIT}
 * and no other field of the frame is ever quoted, because a client's frame is attacker-controlled
 * text and a log that echoes it unbounded is a log worth attacking. The `sessionId` is **refused**
 * above {@link MAX_SESSION_ID_LENGTH} rather than shortened — see that constant.
 *
 * @param raw The frame, as text
 * @returns The message, or a short description of why it is not one
 */
function decodeFrame(raw: string): DecodedFrame {
  const body = readFrameBody(raw);

  if (typeof body === 'string') return rejected(body);

  const { type, sessionId } = body;
  const verb = typeof type === 'string' ? type.slice(0, LOGGED_TYPE_LIMIT) : 'no type';

  if (typeof sessionId !== 'string' || sessionId === '') {
    return rejected(`${verb}, with no session id`);
  }

  if (sessionId.length > MAX_SESSION_ID_LENGTH) {
    // The length, never the value — the whole reason this branch exists is to keep that string out
    // of the log it was aimed at
    return rejected(`${verb}, with a session id of ${sessionId.length} characters`);
  }

  if (type === CLIENT_MESSAGE_TYPE.SUBSCRIBE) {
    return accepted({ type: CLIENT_MESSAGE_TYPE.SUBSCRIBE, sessionId });
  }

  if (type === CLIENT_MESSAGE_TYPE.UNSUBSCRIBE) {
    return accepted({ type: CLIENT_MESSAGE_TYPE.UNSUBSCRIBE, sessionId });
  }

  return rejected(verb);
}

/**
 * Admit a connection to a room, or refuse it saying nothing
 *
 * @param connection Who is asking
 * @param sessionId Which table
 * @param rooms Where admission is recorded
 * @throws Anything `requireMember` throws that is not an {@link AppError} — a bug rather than a
 *   refusal, handled where every other bug on this socket is
 */
function subscribe(connection: LiveConnection, sessionId: string, rooms: SocketRooms): void {
  const asking: Asking = { account: { id: connection.accountId } };

  try {
    requireMember(asking, sessionId);
  } catch (error) {
    if (!(error instanceof AppError)) throw error;

    // Every refusal `requireMember` can produce becomes this one object. A test asserts the
    // *not a member* and *no such session* payloads equal **each other** rather than asserting
    // each against a literal: two separate assertions can drift apart while both stay green, and
    // the property under test is that the two are indistinguishable (v3 Req 32.5).
    say(connection, { type: SERVER_MESSAGE_TYPE.SUBSCRIBE_REFUSED, sessionId });
    return;
  }

  rooms.join(sessionId, connection);
  say(connection, { type: SERVER_MESSAGE_TYPE.SUBSCRIBED, sessionId });
}

/**
 * Act on one frame from one connection
 *
 * @param connection Who sent it, with the Account settled on the upgrade
 * @param raw The frame, as text
 * @param rooms The registry to record admission in
 */
export function handleClientMessage(
  connection: LiveConnection,
  raw: string,
  rooms: SocketRooms
): void {
  const decoded = decodeFrame(raw);

  if (!decoded.accepted) {
    // **Criterion 4, and D8's whole point.** A `set-resource` or a `dm-award-experience` sent here
    // lands in this branch: it is not one of the two verbs, so it is dropped before anything reads
    // a body, touches a repository or opens a transaction. There is no path from this function to
    // a write.
    console.warn(`[live] ignored a message this socket does not accept: ${decoded.rejection}`);
    return;
  }

  const { message } = decoded;

  if (message.type === CLIENT_MESSAGE_TYPE.SUBSCRIBE) {
    subscribe(connection, message.sessionId, rooms);
    return;
  }

  // Leaving a room you are not in is already true, so there is nothing to refuse and nothing to
  // say back — and no guard to call, because leaving asks nothing about the session
  rooms.leave(message.sessionId, connection);
}
