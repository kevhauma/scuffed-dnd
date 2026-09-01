/**
 * What travels on the live socket, declared once for both ends (TICKET-LIVE-01)
 *
 * The socket is **server → client** ([D8](../../../docs/v3.0_backend/overview.md#d8--websockets-notify-http-mutates)):
 * every state-changing action is an HTTP request, and the only thing a client may say here is
 * *which rooms it is listening to*. That is what keeps authorization to one implementation — the
 * HTTP one — rather than one per transport, and it is why {@link CLIENT_MESSAGE_TYPE} has two
 * members and will not grow a third that writes anything.
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

/** *Listen to this session* */
export interface SubscribeMessage {
  type: typeof CLIENT_MESSAGE_TYPE.SUBSCRIBE;
  sessionId: string;
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
} as const;

/** *You are in that room* */
export interface SubscribedMessage {
  type: typeof SERVER_MESSAGE_TYPE.SUBSCRIBED;
  sessionId: string;
}

/** *You are not in that room*, and nothing further */
export interface SubscribeRefusedMessage {
  type: typeof SERVER_MESSAGE_TYPE.SUBSCRIBE_REFUSED;
  sessionId: string;
}

/** Anything this server sends. LIVE-02 adds the Event feed to this union. */
export type ServerSocketMessage = SubscribedMessage | SubscribeRefusedMessage;
