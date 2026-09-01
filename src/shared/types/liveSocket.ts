/**
 * What travels on the live socket, declared once for both ends (TICKET-LIVE-01, TICKET-LIVE-02,
 * TICKET-LIVE-03)
 *
 * The socket is **server → client** ([D8](../../../docs/v3.0_backend/overview.md#d8--websockets-notify-http-mutates)):
 * every state-changing action is an HTTP request, and the only thing a client may say here is
 * *which rooms it is listening to*. That is what keeps authorization to one implementation — the
 * HTTP one — rather than one per transport, and it is why {@link CLIENT_MESSAGE_TYPE} has two
 * members and will not grow a third that writes anything.
 *
 * **TICKET-LIVE-03 added a *parameter* rather than a verb**, and the distinction is the whole of why
 * D8 needed no amendment: {@link SubscribeMessage.afterSeq} says *where I got to*, so the same
 * `subscribe` a client already sent now also asks to be caught up. It steers a server-side query,
 * which is closer to a read than to a notification — see D8's note, and `server/ws/replay.ts` for
 * the two things that keep it safe (it is validated as a non-negative integer or absent, and the
 * query runs **after** `requireMember` against the session the guard approved).
 *
 * In the Kernel rather than in `server/ws/` for the reason every shape in this folder is: the
 * server produces these and the client reads them, so a second declaration on either side is one
 * that can drift. **The path and the close codes are part of that contract**, not implementation
 * detail — a client that guessed either would fail in a way neither side could typecheck.
 *
 * **Nothing here names a host.** {@link LIVE_SOCKET_PATH} is a path, and the origin is whatever
 * `window.location` says (v3 Req 47.6, D1) — see `client/services/liveSocket.ts`.
 *
 * **Validates: v3 Req 44.1, 44.2, 44.4, 47.6**
 */

/** Where the socket answers — a path, deliberately, so no constant anywhere names the socket host */
export const LIVE_SOCKET_PATH = '/api/live';

/**
 * Why a connection was closed, when this server is the one closing it
 *
 * **All in the 4000–4999 range**, which RFC 6455 reserves for the application: a code below it
 * would collide with a meaning the protocol or the library already owns, and a client branching on
 * `1008` could not tell our refusal from `ws`'s own.
 *
 * **A refused *subscribe* is not in here, and that is a design decision rather than an omission.**
 * These are connection-level facts. Room-level refusals are a message
 * ({@link SERVER_MESSAGE_TYPE.SUBSCRIBE_REFUSED}) so that one connection holding several rooms
 * survives a bad id — and so that a caller cannot read the outcome off the connection state, which
 * would re-leak exactly what an indistinguishable refusal payload just hid (v3 Req 32.5).
 */
export const SOCKET_CLOSE_CODE = {
  /**
   * No Auth_Session cookie, or one that does not verify (v3 Req 44.1)
   *
   * **Sent as a close code rather than as a `401` mid-handshake.** A browser `WebSocket` refused
   * during the upgrade surfaces a bare `error` event carrying no status at all, so a client could
   * not tell *sign in and come back* from *the network is down* — and under
   * [D6](../../../docs/v3.0_backend/overview.md#d6--local-mode-stays-sign-in-gates-connected-play-only)
   * that is the one distinction it genuinely needs, the whole app being usable signed out. It is
   * the same reasoning `server/auth/guards.ts` gives for keeping 401 distinct from 404.
   */
  UNAUTHENTICATED: 4401,
  /** The Account stopped being a Member of that room's session (v3 Req 39.3, TICKET-GAM-04) */
  MEMBERSHIP_ENDED: 4403,
  /** The server is shutting down; this is not a refusal and a client may reconnect */
  SERVER_STOPPING: 4499,
} as const;

/**
 * A code this server closes with
 *
 * Named rather than left as `number`, and `LiveConnection.close` takes it: a close code is one of
 * exactly three things this server says, and typing the parameter is what makes that true at every
 * call site instead of only in the ones somebody remembered.
 */
export type SocketCloseCode = (typeof SOCKET_CLOSE_CODE)[keyof typeof SOCKET_CLOSE_CODE];

/**
 * Everything a client may say
 *
 * Two members, and D8 is why there will never be a third that changes anything: a mutation on this
 * channel would be a mutation with no route, no guard call site and no test that reaches it without
 * a socket. Anything else that arrives is dropped and logged — see `server/ws/subscription.ts`.
 */
export const CLIENT_MESSAGE_TYPE = {
  /** Listen to a Game_Session's room. `requireMember` decides. */
  SUBSCRIBE: 'subscribe',
  /** Stop listening. Never refused — leaving a room you are not in is already true. */
  UNSUBSCRIBE: 'unsubscribe',
} as const;

/** *Listen to this session* — and, since TICKET-LIVE-03, *from here* */
export interface SubscribeMessage {
  type: typeof CLIENT_MESSAGE_TYPE.SUBSCRIBE;
  sessionId: string;
  /**
   * The last `seq` this client saw in that room, when it has seen one (v3 Req 44.6)
   *
   * **Absent on a first subscribe, present only across a reconnect.** A surface that has just
   * opened read its state over HTTP a moment ago, so replaying the table's history into it would be
   * work with nothing to correct; a surface whose socket died at 41 has a gap, and this is the
   * number that closes it.
   *
   * `0` is not the same as absent and is not spelled: a client that has seen nothing has nothing to
   * resume from. See `server/ws/replay.ts` for what the server does with it, including the case
   * where the gap is too large to be worth replaying.
   */
  afterSeq?: number;
}

/** *Stop listening to this session* */
export interface UnsubscribeMessage {
  type: typeof CLIENT_MESSAGE_TYPE.UNSUBSCRIBE;
  sessionId: string;
}

/** Anything the socket accepts from a client */
export type ClientSocketMessage = SubscribeMessage | UnsubscribeMessage;

/** Everything this server says back */
export const SERVER_MESSAGE_TYPE = {
  /** The subscribe was allowed and the connection is now in that room */
  SUBSCRIBED: 'subscribed',
  /**
   * The subscribe was refused, and the payload says nothing about why (v3 Req 32.5)
   *
   * *No such session* and *you are not a Member of it* produce the **same object**, because
   * `requireMember` produces the same refusal for both and a socket that widened that would undo
   * the rule at its last mile. The real reason is logged server-side, where an operator can read
   * it and a client cannot.
   */
  SUBSCRIBE_REFUSED: 'subscribe-refused',
  /** Something happened at that table (TICKET-LIVE-02) — see {@link LiveEvent} */
  EVENT: 'event',
  /**
   * Who is connected to that table right now (TICKET-LIVE-03, v3 Req 44.8)
   *
   * Sent to a whole room whenever its **account** set changes, which is not the same as whenever a
   * connection changes: two tabs of one Account are one person at the table, so the second adds
   * nobody and closing it announces no departure.
   *
   * **Not persisted anywhere**, and that is a property rather than an omission — presence is
   * derived from open connections and legitimately ends with the process.
   */
  PRESENCE: 'presence',
  /**
   * *Your gap is too large to replay; read the whole thing again* (TICKET-LIVE-03, v3 Req 44.6)
   *
   * A normal outcome rather than an error. A client gone for an hour should refetch: replaying two
   * thousand Events to reach the state one read returns is slower and more fragile.
   */
  RESYNC: 'resync',
  /**
   * *You are no longer in that room* (TICKET-LIVE-03, v3 Req 44.8)
   *
   * The message TICKET-GAM-04 could not send and TICKET-LIVE-02 declined to invent. `evictMember`
   * takes a Member out of one room and closes their socket **only if that was its last** — so a
   * connection watching two tables and evicted from one used to keep drawing the lost table's
   * numbers with nothing saying they had stopped moving. This is the one case where the server
   * *knows* a surface is stale, and it is now the one case it says so.
   */
  ROOM_CLOSED: 'room-closed',
} as const;

/** *You are in that room*, and here is where its log stands */
export interface SubscribedMessage {
  type: typeof SERVER_MESSAGE_TYPE.SUBSCRIBED;
  sessionId: string;
  /**
   * The session's current highest `seq` — `0` for a table nothing has happened at yet
   *
   * **Added by TICKET-LIVE-03's review, and it closes a gap rather than optimising one.** Without
   * it a client had nowhere to resume from until it had *seen* an Event, so a Player who opened a
   * sheet at a quiet table, lost the connection, and had their HP adjusted while it was down
   * reconnected asking for nothing, was told only *you are in that room*, and sat there stale with
   * no correction pending. Adopting this number on the first acknowledgement makes every later
   * subscribe a genuine resume — see `client/services/liveSocket.ts`'s `resumeFrom`.
   */
  seq: number;
}

/** *You are not in that room*, and nothing further */
export interface SubscribeRefusedMessage {
  type: typeof SERVER_MESSAGE_TYPE.SUBSCRIBE_REFUSED;
  sessionId: string;
}

/**
 * One Event, as the room reads it (TICKET-LIVE-02, v3 Req 44.4, 44.5)
 *
 * The `event` row minus its session — the frame already names the room — and with its `payload`
 * **parsed**. The server holds that column as JSON text (D4); parsing it once here rather than
 * shipping a string inside a string is the same call `playerStateOf` makes at the other end of the
 * same boundary: these are our own bytes, written by this server.
 *
 * **`seq` is on every frame, and it is what ordering means.** Two Events that arrive together are
 * ordered by this number rather than by arrival, because arrival order is a property of the network
 * and `seq` is a property of the log (`UNIQUE(session_id, seq)`, DB-01). It is also what LIVE-03
 * will resume a reconnecting client from.
 *
 * **No derived value is ever in here** (v3 Req 45.1). An Event carries the *stored* values that
 * changed; a level, a stat total or a skill bonus is re-derived by the reader through the Kernel,
 * exactly as it is after any other change.
 */
export interface LiveEvent {
  /** The Event's own id, so a reader can tell a frame it has already seen */
  id: string;
  /** Where this sits in its session's order */
  seq: number;
  /** A `SheetAction`, `ROLL_EVENT`, or `SESSION_EVENT` value — a string, because the column is */
  type: string;
  /** Who did it, or `null` when the server itself acted */
  actorAccountId: string | null;
  /** When, in epoch milliseconds */
  at: number;
  /**
   * The Event's own shape — a `PlayerActionEvent`, a `RollLogPayload`, a snapshot note
   *
   * `unknown` rather than a union of all three: the reader narrows on {@link LiveEvent.type}, which
   * is the same discrimination the log's own readers already perform, and a union here would have
   * to grow every time a *route* invents a payload.
   */
  payload: unknown;
}

/** *This happened at that table* */
export interface LiveEventMessage {
  type: typeof SERVER_MESSAGE_TYPE.EVENT;
  sessionId: string;
  event: LiveEvent;
}

/** *These Accounts are watching that table* */
export interface PresenceMessage {
  type: typeof SERVER_MESSAGE_TYPE.PRESENCE;
  sessionId: string;
  /**
   * Who is connected, by Account id
   *
   * **Ids and nothing else.** Every reader of this frame is a Member of the session and already has
   * the names from `GET /api/sessions/:id/members`, so a name here would be a second copy of
   * something a rename can make wrong — the reasoning `useTableRollLog` gives for resolving a
   * character's name at read time rather than storing it in a payload.
   */
  accountIds: string[];
}

/** *Read it all again* — with the number to resume from once you have */
export interface ResyncMessage {
  type: typeof SERVER_MESSAGE_TYPE.RESYNC;
  sessionId: string;
  /**
   * The session's current highest `seq`
   *
   * What the client resumes from after its refetch. Without it a client that resynchronised would
   * have to guess, and guessing low means replaying the gap it was just told not to replay.
   */
  seq: number;
}

/** *That room is not yours any more*, and nothing further */
export interface RoomClosedMessage {
  type: typeof SERVER_MESSAGE_TYPE.ROOM_CLOSED;
  sessionId: string;
}

/** Anything this server sends */
export type ServerSocketMessage =
  | SubscribedMessage
  | SubscribeRefusedMessage
  | LiveEventMessage
  | PresenceMessage
  | ResyncMessage
  | RoomClosedMessage;
