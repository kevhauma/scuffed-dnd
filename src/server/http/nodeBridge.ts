/**
 * Node's HTTP objects on one side, the Web's `Request`/`Response` on the other (TICKET-POL-03)
 *
 * `src/server/entry.ts` is handed a `Request` and gives back a `Response` — the shape TanStack
 * Start defines and the shape every route in this repository is written against. A `node:http`
 * listener speaks `IncomingMessage`/`ServerResponse`. Something has to translate, and under
 * `yarn dev` that something is Vite. In production it is this module.
 *
 * **Written by hand rather than depended on.** Vite's own preview server uses `srvx/node`, but that
 * is a transitive dependency of a *build* package — leaning on it is the trap LIVE-01 hit with `ws`,
 * where a library reached through somebody else's `node_modules` is a runtime promise nothing in
 * this repository records. D11 lists what this milestone adds and this is not on it. The whole
 * translation is under a hundred lines of Node 22 built-ins.
 *
 * **The load-bearing detail is `Set-Cookie`.** A `Headers` iteration yields it **combined** into a
 * single comma-joined value, which is legal for every other header and wrong for this one — two
 * cookies would arrive as one malformed header and every sign-in would silently fail to stick. The
 * only correct reader is `getSetCookie()`, and {@link writeWebResponse} uses it. This is the same
 * class of bug `src/server/environment.test.ts` exists because of: an authentication failure that
 * throws nothing and reads as working code.
 *
 * **The URL is built on `http://` whatever the proxy did**, and nothing downstream is misled by it:
 * it exists so `new URL` has a base, the API routes read only the path, and the one place an
 * absolute origin actually matters — Better Auth's OAuth callback — builds its own from
 * `AUTH_ALLOWED_HOSTS` and forces `https` in production (`auth/authServer.ts`'s `baseUrlFor`).
 *
 * **Validates: v3 Req 47.1, 47.6**
 */

import type { IncomingMessage, OutgoingHttpHeaders, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

/** The methods that cannot carry a body, and whose `Request` must therefore not be given one */
const BODYLESS_METHODS = new Set(['GET', 'HEAD']);

/**
 * The origin a request is parsed against when nothing better is known
 *
 * Exported because `serve.ts` needs the same one to read a path off an incoming request, and two
 * spellings of *the host does not matter here* are two places for one of them to start mattering.
 * Only the path is ever read off a URL built on it — see the header on why an absolute origin is
 * never taken from here.
 */
export const NOMINAL_ORIGIN = 'http://localhost';

/** What a request with no `Host` header is addressed to */
const FALLBACK_HOST = 'localhost';

/**
 * The incoming headers, in the shape `Request` takes
 *
 * Repeated headers are **appended** rather than joined: Node hands back an array only for the
 * headers it refuses to combine, and re-joining them here would be this module deciding on a
 * separator for a header it knows nothing about.
 *
 * @param incoming The raw request
 * @returns Its headers
 */
function webHeaders(incoming: IncomingMessage): Headers {
  const headers = new Headers();

  for (const [name, value] of Object.entries(incoming.headers)) {
    // HTTP/2 pseudo-headers are not legal `Headers` names and `set` throws on one — the same guard
    // `ws/liveSocketServer.ts` applies to an upgrade request, for the same reason
    if (name.startsWith(':')) continue;

    if (typeof value === 'string') {
      headers.set(name, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) headers.append(name, entry);
    }
  }

  return headers;
}

/**
 * The same request, in the shape the server is written against
 *
 * @param incoming The raw request
 * @returns It as a `Request`, its body streaming rather than buffered
 */
export function toWebRequest(incoming: IncomingMessage): Request {
  const host = incoming.headers.host ?? FALLBACK_HOST;
  const base = `http://${host}`;
  const url = new URL(incoming.url ?? '/', base);
  const method = incoming.method ?? 'GET';
  const headers = webHeaders(incoming);

  if (BODYLESS_METHODS.has(method)) return new Request(url, { method, headers });

  // Streamed rather than buffered, so an upload is not held in memory in full before a handler
  // sees it. `duplex: 'half'` is required by the spec for any streaming body and is what stops
  // undici refusing the request outright.
  const body = Readable.toWeb(incoming) as ReadableStream<Uint8Array>;

  return new Request(url, { method, headers, body, duplex: 'half' } as RequestInit);
}

/**
 * The outgoing headers, in the shape `writeHead` takes
 *
 * @param headers What the response carries
 * @returns The same, with `Set-Cookie` kept as separate values
 */
function nodeHeaders(headers: Headers): OutgoingHttpHeaders {
  const out: OutgoingHttpHeaders = {};

  for (const [name, value] of headers) {
    // Skipped here and restored below from `getSetCookie()`. Iterating yields every cookie combined
    // into one comma-joined string, which is a header no browser will parse back into two.
    if (name.toLowerCase() === 'set-cookie') continue;
    out[name] = value;
  }

  const cookies = headers.getSetCookie();
  if (cookies.length > 0) out['set-cookie'] = cookies;

  return out;
}

/**
 * Send a `Response` down a Node socket
 *
 * @param response What the server produced
 * @param outgoing The socket to write it to
 */
export async function writeWebResponse(
  response: Response,
  outgoing: ServerResponse
): Promise<void> {
  const headers = nodeHeaders(response.headers);
  outgoing.writeHead(response.status, headers);

  if (!response.body) {
    outgoing.end();
    return;
  }

  const source = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);

  try {
    await pipeline(source, outgoing);
  } catch {
    // A client that navigated away mid-stream aborts the pipe, which is not a server fault and not
    // something to log per request. There is nothing left to say on a socket that has gone; what
    // matters is that the stream is torn down rather than left holding the response.
    outgoing.destroy();
  }
}
