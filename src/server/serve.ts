/**
 * One listener, three jobs — the deployed shape (TICKET-POL-03)
 *
 * The client bundle, the API and the live socket on **one** `node:http` server (D1, v3 Req 47.1,
 * 47.6). An operator runs one web server, starts one thing and keeps one thing alive; the browser
 * addresses the API by relative path and the socket by `window.location`, so nothing in the shipped
 * bundle or the documented environment names an origin and changing the port moves everything at
 * once.
 *
 * ## Why this is a module and not a script
 *
 * `scripts/serve.mjs` is three lines: default `NODE_ENV`, import the built entry, call `start()`.
 * Everything it would otherwise contain lives here instead, under `src/server/`, where
 * dependency-cruiser cruises it, the conventions apply and it can be tested — `serve.test.ts`
 * starts this on an ephemeral port and asserts the three jobs against one listener. A runner made
 * of untested JavaScript beside the tree is how a deployment acquires behaviour nobody can check.
 *
 * ## The socket, which is LIVE-01's named debt
 *
 * `attachLiveSocket(httpServer)` takes the listener as a parameter and, until this ticket, its only
 * caller was `scripts/live-socket.mjs` — a Vite plugin that runs under `yarn dev` and nowhere else.
 * A built artefact therefore had an API and no socket, and every LIVE-0x feature was silently
 * absent in the one environment that matters. It is attached here, to the same server the bundle
 * and the API are served from, which is the arrangement `liveSocketServer.ts`'s own note asks for.
 *
 * ## The order requests are tried in
 *
 * Static file first, then the entry's `fetch`. Not the other way round: the SSR handler answers
 * *everything*, so a bundle file reached after it would never be reached at all. A static miss is
 * silent and falls through, which is what makes SSR the default rather than the fallback.
 *
 * **Validates: v3 Req 47.1, 47.6** — deliberately not 47.8, which is scoped to the *development*
 * server, nor 44.1, which is about who may open a socket and belongs to `ws/liveSocketServer.ts`.
 * This module attaches one; it decides nothing about it.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serverEnv } from './env';
import { NOMINAL_ORIGIN, toWebRequest, writeWebResponse } from './http/nodeBridge';
import { findStaticFile, sendStaticFile } from './http/staticFiles';
import { attachLiveSocket, type LiveSocketServer } from './ws/liveSocketServer';

/**
 * Where the client bundle sits, relative to this module once it is built
 *
 * The build emits `dist/server/entry.js` — everything under `src/server/` is bundled into it — and
 * `dist/client/` beside it, so `../client/` is the answer from the artefact's own location. Read
 * from `import.meta.url` rather than from the working directory for `db/migrate.ts`'s reason: where
 * the process was started is not something a deployment should have an opinion about.
 *
 * A test passes its own root instead, which is also what keeps this constant from being a claim
 * about anything but the built layout.
 */
const THIS_DIRECTORY = dirname(fileURLToPath(import.meta.url));

const BUILT_CLIENT_ROOT = join(THIS_DIRECTORY, '..', 'client');

/** The methods a file can answer. Anything else is the app's business, not the bundle's. */
const STATIC_METHODS = new Set(['GET', 'HEAD']);

/** What the process answers a request with */
export type FetchHandler = (request: Request) => Response | Promise<Response>;

/** What {@link startServer} may be told; everything unstated comes from the environment */
export interface ServeOptions {
  /** Where the client bundle is; defaults to the directory beside the built server */
  clientRoot?: string;
  /** Which port to listen on; defaults to `PORT`. `0` asks the OS for a free one, which tests do. */
  port?: number;
  /** Which interface to bind; defaults to `HOST`, and unset means all of them */
  host?: string;
}

/** A running server */
export interface RunningServer {
  /** The port actually bound — the same as the one asked for, unless `0` was */
  port: number;
  /** Stop listening, close every socket, and let the process exit */
  close(): Promise<void>;
}

/**
 * Answer one request: a file from the bundle, or whatever the server makes of it
 *
 * @param request The raw request
 * @param outgoing The socket to answer on
 * @param clientRoot Where the bundle is
 * @param fetch What answers everything the bundle does not
 */
async function answer(
  request: IncomingMessage,
  outgoing: ServerResponse,
  clientRoot: string,
  fetch: FetchHandler
): Promise<void> {
  const url = new URL(request.url ?? '/', NOMINAL_ORIGIN);
  const method = request.method ?? 'GET';

  // **The static half answers reads only.** The ordering argument above is about paths; it says
  // nothing about methods, and a `POST /assets/main-abc123.js` answered with the whole file is a
  // request whose body was never consumed and whose verb was never considered. Anything but a read
  // falls through to the app, which has an opinion about verbs.
  const file = STATIC_METHODS.has(method) ? await findStaticFile(clientRoot, url.pathname) : null;

  if (file) {
    await sendStaticFile(file, outgoing, method);
    return;
  }

  const web = toWebRequest(request);
  const response = await fetch(web);
  await writeWebResponse(response, outgoing);
}

/**
 * What a request that threw is told
 *
 * The pipeline already turns every route's failure into a JSON refusal, so anything arriving here
 * escaped *before* a handler — a malformed request line, a body that could not be read. It is told
 * that something broke and nothing else, which is the same promise `defineHandler` makes.
 *
 * @param outgoing The socket to answer on
 * @param error What went wrong
 */
function fail(outgoing: ServerResponse, error: unknown): void {
  console.error('[serve] unhandled error answering a request', error);

  if (outgoing.headersSent) {
    // The status is already on the wire and cannot be taken back; all that is left is to stop
    // pretending there is more to come
    outgoing.destroy();
    return;
  }

  outgoing.writeHead(500, { 'content-type': 'application/json' });
  outgoing.end('{"error":{"code":"internal","message":"Internal server error"}}');
}

/**
 * Start serving
 *
 * @param fetch What answers everything the client bundle does not — `entry.fetch` in production
 * @param options Overrides for the environment's own answers
 * @returns The running server, once it is listening
 */
export function startServer(
  fetch: FetchHandler,
  options: ServeOptions = {}
): Promise<RunningServer> {
  const env = serverEnv();
  const clientRoot = options.clientRoot ?? BUILT_CLIENT_ROOT;
  const port = options.port ?? env.port;
  const host = options.host ?? env.host;

  const server: Server = createServer((request, outgoing) => {
    void answer(request, outgoing, clientRoot, fetch).catch((error: unknown) =>
      fail(outgoing, error)
    );
  });

  // **The whole point of the ticket, in one line.** The socket shares this listener rather than
  // opening one of its own: same port, same origin, same Auth_Session cookie riding the upgrade
  // with nothing added (LIVE-01).
  const sockets: LiveSocketServer = attachLiveSocket(server);

  return new Promise((resolve, reject) => {
    /**
     * Everything that goes wrong on the listener after it is up
     *
     * **Not merely the absence of `reject`.** A `Server` is an `EventEmitter`, so an `'error'` with
     * no listener is a **throw** out of an event callback where nothing can catch it, and there is
     * no `process.on('uncaughtException')` anywhere in `src/` — so an `EMFILE` on accept, one
     * exhausted file-descriptor table, would end the whole deployment. `liveSocketServer.ts`'s
     * header records this exact failure class as the reason a *refused* connection still gets an
     * error listener; the single listener the deployment stands on is the worse place to omit one.
     */
    const onError = (error: Error): void => {
      console.error('[serve] listener error', error);
    };

    // `once`, and replaced rather than removed below: a failure *before* listening is a start-up
    // failure and belongs to the caller, and everything after it belongs to the log
    server.once('error', reject);

    server.listen({ port, host }, () => {
      server.removeListener('error', reject);
      server.on('error', onError);

      const address = server.address();
      const bound = typeof address === 'object' && address ? address.port : port;
      const shown = host ?? 'localhost';

      console.info(`  ➜  Serving the app, the API and the live socket on http://${shown}:${bound}`);

      resolve({
        port: bound,
        close(): Promise<void> {
          // The socket first: it closes every connection and empties the rooms, so nothing is left
          // holding the listener open when `close` waits for it
          sockets.close();

          return new Promise((done) => {
            server.closeAllConnections();
            server.close(() => done());
          });
        },
      });
    });
  });
}

/** The signals a supervisor sends to ask a process to go away */
const STOP_SIGNALS = ['SIGINT', 'SIGTERM'] as const;

/**
 * Stop the server when the supervisor asks (v3 Req 44.9)
 *
 * Registered by the runner and by nothing else, which is why it is not folded into
 * {@link startServer}: a test that started a server would otherwise leave a process-wide listener
 * behind every time, and the tenth one would be a warning about a leak that was never a leak.
 *
 * Closing rather than exiting outright matters for one reason: every live socket gets a
 * `SERVER_STOPPING` close frame, so a browser is told to reconnect instead of discovering the
 * silence itself.
 *
 * @param running What to stop
 */
export function stopOnSignals(running: RunningServer): void {
  for (const signal of STOP_SIGNALS) {
    process.once(signal, () => {
      console.info(`\n[serve] ${signal} — closing`);
      void running.close().then(() => process.exit(0));
    });
  }
}
