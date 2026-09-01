/**
 * Watching one table's feed while a surface is on screen (TICKET-LIVE-03, v3 Req 44.8)
 *
 * Four claims. **A signed-out browser opens no socket** — D6, and proven with the connection stubbed
 * to *throw* rather than counted, the shape `useLiveSession.test.ts` established: a hook that
 * connected and ignored the result would satisfy a call count and still have made local mode reach
 * the network. **`null` is a real answer** for a reader with no table, rather than a view claiming
 * some status about nothing. **The room is held for exactly as long as the surface is**, because
 * presence is a claim you may only make about a table you are watching. And **the first read happens
 * immediately**, which is the one an event-driven hook would miss: the connection may already be
 * open and this room already confirmed, in which case no notification is coming at all.
 *
 * **Validates: v3 Req 44.8**
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LIVE_STATUS, type LiveRoomView } from '../../services/liveSocket';

const auth = { accountId: null as string | null, email: null, isPending: false, isSignedIn: false };
vi.mock('../auth/useAuth', () => ({ useAuth: () => auth }));

const subscribe = vi.fn();
const unsubscribe = vi.fn();
const stopWatching = vi.fn();
let watchers: (() => void)[] = [];
let view: LiveRoomView = {
  status: LIVE_STATUS.CONNECTING,
  presentAccountIds: [],
  resyncAt: null,
};

const connection = {
  subscribe,
  unsubscribe,
  addListener: vi.fn(),
  addViewListener: (watcher: () => void) => {
    watchers.push(watcher);
    return stopWatching;
  },
  roomView: () => view,
  close: vi.fn(),
};

let openConnection = () => connection;

vi.mock('../../services/liveSocket', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/liveSocket')>();

  return { ...actual, liveConnection: () => openConnection() };
});

import { useLiveRoom } from './useLiveRoom';

/** Tell every watcher the connection holds that something moved */
function announce(next: LiveRoomView): void {
  view = next;

  act(() => {
    for (const watcher of watchers) watcher();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  watchers = [];
  openConnection = () => connection;
  auth.isSignedIn = true;
  view = { status: LIVE_STATUS.CONNECTING, presentAccountIds: [], resyncAt: null };
});

describe('useLiveRoom', () => {
  it('opens no connection at all while nobody is signed in', () => {
    auth.isSignedIn = false;
    openConnection = () => {
      throw new Error('local mode must not open a socket');
    };

    const { result } = renderHook(() => useLiveRoom('session-1'));

    expect(subscribe).not.toHaveBeenCalled();
    expect(result.current).toBeNull();
  });

  it('answers null for a character that plays at no table', () => {
    openConnection = () => {
      throw new Error('there is no room to watch');
    };

    const { result } = renderHook(() => useLiveRoom(null));

    // Not a feed that is down — no feed. `presenceStateOf` and `LiveStatusNotice` both read it as
    // *nothing to say*, which is what keeps the whole treatment invisible in local play.
    expect(result.current).toBeNull();
  });

  it('reads the room once immediately, without waiting to be told', () => {
    view = { status: LIVE_STATUS.LIVE, presentAccountIds: ['account-ada'], resyncAt: null };

    const { result } = renderHook(() => useLiveRoom('session-1'));
    const current = result.current;

    // The connection is very likely already open and this room already confirmed — a second surface
    // on the same sheet — in which case nothing further will be announced
    expect(current?.status).toBe(LIVE_STATUS.LIVE);
    expect(current?.presentAccountIds).toEqual(['account-ada']);
  });

  it('follows the room as it changes', () => {
    const { result } = renderHook(() => useLiveRoom('session-1'));

    const dropped: LiveRoomView = {
      status: LIVE_STATUS.RECONNECTING,
      presentAccountIds: [],
      resyncAt: null,
    };
    announce(dropped);

    expect(result.current?.status).toBe(LIVE_STATUS.RECONNECTING);
  });

  it('holds the room while the surface is mounted and lets go when it leaves', () => {
    const { unmount } = renderHook(() => useLiveRoom('session-1'));

    expect(subscribe).toHaveBeenCalledWith('session-1');
    expect(unsubscribe).not.toHaveBeenCalled();

    unmount();

    expect(unsubscribe).toHaveBeenCalledWith('session-1');
    expect(stopWatching).toHaveBeenCalled();
  });

  it('does not rejoin on a re-render', () => {
    const { rerender } = renderHook(() => useLiveRoom('session-1'));

    rerender();
    rerender();

    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(unsubscribe).not.toHaveBeenCalled();
  });

  it('forgets the view when the reader signs out', () => {
    const { result, rerender } = renderHook(() => useLiveRoom('session-1'));

    view = { status: LIVE_STATUS.LIVE, presentAccountIds: ['account-ada'], resyncAt: null };
    announce(view);

    expect(result.current?.status).toBe(LIVE_STATUS.LIVE);

    auth.isSignedIn = false;
    rerender();

    // Cleared rather than left standing: a stale view would go on saying a table is live to a reader
    // who is no longer connected to anything
    expect(result.current).toBeNull();
  });
});
