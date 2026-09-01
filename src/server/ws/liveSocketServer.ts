/**
 * The socket itself — `ws` bolted to this process's own HTTP listener (TICKET-LIVE-01)
 *
 * **The only module in the repository that imports `ws`.** Everything else — the rooms, the
 * subscribe rule — is written against plain objects, which is what makes `rooms.ts`'s interface
 * load-bearing rather than decorative and what lets every property this ticket claims be tested
 * without a socket library in the frame.
 *
 * ## One listener, because there is one server
 *
 * `noServer: true` and an `upgrade` listener on the HTTP server the app is already being served
 * from ([D1](../../../docs/v3.0_backend/overview.md#d1--the-backend-lives-in-this-repo-on-tanstack-start)).
 * Nothing new listens on anything, no second port, no CORS, and the Auth_Session cookie rides the
 * upgrade with nothing added — same origin, same cookie, same authentication.
 *
 * The listener **returns immediately for any path but {@link LIVE_SOCKET_PATH}**, which is not
 * tidiness: Vite's own HMR socket is an `upgrade` listener on the same server, and a handler that
 * claimed every upgrade would take the dev server's hot reload with it.
 *
 * ## Authenticate on the upgrade, never on the first message
 *
 * {@link accountForUpgrade} runs *before* the connection is wired to anything. A connection that
 * fails it is closed with `SOCKET_CLOSE_CODE.UNAUTHENTICATED` **with no listeners attached and no
 * room joined** — so there is no window in which an unauthenticated socket can say anything, and no
 * message handler that has to remember to check. That is the socket's form of `guards.ts`'s *401 is
 * thrown before any lookup*: nothing is looked up, because the refusal is about the caller.
 *
 * Identity is resolved by the **same** `accountFromRequest` every HTTP request uses. There is no
 * token scheme, no query parameter and no second identity path — v3 Req 44.1 asks for the cookie,
 * and the cookie is what a browser puts on an upgrade request unprompted.
 *
 * ## What stops another site opening one of these, and why there is no `Origin` check
 *
 * **A WebSocket upgrade is not subject to CORS**, so nothing about being same-origin is enforced by
 * the browser here the way it is for `fetch`. What actually prevents `evil.example` opening a
 * connection as one of our signed-in users is that the Auth_Session cookie is **`SameSite=Lax`** —
 * Better Auth's default, recorded rather than set in `auth/authServer.ts`'s `advanced` block, which
 * is worth knowing because it means a *library* change could move it too. A cross-site handshake
 * therefore carries no cookie, `accountFromRequest` answers
 * *nobody*, and the connection is refused 4401 like any other anonymous one. That is a real defence
 * and it is why this module needs no `Origin` check — but it is a defence living in **another
 * module**, so it is written down here rather than left to be inferred. **If the cookie ever moves
 * to `SameSite=None`, this socket becomes cross-site openable in the same commit.**
 *
 * What watches for that is an assertion on the **cookie attribute** — *should be SameSite=Lax on the
 * cookie* in `liveSocketServer.test.ts`, and the matching one in `auth/auth.test.ts`. It **cannot**
 * be a connection test, which is worth stating so that nobody adds one believing it covers this: a
 * Node `ws` client applies no cookie policy, so a cross-origin *handshake* behaves identically under
 * `Lax`, `Strict` and `None`, and such a test would keep passing straight through the change it
 * appeared to guard.
 *
 * An `Origin` allow-list was considered and **rejected as worse than the dependency**. The only
 * list of hosts this deployment knows is `AUTH_ALLOWED_HOSTS`, which is *optional and unset* unless
 * a social provider is configured (TICKET-AUTH-02) — so on the plain email/password deployment D1
 * describes, the check would have nothing to compare against and would either refuse everything or,
 * far more likely, be written to pass when the list is empty. A guard that silently does nothing in
 * the default configuration is worse than a documented reliance, because it reads as protection.
 *
 * ## Where it is attached
 *
 * `yarn dev` attaches through `scripts/live-socket.mjs`, which hands this Vite's own listener.
 * **Production is TICKET-POL-03's**: it owns the deployment shape and the start command, and the
 * one line it must run is `attachLiveSocket(httpServer)` against whatever listener it creates.
 * Until then, the socket exists in development and in the tests and not in a built artefact.
 *
 * **Validates: v3 Req 44.1, 44.2, 44.4, 47.1**
 */

import type { Server as HttpServer, IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { type RawData, WebSocket, WebSocketServer } from 'ws';
import { LIVE_SOCKET_PATH, SOCKET_CLOSE_CODE } from '#shared/types/liveSocket';
import type { RequestAccount } from '../auth/account';
import { accountFromRequest } from '../auth/currentAccount';
import { type LiveConnection, liveRooms, type SocketRooms } from './rooms';
import { handleClientMessage } from './subscription';

/** What a connection with no usable Auth_Session cookie is told, in the close frame */
const UNAUTHENTICATED_REASON = 'Sign in to connect to a game.';

/** …and what everybody is told when the process is going away */
const SERVER_STOPPING_REASON = 'The server is shutting down.';

/**
 * How often an idle connection is pinged
 *
 * `ping`/`pong` at the protocol level with a server-side idle timeout, which is what the ticket's
 * Notes ask for: an application-level heartbeat would be a second mechanism doing the same job
 * worse, and one every client would have to be taught. A connection that misses a whole interval
 * is terminated — half-open TCP does not announce itself, and a room holding a socket nobody is on
 * the other end of is the leak criterion 6 is about.
 */
const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * The largest frame this socket will receive
 *
 * A `subscribe` is a type and an id; the biggest legitimate frame is well under a hundred bytes.
 * 4 KiB is generous by two orders of magnitude and still refuses the 100 MiB the library would
 * otherwise accept and buffer. `ws` fails the frame at the receiver, before any of this module's
 * code sees it.
 */
const MAX_FRAME_BYTES = 4 * 1024;

/** What {@link attachLiveSocket} hands back */
export interface LiveSocketServer {
  /** Stop listening, close every connection, and empty the rooms */
  close(): void;
}

/**
 * A `Request` carrying the upgrade's headers, so the same authentication can read them
 *
 * The cookie is all that is read, but a whole `Request` is built rather than a headers bag because
 * `accountFromRequest` takes one — and giving the socket its own narrower entry point into Better
 * Auth is exactly the second identity path this ticket refuses to create.
 *
 * @param incoming The raw upgrade request
 * @returns The same request, in the shape the HTTP side already speaks
 */
function upgradeRequest(incoming: IncomingMessage): Request {
  const host = incoming.headers.host ?? 'localhost';
  const url = new URL(incoming.url ?? '/', `http://${host}`);
  const headers = new Headers();

  for (const [name, value] of Object.entries(incoming.headers)) {
    // HTTP/2 pseudo-headers are not legal `Headers` names and `set` throws on one
    if (name.startsWith(':')) continue;

    if (typeof value === 'string') {
      headers.set(name, value);
    } else if (Array.isArray(value)) {
      const combined = value.join('; ');
      headers.set(name, combined);
    }
  }

  return new Request(url, { headers });
}

/**
 * Who is upgrading, or nobody (v3 Req 44.1)
 *
 * No cookie, a cookie that does not verify, one naming a signed-out session and one naming an
 * expired session are the same answer — `accountFromRequest` already treats all four as *nobody*
 * rather than as errors, and a socket that distinguished them would be telling an anonymous caller
 * which of their guesses was closest.
 *
 * @param incoming The raw upgrade request
 * @returns The acting account, or `null`
 */
async function accountForUpgrade(incoming: IncomingMessage): Promise<RequestAccount | null> {
  const request = upgradeRequest(incoming);
  return accountFromRequest(request);
}

/**
 * Attach the live socket to an HTTP server
 *
 * @param httpServer The listener the app is already served from
 * @param rooms Where admissions are recorded; defaults to this process's own
 * @returns A handle that detaches and cleans up
 */
export function attachLiveSocket(
  httpServer: HttpServer,
  rooms: SocketRooms = liveRooms()
): LiveSocketServer {
  // `maxPayload` because the default is 100 MiB and this channel's entire vocabulary is two verbs
  // and a session id. A frame that cannot be one of those is not a large request, it is a client
  // doing something else — and `ws` refusing it at the receiver costs nothing and allocates nothing.
  const sockets = new WebSocketServer({ noServer: true, maxPayload: MAX_FRAME_BYTES });

  /** Connections that have been pinged and have not answered. A second miss terminates them. */
  const awaitingPong = new Set<WebSocket>();

  /**
   * Wire an authenticated socket up to the rooms
   *
   * @param raw The accepted socket
   * @param accountId Who it belongs to, settled on the upgrade and not restatable
   */
  function register(raw: WebSocket, accountId: string): void {
    const connection: LiveConnection = {
      accountId,
      send: (payload) => {
        // Checked rather than left to `ws` to emit an asynchronous `error`, so that `rooms.ts`'s
        // per-recipient guard has something synchronous to catch and one dead socket cannot
        // swallow the rest of a broadcast
        if (raw.readyState !== WebSocket.OPEN) throw new Error('the socket is not open');
        raw.send(payload);
      },
      close: (code, reason) => raw.close(code, reason),
    };

    /** Close and error are the same cleanup, and both must run — a socket can do either */
    const release = (): void => {
      awaitingPong.delete(raw);
      rooms.forget(connection);
    };

    raw.on('pong', () => awaitingPong.delete(raw));

    raw.on('message', (data: RawData) => {
      const text = data.toString();

      try {
        handleClientMessage(connection, text, rooms);
      } catch (error) {
        // A refusal is already a message by the time it gets here, so anything thrown is a bug.
        // Logged rather than rethrown: an exception out of an event listener takes the process
        // down, and one malformed frame must not be able to stop a server.
        console.error('[live] unhandled error handling a socket message', error);
      }
    });

    raw.on('close', release);

    raw.on('error', (error) => {
      console.warn('[live] socket error', error);
      release();
    });
  }

  /**
   * Turn an unauthenticated connection away (v3 Req 44.1)
   *
   * **The `'error'` listener is not optional and its absence was a remote crash.** `handleUpgrade`
   * completes the handshake and wires `ws`'s frame receiver *before* this runs, and `raw.close()`
   * only moves the socket to `CLOSING` — so any bytes the client pipelined behind the handshake are
   * still parsed. A malformed frame (a set RSV1 bit is enough) makes the receiver emit `'error'`,
   * and an `'error'` on an `EventEmitter` with no listener is a **throw**, raised out of a
   * `socket.on('data')` callback where nothing can catch it. There is no
   * `process.on('uncaughtException')` anywhere in `src/`, so one frame from an anonymous client
   * ended the process. Reproduced against this tree's own `ws` 8.19.0.
   *
   * **This does not weaken the criterion.** *No listeners attached* means no **message** listener
   * and no room join — the connection can still say nothing and reach nothing. An error listener is
   * the opposite of a capability: it is what stops a refused caller from having any effect at all.
   * The authenticated path in {@link register} always had one, which is exactly what made the
   * asymmetry easy to miss.
   *
   * @param raw The socket to turn away
   */
  function refuse(raw: WebSocket): void {
    raw.on('error', (error) => {
      console.warn('[live] error on a refused connection', error);
      raw.terminate();
    });

    // The handshake is completed only so that the close *code* can be delivered — a browser refused
    // mid-handshake gets a bare `error` carrying no code and cannot tell *sign in* from *the network
    // is down*, which under D6 is the one distinction it needs
    raw.close(SOCKET_CLOSE_CODE.UNAUTHENTICATED, UNAUTHENTICATED_REASON);
  }

  const onUpgrade = (incoming: IncomingMessage, socket: Duplex, head: Buffer): void => {
    const url = new URL(incoming.url ?? '/', 'http://localhost');

    // Not ours — and saying nothing is the correct answer. Vite's HMR socket is another `upgrade`
    // listener on this same server, and a handler that answered every path would break hot reload.
    if (url.pathname !== LIVE_SOCKET_PATH) return;

    // Authentication is asynchronous, so the raw socket outlives this function. Without a listener
    // an `error` on it during that window is an unhandled event that takes the process down.
    socket.on('error', (error) => console.warn('[live] upgrade socket error', error));

    const admitting = accountForUpgrade(incoming);

    void admitting
      .then((account) => {
        sockets.handleUpgrade(incoming, socket, head, (raw) => {
          if (!account) {
            refuse(raw);
            return;
          }

          register(raw, account.id);
        });
      })
      .catch((error: unknown) => {
        // `accountFromRequest` catches its own failures today, but that is another module's promise
        // and not a guarantee this one may lean on. An unhandled rejection here would be a crash on
        // some Node versions *and* would leak the `Duplex` forever, since nothing else closes it.
        console.error('[live] the upgrade could not be decided', error);
        socket.destroy();
      });
  };

  httpServer.on('upgrade', onUpgrade);

  const heartbeat = setInterval(() => {
    for (const raw of sockets.clients) {
      if (awaitingPong.has(raw)) {
        // Deleted here rather than left to a `'close'` handler. A **registered** socket has one and
        // it would clean up; a **refused** one deliberately has no `'close'` listener at all, so
        // without this line its `WebSocket` is retained by this Set for the life of the process —
        // reachable by any client that stalls the close handshake past one interval.
        awaitingPong.delete(raw);
        raw.terminate();
        continue;
      }

      awaitingPong.add(raw);
      raw.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);

  return {
    close(): void {
      clearInterval(heartbeat);
      httpServer.off('upgrade', onUpgrade);

      // The rooms first — that empties the map and closes everything in one
      rooms.closeAll();

      // …then anything that connected and never subscribed, which no room ever held. Closing an
      // already-closing socket is a no-op, so the overlap costs nothing.
      for (const raw of sockets.clients) {
        raw.close(SOCKET_CLOSE_CODE.SERVER_STOPPING, SERVER_STOPPING_REASON);
      }

      awaitingPong.clear();
      sockets.close();
    },
  };
}
