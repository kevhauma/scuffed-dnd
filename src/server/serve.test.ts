/**
 * The deployed shape, proven against one listener (TICKET-POL-03)
 *
 * The ticket's central claim is that the built server does **three** jobs on **one** port — serves
 * the client bundle, answers the API, and carries the live socket — and this is where that stops
 * being a description. Each case starts the real `startServer` on an ephemeral port and asks the
 * one address for a different one of the three.
 *
 * **The socket handshake is written by hand, against a raw TCP socket.**
 * `.dependency-cruiser.mjs`'s `the-socket-library-has-one-importer` exempts exactly one test file
 * from importing `ws`, and this is not it — weakening a check in order to test something is worse
 * than testing it another way, and all this case needs is the status line. `101 Switching
 * Protocols` on `/api/live` can only come from an attached socket server; an unattached one leaves
 * the upgrade to the HTTP handler, which answers an ordinary status. What happens *after* the
 * switch — the 4401 refusal of an anonymous connection — is `ws/liveSocketServer.test.ts`'s, and
 * the ticket's browser check confirms it against the built artefact.
 *
 * **Validates: v3 Req 47.1, 47.6** — the attachment, not 44.1's rule about who may connect, which
 * `ws/liveSocketServer.test.ts` owns.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { type RunningServer, startServer } from './serve';

const running: RunningServer[] = [];
const temporary: string[] = [];

afterEach(async () => {
  for (const server of running.splice(0)) await server.close();
  for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true });
});

/** A directory shaped like a built client bundle */
function clientRoot(): string {
  const parent = tmpdir();
  const prefix = join(parent, 'dnd-serve-');
  const root = mkdtempSync(prefix);
  temporary.push(root);

  const assets = join(root, 'assets');
  mkdirSync(assets, { recursive: true });

  const bundle = join(assets, 'main-abc123.js');
  writeFileSync(bundle, 'console.info("the app")', 'utf8');

  return root;
}

/**
 * Start the real server on a free port, with a stand-in for the app
 *
 * The fetch handler is a stand-in rather than `entry.fetch` deliberately: what is under test is the
 * listener — routing to static files, bridging everything else, attaching the socket — and pulling
 * the whole SSR handler in would test TanStack Start instead.
 *
 * @param answer What the server should say to anything the bundle does not hold
 * @returns The origin to send requests to
 */
async function serving(answer: (request: Request) => Response): Promise<string> {
  const root = clientRoot();
  const server = await startServer(answer, { clientRoot: root, port: 0, host: '127.0.0.1' });
  running.push(server);

  return `http://127.0.0.1:${server.port}`;
}

/** What the API half of each case answers with */
function apiHandler(request: Request): Response {
  const { pathname } = new URL(request.url);
  const body = JSON.stringify({ pathname });

  return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
}

describe('startServer', () => {
  it('serves the client bundle from the same port as everything else', async () => {
    const origin = await serving(apiHandler);

    const response = await fetch(`${origin}/assets/main-abc123.js`);
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
    expect(text).toBe('console.info("the app")');
  });

  it('hands everything the bundle does not hold to the app', async () => {
    const origin = await serving(apiHandler);

    const response = await fetch(`${origin}/api/health`);
    const body = await response.json();

    // The order matters: the app answers *everything*, so a bundle file looked for after it would
    // never be reached at all
    expect(body).toEqual({ pathname: '/api/health' });
  });

  it('answers a route that looks like a file but is not one', async () => {
    const origin = await serving(apiHandler);

    const response = await fetch(`${origin}/config/stats.json`);
    const body = await response.json();

    expect(body).toEqual({ pathname: '/config/stats.json' });
  });

  it('carries the live socket on that same listener (TICKET-LIVE-01’s debt)', async () => {
    const origin = await serving(apiHandler);
    const address = new URL(origin);
    const port = Number(address.port);

    // An upgrade to `/api/live` reaches a handler on *this* server rather than a second process on
    // a second port. Asserted through a raw handshake so nothing here imports `ws`.
    const upgraded = await handshake(port, '/api/live');

    // Refused for want of a cookie — which is the point: a **4401** close frame can only come from
    // `liveSocketServer.refuse()`, so an anonymous handshake proves attachment as well as a
    // signed-in one would. A server with no socket answers the upgrade with a plain HTTP status.
    expect(upgraded.switching).toBe(true);
  });

  it('stops listening when it is closed', async () => {
    const root = clientRoot();
    const server = await startServer(apiHandler, {
      clientRoot: root,
      port: 0,
      host: '127.0.0.1',
    });
    const origin = `http://127.0.0.1:${server.port}`;

    await server.close();

    const refused = fetch(`${origin}/api/health`);
    await expect(refused).rejects.toThrow();
  });

  it('reports the port it actually bound', async () => {
    const root = clientRoot();
    const server = await startServer(apiHandler, { clientRoot: root, port: 0, host: '127.0.0.1' });
    running.push(server);

    // `0` asks the OS for a free one, so a caller that could not read it back would have nothing
    // to connect to
    expect(server.port).toBeGreaterThan(0);
  });
});

/**
 * Ask for a WebSocket upgrade and see whether the server grants one
 *
 * Written with `node:http`'s own client rather than with a socket library, twice over. `ws` has one
 * permitted importer and this is not it; and `node:net` — the obvious way to write a handshake by
 * hand — is refused by `the-server-sends-no-mail`, which forbids the raw-socket modules an SMTP
 * client is built out of and deliberately allows `http`. Node's client emits `'upgrade'` only when
 * the server answered `101`, which is the whole question.
 *
 * @param port Where to connect
 * @param path What to ask to upgrade
 * @returns Whether the server switched protocols
 */
function handshake(port: number, path: string): Promise<{ switching: boolean }> {
  return new Promise((resolve, reject) => {
    const attempt = httpRequest({
      port,
      path,
      host: '127.0.0.1',
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
        'Sec-WebSocket-Version': '13',
      },
    });

    attempt.setTimeout(5_000, () => {
      attempt.destroy();
      const timedOut = new Error('the handshake timed out');
      reject(timedOut);
    });
    attempt.once('error', reject);

    // Emitted only for a 101 — anything else arrives as an ordinary `response`, which is what a
    // server with no socket attached would send
    attempt.once('upgrade', (_message, socket) => {
      socket.destroy();
      resolve({ switching: true });
    });

    attempt.once('response', () => {
      attempt.destroy();
      resolve({ switching: false });
    });

    attempt.end();
  });
}
