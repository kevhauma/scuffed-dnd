/**
 * The socket end to end, over a real connection (TICKET-LIVE-01)
 *
 * **How a socket is tested with `tanstackStart()` omitted from `vitest.config.ts`.** The rule is
 * that server code is exercised by calling functions and handlers directly, never by booting Nitro
 * — and this keeps it. What these tests create is a bare `node:http` server, which is not a
 * framework: no route tree, no SSR handler, no Vite, no build. `attachLiveSocket` is handed a
 * listener the way it will be handed Vite's in development and TICKET-POL-03's in production, and
 * real `ws` clients connect to it over loopback.
 *
 * It is also not the shared test server `testing/index.ts` rules out. Each test owns its own,
 * listening on an ephemeral port and closed in a `finally`, so nothing is carried between them.
 *
 * **The cookies are real.** Every account here is signed up through the actual Better Auth handler
 * and the `Set-Cookie` it produces is what the upgrade request carries — because the claim under
 * test is *the socket authenticates from the same cookie the HTTP requests use*, and a forged
 * cookie would be asserting our own assumptions back at us. The expired case drives `Date` rather
 * than waiting thirty days, the way `auth/session.test.ts` does.
 *
 * **Validates: v3 Req 44.1, 44.2, 44.3, 39.3**
 */

import { createServer, type Server as HttpServer, request as httpRequest } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import {
  CLIENT_MESSAGE_TYPE,
  LIVE_SOCKET_PATH,
  MEMBER_ROLE,
  SERVER_MESSAGE_TYPE,
  type ServerSocketMessage,
  SOCKET_CLOSE_CODE,
} from '#shared/types';
import { handleApiRequest } from '../http/apiRouter';
import { type Database, seedMember, seedSession, withTestDatabase } from '../testing';
import { attachLiveSocket, type LiveSocketServer } from './liveSocketServer';
import { createSocketRooms, type SocketRooms } from './rooms';

const PASSWORD = 'correct-horse-battery';

/** How long a socket assertion may wait before the failure is the wait rather than the behaviour */
const PATIENCE_MS = 4_000;

/** A different client per request, for the reason `auth.test.ts` records about Better Auth's limiter */
let clientNumber = 0;
function nextClientIp(): string {
  clientNumber += 1;
  return `10.4.${Math.floor(clientNumber / 250)}.${(clientNumber % 250) + 1}`;
}

/** An Account that really exists, with the cookie a browser would keep and the id rows key on */
interface SignedInAccount {
  id: string;
  /** The `name=value` to send back */
  cookie: string;
  /** The whole `Set-Cookie`, for the one test that is about an attribute rather than a value */
  attributes: string;
}

/** Ask the real auth handler, and insist the router claimed the path */
async function callAuth(
  path: string,
  init: { body?: unknown; cookie?: string } = {}
): Promise<Response> {
  const ip = nextClientIp();
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-forwarded-for': ip,
  };

  if (init.cookie) headers.cookie = init.cookie;

  const body = init.body === undefined ? undefined : JSON.stringify(init.body);
  const request = new Request(`http://localhost/api/auth${path}`, {
    method: 'POST',
    headers,
    body,
  });

  const response = await handleApiRequest(request);

  if (!response) throw new Error(`POST /api/auth${path} was not claimed by the API router`);

  return response;
}

/** The whole `Set-Cookie`, attributes and all — which is where `SameSite` lives */
function setCookieHeader(response: Response): string {
  const cookies = response.headers.getSetCookie();
  const header = cookies.find((value) => value.includes('session_token'));

  if (!header) throw new Error('no session cookie on that response');

  return header;
}

/** …and just the `name=value` a browser sends back */
function cookieFrom(response: Response): string {
  const header = setCookieHeader(response);
  return header.split(';')[0] as string;
}

/** Create a real Account and sign it in */
async function signUp(email: string): Promise<SignedInAccount> {
  const response = await callAuth('/sign-up/email', {
    body: { email, password: PASSWORD, name: email },
  });

  if (response.status !== 200) {
    const complaint = await response.text();
    throw new Error(`sign-up failed: ${complaint}`);
  }

  const cookie = cookieFrom(response);
  const attributes = setCookieHeader(response);
  const body = (await response.json()) as { user?: { id?: string } };
  const id = body.user?.id;

  if (!id) throw new Error('the sign-up response carried no account id');

  return { id, cookie, attributes };
}

/** What a running socket server offers a test */
interface RunningLiveServer {
  /** The live socket's own address on this server */
  url: string;
  /** The ephemeral port it is listening on, for a test that has to speak HTTP itself */
  port: number;
  rooms: SocketRooms;
  httpServer: HttpServer;
  live: LiveSocketServer;
  /** Detach, close every connection, and stop listening */
  stop(): Promise<void>;
}

/** A live socket on its own ephemeral port */
async function startLiveServer(): Promise<RunningLiveServer> {
  const rooms = createSocketRooms();
  const httpServer: HttpServer = createServer((_request, response) => {
    // Nothing here serves the app; every request that is not an upgrade is a mistake
    response.statusCode = 426;
    response.end();
  });

  const live = attachLiveSocket(httpServer, rooms);

  await new Promise<void>((resolve) => {
    httpServer.listen(0, '127.0.0.1', resolve);
  });

  const address = httpServer.address();

  if (address === null || typeof address === 'string') {
    throw new Error('the test server is not listening on a port');
  }

  const url = `ws://127.0.0.1:${address.port}${LIVE_SOCKET_PATH}`;

  return {
    url,
    port: address.port,
    rooms,
    httpServer,
    live,
    stop: async () => {
      live.close();
      httpServer.closeAllConnections();
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    },
  };
}

/**
 * Run something against a live socket, stopped afterwards whatever happened
 *
 * @param run What to do with it
 * @returns Whatever `run` returned
 */
async function withLiveServer<T>(run: (server: RunningLiveServer) => Promise<T>): Promise<T> {
  const server = await startLiveServer();

  try {
    return await run(server);
  } finally {
    await server.stop();
  }
}

/**
 * Wait for something the *server* does in response to something the client did
 *
 * A client's `close` event fires when its own handshake finishes; the server's own `close` listener
 * — the one that empties the room — runs a socket round trip later. Polling to a deadline says
 * *this becomes true* without asserting how many turns of the event loop it takes, which is the
 * kind of number that is right on one machine and flaky on another.
 *
 * @param condition What has to become true
 * @param what What to say if it never does
 */
async function until(condition: () => boolean, what: string): Promise<void> {
  const deadline = Date.now() + PATIENCE_MS;

  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);

    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

/** Every socket a test opened, closed on the way out whatever happened */
const opened: WebSocket[] = [];

afterEach(() => {
  for (const socket of opened) socket.terminate();
  opened.length = 0;
  vi.useRealTimers();
});

/** Open a connection, optionally carrying a cookie */
function connect(url: string, cookie?: string): WebSocket {
  const headers = cookie === undefined ? undefined : { cookie };
  const socket = new WebSocket(url, { headers });

  opened.push(socket);

  return socket;
}

/** Resolve with the code this socket is closed with */
function closeCode(socket: WebSocket): Promise<number> {
  return new Promise((resolve, reject) => {
    const giveUp = setTimeout(() => {
      const timedOut = new Error('the socket was never closed');
      reject(timedOut);
    }, PATIENCE_MS);

    socket.on('close', (code) => {
      clearTimeout(giveUp);
      resolve(code);
    });
  });
}

/** Resolve once the handshake has completed */
function openedUp(socket: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    const giveUp = setTimeout(() => {
      const timedOut = new Error('the socket never opened');
      reject(timedOut);
    }, PATIENCE_MS);

    socket.on('open', () => {
      clearTimeout(giveUp);
      resolve();
    });

    socket.on('error', (error) => {
      clearTimeout(giveUp);
      reject(error);
    });
  });
}

/** Resolve with the next message this socket receives */
function nextMessage(socket: WebSocket): Promise<ServerSocketMessage> {
  return new Promise((resolve, reject) => {
    const giveUp = setTimeout(() => {
      const timedOut = new Error('no message arrived');
      reject(timedOut);
    }, PATIENCE_MS);

    socket.once('message', (data) => {
      clearTimeout(giveUp);
      const text = data.toString();
      const parsed = JSON.parse(text) as ServerSocketMessage;
      resolve(parsed);
    });
  });
}

/** Say *listen to this table*, and wait for the answer */
function subscribe(socket: WebSocket, sessionId: string): Promise<ServerSocketMessage> {
  const reply = nextMessage(socket);
  const frame = JSON.stringify({ type: CLIENT_MESSAGE_TYPE.SUBSCRIBE, sessionId });

  socket.send(frame);

  return reply;
}

/** A table with one signed-in player seated at it */
async function aTableWithAPlayer(
  database: Database,
  email: string
): Promise<{ player: SignedInAccount; sessionId: string }> {
  const player = await signUp(email);
  const { session } = seedSession(database);

  seedMember(database, { session, account: player.id, role: MEMBER_ROLE.PLAYER });

  return { player, sessionId: session.id };
}

describe('the upgrade', () => {
  it('should close a connection carrying no cookie at all', () =>
    withTestDatabase(() =>
      withLiveServer(async ({ url, rooms }) => {
        const socket = connect(url);
        const code = await closeCode(socket);
        const joined = rooms.roomCount();

        expect(code).toBe(SOCKET_CLOSE_CODE.UNAUTHENTICATED);
        expect(joined).toBe(0);
      })
    ));

  it('should close a connection carrying a cookie that does not verify', () =>
    withTestDatabase(() =>
      withLiveServer(async ({ url, rooms }) => {
        const socket = connect(url, 'better-auth.session_token=not-a-real-token');
        const code = await closeCode(socket);
        const joined = rooms.roomCount();

        expect(code).toBe(SOCKET_CLOSE_CODE.UNAUTHENTICATED);
        expect(joined).toBe(0);
      })
    ));

  it('should close a connection carrying a cookie that has been signed out', () =>
    withTestDatabase(() =>
      withLiveServer(async ({ url, rooms }) => {
        const account = await signUp('signed-out@example.test');
        await callAuth('/sign-out', { body: {}, cookie: account.cookie });

        const socket = connect(url, account.cookie);
        const code = await closeCode(socket);
        const joined = rooms.roomCount();

        expect(code).toBe(SOCKET_CLOSE_CODE.UNAUTHENTICATED);
        expect(joined).toBe(0);
      })
    ));

  it('should close a connection carrying an expired cookie', () =>
    withTestDatabase(() =>
      withLiveServer(async ({ url, rooms }) => {
        // Only `Date` is faked — faking timers as well would suspend the promises this awaits,
        // which is the reason `auth/session.test.ts` gives for the same choice
        vi.useFakeTimers({ toFake: ['Date'] });
        const signedInAt = new Date('2026-01-01T00:00:00.000Z');
        vi.setSystemTime(signedInAt);

        const account = await signUp('expired@example.test');

        // Past the documented 30-day idle default, with nothing having renewed it
        const longAfterwards = new Date('2026-03-01T00:00:00.000Z');
        vi.setSystemTime(longAfterwards);

        const socket = connect(url, account.cookie);
        const code = await closeCode(socket);
        const joined = rooms.roomCount();

        expect(code).toBe(SOCKET_CLOSE_CODE.UNAUTHENTICATED);
        expect(joined).toBe(0);
      })
    ));

  it('should admit a real Account and leave the connection open', () =>
    withTestDatabase(async (database) => {
      const account = await signUp('admitted@example.test');

      await withLiveServer(async ({ url, rooms }) => {
        const socket = connect(url, account.cookie);

        await openedUp(socket);

        const state = socket.readyState;
        const joined = rooms.roomCount();

        // Connected, and in no room — a socket is admitted to the *server* on the upgrade and to a
        // *room* only when it asks and `requireMember` agrees
        expect(state).toBe(WebSocket.OPEN);
        expect(joined).toBe(0);

        // `database` is what `withTestDatabase` installed and the sign-up above wrote into
        expect(database).toBeDefined();
      });
    }));
});

describe('a refused connection cannot take the process with it', () => {
  /**
   * One frame that `ws` must reject, written straight onto a refused connection's socket
   *
   * Hand-rolled over `node:http`'s upgrade socket rather than through a `ws` client, because a
   * conforming client cannot produce this: the whole point is a frame the receiver refuses.
   * `node:net` would be the obvious tool and is forbidden here by `the-server-sends-no-mail`,
   * whose comment carves out `http` for exactly this kind of use.
   *
   * The bytes are `0xC1 0x80` + a zero mask: FIN, **RSV1 set**, opcode 1, masked, zero length. No
   * extension was negotiated, so RSV1 is illegal and `ws` fails it with `WS_ERR_UNEXPECTED_RSV_1`.
   *
   * @param port Where the server is listening
   */
  function pipelineABadFrame(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const upgrading = httpRequest({
        host: '127.0.0.1',
        port,
        path: LIVE_SOCKET_PATH,
        headers: {
          connection: 'Upgrade',
          upgrade: 'websocket',
          'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
          'sec-websocket-version': '13',
        },
      });

      upgrading.on('upgrade', (_response, socket) => {
        const malformed = Buffer.from([0xc1, 0x80, 0x00, 0x00, 0x00, 0x00]);

        socket.on('error', () => undefined);
        socket.write(malformed);

        // The write is on the wire; the caller waits for the server to have *parsed* it with
        // `until`, not with a guessed sleep
        resolve();
      });

      const failed = (error: Error) => reject(error);

      upgrading.on('error', failed);
      upgrading.end();
    });
  }

  it('should survive a malformed frame from an unauthenticated client', () =>
    withTestDatabase(async (database) => {
      // **A reproduced process-crash vector, kept reproduced.** `handleUpgrade` completes the
      // handshake and wires `ws`'s receiver *before* the refusal runs, and `raw.close()` only moves
      // the socket to CLOSING — so a frame pipelined behind the handshake is still parsed. Without
      // an `'error'` listener on the refusal path, the receiver's error is emitted on an emitter
      // with no listener, which Node turns into a **throw** out of a `socket.on('data')` callback.
      // Nothing in `src/` installs an `uncaughtException` handler, so the process ended. From an
      // anonymous client, on one frame.
      //
      // The assertion is deliberately *the server still answers*: if the fix regresses, this file's
      // worker dies outright and the failure is unmissable.
      const account = await signUp('survivor@example.test');
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      try {
        await withLiveServer(async ({ url, port, rooms }) => {
          await pipelineABadFrame(port);

          // Waited for, not slept through — this file's own `until` exists because a guessed
          // millisecond count is right on one machine and flaky on another, which is the lesson
          // TEST_STATUS records for this very ticket
          await until(() => warn.mock.calls.length > 0, 'the bad frame to be parsed and handled');

          const afterwards = connect(url, account.cookie);
          await openedUp(afterwards);

          const state = afterwards.readyState;
          const joined = rooms.roomCount();
          const logged = warn.mock.calls.flat().join(' ');

          expect(state).toBe(WebSocket.OPEN);
          expect(joined).toBe(0);

          // The error was *handled*, not merely survived — asserted rather than left as stderr
          // noise, so the difference between "the listener ran" and "we got lucky on timing" is
          // visible in the test rather than in the scrollback
          expect(logged).toContain('error on a refused connection');
        });
      } finally {
        warn.mockRestore();
      }

      expect(database).toBeDefined();
    }));
});

describe('what stops another site opening one of these', () => {
  it('should be SameSite=Lax on the cookie, which is the whole of the defence', () =>
    withTestDatabase(async () => {
      // **This is the tripwire, and it has to be this one.** A WebSocket upgrade is not subject to
      // CORS, and nothing in `src/` reads `Origin` — so what actually prevents `evil.example`
      // opening a connection as one of our signed-in users is that the browser declines to *send*
      // the Auth_Session cookie cross-site. That is `SameSite=Lax`, and it is Better Auth's
      // **default** rather than something `authServer.ts` sets, which means a library bump is
      // exactly the change that could move it with nothing in this repo objecting.
      //
      // Asserted on the attribute itself rather than through a connection, because a connection
      // cannot see it: a Node `ws` client applies no cookie policy at all, so a cross-origin case
      // below passes identically under `Lax`, `Strict` and `None`. `auth.test.ts` carries the same
      // assertion for the cookie's own sake; this one exists because *this module* is the thing
      // that silently loses its only defence if it changes.
      const account = await signUp('same-site@example.test');
      const attributes = account.attributes.toLowerCase();

      expect(attributes).toContain('samesite=lax');
    }));

  it('should refuse a handshake that arrives with another site’s Origin', () =>
    withTestDatabase(async (database) => {
      // **Documentation of the shape, not a tripwire** — and saying so is the point. A Node client
      // sends whatever headers it is told to and no cookie it was not given, so this is
      // behaviourally the same case as *no cookie at all* and would keep passing under any
      // `SameSite`. It is kept because it records what the server does with an `Origin` it has no
      // opinion about: nothing, and the refusal comes from the absent cookie.
      //
      // An `Origin` allow-list was considered and rejected — see this module's header for why a
      // check reading `AUTH_ALLOWED_HOSTS` would do nothing on the deployment that needs it most.
      await signUp('cross-origin@example.test');

      await withLiveServer(async ({ url, rooms }) => {
        const fromElsewhere = new WebSocket(url, { headers: { origin: 'https://evil.example' } });
        opened.push(fromElsewhere);

        const code = await closeCode(fromElsewhere);
        const joined = rooms.roomCount();

        expect(code).toBe(SOCKET_CLOSE_CODE.UNAUTHENTICATED);
        expect(joined).toBe(0);
      });

      expect(database).toBeDefined();
    }));
});

describe('rooms, over a real connection', () => {
  it('should admit a Member who asks, and refuse a stranger saying nothing', () =>
    withTestDatabase(async (database) => {
      const { player, sessionId } = await aTableWithAPlayer(database, 'member@example.test');
      const stranger = await signUp('stranger@example.test');

      await withLiveServer(async ({ url, rooms }) => {
        const memberSocket = connect(url, player.cookie);
        await openedUp(memberSocket);
        const admitted = await subscribe(memberSocket, sessionId);

        const strangerSocket = connect(url, stranger.cookie);
        await openedUp(strangerSocket);
        const refused = await subscribe(strangerSocket, sessionId);

        const joined = rooms.roomCount();

        expect(admitted).toEqual({
          type: SERVER_MESSAGE_TYPE.SUBSCRIBED,
          sessionId,
        });
        expect(refused).toEqual({
          type: SERVER_MESSAGE_TYPE.SUBSCRIBE_REFUSED,
          sessionId,
        });
        expect(joined).toBe(1);
      });
    }));

  it('should deliver a broadcast to the room and to nobody outside it', () =>
    withTestDatabase(async (database) => {
      const { player, sessionId } = await aTableWithAPlayer(database, 'listener@example.test');
      const bystander = await signUp('bystander@example.test');

      await withLiveServer(async ({ url, rooms }) => {
        const listening = connect(url, player.cookie);
        await openedUp(listening);
        await subscribe(listening, sessionId);

        const notListening = connect(url, bystander.cookie);
        await openedUp(notListening);

        const outsideHeard: string[] = [];
        notListening.on('message', (data) => {
          const text = data.toString();
          outsideHeard.push(text);
        });

        const arriving = nextMessage(listening);

        // Built from the shared constant rather than typed out as JSON: LIVE-02's traffic will use
        // this contract, and a hand-written literal would keep passing after the contract moved
        const traffic: ServerSocketMessage = {
          type: SERVER_MESSAGE_TYPE.SUBSCRIBED,
          sessionId: "a later ticket's traffic",
        };
        const frame = JSON.stringify(traffic);
        rooms.broadcast(sessionId, frame);

        const received = await arriving;

        expect(received).toEqual({
          type: SERVER_MESSAGE_TYPE.SUBSCRIBED,
          sessionId: "a later ticket's traffic",
        });
        expect(outsideHeard).toEqual([]);
      });
    }));

  it('should hold no rooms once every client has disconnected', () =>
    withTestDatabase(async (database) => {
      // Criterion 6, over real sockets: the close event is what empties the map, and a server that
      // ran for a month must not be holding one Set per table ever played
      const { player, sessionId } = await aTableWithAPlayer(database, 'leaver@example.test');

      await withLiveServer(async ({ url, rooms }) => {
        const socket = connect(url, player.cookie);
        await openedUp(socket);
        await subscribe(socket, sessionId);

        const whileConnected = rooms.roomCount();
        expect(whileConnected).toBe(1);

        const closed = closeCode(socket);
        socket.close();
        await closed;

        await until(() => rooms.roomCount() === 0, 'the room to empty');

        const afterDisconnect = rooms.roomCount();

        expect(afterDisconnect).toBe(0);
      });
    }));

  it('should close every connection when the server shuts down', () =>
    withTestDatabase(async (database) => {
      const { player, sessionId } = await aTableWithAPlayer(database, 'shutdown@example.test');

      await withLiveServer(async ({ url, rooms, live }) => {
        const socket = connect(url, player.cookie);

        await openedUp(socket);
        await subscribe(socket, sessionId);

        const closing = closeCode(socket);

        live.close();

        const code = await closing;
        const remaining = rooms.roomCount();

        expect(code).toBe(SOCKET_CLOSE_CODE.SERVER_STOPPING);
        expect(remaining).toBe(0);
      });
    }));
});

describe('sharing the listener', () => {
  it('should claim its own path and leave another upgrade handler’s alone', () =>
    withTestDatabase(() =>
      withLiveServer(async ({ url, httpServer }) => {
        // **The reason the handler filters by path.** In development Vite's HMR socket is a second
        // `upgrade` listener on this very server, so a handler that answered every path would take
        // hot reload down with it — and one that answered none would be invisible. Both halves are
        // asserted here against a stand-in for Vite's listener.
        //
        // Note that *nobody* claiming an upgrade does not close it: node destroys an unhandled
        // upgrade only when there are **zero** `upgrade` listeners, and ours is one. So the
        // stand-in below does what Vite's does and refuses what is not its own.
        const claimedByTheOther: string[] = [];

        httpServer.on('upgrade', (incoming, socket) => {
          if (incoming.url === LIVE_SOCKET_PATH) return;

          claimedByTheOther.push(incoming.url ?? '');
          socket.destroy();
        });

        const elsewhere = url.replace(LIVE_SOCKET_PATH, '/some-other-socket');
        const strayed = connect(elsewhere);

        const refusedByTheOther = new Promise<void>((resolve) => {
          strayed.on('error', () => resolve());
          strayed.on('close', () => resolve());
        });

        await refusedByTheOther;

        const ours = connect(url);
        const code = await closeCode(ours);

        // Ours claimed its own path — the stand-in never saw it — and said its own thing about it
        expect(claimedByTheOther).toEqual(['/some-other-socket']);
        expect(code).toBe(SOCKET_CLOSE_CODE.UNAUTHENTICATED);
      })
    ));
});
