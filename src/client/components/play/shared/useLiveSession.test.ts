/**
 * Joining a table's room while a surface is on screen (TICKET-LIVE-02, v3 Req 44.2)
 *
 * Three claims, and the first is D6's: **a signed-out browser opens no socket at all**, proven with
 * the connection stubbed to *throw* rather than counted — a hook that connected and ignored the
 * result would satisfy a call count and still have made local mode reach the network.
 *
 * The other two are about not being noisy: the room is left exactly once, when the surface goes,
 * and a caller passing a fresh closure every render — which every caller does — must not make the
 * hook leave and rejoin.
 *
 * **Validates: v3 Req 44.2, 44.7**
 */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveEventMessage } from '#shared/types/liveSocket';

const auth = { accountId: null as string | null, email: null, isPending: false, isSignedIn: false };
vi.mock('../../auth/useAuth', () => ({ useAuth: () => auth }));

const subscribe = vi.fn();
const unsubscribe = vi.fn();
const stopListening = vi.fn();
let listeners: ((message: LiveEventMessage) => void)[] = [];

const connection = {
  subscribe,
  unsubscribe,
  addListener: (listener: (message: LiveEventMessage) => void) => {
    listeners.push(listener);
    return stopListening;
  },
  close: vi.fn(),
};

let openConnection = () => connection;

vi.mock('../../../services/liveSocket', () => ({
  liveConnection: () => openConnection(),
}));

import { useLiveSession } from './useLiveSession';

/** One Event, in some room */
function aFrame(sessionId: string): LiveEventMessage {
  return {
    type: 'event',
    sessionId,
    event: {
      id: 'event-1',
      seq: 1,
      type: 'dm-award-experience',
      actorAccountId: 'account-dm',
      at: 0,
      payload: {},
    },
  } as LiveEventMessage;
}

/** Push a frame at every listener the connection holds */
function broadcast(sessionId: string): void {
  const frame = aFrame(sessionId);

  for (const listener of listeners) listener(frame);
}

beforeEach(() => {
  vi.clearAllMocks();
  listeners = [];
  openConnection = () => connection;
  auth.isSignedIn = true;
});

describe('useLiveSession', () => {
  it('opens no connection at all while nobody is signed in', () => {
    auth.isSignedIn = false;
    openConnection = () => {
      throw new Error('local mode must not open a socket');
    };

    const listener = vi.fn();

    renderHook(() => useLiveSession('session-1', listener));

    expect(subscribe).not.toHaveBeenCalled();
  });

  it('opens no connection when there is no table to listen to', () => {
    openConnection = () => {
      throw new Error('there is nothing to subscribe to');
    };

    const listener = vi.fn();

    renderHook(() => useLiveSession(null, listener));

    expect(subscribe).not.toHaveBeenCalled();
  });

  it('joins the room while the surface is mounted and leaves when it goes', () => {
    const listener = vi.fn();
    const { unmount } = renderHook(() => useLiveSession('session-1', listener));

    expect(subscribe).toHaveBeenCalledWith('session-1');
    expect(unsubscribe).not.toHaveBeenCalled();

    unmount();

    expect(unsubscribe).toHaveBeenCalledWith('session-1');
    expect(stopListening).toHaveBeenCalled();
  });

  it('does not rejoin because the caller passed a new closure', () => {
    const { rerender } = renderHook(() => useLiveSession('session-1', () => undefined));

    rerender();
    rerender();

    // Every caller builds its listener inline — the room is keyed on the session and nothing else
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(unsubscribe).not.toHaveBeenCalled();
  });

  it('hands over the Events of its own room and no other', () => {
    const heard: string[] = [];
    renderHook(() => useLiveSession('session-1', (message) => heard.push(message.sessionId)));

    broadcast('session-1');
    broadcast('session-2');

    // One connection may hold several rooms, so a surface watching one table must not read another's
    expect(heard).toEqual(['session-1']);
  });

  it('calls the listener the caller passed most recently', () => {
    const first = vi.fn();
    const second = vi.fn();
    let current = first;

    const { rerender } = renderHook(() => useLiveSession('session-1', (m) => current(m)));

    current = second;
    rerender();
    broadcast('session-1');

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
