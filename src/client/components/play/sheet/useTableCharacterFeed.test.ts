/**
 * One refetch for a burst, and none at all for what can be applied (TICKET-LIVE-02, v3 Req 44.7)
 *
 * The criterion is *an Event a client cannot apply triggers **exactly one** full refetch, not one
 * per Event* — a claim about counting, which is why this file drives the hook with a fake clock and
 * counts. The three cases that matter are the burst, the Event that lands *during* the read it
 * caused, and the Event that needs no read at all.
 *
 * The room itself is `useLiveSession`'s and is faked here down to *what does this hook do with a
 * frame*: the connection has its own tests in `services/liveSocket.test.ts`, and a second copy of
 * subscribe/unsubscribe here would be testing that module twice and this one not at all.
 *
 * **Validates: v3 Req 44.7**
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveEventMessage } from '#shared/types/liveSocket';
import { EVENT_EFFECT, type LiveEventEffect } from '../../../services/liveEvents';

/** What the hook subscribed with, so a case can push frames at it */
let deliver: ((message: LiveEventMessage) => void) | null = null;
let listeningTo: string | null = null;

vi.mock('../shared/useLiveSession', () => ({
  useLiveSession: (sessionId: string | null, onEvent: (message: LiveEventMessage) => void) => {
    listeningTo = sessionId;
    deliver = onEvent;
  },
}));

const applyTableEvent = vi.fn<(event: unknown) => LiveEventEffect>(() => EVENT_EFFECT.APPLIED);

let storeState = {
  tableCharacter: { id: 'character-1' } as { id: string } | null,
  tableSessionId: 'session-1' as string | null,
  applyTableEvent,
};

vi.mock('../../../stores/characterStore', () => ({
  useCharacterStore: (selector: (state: typeof storeState) => unknown) => selector(storeState),
}));

import { useTableCharacterFeed } from './useTableCharacterFeed';

/** One Event, whose content the fake `applyTableEvent` decides the meaning of */
function aFrame(seq: number): LiveEventMessage {
  return {
    type: 'event',
    sessionId: 'session-1',
    event: {
      id: `event-${seq}`,
      seq,
      type: 'dm-award-experience',
      actorAccountId: 'account-dm',
      at: 1_700_000_000_000,
      payload: { characterId: 'character-1' },
    },
  } as LiveEventMessage;
}

/** Push one frame at the mounted hook */
function arrive(seq: number): void {
  const push = deliver;
  expect(push, 'the hook should be listening').not.toBeNull();

  const frame = aFrame(seq);
  const deliverTo = push as (message: LiveEventMessage) => void;

  act(() => {
    deliverTo(frame);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  deliver = null;
  listeningTo = null;
  applyTableEvent.mockReturnValue(EVENT_EFFECT.APPLIED);
  storeState = {
    tableCharacter: { id: 'character-1' },
    tableSessionId: 'session-1',
    applyTableEvent,
  };
});

describe('useTableCharacterFeed', () => {
  it('listens to the table the open character plays at', () => {
    const reopen = vi.fn(async () => undefined);

    renderHook(() => useTableCharacterFeed('character-1', reopen));

    expect(listeningTo).toBe('session-1');
  });

  it('listens to nothing when the sheet on screen is not the table one', () => {
    // A local character has no room to join, and joining one would be a request D6 says local mode
    // never makes
    storeState.tableCharacter = { id: 'somebody-else' };
    const reopen = vi.fn(async () => undefined);

    renderHook(() => useTableCharacterFeed('character-1', reopen));

    expect(listeningTo).toBeNull();
  });

  it('reads nothing when every Event applied', () => {
    const reopen = vi.fn(async () => undefined);
    renderHook(() => useTableCharacterFeed('character-1', reopen));

    arrive(1);
    arrive(2);

    act(() => {
      vi.runAllTimers();
    });

    // The whole point of applying: the DM's award moves the sheet without a request
    expect(reopen).not.toHaveBeenCalled();
  });

  it('reads nothing for an Event about somebody else at the table', () => {
    applyTableEvent.mockReturnValue(EVENT_EFFECT.ELSEWHERE);
    const reopen = vi.fn(async () => undefined);
    renderHook(() => useTableCharacterFeed('character-1', reopen));

    arrive(1);

    act(() => {
      vi.runAllTimers();
    });

    expect(reopen).not.toHaveBeenCalled();
  });

  it('reads once for a burst of Events it cannot apply', async () => {
    applyTableEvent.mockReturnValue(EVENT_EFFECT.STALE);
    const reopen = vi.fn(async () => undefined);
    renderHook(() => useTableCharacterFeed('character-1', reopen));

    arrive(1);
    arrive(2);
    arrive(3);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Criterion 5, as a number: a DM handing out four items in a second costs one read
    expect(reopen).toHaveBeenCalledTimes(1);
  });

  it('reads again for an Event that arrived while it was reading', async () => {
    applyTableEvent.mockReturnValue(EVENT_EFFECT.STALE);

    let settle: (() => void) | null = null;
    const reopen = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          settle = resolve;
        })
    );

    renderHook(() => useTableCharacterFeed('character-1', reopen));

    arrive(1);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(reopen).toHaveBeenCalledTimes(1);

    // …and now something else happens, which the read already in flight may not have seen
    arrive(2);

    await act(async () => {
      (settle as unknown as () => void)();
      await vi.runAllTimersAsync();
    });

    expect(reopen).toHaveBeenCalledTimes(2);
  });

  it('does not read after the sheet has gone', async () => {
    applyTableEvent.mockReturnValue(EVENT_EFFECT.STALE);
    const reopen = vi.fn(async () => undefined);

    const { unmount } = renderHook(() => useTableCharacterFeed('character-1', reopen));

    arrive(1);
    unmount();

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(reopen).not.toHaveBeenCalled();
  });

  it('does not run the trailing read into a sheet that has gone', async () => {
    // Clearing the timer is not enough: a read **already in flight** when the User navigates away
    // settles afterwards, and its `.finally` would fire the trailing re-read into a component
    // nobody is looking at — a request for one sheet writing a character the next sheet is about
    // to replace.
    applyTableEvent.mockReturnValue(EVENT_EFFECT.STALE);

    let settle: (() => void) | null = null;
    const reopen = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          settle = resolve;
        })
    );

    const { unmount } = renderHook(() => useTableCharacterFeed('character-1', reopen));

    arrive(1);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(reopen).toHaveBeenCalledTimes(1);

    // …something else happens, and *then* the sheet goes
    arrive(2);
    unmount();

    await act(async () => {
      const finish = settle as unknown as () => void;
      finish();
      await vi.runAllTimersAsync();
    });

    expect(reopen).toHaveBeenCalledTimes(1);
  });
});
