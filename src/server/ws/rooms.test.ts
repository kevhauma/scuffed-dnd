/**
 * The room model, against plain objects (TICKET-LIVE-01, TICKET-LIVE-03)
 *
 * **No socket library appears in this file, and that is the point of the interface it drives.**
 * `rooms.ts` imports `ws` not at all, so isolation, eviction and the map emptying itself are
 * properties assertable against three-method fakes — with no handshake, no port and no timing. The
 * end-to-end proof that a real `ws` connection behaves like one of these fakes is
 * `liveSocketServer.test.ts`'s job, and it is a much smaller claim for having this file underneath
 * it.
 *
 * ## Presence, and the property that needs two connections of one Account to be visible at all
 *
 * TICKET-LIVE-03 made every mutator announce its room's membership, and the rule is that it
 * announces on a change of **Account** rather than of connection. That claim cannot be tested with
 * one connection per person: a fake per Account would pass whether the registry counted people or
 * sockets. The cases below that matter most therefore give one Account **two** connections — two
 * browser tabs — and assert that the room hears nothing at all about the second.
 *
 * **Validates: v3 Req 44.2, 44.3, 44.8, 39.3**
 */

import { describe, expect, it, vi } from 'vitest';
import type { PresenceMessage } from '#shared/types/liveSocket';
import { SERVER_MESSAGE_TYPE, SOCKET_CLOSE_CODE } from '#shared/types/liveSocket';
import { createSocketRooms, type LiveConnection } from './rooms';

/** One close, as a fake records it */
interface RecordedClose {
  code: number;
  reason: string;
}

/** A connection that remembers what it was told instead of speaking to anything */
interface FakeConnection extends LiveConnection {
  readonly sent: string[];
  readonly closes: RecordedClose[];
}

/**
 * A connection belonging to an Account
 *
 * @param accountId Whose it is — the one thing eviction asks about
 * @returns A connection that records rather than transmits
 */
function fakeConnection(accountId: string): FakeConnection {
  const sent: string[] = [];
  const closes: RecordedClose[] = [];

  return {
    accountId,
    sent,
    closes,
    send: (payload) => {
      sent.push(payload);
    },
    close: (code, reason) => {
      closes.push({ code, reason });
    },
  };
}

/** A connection whose socket has already gone — every `send` on it throws */
function deadConnection(accountId: string): FakeConnection {
  const connection = fakeConnection(accountId);

  return {
    ...connection,
    send: () => {
      throw new Error('the socket is not open');
    },
  };
}

/** …and one that cannot even be closed */
function unclosableConnection(accountId: string): FakeConnection {
  const connection = fakeConnection(accountId);

  return {
    ...connection,
    close: () => {
      throw new Error('the socket cannot be closed');
    },
  };
}

const TABLE_ONE = 'session-one';
const TABLE_TWO = 'session-two';

/**
 * What kind of frame this is, or `null` for one of this file's plain-text payloads
 *
 * The broadcast cases send bare strings on purpose — the registry does not care what a payload is —
 * so this has to survive text that is not JSON at all.
 *
 * @param frame What a connection was sent
 * @returns The message type, or `null`
 */
function frameType(frame: string): string | null {
  try {
    const parsed = JSON.parse(frame) as { type?: unknown };
    return typeof parsed.type === 'string' ? parsed.type : null;
  } catch {
    return null;
  }
}

/**
 * Everything a connection was told **except** the registry's own bookkeeping
 *
 * Presence and *room closed* are frames the room sends about itself, and the cases below about
 * broadcast isolation are not about them. Filtered rather than asserted around, so that adding a
 * presence frame somewhere does not silently change what an isolation test is checking.
 *
 * @param connection Whose frames
 * @returns The payloads a caller of `broadcast` put there
 */
function payloadsTo(connection: FakeConnection): string[] {
  return connection.sent.filter((frame) => {
    const type = frameType(frame);

    return type !== SERVER_MESSAGE_TYPE.PRESENCE && type !== SERVER_MESSAGE_TYPE.ROOM_CLOSED;
  });
}

/**
 * Every presence frame a connection heard, as the Accounts each one named
 *
 * @param connection Whose frames
 * @returns One entry per announcement, in the order they arrived
 */
function presenceHeardBy(connection: FakeConnection): string[][] {
  const announcements = connection.sent.filter((frame) => {
    const type = frameType(frame);
    return type === SERVER_MESSAGE_TYPE.PRESENCE;
  });

  return announcements.map((frame) => {
    const message = JSON.parse(frame) as PresenceMessage;
    return message.accountIds;
  });
}

describe('broadcast', () => {
  it('should reach every connection in one room and no connection in another', () => {
    // Criterion 3, in the shape it asks for: two rooms, four connections
    const rooms = createSocketRooms();
    const alice = fakeConnection('account-alice');
    const bob = fakeConnection('account-bob');
    const carol = fakeConnection('account-carol');
    const dan = fakeConnection('account-dan');

    rooms.join(TABLE_ONE, alice);
    rooms.join(TABLE_ONE, bob);
    rooms.join(TABLE_TWO, carol);
    rooms.join(TABLE_TWO, dan);

    rooms.broadcast(TABLE_ONE, 'a thing happened at table one');

    const aliceHeard = payloadsTo(alice);
    const bobHeard = payloadsTo(bob);
    const carolHeard = payloadsTo(carol);
    const danHeard = payloadsTo(dan);

    expect(aliceHeard).toEqual(['a thing happened at table one']);
    expect(bobHeard).toEqual(['a thing happened at table one']);
    expect(carolHeard).toEqual([]);
    expect(danHeard).toEqual([]);
  });

  it('should say nothing to a room nobody has joined', () => {
    const rooms = createSocketRooms();
    const alice = fakeConnection('account-alice');

    rooms.join(TABLE_ONE, alice);
    rooms.broadcast('a session that has no listeners', 'hello?');

    const heard = payloadsTo(alice);

    expect(heard).toEqual([]);
  });

  it('should reach the rest of a room when one connection has already died', () => {
    // Without `deliver`'s guard the throw escapes mid-iteration and the connections after it in the
    // Set never hear anything — which would make "reaches every connection in it" false for a
    // reason no test that only used healthy fakes could ever see
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const rooms = createSocketRooms();
    const dead = deadConnection('account-dead');
    const alive = fakeConnection('account-alive');

    rooms.join(TABLE_ONE, dead);
    rooms.join(TABLE_ONE, alive);

    // Read before the act, because since TICKET-LIVE-03 the *arrangement* provokes complaints of its
    // own: each join announces the room's membership, and announcing to a dead connection fails the
    // same way. Counting the difference keeps this case about the broadcast rather than about how
    // many times a fake was spoken to on the way in.
    const provokedByJoining = warn.mock.calls.length;

    rooms.broadcast(TABLE_ONE, 'still delivered');

    const heard = payloadsTo(alive);
    const complaints = warn.mock.calls.length - provokedByJoining;

    expect(heard).toEqual(['still delivered']);
    expect(complaints).toBe(1);

    warn.mockRestore();
  });
});

describe('joining and leaving', () => {
  it('should not duplicate a connection that joins the same room twice', () => {
    const rooms = createSocketRooms();
    const alice = fakeConnection('account-alice');

    rooms.join(TABLE_ONE, alice);
    rooms.join(TABLE_ONE, alice);
    rooms.broadcast(TABLE_ONE, 'once');

    const heard = payloadsTo(alice);

    expect(heard).toEqual(['once']);
  });

  it('should leave one room without leaving the others', () => {
    const rooms = createSocketRooms();
    const alice = fakeConnection('account-alice');

    rooms.join(TABLE_ONE, alice);
    rooms.join(TABLE_TWO, alice);

    rooms.leave(TABLE_ONE, alice);

    rooms.broadcast(TABLE_ONE, 'table one');
    rooms.broadcast(TABLE_TWO, 'table two');

    const heard = payloadsTo(alice);

    expect(heard).toEqual(['table two']);
  });

  it('should treat leaving a room it is not in as already true', () => {
    const rooms = createSocketRooms();
    const alice = fakeConnection('account-alice');

    const leaving = () => rooms.leave('a session nobody joined', alice);

    expect(leaving).not.toThrow();
  });
});

describe('cleanup', () => {
  it('should hold no rooms once every connection has been forgotten', () => {
    // Criterion 6: a long-running server must not accumulate one empty Set per table ever played
    const rooms = createSocketRooms();
    const alice = fakeConnection('account-alice');
    const bob = fakeConnection('account-bob');

    rooms.join(TABLE_ONE, alice);
    rooms.join(TABLE_ONE, bob);
    rooms.join(TABLE_TWO, alice);

    const whileConnected = rooms.roomCount();
    expect(whileConnected).toBe(2);

    rooms.forget(alice);

    const afterOne = rooms.roomCount();
    expect(afterOne).toBe(1);

    rooms.forget(bob);

    const afterBoth = rooms.roomCount();
    expect(afterBoth).toBe(0);
  });

  it('should drop a room as soon as its last connection leaves', () => {
    const rooms = createSocketRooms();
    const alice = fakeConnection('account-alice');

    rooms.join(TABLE_ONE, alice);
    rooms.leave(TABLE_ONE, alice);

    const remaining = rooms.roomCount();

    expect(remaining).toBe(0);
  });

  it('should close the rest of the process when one connection cannot be closed', () => {
    // `deliver`'s reasoning applied to the other verb. Shutdown is the path where partial
    // completion is worst: an unguarded throw halfway through would leave every remaining socket
    // open with the map already cleared — connections nothing can reach and nothing will close.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const rooms = createSocketRooms();
    const stuck = unclosableConnection('account-stuck');
    const fine = fakeConnection('account-fine');

    rooms.join(TABLE_ONE, stuck);
    rooms.join(TABLE_ONE, fine);

    const shuttingDown = () => rooms.closeAll();

    expect(shuttingDown).not.toThrow();

    const fineClosed = fine.closes.length;
    const remaining = rooms.roomCount();
    const complaints = warn.mock.calls.length;

    expect(fineClosed).toBe(1);
    expect(remaining).toBe(0);
    expect(complaints).toBe(1);

    warn.mockRestore();
  });

  it('should close a connection watching two tables exactly once', () => {
    // The blind spot `evictMember` was corrected for, in the neighbouring method: a flat walk of
    // the rooms closes one socket once per room. A second close is a no-op, so nothing breaks —
    // which is exactly why no test would have noticed while every fake sat in one room.
    const rooms = createSocketRooms();
    const oneSocketTwoTables = fakeConnection('account-alice');

    rooms.join(TABLE_ONE, oneSocketTwoTables);
    rooms.join(TABLE_TWO, oneSocketTwoTables);

    rooms.closeAll();

    const closed = oneSocketTwoTables.closes.length;

    expect(closed).toBe(1);
  });

  it('should close everything and empty itself on shutdown', () => {
    const rooms = createSocketRooms();
    const alice = fakeConnection('account-alice');
    const carol = fakeConnection('account-carol');

    rooms.join(TABLE_ONE, alice);
    rooms.join(TABLE_TWO, carol);

    rooms.closeAll();

    const aliceClosed = alice.closes;
    const carolClosed = carol.closes;
    const remaining = rooms.roomCount();

    expect(aliceClosed).toEqual([
      { code: SOCKET_CLOSE_CODE.SERVER_STOPPING, reason: 'The server is shutting down.' },
    ]);
    expect(carolClosed).toEqual([
      { code: SOCKET_CLOSE_CODE.SERVER_STOPPING, reason: 'The server is shutting down.' },
    ]);
    expect(remaining).toBe(0);
  });
});

describe('presence', () => {
  it('should tell a room who is in it when somebody joins', () => {
    const rooms = createSocketRooms();
    const alice = fakeConnection('account-alice');
    const bob = fakeConnection('account-bob');

    rooms.join(TABLE_ONE, alice);
    rooms.join(TABLE_ONE, bob);

    // Alice hears her own arrival and then Bob's; Bob hears the room he joined, himself included —
    // which is why the announcement happens *after* the join rather than before it
    const aliceHeard = presenceHeardBy(alice);
    const bobHeard = presenceHeardBy(bob);

    expect(aliceHeard).toEqual([['account-alice'], ['account-alice', 'account-bob']]);
    expect(bobHeard).toEqual([['account-alice', 'account-bob']]);
  });

  it('should say nothing at all about a second tab of the same Account', () => {
    // **The property that needs two connections of one person to be visible.** A registry counting
    // sockets would announce here — twice — and every other case in this file would still pass.
    const rooms = createSocketRooms();
    const watching = fakeConnection('account-alice');
    const firstTab = fakeConnection('account-bob');
    const secondTab = fakeConnection('account-bob');

    rooms.join(TABLE_ONE, watching);
    rooms.join(TABLE_ONE, firstTab);

    const beforeTheSecondTab = presenceHeardBy(watching);

    rooms.join(TABLE_ONE, secondTab);

    const afterTheSecondTab = presenceHeardBy(watching);

    expect(afterTheSecondTab).toEqual(beforeTheSecondTab);
  });

  it('should say nothing when that second tab closes either', () => {
    // The other half, and the one a person actually notices: closing one of two windows must not
    // make everybody else's lobby say you have left the table you are still sitting at.
    const rooms = createSocketRooms();
    const watching = fakeConnection('account-alice');
    const firstTab = fakeConnection('account-bob');
    const secondTab = fakeConnection('account-bob');

    rooms.join(TABLE_ONE, watching);
    rooms.join(TABLE_ONE, firstTab);
    rooms.join(TABLE_ONE, secondTab);

    const beforeTheTabClosed = presenceHeardBy(watching);

    rooms.leave(TABLE_ONE, secondTab);

    const afterTheTabClosed = presenceHeardBy(watching);

    expect(afterTheTabClosed).toEqual(beforeTheTabClosed);

    // …and when the *last* of their tabs goes, the departure is announced exactly once
    rooms.leave(TABLE_ONE, firstTab);

    const afterTheyLeft = presenceHeardBy(watching);
    const announcements = afterTheyLeft.length - beforeTheTabClosed.length;
    const latest = afterTheyLeft[afterTheyLeft.length - 1];

    expect(announcements).toBe(1);
    expect(latest).toEqual(['account-alice']);
  });

  it('should tell each room a dropped connection was in, and only those', () => {
    // What a `close` handler does: one socket, several tables, and every one of them hears about it
    const rooms = createSocketRooms();
    const leaving = fakeConnection('account-alice');
    const atTableOne = fakeConnection('account-bob');
    const atTableTwo = fakeConnection('account-carol');
    const elsewhere = fakeConnection('account-dan');

    rooms.join(TABLE_ONE, leaving);
    rooms.join(TABLE_ONE, atTableOne);
    rooms.join(TABLE_TWO, leaving);
    rooms.join(TABLE_TWO, atTableTwo);
    rooms.join('a third table', elsewhere);

    const elsewhereBefore = presenceHeardBy(elsewhere);

    rooms.forget(leaving);

    const oneHeard = presenceHeardBy(atTableOne);
    const twoHeard = presenceHeardBy(atTableTwo);
    const elsewhereAfter = presenceHeardBy(elsewhere);

    const lastAtOne = oneHeard[oneHeard.length - 1];
    const lastAtTwo = twoHeard[twoHeard.length - 1];

    expect(lastAtOne).toEqual(['account-bob']);
    expect(lastAtTwo).toEqual(['account-carol']);
    expect(elsewhereAfter).toEqual(elsewhereBefore);
  });

  it('should name only the Accounts in that room', () => {
    const rooms = createSocketRooms();
    const alice = fakeConnection('account-alice');
    const bob = fakeConnection('account-bob');

    rooms.join(TABLE_ONE, alice);
    rooms.join(TABLE_TWO, bob);

    const aliceHeard = presenceHeardBy(alice);

    // Isolation is the same claim `broadcast` makes, and presence is the frame most likely to break
    // it: it is the only one built from the registry's own state rather than handed in
    expect(aliceHeard).toEqual([['account-alice']]);
  });

  it('should announce nothing on shutdown', () => {
    // Presence says who is at a table. *Everybody is going* is what the close frame already tells
    // each of them, and a final announcement would be a room describing itself to nobody.
    const rooms = createSocketRooms();
    const alice = fakeConnection('account-alice');
    const bob = fakeConnection('account-bob');

    rooms.join(TABLE_ONE, alice);
    rooms.join(TABLE_ONE, bob);

    const beforeShutdown = presenceHeardBy(alice);

    rooms.closeAll();

    const afterShutdown = presenceHeardBy(alice);

    expect(afterShutdown).toEqual(beforeShutdown);
  });
});

describe('eviction', () => {
  it('should close the removed Member’s connections for that room', () => {
    // Criterion 5, at the registry. The route half is `routes/sessions/membership.test.ts`.
    const rooms = createSocketRooms();
    const departing = fakeConnection('account-departing');
    const staying = fakeConnection('account-staying');

    rooms.join(TABLE_ONE, departing);
    rooms.join(TABLE_ONE, staying);

    rooms.evictMember(TABLE_ONE, 'account-departing');

    const departingClosed = departing.closes;
    const stayingClosed = staying.closes;

    expect(departingClosed).toEqual([
      {
        code: SOCKET_CLOSE_CODE.MEMBERSHIP_ENDED,
        reason: 'You are no longer a member of that game.',
      },
    ]);
    expect(stayingClosed).toEqual([]);
  });

  it('should leave a second connection of the same Account alone', () => {
    // Two *sockets* belonging to one Account — two browser tabs — and only the one in the room
    // that lost the seat is closed
    const rooms = createSocketRooms();
    const atTableOne = fakeConnection('account-alice');
    const atTableTwo = fakeConnection('account-alice');

    rooms.join(TABLE_ONE, atTableOne);
    rooms.join(TABLE_TWO, atTableTwo);

    rooms.evictMember(TABLE_ONE, 'account-alice');

    const oneClosed = atTableOne.closes.length;
    const twoClosed = atTableTwo.closes;
    const remaining = rooms.roomCount();

    expect(oneClosed).toBe(1);
    expect(twoClosed).toEqual([]);
    expect(remaining).toBe(1);
  });

  it('should not close one connection that is watching two tables', () => {
    // **The case that actually occurs, and the one two separate fakes hid.** A browser holds *one*
    // socket across every table it is watching, so closing outright on eviction would take the live
    // feed for table two away because a seat at table one was removed. The criterion is *closes
    // their open connections **for that room***, and it is `subscription.ts`'s own rule: a
    // room-level fact is a message, not a close.
    const rooms = createSocketRooms();
    const oneSocketTwoTables = fakeConnection('account-alice');

    rooms.join(TABLE_ONE, oneSocketTwoTables);
    rooms.join(TABLE_TWO, oneSocketTwoTables);

    rooms.evictMember(TABLE_ONE, 'account-alice');

    const closed = oneSocketTwoTables.closes;
    const remaining = rooms.roomCount();

    expect(closed).toEqual([]);
    expect(remaining).toBe(1);

    // …and it is genuinely out of the room it lost, while still hearing the one it kept
    rooms.broadcast(TABLE_ONE, 'the table they left');
    rooms.broadcast(TABLE_TWO, 'the table they kept');

    const heard = payloadsTo(oneSocketTwoTables);

    expect(heard).toEqual(['the table they kept']);
  });

  it('should close that same connection once its last room is taken too', () => {
    // The other half of the rule: leaving is not a licence to stay connected forever
    const rooms = createSocketRooms();
    const oneSocketTwoTables = fakeConnection('account-alice');

    rooms.join(TABLE_ONE, oneSocketTwoTables);
    rooms.join(TABLE_TWO, oneSocketTwoTables);

    rooms.evictMember(TABLE_ONE, 'account-alice');
    rooms.evictMember(TABLE_TWO, 'account-alice');

    const closed = oneSocketTwoTables.closes;
    const remaining = rooms.roomCount();

    expect(closed).toEqual([
      {
        code: SOCKET_CLOSE_CODE.MEMBERSHIP_ENDED,
        reason: 'You are no longer a member of that game.',
      },
    ]);
    expect(remaining).toBe(0);
  });

  it('should take the evicted connections out of the room', () => {
    const rooms = createSocketRooms();
    const departing = fakeConnection('account-departing');

    rooms.join(TABLE_ONE, departing);
    rooms.evictMember(TABLE_ONE, 'account-departing');
    rooms.broadcast(TABLE_ONE, 'you should not hear this');

    const heard = payloadsTo(departing);
    const remaining = rooms.roomCount();

    expect(heard).toEqual([]);
    expect(remaining).toBe(0);
  });

  it('should evict the rest of a room when one connection cannot be closed', () => {
    // `shut`'s guard on the eviction path. It was only ever driven through `closeAll`, which left
    // the branch that matters for a *removal* — several of one Account's sockets, one of them
    // already dead — resting on the other path's coverage.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const rooms = createSocketRooms();
    const stuck = unclosableConnection('account-departing');
    const alsoTheirs = fakeConnection('account-departing');

    rooms.join(TABLE_ONE, stuck);
    rooms.join(TABLE_ONE, alsoTheirs);

    const evicting = () => rooms.evictMember(TABLE_ONE, 'account-departing');

    expect(evicting).not.toThrow();

    const otherClosed = alsoTheirs.closes.length;
    const remaining = rooms.roomCount();
    const complaints = warn.mock.calls.length;

    expect(otherClosed).toBe(1);
    expect(remaining).toBe(0);
    expect(complaints).toBe(1);

    warn.mockRestore();
  });

  it('should tell the evicted connection which room it lost (TICKET-LIVE-03)', () => {
    // **The one case where the server *knows* a surface has gone stale**, and until this ticket the
    // one case it said nothing about. This connection is watching two tables, so it survives the
    // eviction — and without a message it would go on drawing the lost table as live (v3 Req 44.8).
    const rooms = createSocketRooms();
    const oneSocketTwoTables = fakeConnection('account-alice');
    const staying = fakeConnection('account-bob');

    rooms.join(TABLE_ONE, oneSocketTwoTables);
    rooms.join(TABLE_ONE, staying);
    rooms.join(TABLE_TWO, oneSocketTwoTables);

    rooms.evictMember(TABLE_ONE, 'account-alice');

    const told = oneSocketTwoTables.sent.map(frameType);
    const closedFrames = told.filter((type) => type === SERVER_MESSAGE_TYPE.ROOM_CLOSED);
    const stillOpen = oneSocketTwoTables.closes;

    expect(closedFrames).toHaveLength(1);
    expect(stillOpen).toEqual([]);

    // …and the room they left hears that they are gone, in the same act
    const stayingHeard = presenceHeardBy(staying);
    const latest = stayingHeard[stayingHeard.length - 1];

    expect(latest).toEqual(['account-bob']);
  });

  it('should do nothing for an Account with no connections to that room', () => {
    const rooms = createSocketRooms();
    const alice = fakeConnection('account-alice');

    rooms.join(TABLE_ONE, alice);
    rooms.evictMember(TABLE_ONE, 'account-nobody');

    const closed = alice.closes;
    const remaining = rooms.roomCount();

    expect(closed).toEqual([]);
    expect(remaining).toBe(1);
  });
});
