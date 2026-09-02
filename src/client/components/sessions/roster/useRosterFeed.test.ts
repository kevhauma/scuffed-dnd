/**
 * The roster moves when the table does (TICKET-DM-04, v3 Req 49.9)
 *
 * The ticket's fourth criterion: *a player spending points in their own browser moves that row in the
 * DM's roster with no refresh; so does another Member's roll and the DM's own adjustment*. Each of
 * those three is a different path through this hook, and the difference is the point:
 *
 * - **A DM's adjustment applies**, patching the cached character in place — no request at all.
 * - **A player's point spend is structural**, so it cannot be applied and earns **one** coalesced
 *   re-read, however many arrive together.
 * - **A roll stores nothing**, so it must provoke neither. A roster that refetched the party every
 *   time somebody threw dice would be the most expensive surface in the app.
 *
 * Plus the two the whole roster rests on: a **Snapshot refresh** re-reads the *rules*, because every
 * number here is priced against them; and the **adjustments come off the feed**, which is what makes
 * a row's before → after and undo cost zero extra requests.
 *
 * The room is faked to *what does this hook do with a frame*, `useTableCharacterFeed.test.ts`'s shape
 * and for its reason — the connection has its own tests, and a second copy of subscribe/unsubscribe
 * here would test that module twice and this one not at all. The **applier is real**: what an Event
 * means to a character is `liveEvents.ts`'s rule, and this hook exists precisely so there is not a
 * second one.
 *
 * **Validates: v3 Req 44.6, 44.7, 49.5, 49.9**
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CharacterDocument } from '#shared/types/api';
import { DM_ACTION, PLAYER_ACTION, ROLL_EVENT, SESSION_EVENT } from '#shared/types/api';
import type { LiveEvent, LiveEventMessage } from '#shared/types/liveSocket';
import type { LiveRoomView } from '../../../services/liveSocket';

/** What the hook subscribed with, so a case can push frames at it */
let deliver: ((message: LiveEventMessage) => void) | null = null;

vi.mock('../../play/shared/useLiveSession', () => ({
  useLiveSession: (_sessionId: string | null, onEvent: (message: LiveEventMessage) => void) => {
    deliver = onEvent;
  },
}));

/** The room's own view, which is where a *read it all again* instruction arrives */
let room: LiveRoomView | null = null;

vi.mock('../../live/useLiveRoom', () => ({ useLiveRoom: () => room }));

import { makeDocument, PLAYER_ACCOUNT } from './roster.fixtures';
import { adjustmentsFor, useRosterFeed } from './useRosterFeed';

/** How this table spells an Account id */
function nameOf(accountId: string | null): string | null {
  if (accountId === null) return null;

  return accountId === 'account-dm' ? 'The DM' : 'Ada';
}

/** One frame carrying whatever a case wants said */
function aFrame(event: Partial<LiveEvent>): LiveEventMessage {
  return {
    type: 'event',
    sessionId: 'session-1',
    event: {
      id: 'event-1',
      seq: 1,
      type: DM_ACTION.ADJUST_RESOURCE,
      actorAccountId: 'account-dm',
      at: 1_700_000_000_000,
      payload: { characterId: 'character-1', action: DM_ACTION.ADJUST_RESOURCE },
      ...event,
    },
  } as LiveEventMessage;
}

/** Push one frame at the mounted hook */
function arrive(event: Partial<LiveEvent>): void {
  const push = deliver;
  expect(push, 'the hook should be listening').not.toBeNull();

  const frame = aFrame(event);

  act(() => {
    push?.(frame);
  });
}

/** The two reads, counted */
function stubReads() {
  const characters = vi.fn(async () => {});
  const rules = vi.fn(async () => {});

  return { characters, rules };
}

/** Mount the feed over one character */
function mountFeed(fetched: CharacterDocument[] = [makeDocument()]) {
  const reads = stubReads();
  const rendered = renderHook(() => useRosterFeed('session-1', fetched, reads, nameOf));

  return { reads, ...rendered };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  deliver = null;
  room = null;
});

describe('useRosterFeed', () => {
  it('patches a row from a DM’s adjustment, with no request at all', () => {
    const { result, reads } = mountFeed();

    arrive({
      type: DM_ACTION.ADJUST_RESOURCE,
      payload: {
        characterId: 'character-1',
        action: DM_ACTION.ADJUST_RESOURCE,
        target: 'stat-vigor',
        before: 31,
        after: 24,
      },
    });

    const patched = result.current.characters[0].character;

    expect(patched.currentResourceValues['stat-vigor']).toBe(24);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(reads.characters).not.toHaveBeenCalled();
  });

  it('re-reads once for a burst of changes it cannot apply (v3 Req 49.9)', () => {
    // A point spend is *structural* — the allocation moves, not one of the five stored fields — so
    // only a re-read can say what the sheet now is. Four of them cost one request.
    const { reads } = mountFeed();

    for (const seq of [1, 2, 3, 4]) {
      arrive({
        id: `event-${seq}`,
        seq,
        type: PLAYER_ACTION.INVEST_STAT_POINTS,
        actorAccountId: PLAYER_ACCOUNT,
        payload: {
          characterId: 'character-1',
          action: PLAYER_ACTION.INVEST_STAT_POINTS,
          target: 'stat-might',
          before: 4,
          after: 5,
        },
      });
    }

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(reads.characters).toHaveBeenCalledTimes(1);
  });

  it('does nothing at all for a roll, which stores nothing', () => {
    const { result, reads } = mountFeed();

    const before = result.current.characters;

    arrive({
      type: ROLL_EVENT,
      payload: { characterId: 'character-1', outcome: { total: 17 } },
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(reads.characters).not.toHaveBeenCalled();
    expect(result.current.characters).toBe(before);
  });

  it('re-reads the rules as well when the Snapshot is refreshed', () => {
    // Every number on this surface is priced against the Snapshot, so a refresh that only re-read
    // the characters would leave the roster deriving against rules that had moved
    const { reads } = mountFeed();

    arrive({ type: SESSION_EVENT.SNAPSHOT_REFRESHED, payload: {} });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(reads.characters).toHaveBeenCalledTimes(1);
    expect(reads.rules).toHaveBeenCalledTimes(1);
  });

  it('re-reads both on a resynchronise instruction, and once per instruction', () => {
    const reads = stubReads();
    const fetched = [makeDocument()];
    const { rerender } = renderHook(() => useRosterFeed('session-1', fetched, reads, nameOf));

    room = { status: 'live', presentAccountIds: [], resyncAt: 1_700_000_000_500 } as LiveRoomView;

    act(() => {
      rerender();
      vi.advanceTimersByTime(500);
    });

    act(() => {
      rerender();
      vi.advanceTimersByTime(500);
    });

    expect(reads.characters).toHaveBeenCalledTimes(1);
    expect(reads.rules).toHaveBeenCalledTimes(1);
  });

  it('keeps the newest adjustment per character, so a row’s undo costs no request', () => {
    const { result } = mountFeed();

    arrive({
      id: 'event-7',
      seq: 7,
      type: DM_ACTION.ADJUST_RESOURCE,
      payload: {
        characterId: 'character-1',
        action: DM_ACTION.ADJUST_RESOURCE,
        target: 'stat-vigor',
        before: 31,
        after: 24,
      },
    });

    const seen = adjustmentsFor(result.current, 'character-1');

    expect(seen).toHaveLength(1);
    expect(seen[0].seq).toBe(7);
    expect(seen[0].after).toBe(24);
    // Resolved from the table's member list, never read out of the payload — a name written into an
    // Event would be a stored copy a rename could make wrong
    expect(seen[0].by).toBe('The DM');
  });

  it('keeps only the newest, because only the newest is read', () => {
    const { result } = mountFeed();

    arrive({ id: 'event-1', seq: 1 });
    arrive({ id: 'event-2', seq: 2 });

    const seen = adjustmentsFor(result.current, 'character-1');

    expect(seen).toHaveLength(1);
    expect(seen[0].seq).toBe(2);
  });

  it('records no adjustment for a player’s own action, which is not a DM’s', () => {
    const { result } = mountFeed();

    arrive({
      type: PLAYER_ACTION.ADJUST_RESOURCE,
      payload: {
        characterId: 'character-1',
        action: PLAYER_ACTION.ADJUST_RESOURCE,
        target: 'stat-vigor',
        before: 31,
        after: 24,
      },
    });

    const seen = adjustmentsFor(result.current, 'character-1');

    expect(seen).toEqual([]);
  });

  it('hands every reader the same empty list, so a quiet row does not re-render its neighbours', () => {
    const { result } = mountFeed();

    const first = adjustmentsFor(result.current, 'character-1');
    const second = adjustmentsFor(result.current, 'character-2');

    expect(first).toBe(second);
  });

  it('composes two changes that arrive in one tick rather than losing the first', () => {
    // The listener closes over the render's characters, so a second frame computing its patch from
    // the pre-Event list would silently overwrite the first. The held ref is what stops that.
    const { result } = mountFeed();

    arrive({
      id: 'event-1',
      seq: 1,
      payload: {
        characterId: 'character-1',
        action: DM_ACTION.ADJUST_RESOURCE,
        target: 'stat-vigor',
        before: 31,
        after: 24,
      },
    });
    arrive({
      id: 'event-2',
      seq: 2,
      type: DM_ACTION.AWARD_EXPERIENCE,
      payload: {
        characterId: 'character-1',
        action: DM_ACTION.AWARD_EXPERIENCE,
        target: '',
        before: 300,
        after: 900,
      },
    });

    const patched = result.current.characters[0].character;

    expect(patched.currentResourceValues['stat-vigor']).toBe(24);
    expect(patched.experience).toBe(900);
  });

  it('adopts a fresh listing when one lands', () => {
    const reads = stubReads();
    const first = [makeDocument()];
    const { result, rerender } = renderHook(
      ({ fetched }) => useRosterFeed('session-1', fetched, reads, nameOf),
      { initialProps: { fetched: first } }
    );

    const renamed = makeDocument({ character: { name: 'Feathers' } });
    const second = [renamed];

    act(() => {
      rerender({ fetched: second });
    });

    expect(result.current.characters[0].character.name).toBe('Feathers');
  });
});
