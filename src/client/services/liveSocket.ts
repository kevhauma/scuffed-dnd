/**
 * Where the live socket is, worked out rather than configured (TICKET-LIVE-01)
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
 * ## The connection, added by TICKET-LIVE-02 in the change that consumes it
 *
 * {@link openLiveConnection} is the client half of the feed: one socket, several rooms, and a list
 * of listeners. Three things it deliberately is **not**, all of them TICKET-LIVE-03's by name
 * (v3 Req 44.6, 44.8, 44.9):
 *
 * - **It does not reconnect.** A socket that dies stays dead until the page is reloaded, and the
 *   app stays correct without it — every action is an HTTP request and only the liveness is lost.
 *   Reconnection without replay would be worse than none: a client that quietly came back would
 *   have a gap in its Event sequence and no way to know.
 * - **It does not report connection state**, so nothing on screen claims to be live. *Showing* that
 *   what you are looking at may be stale is its own requirement (44.8) and its own surface.
 * - **It does not replay.** Nothing is buffered across a close; `seq` is on every frame so that
 *   LIVE-03 can ask for what was missed.
 *
 * **Rooms are reference-counted** because two hooks on one sheet subscribe to the same table — the
 * character feed and the roll log — and the second one unmounting must not take the first one's
 * feed with it. The socket itself is opened once and kept: leaving a room is not a reason to close
 * a connection other rooms are riding on.
 *
 * **Validates: v3 Req 44.1, 44.4, 44.7, 47.6**
 */

import type { LiveEventMessage, ServerSocketMessage } from '#shared/types/liveSocket';
import {
  CLIENT_MESSAGE_TYPE,
  LIVE_SOCKET_PATH,
  SERVER_MESSAGE_TYPE,
} from '#shared/types/liveSocket';

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

/**
 * One socket, several rooms, several listeners
 *
 * Deliberately four verbs. There is no `isConnected` and no `state`, because a caller that could
 * read those would draw them — and *what is on screen is stale* is a surface LIVE-03 owns rather
 * than a boolean this hands out early.
 */
export interface LiveConnection {
  /** Listen to a table. Twice is not an error; the second caller shares the first's subscription. */
  subscribe(sessionId: string): void;
  /** Stop listening — for real only when the last interested caller has let go */
  unsubscribe(sessionId: string): void;
  /** Hear every Event from every room this connection holds. Returns the way to stop. */
  addListener(listener: LiveEventListener): () => void;
  /** Close the socket and forget every room */
  close(): void;
}

/** What {@link openLiveConnection} needs to be told */
export interface LiveConnectionOptions {
  /** Where to connect — {@link liveSocketUrl}'s answer in the app */
  url: string;
  /** How to open it; defaults to the browser's own `WebSocket` */
  open?: LiveSocketFactory;
}

/** The browser's socket, in the shape this module speaks */
function browserSocket(url: string): LiveSocketLike {
  return new WebSocket(url) as unknown as LiveSocketLike;
}

/**
 * Open a live connection
 *
 * @param options Where to connect and how
 * @returns The connection
 */
export function openLiveConnection(options: LiveConnectionOptions): LiveConnection {
  const open = options.open ?? browserSocket;
  const socket = open(options.url);

  /** How many callers are interested in each room. A room at zero is one nobody is listening to. */
  const rooms = new Map<string, number>();

  const listeners = new Set<LiveEventListener>();

  /**
   * Frames written before the socket opened
   *
   * A `subscribe` sent on a `CONNECTING` socket throws, and the hook that wants a room is mounted
   * long before the handshake finishes — so the first subscribe of every page load would be the one
   * that failed. Queued and flushed on `open`, which is the whole of it: nothing is queued *across*
   * a close, because that would be replay.
   */
  let pending: string[] = [];
  let isOpen = false;

  /**
   * Whether this connection is finished
   *
   * **Distinct from `!isOpen`, which is also true before the handshake.** Without the distinction a
   * dead socket looks like a connecting one, so every later `subscribe`/`unsubscribe` would be
   * queued against a flush that can never come — an array that grows for as long as the page is
   * open, once per sheet the User visits. Closed means writes are dropped, not stored.
   */
  let isClosed = false;

  const write = (frame: string): void => {
    // Dropping is the honest answer: nothing reconnects, so a frame kept here would be kept
    // forever. Telling the caller its room is gone is v3 Req 44.8 and TICKET-LIVE-03's.
    if (isClosed) return;

    if (!isOpen) {
      pending.push(frame);
      return;
    }

    socket.send(frame);
  };

  socket.onopen = () => {
    isOpen = true;

    const queued = pending;
    pending = [];

    for (const frame of queued) socket.send(frame);
  };

  socket.onclose = () => {
    isOpen = false;
    isClosed = true;

    // The queue goes, because holding frames across a close is replay by another name and nothing
    // will flush them. The **rooms** map deliberately stays: it says what this connection *wants*,
    // and a closed connection wanting nothing would be a lie.
    pending = [];
  };

  socket.onerror = (error) => {
    console.warn('[live] the connection reported an error', error);
  };

  socket.onmessage = (event) => {
    const message = readMessage(event.data);

    if (message === null) return;

    if (message.type === SERVER_MESSAGE_TYPE.SUBSCRIBE_REFUSED) {
      // The server says nothing about why, deliberately (v3 Req 32.5). What it means for the reader
      // is that this table's feed will stay silent; saying so on screen is LIVE-03's.
      console.warn('[live] the server refused a subscription');
      return;
    }

    if (message.type !== SERVER_MESSAGE_TYPE.EVENT) return;

    for (const listener of listeners) listener(message);
  };

  return {
    subscribe: (sessionId) => {
      const held = rooms.get(sessionId) ?? 0;
      rooms.set(sessionId, held + 1);

      if (held > 0) return;

      const frame = JSON.stringify({ type: CLIENT_MESSAGE_TYPE.SUBSCRIBE, sessionId });
      write(frame);
    },
    unsubscribe: (sessionId) => {
      const held = rooms.get(sessionId) ?? 0;

      if (held === 0) return;

      if (held > 1) {
        rooms.set(sessionId, held - 1);
        return;
      }

      rooms.delete(sessionId);

      const frame = JSON.stringify({ type: CLIENT_MESSAGE_TYPE.UNSUBSCRIBE, sessionId });
      write(frame);
    },
    addListener: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    close: () => {
      rooms.clear();
      listeners.clear();
      pending = [];
      isOpen = false;
      isClosed = true;
      socket.close();
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
