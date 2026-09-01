/**
 * Where the live socket is, and the connection that survives losing it (TICKET-LIVE-01,
 * TICKET-LIVE-02, TICKET-LIVE-03)
 *
 * **Derived from `window.location`, always** (v3 Req 47.6). There is no `VITE_SOCKET_URL`, no base
 * to override and no constant naming a host, for the reason `services/api.ts` gives about the API:
 * the backend is *this* server — one process serving the client bundle, the API and the socket
 * ([D1](../../../docs/v3.0_backend/overview.md#d1--the-backend-lives-in-this-repo-on-tanstack-start))
 * — and a configurable address is an address somebody eventually points elsewhere. Same host, same
 * port, so the Auth_Session cookie rides the upgrade with nothing added.
 *
 * **The scheme follows the page's**, which is a security property rather than a convenience: a page
 * served over `https:` opening a `ws:` socket is a downgrade the browser would refuse as mixed
 * content, and hard-coding either one is how a deployment behind TLS breaks in a way no test on
 * `http://localhost` would ever show.
 *
 * ## The connection: one socket, several rooms, and a way back (TICKET-LIVE-03)
 *
 * TICKET-LIVE-02 left three things undone here by name, and this is where each landed.
 *
 * **It reconnects, with a backoff.** A dropped socket schedules another through
 * [`liveBackoff.ts`](./liveBackoff.ts) — half-fixed, half-random, doubling to thirty seconds — so a
 * server restart with fifty clients is fifty spread attempts rather than one stampede. Two refusals
 * to retry are as load-bearing as the retrying: **a deliberate `close()` and a `4401`**. Signing out
 * must not become a retry loop against a server that is correctly refusing.
 *
 * **It replays rather than queueing.** LIVE-02 held frames written before the handshake in a
 * `pending` array; that array is **gone**. On every open the connection *reconciles* — one subscribe
 * per room it still holds, each carrying that room's resume point so the server can send back
 * exactly what was missed (v3 Req 44.6). The rooms map is already the record of what this connection
 * wants, and a queue of frames was a second, weaker copy of it: a room let go while offline needs no
 * unsubscribe frame at all, because a reconnected socket was never subscribed to it.
 *
 * **A room's resume point comes from the acknowledgement, not from the first Event it sees.** That
 * is LIVE-03's review finding and it is the difference between a reconnect that works and one that
 * looks like it does: a Player at a quiet table has seen nothing, so a client keyed on *the last
 * `seq` I saw* asked for nothing on reconnect and was told nothing back, and an adjustment made
 * while they were away was neither replayed nor refetched. `SubscribedMessage.seq` carries where the
 * log stands, {@link RoomBook.resumeFrom} adopts it once, and `null` there means *first subscribe*
 * rather than *seen nothing*.
 *
 * **It reports connection state**, per room, through {@link LiveConnection.roomView} — so a surface
 * can say *this may be stale* instead of drawing a number that stopped moving four minutes ago
 * (v3 Req 44.8). Presence is **cleared** the instant the socket goes, deliberately: an empty list
 * beside a non-live status is *we cannot tell*, where a kept list would be a confident answer about
 * who is at a table nobody can currently see.
 *
 * ## Ordering, and the one thing that makes duplicate suppression safe
 *
 * Frames arrive in `seq` order on a given socket: the server replays before it can broadcast (the
 * whole subscribe is one synchronous turn — see `server/ws/replay.ts`), and TCP does the rest. That
 * is what lets this drop any Event whose `seq` is **not greater** than the room's last-seen without
 * ever creating a gap. Out of order, the same rule would silently discard the very Events a replay
 * was for.
 *
 * **Validates: v3 Req 44.1, 44.4, 44.6, 44.7, 44.8, 47.6**
 */

import type {
  LiveEventMessage,
  PresenceMessage,
  ResyncMessage,
  ServerSocketMessage,
  SubscribedMessage,
} from '#shared/types/liveSocket';
import {
  CLIENT_MESSAGE_TYPE,
  LIVE_SOCKET_PATH,
  SERVER_MESSAGE_TYPE,
  SOCKET_CLOSE_CODE,
} from '#shared/types/liveSocket';
import { backoffDelay, CONNECTION_STABLE_MS } from './liveBackoff';

/**
 * As much of `window.location` as an address needs
 *
 * Structural rather than `Location`, so this is callable with a literal — which is what lets the
 * `https:` case be asserted at all. A test cannot serve itself over TLS, and a builder that could
 * only be driven by a real browser would leave exactly the branch that breaks in production
 * unproven.
 */
export interface PageLocation {
  /** `http:` or `https:`, with the colon, as `window.location.protocol` carries it */
  protocol: string;
  /** Host **and port** — `window.location.host`, not `hostname` */
  host: string;
}

/** The page's scheme, and the socket scheme that matches it */
const SOCKET_SCHEME = {
  PLAIN: 'ws:',
  SECURE: 'wss:',
} as const;

/** What a secure page is served over */
const SECURE_PAGE_PROTOCOL = 'https:';

/**
 * The URL of this deployment's live socket
 *
 * @param location Where the page is — `window.location` in the app, a literal in a test
 * @returns An absolute `ws:`/`wss:` URL on the very origin that served the page
 */
export function liveSocketUrl(location: PageLocation): string {
  const scheme =
    location.protocol === SECURE_PAGE_PROTOCOL ? SOCKET_SCHEME.SECURE : SOCKET_SCHEME.PLAIN;

  return `${scheme}//${location.host}${LIVE_SOCKET_PATH}`;
}

/**
 * As much of a `WebSocket` as this module uses
 *
 * Structural for {@link PageLocation}'s reason: a test cannot open a real socket, and a connection
 * object that could only be driven by a browser would leave every branch that matters unproven. The
 * four handler properties are assigned rather than added with `addEventListener`, because a fake
 * that has to implement listener registration is a fake with logic in it.
 *
 * `onclose` takes `unknown` rather than a `CloseEvent`: the **code** matters now (a `4401` is not
 * retried), but it is read defensively by {@link closeCodeOf} so that a fake may pass anything at
 * all — including nothing — and still drive the path a real browser drives.
 */
export interface LiveSocketLike {
  send(data: string): void;
  close(): void;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

/** How a socket is opened — the browser's `WebSocket`, or a test's stand-in */
export type LiveSocketFactory = (url: string) => LiveSocketLike;

/** What a listener is handed: one Event, and the room it happened in */
export type LiveEventListener = (message: LiveEventMessage) => void;

/** …and how a surface hears that *anything* about a room changed */
export type LiveViewListener = () => void;

/**
 * What one room's feed is doing, as a surface may say it out loud (v3 Req 44.8)
 *
 * Five states rather than a boolean, because *not live* is four different sentences to a Player and
 * three of them are not alarming. Presence is **unknown** in every one of them but {@link
 * LIVE_STATUS.LIVE} — see `components/live/presenceState.ts`, which is where that judgement lives.
 */
export const LIVE_STATUS = {
  /** The socket is open and the server has confirmed this room. What is on screen is current. */
  LIVE: 'live',
  /** Opening for the first time — nothing has been lost yet, so nothing alarming to say */
  CONNECTING: 'connecting',
  /** It was live and is not now. Another attempt is scheduled; what is on screen may be stale. */
  RECONNECTING: 'reconnecting',
  /** No further attempt will be made — signed out, or the page let the connection go */
  OFFLINE: 'offline',
  /** The server refused this room, or took it away. Nothing here will move again. */
  LOST: 'lost',
} as const;

/** One of the five */
export type LiveStatus = (typeof LIVE_STATUS)[keyof typeof LIVE_STATUS];

/**
 * Everything a surface needs to render one room's liveness
 *
 * **One object rather than three hooks**, because the three are read together: a badge saying who is
 * connected is a lie unless the status beside it says the connection is up. TICKET-DM-04's roster
 * renders the same view for the same reason the lobby does.
 */
export interface LiveRoomView {
  status: LiveStatus;
  /** Who is watching this table, by Account id — empty whenever the status is not `live` */
  presentAccountIds: string[];
  /**
   * When the server last said *read it all again*, or `null`
   *
   * A timestamp rather than a flag, so a surface can `useEffect` on it and refetch **once** per
   * instruction — a boolean would need clearing, and whoever cleared it would own a race with the
   * next one.
   */
  resyncAt: number | null;
}

/**
 * One socket, several rooms, several listeners
 *
 * Six verbs since TICKET-LIVE-03: the four LIVE-02 defined, plus the two that make staleness
 * visible. There is still no `isConnected` — a caller reads {@link LiveConnection.roomView}, which
 * answers about **a room** rather than about the transport, because *my table has gone quiet* is
 * what a Player needs to know and *the socket is closed* is only sometimes the reason.
 */
export interface LiveConnection {
  /** Listen to a table. Twice is not an error; the second caller shares the first's subscription. */
  subscribe(sessionId: string): void;
  /** Stop listening — for real only when the last interested caller has let go */
  unsubscribe(sessionId: string): void;
  /** Hear every Event from every room this connection holds. Returns the way to stop. */
  addListener(listener: LiveEventListener): () => void;
  /** Hear that something about some room changed — status, presence, a resync. Returns the stop. */
  addViewListener(listener: LiveViewListener): () => void;
  /** How one room's feed is doing right now */
  roomView(sessionId: string): LiveRoomView;
  /** Close the socket, forget every room, and make no further attempt */
  close(): void;
}

/** What {@link openLiveConnection} needs to be told */
export interface LiveConnectionOptions {
  /** Where to connect — {@link liveSocketUrl}'s answer in the app */
  url: string;
  /** How to open it; defaults to the browser's own `WebSocket` */
  open?: LiveSocketFactory;
  /**
   * Where the reconnect jitter comes from; defaults to `Math.random`
   *
   * Injected for one reason and it is criterion 3's: *fifty clients do not stampede* is a claim
   * about a **spread**, and a spread cannot be asserted against a real random source without either
   * flaking or asserting nothing.
   */
  random?: () => number;
}

/** The browser's socket, in the shape this module speaks */
function browserSocket(url: string): LiveSocketLike {
  return new WebSocket(url) as unknown as LiveSocketLike;
}

/** What the transport is doing, which is not the same as what a room is doing */
const SOCKET_PHASE = {
  /** Handshaking — the first time, or after a backoff */
  CONNECTING: 'connecting',
  OPEN: 'open',
  /** Dropped, with another attempt scheduled */
  WAITING: 'waiting',
  /** Finished: closed by the page, or refused for a reason retrying cannot fix */
  CLOSED: 'closed',
} as const;

type SocketPhase = (typeof SOCKET_PHASE)[keyof typeof SOCKET_PHASE];

/** What this connection knows about one room */
interface RoomBook {
  /** How many callers want it. A room at zero is deleted, never kept. */
  holders: number;
  /**
   * Where to resume this room from, or `null` for one this connection has never been admitted to
   *
   * **`null` means *first subscribe*, not *seen nothing***, and the distinction is the whole of what
   * makes a reconnect gapless. It was a `lastSeq` number with a `> 0` test until LIVE-03's review,
   * which is the same question asked badly: a Player at a **quiet** table has seen nothing, so their
   * reconnect asked for nothing, so an adjustment made while they were away was never replayed and
   * never refetched — the sheet simply stayed wrong. The acknowledgement now carries the log's head,
   * this adopts it the first time, and every later subscribe is a genuine resume from a real number.
   */
  resumeFrom: number | null;
  /** Whether the server has confirmed this room on the **current** socket */
  isAcknowledged: boolean;
  /** Whether the server refused it, or took it away */
  isLost: boolean;
  presentAccountIds: string[];
  resyncAt: number | null;
}

/**
 * Everything one connection holds
 *
 * At module scope, with the behaviour as module-scope functions taking it, rather than as one large
 * closure. The reason is measurable rather than stylistic: `openLiveConnection` would otherwise
 * carry every branch of the reconnect, the reconciliation and the six-way message dispatch inside
 * its own body, which is exactly the shape `fallow` charges for — and the shape TICKET-LIVE-02 had
 * to split `useRoller` out of. Each function below is small enough to read on its own.
 */
interface ConnectionState {
  readonly url: string;
  readonly open: LiveSocketFactory;
  readonly random: () => number;
  readonly rooms: Map<string, RoomBook>;
  readonly listeners: Set<LiveEventListener>;
  readonly watchers: Set<LiveViewListener>;
  socket: LiveSocketLike | null;
  phase: SocketPhase;
  /** Set by `close()`; nothing reopens after it */
  isFinished: boolean;
  /**
   * Consecutive failed or short-lived attempts, which is what the backoff grows on
   *
   * Read twice, and the second reading is what a surface says out loud: while it is zero nothing has
   * been lost, which is the difference between *connecting* and *reconnecting*.
   */
  attempts: number;
  /** When the current socket opened, or `0` for one that never did */
  openedAt: number;
  timer: ReturnType<typeof setTimeout> | null;
}

/** A room nobody has heard anything about yet */
function freshRoom(): RoomBook {
  return {
    holders: 1,
    resumeFrom: null,
    isAcknowledged: false,
    isLost: false,
    presentAccountIds: [],
    resyncAt: null,
  };
}

/** A view for a room this connection does not hold — the transport's state and nothing else */
function unheldView(state: ConnectionState): LiveRoomView {
  const status = state.phase === SOCKET_PHASE.CLOSED ? LIVE_STATUS.OFFLINE : LIVE_STATUS.CONNECTING;

  return { status, presentAccountIds: [], resyncAt: null };
}

/**
 * What one room's feed is doing (v3 Req 44.8)
 *
 * **`LOST` outranks everything**, because it is the only one of the five that will not fix itself:
 * a refused or withdrawn room stays refused however healthy the transport becomes, and telling a
 * reader *reconnecting* about it would promise a recovery that is not coming.
 *
 * @param state The connection
 * @param room What it knows about the room
 * @returns The status a surface may draw
 */
function roomStatusOf(state: ConnectionState, room: RoomBook): LiveStatus {
  if (room.isLost) return LIVE_STATUS.LOST;
  if (state.phase === SOCKET_PHASE.CLOSED) return LIVE_STATUS.OFFLINE;
  if (state.phase === SOCKET_PHASE.OPEN && room.isAcknowledged) return LIVE_STATUS.LIVE;

  // Handshaking, waiting on a backoff, or open with this room not yet confirmed — all of which are
  // *not live yet*. Which sentence to show turns on whether anything has been **lost**, and
  // `attempts` is exactly that count: nothing has dropped while it is zero, and a socket that closed
  // without being replaced has moved it off zero. It is deliberately not *have we ever connected*,
  // which would say *reconnecting* about a room whose first subscribe is merely still in flight.
  //
  // A failed first attempt therefore speaks, which matters: a page loaded against a server whose
  // socket never answers would otherwise sit at `connecting` for as long as it stayed open, and the
  // notice — silent while connecting, because nothing is stale yet on a first load — would never say
  // a word about a table it has never reached.
  const hasLostSomething = state.attempts > 0;

  return hasLostSomething ? LIVE_STATUS.RECONNECTING : LIVE_STATUS.CONNECTING;
}

/** Tell every watcher that something changed */
function notify(state: ConnectionState): void {
  for (const watcher of state.watchers) watcher();
}

/**
 * Ask the server for one room, saying where to resume from if there is anywhere
 *
 * @param state The connection
 * @param sessionId Which table
 * @param room What is known about it
 */
function sendSubscribe(state: ConnectionState, sessionId: string, room: RoomBook): void {
  if (state.socket === null) return;

  // **Only a room this connection has been admitted to before.** A *first* subscribe carries no
  // number, because the surface that wants it read its state over HTTP a moment ago and has nothing
  // for a replay to correct. Everything after that is a resume — including from `0`, which is a
  // real answer meaning *the log was empty when I joined*, and which the old `lastSeq > 0` test
  // could not tell apart from *I have never been here*.
  const resuming = room.resumeFrom === null ? {} : { afterSeq: room.resumeFrom };
  const frame = JSON.stringify({
    type: CLIENT_MESSAGE_TYPE.SUBSCRIBE,
    sessionId,
    ...resuming,
  });

  state.socket.send(frame);
}

/**
 * Put the server back in step with what this connection wants (v3 Req 44.6)
 *
 * The replacement for LIVE-02's frame queue, and the reason there is no longer one. Every room is
 * unconfirmed again — this is a **new** connection, which has joined nothing — so each is asked for
 * afresh, carrying its own resume point. A room whose last caller let go while the socket was down
 * is simply not here to ask for.
 *
 * @param state The connection
 */
function resubscribeAll(state: ConnectionState): void {
  for (const [sessionId, room] of state.rooms) {
    // **A lost room is not asked for again**, and it keeps saying so. Refused and *taken away* are
    // both facts about a Member, not about a socket: re-asking on every reconnect would provoke the
    // server's refusal log once a backoff for as long as an evicted browser is left open, and would
    // meanwhile tell the reader *reconnecting* about a feed that is never coming back. Regaining a
    // seat means reloading, which is what the notice says.
    if (room.isLost) continue;

    room.isAcknowledged = false;
    room.presentAccountIds = [];

    sendSubscribe(state, sessionId, room);
  }
}

/**
 * The close code, out of whatever the socket handed us
 *
 * Defensive because {@link LiveSocketLike.onclose} takes `unknown`: a real browser passes a
 * `CloseEvent`, and a fake may pass `null`. A code that cannot be read is treated as *no code*,
 * which retries — the conservative answer, since the one code that must not retry is a code we can
 * only act on by reading it.
 *
 * @param event Whatever arrived
 * @returns The code, or `null`
 */
function closeCodeOf(event: unknown): number | null {
  if (typeof event !== 'object' || event === null) return null;

  const { code } = event as { code?: unknown };

  return typeof code === 'number' ? code : null;
}

/**
 * Wait, then try again (v3 Req 44.6)
 *
 * @param state The connection
 */
function scheduleReconnect(state: ConnectionState): void {
  state.attempts += 1;

  const delay = backoffDelay(state.attempts, state.random);

  state.timer = setTimeout(() => {
    state.timer = null;
    connect(state);
  }, delay);
}

/** The socket opened: this connection is live, and the server knows none of its rooms */
function onOpen(state: ConnectionState): void {
  state.phase = SOCKET_PHASE.OPEN;
  state.openedAt = Date.now();

  resubscribeAll(state);
  notify(state);
}

/**
 * The socket went. Decide whether to go back for it.
 *
 * @param state The connection
 * @param event Whatever the socket reported
 */
function onClose(state: ConnectionState, event: unknown): void {
  const code = closeCodeOf(event);
  const lasted = state.openedAt === 0 ? 0 : Date.now() - state.openedAt;

  state.socket = null;
  state.openedAt = 0;

  // Presence is cleared rather than kept. A list of who is connected, drawn from a socket that is
  // not, is the confident-wrong-number this whole ticket is against.
  for (const room of state.rooms.values()) {
    room.isAcknowledged = false;
    room.presentAccountIds = [];
  }

  // **The two refusals to retry.** A page that let the connection go has said so, and a `4401` is a
  // server correctly refusing an anonymous caller — retrying either is a loop with no end state.
  if (state.isFinished || code === SOCKET_CLOSE_CODE.UNAUTHENTICATED) {
    state.phase = SOCKET_PHASE.CLOSED;
    notify(state);
    return;
  }

  // **Reset only after a connection that lasted.** A server shutting down accepts and immediately
  // closes, so resetting on every `open` would peg every client at the base delay together — which
  // is the stampede the backoff exists to prevent, arriving through the back door.
  if (lasted >= CONNECTION_STABLE_MS) state.attempts = 0;

  state.phase = SOCKET_PHASE.WAITING;
  scheduleReconnect(state);
  notify(state);
}

/** Hand one Event to everybody listening */
function deliverEvent(state: ConnectionState, message: LiveEventMessage): void {
  for (const listener of state.listeners) listener(message);
}

/**
 * One Event, if this connection has not already seen it (v3 Req 44.6)
 *
 * **Dropping anything not *greater* than the last `seq` is duplicate suppression and never a gap**,
 * for one reason: frames arrive in `seq` order. The server replays a resumed room before any live
 * frame can reach the same socket — the whole subscribe is one synchronous turn — so a lower number
 * arriving later is a repeat rather than a straggler. Were that ever untrue, this line would discard
 * exactly the Events a replay exists to deliver.
 *
 * @param state The connection
 * @param message The Event and its room
 */
function receiveEvent(state: ConnectionState, message: LiveEventMessage): void {
  const room = state.rooms.get(message.sessionId);

  // A room nobody here holds: the last caller let go and the unsubscribe is still in flight. There
  // is no surface to tell.
  if (!room) return;

  if (room.resumeFrom !== null && message.event.seq <= room.resumeFrom) return;

  room.resumeFrom = message.event.seq;

  deliverEvent(state, message);
}

/** Who is at that table now */
function receivePresence(state: ConnectionState, message: PresenceMessage): void {
  const room = state.rooms.get(message.sessionId);
  if (!room) return;

  room.presentAccountIds = message.accountIds;
  notify(state);
}

/**
 * *Read it all again*, and resume from here afterwards (v3 Req 44.6)
 *
 * The `seq` is taken **now** rather than after whatever refetch a surface performs, because it is
 * the head of the log at the moment the server answered: an Event written after it arrives live and
 * is applied on top, where a number taken later would skip whatever landed in between.
 */
function receiveResync(state: ConnectionState, message: ResyncMessage): void {
  const room = state.rooms.get(message.sessionId);
  if (!room) return;

  room.resumeFrom = message.seq;
  room.resyncAt = Date.now();

  notify(state);
}

/**
 * *You are in that room*, and here is where its log stands
 *
 * **The head is adopted only the first time** (LIVE-03's review). On a first subscribe it is what
 * gives this room a resume point before anything has happened at it, so the next reconnect asks a
 * real question instead of no question. On a **reconnect** the replay follows this frame, and
 * overwriting the resume point with the head would make every replayed Event look like one already
 * seen — the catch-up would arrive and be dropped in the same turn.
 *
 * @param state The connection
 * @param room What is known about the room
 * @param message What the server said
 */
function receiveSubscribed(
  state: ConnectionState,
  room: RoomBook,
  message: SubscribedMessage
): void {
  room.isAcknowledged = true;

  if (room.resumeFrom === null) room.resumeFrom = message.seq;

  notify(state);
}

/**
 * Act on one frame
 *
 * @param state The connection
 * @param message What the server said
 */
function applyMessage(state: ConnectionState, message: ServerSocketMessage): void {
  if (message.type === SERVER_MESSAGE_TYPE.EVENT) {
    receiveEvent(state, message);
    return;
  }

  if (message.type === SERVER_MESSAGE_TYPE.PRESENCE) {
    receivePresence(state, message);
    return;
  }

  if (message.type === SERVER_MESSAGE_TYPE.RESYNC) {
    receiveResync(state, message);
    return;
  }

  const room = state.rooms.get(message.sessionId);
  if (!room) return;

  if (message.type === SERVER_MESSAGE_TYPE.SUBSCRIBED) {
    receiveSubscribed(state, room, message);
    return;
  }

  // **Matched literally, one type each, with everything else returning** — `subscription.ts`'s rule
  // at the other end of the same socket, and for the same reason. A catch-all `else` here would be
  // correct only for as long as these are the only two `sessionId`-carrying messages: the next one
  // would silently turn every open room into *this feed will never move again* and paint a banner
  // over a healthy sheet.
  const isRefused = message.type === SERVER_MESSAGE_TYPE.SUBSCRIBE_REFUSED;
  const isClosed = message.type === SERVER_MESSAGE_TYPE.ROOM_CLOSED;

  if (!isRefused && !isClosed) return;

  // The server says nothing about why a subscribe was refused (v3 Req 32.5) and nothing needs to:
  // both mean *this table's feed will not move*, which is the one thing a reader has to be told
  // rather than left to infer from a screen that has gone quiet.
  room.isLost = true;
  room.presentAccountIds = [];
  notify(state);
}

/**
 * Open a socket and wire it up
 *
 * @param state The connection
 */
function connect(state: ConnectionState): void {
  if (state.isFinished) return;

  state.phase = SOCKET_PHASE.CONNECTING;
  state.openedAt = 0;

  const socket = state.open(state.url);
  state.socket = socket;

  socket.onopen = () => onOpen(state);
  socket.onclose = (event) => onClose(state, event);

  socket.onerror = (error) => {
    // Not a reconnect trigger: an `error` on a socket that is going is followed by its `close`, and
    // acting on both would schedule two attempts for one drop
    console.warn('[live] the connection reported an error', error);
  };

  socket.onmessage = (event) => {
    const message = readMessage(event.data);

    if (message === null) return;

    applyMessage(state, message);
  };
}

/**
 * Open a live connection
 *
 * @param options Where to connect and how
 * @returns The connection
 */
export function openLiveConnection(options: LiveConnectionOptions): LiveConnection {
  const state: ConnectionState = {
    url: options.url,
    open: options.open ?? browserSocket,
    random: options.random ?? Math.random,
    rooms: new Map(),
    listeners: new Set(),
    watchers: new Set(),
    socket: null,
    phase: SOCKET_PHASE.CONNECTING,
    isFinished: false,
    attempts: 0,
    openedAt: 0,
    timer: null,
  };

  connect(state);

  return {
    subscribe: (sessionId) => {
      if (state.isFinished) return;

      const held = state.rooms.get(sessionId);

      if (held) {
        held.holders += 1;
        return;
      }

      const opened = freshRoom();
      state.rooms.set(sessionId, opened);

      // Only while the socket is open. Anything else is reconciled on the next one, which is what
      // makes this connection recover without holding a queue of frames nothing may ever flush.
      if (state.phase === SOCKET_PHASE.OPEN) sendSubscribe(state, sessionId, opened);

      notify(state);
    },
    unsubscribe: (sessionId) => {
      const held = state.rooms.get(sessionId);

      if (!held) return;

      if (held.holders > 1) {
        held.holders -= 1;
        return;
      }

      state.rooms.delete(sessionId);

      if (state.phase === SOCKET_PHASE.OPEN && state.socket !== null) {
        const frame = JSON.stringify({ type: CLIENT_MESSAGE_TYPE.UNSUBSCRIBE, sessionId });
        state.socket.send(frame);
      }

      notify(state);
    },
    addListener: (listener) => {
      state.listeners.add(listener);

      return () => {
        state.listeners.delete(listener);
      };
    },
    addViewListener: (listener) => {
      state.watchers.add(listener);

      return () => {
        state.watchers.delete(listener);
      };
    },
    roomView: (sessionId) => {
      const room = state.rooms.get(sessionId);

      if (!room) return unheldView(state);

      const status = roomStatusOf(state, room);

      // **Presence is only ever handed out alongside a live status**, enforced here rather than
      // trusted to the four places that clear it. A list of who is connected is a claim, and the
      // moment the socket is not up it is a claim this connection cannot make.
      const isLive = status === LIVE_STATUS.LIVE;
      const presentAccountIds = isLive ? room.presentAccountIds : [];

      return { status, presentAccountIds, resyncAt: room.resyncAt };
    },
    close: () => {
      state.isFinished = true;
      state.phase = SOCKET_PHASE.CLOSED;

      if (state.timer !== null) {
        clearTimeout(state.timer);
        state.timer = null;
      }

      state.rooms.clear();
      state.listeners.clear();

      const socket = state.socket;
      state.socket = null;

      notify(state);
      state.watchers.clear();

      socket?.close();
    },
  };
}

/**
 * One frame, if it is one of ours
 *
 * @param data Whatever arrived
 * @returns The message, or `null` for anything that is not one
 */
function readMessage(data: unknown): ServerSocketMessage | null {
  if (typeof data !== 'string') return null;

  try {
    return JSON.parse(data) as ServerSocketMessage;
  } catch {
    // A frame this client cannot read is not a reason to break the page. It is also not something
    // this server sends, so there is nothing to report to a User about it.
    console.warn('[live] ignored a frame that was not JSON');
    return null;
  }
}

/** Read once, then reused — one browser, one socket, however many tables it is watching */
let connection: LiveConnection | null = null;

/**
 * This page's live connection, opened on first use
 *
 * `ws/rooms.ts`'s `liveRooms()` at the other end of the same socket, and for the same reason: two
 * hooks on one sheet must reach one connection, and a module-level singleton is what makes that
 * true without threading a connection through the component tree.
 *
 * @returns The connection
 */
export function liveConnection(): LiveConnection {
  if (connection) return connection;

  const url = liveSocketUrl(window.location);
  connection = openLiveConnection({ url });

  return connection;
}

/*
 * There is deliberately **no `setLiveConnection`**, though `setLiveRooms` and `setProcessDatabase`
 * both exist at the other end of this socket. It was written, `fallow` found it unused, and the
 * reason it is unused is the honest one: a test that wants a connection calls
 * {@link openLiveConnection} with its own socket, and a test of a *hook* mocks this module. Nothing
 * needs to displace the singleton, so nothing may — the seam would be a way for one test to leave
 * another test's connection installed.
 */
