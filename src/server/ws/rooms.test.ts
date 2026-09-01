/**
 * The room model, against plain objects (TICKET-LIVE-01)
 *
 * **No socket library appears in this file, and that is the point of the interface it drives.**
 * `rooms.ts` imports `ws` not at all, so isolation, eviction and the map emptying itself are
 * properties assertable against three-method fakes — with no handshake, no port and no timing. The
 * end-to-end proof that a real `ws` connection behaves like one of these fakes is
 * `liveSocketServer.test.ts`'s job, and it is a much smaller claim for having this file underneath
 * it.
 *
 * **Validates: v3 Req 44.2, 44.3, 39.3**
 */

import { describe, expect, it, vi } from 'vitest';
import { SOCKET_CLOSE_CODE } from '#shared/types/liveSocket';
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

    const aliceHeard = alice.sent;
    const bobHeard = bob.sent;
    const carolHeard = carol.sent;
    const danHeard = dan.sent;

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

    const heard = alice.sent;

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

    rooms.broadcast(TABLE_ONE, 'still delivered');

    const heard = alive.sent;
    const complaints = warn.mock.calls.length;

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

    const heard = alice.sent;

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

    const heard = alice.sent;

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

    const heard = oneSocketTwoTables.sent;

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

    const heard = departing.sent;
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
