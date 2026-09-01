/**
 * The socket's address is derived, never configured — and the connection that uses it
 * (TICKET-LIVE-01, TICKET-LIVE-02, v3 Req 47.6, 44.7)
 *
 * Two halves, and the second is the one that decays without a check. *The URL is right* is an
 * assertion about a function; *no environment variable or constant names the socket host* is an
 * assertion about the **module**, which stays true only for as long as nobody adds a fallback — so
 * it is asserted against the source text, the way `routeGuards.test.ts` asserts a call-site
 * obligation it cannot express as a type.
 *
 * **Validates: v3 Req 47.6, 44.1**
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { LiveEventMessage } from '#shared/types/liveSocket';
import {
  CLIENT_MESSAGE_TYPE,
  LIVE_SOCKET_PATH,
  SERVER_MESSAGE_TYPE,
} from '#shared/types/liveSocket';
import type { LiveSocketLike } from './liveSocket';
import { liveSocketUrl, openLiveConnection } from './liveSocket';

describe('the URL', () => {
  it('should use ws: on a page served over http:', () => {
    const address = liveSocketUrl({ protocol: 'http:', host: 'localhost:3000' });

    expect(address).toBe(`ws://localhost:3000${LIVE_SOCKET_PATH}`);
  });

  it('should use wss: on a page served over https:', () => {
    // The branch that only exists in production, and the one a test on localhost would never reach
    // by accident: a page over TLS opening a `ws:` socket is mixed content and the browser refuses
    // it, so hard-coding either scheme breaks exactly one deployment and never the developer's
    const address = liveSocketUrl({ protocol: 'https:', host: 'dnd.example.com' });

    expect(address).toBe(`wss://dnd.example.com${LIVE_SOCKET_PATH}`);
  });

  it('should keep the port the page was served from', () => {
    const address = liveSocketUrl({ protocol: 'http:', host: '192.168.1.20:8080' });

    expect(address).toBe(`ws://192.168.1.20:8080${LIVE_SOCKET_PATH}`);
  });

  it('should treat anything that is not https: as plain', () => {
    // A deliberately conservative default: an unrecognised scheme becoming `wss:` would be a
    // connection that silently cannot be made, where `ws:` fails loudly and locally
    const address = liveSocketUrl({ protocol: 'file:', host: 'localhost' });

    expect(address).toBe(`ws://localhost${LIVE_SOCKET_PATH}`);
  });

  it('should be the same address the page itself came from', () => {
    // D1 as an assertion: same host, same port, so the Auth_Session cookie rides the upgrade with
    // nothing added and no CORS layer exists anywhere in this milestone
    const page = { protocol: 'https:', host: 'table.example.org:8443' };
    const address = liveSocketUrl(page);

    expect(address).toContain(page.host);
  });
});

/** A socket that records rather than connecting to anything */
interface FakeSocket extends LiveSocketLike {
  readonly sent: string[];
  readonly closes: number[];
}

/** One, still connecting: nothing sent to it goes anywhere until `onopen` is called */
function fakeSocket(): FakeSocket {
  const sent: string[] = [];
  const closes: number[] = [];

  return {
    sent,
    closes,
    send: (data) => sent.push(data),
    close: () => closes.push(1),
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
  };
}

/** Every frame the connection wrote, parsed */
function framesOf(socket: FakeSocket) {
  return socket.sent.map((frame) => JSON.parse(frame) as { type: string; sessionId: string });
}

/** One Event, as the server sends it */
function eventFrame(sessionId: string, seq: number): string {
  const message: LiveEventMessage = {
    type: SERVER_MESSAGE_TYPE.EVENT,
    sessionId,
    event: {
      id: `event-${seq}`,
      seq,
      type: 'dm-award-experience',
      actorAccountId: 'account-1',
      at: 1_700_000_000_000,
      payload: { characterId: 'character-1' },
    },
  };

  return JSON.stringify(message);
}

/** Open a connection over a fake socket, and hand back both */
function aConnection() {
  const socket = fakeSocket();
  const connection = openLiveConnection({
    url: `ws://host${LIVE_SOCKET_PATH}`,
    open: () => socket,
  });

  return { socket, connection };
}

describe('the connection', () => {
  it('should hold a subscribe until the socket opens, then send it', () => {
    const { socket, connection } = aConnection();

    connection.subscribe('session-1');

    // The handshake is not finished when the sheet mounts, and a `send` on a connecting socket
    // throws — so the first subscribe of every page load is exactly the one that would fail
    expect(socket.sent).toEqual([]);

    socket.onopen?.(null);

    const flushed = framesOf(socket);

    expect(flushed).toEqual([{ type: CLIENT_MESSAGE_TYPE.SUBSCRIBE, sessionId: 'session-1' }]);
  });

  it('should send one subscribe however many callers want the room', () => {
    const { socket, connection } = aConnection();
    socket.onopen?.(null);

    connection.subscribe('session-1');
    connection.subscribe('session-1');

    const sent = framesOf(socket);

    expect(sent).toHaveLength(1);
  });

  it('should keep the room until the last caller lets go', () => {
    const { socket, connection } = aConnection();
    socket.onopen?.(null);

    connection.subscribe('session-1');
    connection.subscribe('session-1');
    connection.unsubscribe('session-1');

    // The character feed and the roll log are both on one sheet: the second unmounting must not
    // take the first one's feed with it
    const whileHeld = framesOf(socket);

    expect(whileHeld).toHaveLength(1);

    connection.unsubscribe('session-1');

    const afterLast = framesOf(socket);

    expect(afterLast).toEqual([
      { type: CLIENT_MESSAGE_TYPE.SUBSCRIBE, sessionId: 'session-1' },
      { type: CLIENT_MESSAGE_TYPE.UNSUBSCRIBE, sessionId: 'session-1' },
    ]);
  });

  it('should say nothing about a room nobody asked for', () => {
    const { socket, connection } = aConnection();
    socket.onopen?.(null);

    connection.unsubscribe('never-joined');

    expect(socket.sent).toEqual([]);
  });

  it('should hand every Event to every listener', () => {
    const { socket, connection } = aConnection();
    const first: LiveEventMessage[] = [];
    const second: LiveEventMessage[] = [];

    connection.addListener((message) => first.push(message));
    connection.addListener((message) => second.push(message));

    const frame = eventFrame('session-1', 3);
    socket.onmessage?.({ data: frame });

    expect(first).toHaveLength(1);
    expect(first[0].event.seq).toBe(3);
    expect(second).toHaveLength(1);
  });

  it('should stop delivering to a listener that has let go', () => {
    const { socket, connection } = aConnection();
    const heard: LiveEventMessage[] = [];

    const stop = connection.addListener((message) => heard.push(message));
    stop();

    const frame = eventFrame('session-1', 1);
    socket.onmessage?.({ data: frame });

    expect(heard).toEqual([]);
  });

  it('should ignore everything that is not an Event', () => {
    const { socket, connection } = aConnection();
    const heard: LiveEventMessage[] = [];

    connection.addListener((message) => heard.push(message));

    const subscribed = JSON.stringify({
      type: SERVER_MESSAGE_TYPE.SUBSCRIBED,
      sessionId: 'session-1',
    });
    const refused = JSON.stringify({
      type: SERVER_MESSAGE_TYPE.SUBSCRIBE_REFUSED,
      sessionId: 'session-2',
    });

    socket.onmessage?.({ data: subscribed });
    socket.onmessage?.({ data: refused });
    socket.onmessage?.({ data: 'not json at all' });
    socket.onmessage?.({ data: 17 });

    expect(heard).toEqual([]);
  });

  it('should close the socket and forget its rooms', () => {
    const { socket, connection } = aConnection();
    socket.onopen?.(null);

    connection.subscribe('session-1');
    connection.close();

    expect(socket.closes).toHaveLength(1);

    // Nothing is resubscribed and nothing retries — a dead connection stays dead until the page is
    // reloaded, which is LIVE-03's to improve on
    connection.subscribe('session-1');

    const afterClose = framesOf(socket);

    expect(afterClose).toHaveLength(1);
  });

  it('should drop what is written to a socket that has gone, rather than queueing it forever', () => {
    const { socket, connection } = aConnection();
    socket.onopen?.(null);

    connection.subscribe('session-1');
    socket.onclose?.(null);

    // Nothing reconnects, so a frame held here would be held for the life of the page — one per
    // sheet the User opens after the connection died. `!isOpen` is also true *before* the
    // handshake, which is why the module tracks *closed* separately: a queue is right in one case
    // and a leak in the other.
    connection.subscribe('session-2');
    connection.unsubscribe('session-1');

    const sent = framesOf(socket);

    expect(sent).toHaveLength(1);

    // …and nothing flushes if the same socket somehow reports `open` again
    socket.onopen?.(null);

    const afterReopen = framesOf(socket);

    expect(afterReopen).toHaveLength(1);
  });
});

describe('the module itself', () => {
  const thisFile = fileURLToPath(import.meta.url);
  const here = dirname(thisFile);
  const modulePath = join(here, 'liveSocket.ts');
  const source = readFileSync(modulePath, 'utf8');

  /** The prose explains what the code must not do, so the prose is not what is being scanned */
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');

  it('should read no environment variable', () => {
    // **Written as patterns rather than as string literals on purpose.** `server/env.test.ts`
    // scans `src/` for the text `process.env` to prove that `env.ts` is its only reader, and a
    // test that spelled the needle out would register there as a second one. Do not "simplify"
    // these back to `toContain`.
    expect(code).not.toMatch(/import\.meta\.env/);
    expect(code).not.toMatch(/process\.env/);
  });

  it('should name no host, and no origin to talk to', () => {
    // `https:` on its own is a *page* scheme this compares against, which is why the pattern asks
    // for the slashes — an origin is what is forbidden, not the word
    expect(code).not.toMatch(/https?:\/\//);
    expect(code).not.toMatch(/localhost|127\.0\.0\.1/);
  });

  it('should take the path from the shared contract rather than spelling it again', () => {
    // Both ends of the socket have to agree on where it is, and two spellings is one drift
    expect(code).toContain('LIVE_SOCKET_PATH');
    expect(code).not.toContain("'/api/live'");
  });
});
