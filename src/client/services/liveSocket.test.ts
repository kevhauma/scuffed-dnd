/**
 * The socket's address is derived, never configured — and the connection that uses it
 * (TICKET-LIVE-01, TICKET-LIVE-02, TICKET-LIVE-03, v3 Req 47.6, 44.7)
 *
 * Two halves, and the second is the one that decays without a check. *The URL is right* is an
 * assertion about a function; *no environment variable or constant names the socket host* is an
 * assertion about the **module**, which stays true only for as long as nobody adds a fallback — so
 * it is asserted against the source text, the way `routeGuards.test.ts` asserts a call-site
 * obligation it cannot express as a type.
 *
 * ## The reconnect, driven by a fake clock and a fake random
 *
 * TICKET-LIVE-03's cases are about **when** and **how many**, so both sources of nondeterminism are
 * taken away: `vi.useFakeTimers` for the delay, and an injected `random` for the jitter. That is what
 * lets *fifty clients do not come back together* be an assertion about fifty exact numbers rather
 * than about a distribution, and it is why the connection takes a `random` at all.
 *
 * Every reconnect case mints a **new** fake socket per attempt, because a connection that came back
 * on the very object it had just lost would pass whether or not the module ever reconnected.
 *
 * **Validates: v3 Req 47.6, 44.1, 44.6, 44.8**
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  LiveEventMessage,
  PresenceMessage,
  SubscribedMessage,
} from '#shared/types/liveSocket';
import {
  CLIENT_MESSAGE_TYPE,
  LIVE_SOCKET_PATH,
  SERVER_MESSAGE_TYPE,
  SOCKET_CLOSE_CODE,
} from '#shared/types/liveSocket';
import type { LiveSocketLike } from './liveSocket';
import { LIVE_STATUS, liveSocketUrl, openLiveConnection } from './liveSocket';

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

/** One presence announcement, as the server sends it */
function presenceFrame(sessionId: string, accountIds: string[]): string {
  const message: PresenceMessage = {
    type: SERVER_MESSAGE_TYPE.PRESENCE,
    sessionId,
    accountIds,
  };

  return JSON.stringify(message);
}

/**
 * Open a connection that mints a **new** socket every time it connects
 *
 * The reconnect cases need this: a connection that came back on the very object it had just lost
 * would prove nothing about reconnecting, and would quietly pass even if the module never called its
 * factory again.
 *
 * @param random Where the jitter comes from; a constant makes the delay exact
 * @returns Every socket it has opened, newest last, and the connection
 */
function aReconnectingConnection(random: () => number = () => 0) {
  const sockets: FakeSocket[] = [];

  const connection = openLiveConnection({
    url: `ws://host${LIVE_SOCKET_PATH}`,
    open: () => {
      const socket = fakeSocket();
      sockets.push(socket);
      return socket;
    },
    random,
  });

  return { sockets, connection };
}

/** Open a connection over a fake socket, and hand back both */
function aConnection() {
  const { sockets, connection } = aReconnectingConnection();
  const socket = sockets[0];

  return { socket, connection };
}

/** The newest socket a connection has opened */
function latestSocket(sockets: FakeSocket[]): FakeSocket {
  return sockets[sockets.length - 1];
}

/** *You are in that room*, carrying where the log stands */
function acknowledge(socket: FakeSocket, sessionId: string, seq: number): void {
  const message: SubscribedMessage = {
    type: SERVER_MESSAGE_TYPE.SUBSCRIBED,
    sessionId,
    seq,
  };
  const frame = JSON.stringify(message);

  socket.onmessage?.({ data: frame });
}

/**
 * A connection that is open, in a room the server has confirmed
 *
 * @param sessionId Which table
 * @param head Where its log stands — `0` by default, a table nothing has happened at
 */
function aLiveRoom(sessionId: string, head = 0) {
  const { sockets, connection } = aReconnectingConnection();
  const socket = sockets[0];

  socket.onopen?.(null);
  connection.subscribe(sessionId);
  acknowledge(socket, sessionId, head);

  return { sockets, socket, connection };
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
    const { socket, connection } = aLiveRoom('session-1');
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
    const { socket, connection } = aLiveRoom('session-1');
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

    // A connection the page has closed is finished: it holds no rooms, sends nothing, and — since
    // TICKET-LIVE-03 — does not come back either. That last part is the whole reason `close()` is
    // distinguishable from a drop.
    connection.subscribe('session-1');

    const afterClose = framesOf(socket);

    expect(afterClose).toHaveLength(1);
  });

  it('should say nothing about a room it does not hold', () => {
    const { socket, connection } = aConnection();
    const heard: LiveEventMessage[] = [];

    socket.onopen?.(null);
    connection.addListener((message) => heard.push(message));

    // The server sends Events only to rooms a connection is in, so this is a frame that should not
    // arrive — and if it ever does, there is no surface here that asked for it and no `seq` this
    // connection has any business recording
    const frame = eventFrame('a table nobody here is watching', 4);
    socket.onmessage?.({ data: frame });

    expect(heard).toEqual([]);
  });
});

describe('reconnecting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should wait before opening another socket, rather than trying at once', () => {
    const { sockets } = aReconnectingConnection();
    const socket = sockets[0];

    socket.onopen?.(null);
    socket.onclose?.(null);

    // Immediately is the stampede. With the jitter pinned at its floor the wait is half the base
    // ceiling — see `liveBackoff.ts`, where the band is the property rather than the number.
    expect(sockets).toHaveLength(1);

    vi.advanceTimersByTime(499);
    expect(sockets).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);
  });

  it('should use the jitter it is given rather than a fixed delay', () => {
    // The same drop, with the random source at the other end of its range: the ceiling rather than
    // the floor. Two clients dropped together therefore do not come back together.
    const { sockets } = aReconnectingConnection(() => 1);
    const socket = sockets[0];

    socket.onopen?.(null);
    socket.onclose?.(null);

    vi.advanceTimersByTime(999);
    expect(sockets).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);
  });

  it('should not come back after the page closed it', () => {
    const { sockets, connection } = aReconnectingConnection();
    const socket = sockets[0];

    socket.onopen?.(null);
    connection.close();
    socket.onclose?.(null);

    vi.advanceTimersByTime(60_000);

    expect(sockets).toHaveLength(1);
  });

  it('should not come back after the server refused an anonymous caller', () => {
    // Signing out must not become a retry loop against a server that is correctly refusing. `4401`
    // is the one close code this client treats as final.
    const { sockets } = aReconnectingConnection();
    const socket = sockets[0];

    socket.onclose?.({ code: SOCKET_CLOSE_CODE.UNAUTHENTICATED });

    vi.advanceTimersByTime(60_000);

    expect(sockets).toHaveLength(1);
  });

  it('should come back after the server shut down, which is not a refusal', () => {
    const { sockets } = aReconnectingConnection();
    const socket = sockets[0];

    socket.onopen?.(null);
    socket.onclose?.({ code: SOCKET_CLOSE_CODE.SERVER_STOPPING });

    vi.advanceTimersByTime(1_000);

    expect(sockets).toHaveLength(2);
  });

  it('should grow the wait for a server that keeps refusing', () => {
    const { sockets } = aReconnectingConnection();
    const first = sockets[0];

    // Never opened: an attempt that fails during the handshake is still an attempt
    first.onclose?.(null);
    vi.advanceTimersByTime(500);
    expect(sockets).toHaveLength(2);

    const second = latestSocket(sockets);
    second.onclose?.(null);

    // Doubled, so fifty clients against a server that is still starting are asking half as often
    // each time round rather than hammering it at a fixed rate
    vi.advanceTimersByTime(999);
    expect(sockets).toHaveLength(2);

    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(3);
  });

  it('should start over only after a connection that lasted', () => {
    // **The shutting-down server.** A process going away accepts a socket and closes it a moment
    // later; a client that reset its counter on every `open` would sit at the base delay forever and
    // fifty of them would do it in step. The reset is earned by staying up, not by connecting.
    const { sockets } = aReconnectingConnection();
    const first = sockets[0];

    first.onopen?.(null);
    first.onclose?.(null);
    vi.advanceTimersByTime(500);

    const second = latestSocket(sockets);

    second.onopen?.(null);

    // Accepted and dropped again inside the stability window
    vi.advanceTimersByTime(100);
    second.onclose?.(null);

    vi.advanceTimersByTime(999);
    expect(sockets).toHaveLength(2);

    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(3);

    const third = latestSocket(sockets);

    // …and this one stays up long enough to count, so the next drop starts from the base again
    third.onopen?.(null);
    vi.advanceTimersByTime(5_000);
    third.onclose?.(null);

    vi.advanceTimersByTime(500);
    expect(sockets).toHaveLength(4);
  });

  it('should spread fifty clients rather than bringing them all back at once', () => {
    // Criterion 3 in the shape it asks for: a server restart drops every connected browser in the
    // same instant. Each gets its own point in the jitter range, so what comes back is a spread
    // rather than a wall.
    const population = 50;
    const clients = Array.from({ length: population }, (_unused, index) => {
      const random = () => index / population;
      return aReconnectingConnection(random);
    });

    for (const client of clients) {
      const socket = client.sockets[0];
      socket.onopen?.(null);
      socket.onclose?.(null);
    }

    /** How many have opened a second socket by now */
    const returned = () => clients.filter(({ sockets }) => sockets.length > 1).length;

    vi.advanceTimersByTime(499);
    const beforeTheFloor = returned();

    vi.advanceTimersByTime(1);
    const atTheFloor = returned();

    vi.advanceTimersByTime(250);
    const midway = returned();

    vi.advanceTimersByTime(250);
    const atTheCeiling = returned();

    expect(beforeTheFloor).toBe(0);
    // One client draws the floor exactly; the other forty-nine are still waiting, which is the whole
    // property — a fixed delay would put all fifty here
    expect(atTheFloor).toBe(1);
    expect(midway).toBe(26);
    expect(atTheCeiling).toBe(population);
  });

  it('should ask for every room it still holds, saying where it got to', () => {
    const { sockets, connection } = aReconnectingConnection();
    const first = sockets[0];

    first.onopen?.(null);
    connection.subscribe('session-1');
    connection.subscribe('session-2');

    // Each acknowledgement carries where that table's log stood when this connection joined it
    acknowledge(first, 'session-1', 4);
    acknowledge(first, 'session-2', 12);

    const seen = eventFrame('session-1', 7);
    first.onmessage?.({ data: seen });

    first.onclose?.(null);
    vi.advanceTimersByTime(500);

    const second = latestSocket(sockets);
    second.onopen?.(null);

    const asked = framesOf(second);

    // The room something happened in resumes from that Event; the quiet one resumes from where its
    // log stood when this connection was admitted, which is a real answer rather than silence
    expect(asked).toEqual([
      { type: CLIENT_MESSAGE_TYPE.SUBSCRIBE, sessionId: 'session-1', afterSeq: 7 },
      { type: CLIENT_MESSAGE_TYPE.SUBSCRIBE, sessionId: 'session-2', afterSeq: 12 },
    ]);
  });

  it('should resume a quiet table from zero rather than asking for nothing', () => {
    // **The gap LIVE-03's review found, as its own case.** A Player opens a sheet at a table nothing
    // has happened at, the wifi blips, and the DM takes 7 HP off them while it is down. Keyed on
    // *the last `seq` I saw*, this client had no resume point, so it asked for nothing, was told only
    // *you are in that room*, and nothing ever refetched — the sheet stayed wrong with no correction
    // pending. `afterSeq: 0` is what makes the server replay the adjustment.
    const { sockets, connection } = aReconnectingConnection();
    const first = sockets[0];

    first.onopen?.(null);
    connection.subscribe('session-1');
    acknowledge(first, 'session-1', 0);

    first.onclose?.(null);
    vi.advanceTimersByTime(500);

    const second = latestSocket(sockets);
    second.onopen?.(null);

    const asked = framesOf(second);

    expect(asked).toEqual([
      { type: CLIENT_MESSAGE_TYPE.SUBSCRIBE, sessionId: 'session-1', afterSeq: 0 },
    ]);
  });

  it('should ask a room it was never admitted to with no resume point at all', () => {
    // The other side of the same rule, and why `resumeFrom` is nullable rather than a number: a room
    // that has never been acknowledged is a **first** subscribe however many sockets have come and
    // gone, and its surface read over HTTP a moment ago. `afterSeq: 0` here would replay a busy
    // table's whole window into a sheet that is already current.
    const { sockets, connection } = aReconnectingConnection();
    const first = sockets[0];

    first.onopen?.(null);
    connection.subscribe('session-1');

    first.onclose?.(null);
    vi.advanceTimersByTime(500);

    const second = latestSocket(sockets);
    second.onopen?.(null);

    const asked = framesOf(second);

    expect(asked).toEqual([{ type: CLIENT_MESSAGE_TYPE.SUBSCRIBE, sessionId: 'session-1' }]);
  });

  it('should not adopt the head over a resume point it already has', () => {
    // The acknowledgement arrives **before** the replay it precedes, so a client that took the head
    // every time would set its resume point past the very Events about to arrive and drop all of
    // them — a catch-up delivered and discarded in the same turn.
    const { sockets, connection } = aReconnectingConnection();
    const first = sockets[0];
    const heard: LiveEventMessage[] = [];

    first.onopen?.(null);
    connection.subscribe('session-1');
    acknowledge(first, 'session-1', 2);
    connection.addListener((message) => heard.push(message));

    first.onclose?.(null);
    vi.advanceTimersByTime(500);

    const second = latestSocket(sockets);
    second.onopen?.(null);

    // The server acknowledges at the new head, then replays what was missed
    acknowledge(second, 'session-1', 5);

    const missed = [3, 4, 5];
    for (const seq of missed) {
      const frame = eventFrame('session-1', seq);
      second.onmessage?.({ data: frame });
    }

    const applied = heard.map((message) => message.event.seq);

    expect(applied).toEqual(missed);
  });

  it('should not ask again for a room the server took away', () => {
    // An evicted browser left open would otherwise re-provoke the server's refusal once per backoff
    // for as long as it stayed on the page — and would meanwhile read *reconnecting* about a feed
    // that is never coming back. Regaining a seat means reloading, which is what the notice says.
    const { sockets, connection } = aReconnectingConnection();
    const first = sockets[0];

    first.onopen?.(null);
    connection.subscribe('session-1');
    acknowledge(first, 'session-1', 3);

    const taken = JSON.stringify({
      type: SERVER_MESSAGE_TYPE.ROOM_CLOSED,
      sessionId: 'session-1',
    });
    first.onmessage?.({ data: taken });

    first.onclose?.(null);
    vi.advanceTimersByTime(500);

    const second = latestSocket(sockets);
    second.onopen?.(null);

    const asked = framesOf(second);
    const view = connection.roomView('session-1');

    expect(asked).toEqual([]);
    expect(view.status).toBe(LIVE_STATUS.LOST);
  });

  it('should not ask for a room whose last caller let go while it was down', () => {
    // The reason there is no frame queue any more: the rooms map already says what this connection
    // wants, so a room given up while offline needs no unsubscribe — the new socket was never
    // subscribed to it
    const { sockets, connection } = aReconnectingConnection();
    const first = sockets[0];

    first.onopen?.(null);
    connection.subscribe('session-1');
    first.onclose?.(null);

    connection.unsubscribe('session-1');

    vi.advanceTimersByTime(500);

    const second = latestSocket(sockets);
    second.onopen?.(null);

    const asked = framesOf(second);

    expect(asked).toEqual([]);
  });
});

describe('what a surface may say about a room', () => {
  it('should be connecting until the server confirms the room', () => {
    const { socket, connection } = aConnection();

    const beforeTheHandshake = connection.roomView('session-1');
    expect(beforeTheHandshake.status).toBe(LIVE_STATUS.CONNECTING);

    socket.onopen?.(null);
    connection.subscribe('session-1');

    // Open is not the same as *this room is mine*: the server answers each subscribe, and until it
    // does there is nothing to promise a reader about this table
    const beforeTheAck = connection.roomView('session-1');
    expect(beforeTheAck.status).toBe(LIVE_STATUS.CONNECTING);
  });

  it('should be live once the room is confirmed, and name who is there', () => {
    const { socket, connection } = aLiveRoom('session-1');

    const afterAck = connection.roomView('session-1');
    expect(afterAck.status).toBe(LIVE_STATUS.LIVE);

    const presence = presenceFrame('session-1', ['account-ada', 'account-dm']);
    socket.onmessage?.({ data: presence });

    const withPresence = connection.roomView('session-1');

    expect(withPresence.presentAccountIds).toEqual(['account-ada', 'account-dm']);
  });

  it('should forget who was there the moment the socket goes', () => {
    // **The ticket's discipline at the source.** Presence read off a socket that is down is a
    // confident answer about people nobody can currently see, which is the badge saying *Away* about
    // somebody sitting right there.
    const { socket, connection } = aLiveRoom('session-1');

    const presence = presenceFrame('session-1', ['account-ada']);
    socket.onmessage?.({ data: presence });

    socket.onclose?.(null);

    const afterTheDrop = connection.roomView('session-1');

    expect(afterTheDrop.status).toBe(LIVE_STATUS.RECONNECTING);
    expect(afterTheDrop.presentAccountIds).toEqual([]);
  });

  it('should be offline once the page has closed the connection', () => {
    const { connection } = aLiveRoom('session-1');

    connection.close();

    const afterClose = connection.roomView('session-1');

    expect(afterClose.status).toBe(LIVE_STATUS.OFFLINE);
  });

  it('should be lost when the server refuses the room', () => {
    const { socket, connection } = aConnection();

    socket.onopen?.(null);
    connection.subscribe('session-1');

    const refused = JSON.stringify({
      type: SERVER_MESSAGE_TYPE.SUBSCRIBE_REFUSED,
      sessionId: 'session-1',
    });
    socket.onmessage?.({ data: refused });

    const view = connection.roomView('session-1');

    expect(view.status).toBe(LIVE_STATUS.LOST);
  });

  it('should be lost when the server takes the room away', () => {
    // TICKET-GAM-04's eviction, finally audible: this connection is still open and still watching
    // other tables, and without the message this room would go quiet while looking live
    const { socket, connection } = aLiveRoom('session-1');

    const taken = JSON.stringify({
      type: SERVER_MESSAGE_TYPE.ROOM_CLOSED,
      sessionId: 'session-1',
    });
    socket.onmessage?.({ data: taken });

    const view = connection.roomView('session-1');

    expect(view.status).toBe(LIVE_STATUS.LOST);
    expect(view.presentAccountIds).toEqual([]);
  });

  it('should stop saying *connecting* once a first attempt has failed', () => {
    vi.useFakeTimers();

    // Otherwise a page loaded against a server whose socket never answers would sit at *connecting*
    // for as long as it stayed open — and the notice, which says nothing while connecting because
    // nothing is stale on a first load, would never speak
    const { sockets, connection } = aReconnectingConnection();
    const first = sockets[0];

    connection.subscribe('session-1');
    first.onclose?.(null);

    const view = connection.roomView('session-1');

    expect(view.status).toBe(LIVE_STATUS.RECONNECTING);

    vi.useRealTimers();
  });

  it('should tell a watcher that something changed', () => {
    const { socket, connection } = aConnection();
    let changes = 0;

    const stop = connection.addViewListener(() => {
      changes += 1;
    });

    socket.onopen?.(null);
    connection.subscribe('session-1');

    const presence = presenceFrame('session-1', ['account-ada']);
    socket.onmessage?.({ data: presence });

    expect(changes).toBeGreaterThan(0);

    const heardSoFar = changes;
    stop();

    const again = presenceFrame('session-1', []);
    socket.onmessage?.({ data: again });

    expect(changes).toBe(heardSoFar);
  });
});

describe('replay', () => {
  it('should ignore an Event it has already applied', () => {
    // What makes a resumed subscribe safe: the replay and the live feed may overlap at the edges,
    // and an Event applied twice is an Event whose `after` is written twice. Harmless for the five
    // stored fields, and still not something a listener should be told about.
    const { socket, connection } = aLiveRoom('session-1');
    const heard: LiveEventMessage[] = [];

    connection.addListener((message) => heard.push(message));

    const third = eventFrame('session-1', 3);
    socket.onmessage?.({ data: third });
    socket.onmessage?.({ data: third });

    const second = eventFrame('session-1', 2);
    socket.onmessage?.({ data: second });

    const fourth = eventFrame('session-1', 4);
    socket.onmessage?.({ data: fourth });

    const sequence = heard.map((message) => message.event.seq);

    // 3 once, 2 never — it is behind what this connection has already seen — and 4 through, because
    // suppression is *not greater than* rather than *not equal to*
    expect(sequence).toEqual([3, 4]);
  });

  it('should take the resynchronise instruction as a place to resume from', () => {
    vi.useFakeTimers();

    const { sockets, connection } = aReconnectingConnection();
    const first = sockets[0];

    first.onopen?.(null);
    connection.subscribe('session-1');

    const seen = eventFrame('session-1', 2);
    first.onmessage?.({ data: seen });

    // Too far behind to replay: the server names the head of the log instead of sending it
    const resync = JSON.stringify({
      type: SERVER_MESSAGE_TYPE.RESYNC,
      sessionId: 'session-1',
      seq: 900,
    });
    first.onmessage?.({ data: resync });

    const view = connection.roomView('session-1');

    expect(view.resyncAt).not.toBeNull();

    first.onclose?.(null);
    vi.advanceTimersByTime(500);

    const second = latestSocket(sockets);
    second.onopen?.(null);

    const asked = framesOf(second);

    // Resumes from where the server said, not from the last Event this browser happened to see —
    // asking from 2 again would be asking for the gap it was just told to skip
    expect(asked).toEqual([
      { type: CLIENT_MESSAGE_TYPE.SUBSCRIBE, sessionId: 'session-1', afterSeq: 900 },
    ]);

    vi.useRealTimers();
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

  it('should be reachable from no store and no persistence service (v3 Req 44.9)', () => {
    // **The structural half of *the application stays correct with the socket disconnected*.** Every
    // action a Player or a DM performs goes store → `characterSync` → `api`, and none of those may so
    // much as know this module exists — the day one of them consults the connection before writing,
    // a dropped socket stops being a loss of liveness and starts being a loss of function.
    //
    // An equality rather than an allow-list, the shape `eventFanOut.test.ts` uses: this is *every*
    // module under `stores/` and `services/` that names the socket, and it is the socket itself.
    const clientRoot = dirname(here);
    const roots = [join(clientRoot, 'stores'), here];

    // The **connection**, not the contract: `#shared/types/liveSocket` is a shape, and a store that
    // applies a `LiveEvent` is doing exactly what TICKET-LIVE-02 asked of it. What must not appear is
    // a reach for the socket itself.
    const markers = ['services/liveSocket', 'liveConnection('];

    const naming = roots.flatMap((root) => {
      const modules = readdirSync(root);

      return modules
        .filter((entry) => entry.endsWith('.ts') && !entry.endsWith('.test.ts'))
        .filter((entry) => {
          const path = join(root, entry);
          const text = readFileSync(path, 'utf8');

          return markers.some((marker) => text.includes(marker));
        });
    });

    expect(naming).toEqual(['liveSocket.ts']);
  });
});
