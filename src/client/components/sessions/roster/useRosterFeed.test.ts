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
import {
  DM_ACTION,
  MEMBER_ROLE,
  PLAYER_ACTION,
  ROLL_EVENT,
  SESSION_EVENT,
} from '#shared/types/api';
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

import {
  DM_ACCOUNT,
  makeDocument,
  makeSnapshot,
  makeTable,
  PLAYER_ACCOUNT,
} from './roster.fixtures';
import { toRosterView } from './rosterView';
import type { RosterListing } from './useRosterFeed';
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

/** The three reads, counted */
function stubReads() {
  const characters = vi.fn(async () => {});
  const rules = vi.fn(async () => {});
  const members = vi.fn(async () => {});

  return { characters, rules, members };
}

/** What the server last said this table is made of */
function aListing(characters: CharacterDocument[] = [makeDocument()]): RosterListing {
  return { characters, members: makeTable() };
}

/** Mount the feed over one character and the table that owns it */
function mountFeed(fetched: RosterListing = aListing()) {
  const reads = stubReads();
  const rendered = renderHook(() => useRosterFeed('session-1', fetched, reads, nameOf));

  return { reads, ...rendered };
}

/** Nothing was asked for again — the assertion four of these cases are really making */
function expectNoReads(reads: ReturnType<typeof stubReads>): void {
  expect(reads.characters).not.toHaveBeenCalled();
  expect(reads.rules).not.toHaveBeenCalled();
  expect(reads.members).not.toHaveBeenCalled();
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

  it('re-reads all three on a resynchronise instruction, and once per instruction', () => {
    const reads = stubReads();
    const fetched = aListing();
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
    // The member list too, since TICKET-LIVE-04: a client gone long enough to be told this has been
    // gone long enough for somebody to have joined or left
    expect(reads.members).toHaveBeenCalledTimes(1);
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
    const first = aListing();
    const { result, rerender } = renderHook(
      ({ fetched }) => useRosterFeed('session-1', fetched, reads, nameOf),
      { initialProps: { fetched: first } }
    );

    const renamed = makeDocument({ character: { name: 'Feathers' } });
    const second = aListing([renamed]);

    act(() => {
      rerender({ fetched: second });
    });

    expect(result.current.characters[0].character.name).toBe('Feathers');
  });
});

/**
 * Who is at the table, moved by the table itself (TICKET-LIVE-04, v3 Req 44.7)
 *
 * The ticket's third and fourth criteria, and the pair is the whole design: **three of the four
 * membership Events cost no read at all**, and the fourth costs exactly one, of exactly one list.
 * That narrowing is checked here rather than described on the ticket, because *it only reads what it
 * needs* is precisely the kind of claim that stops being true without anything failing.
 */
describe('useRosterFeed and the member list', () => {
  /** One membership Event, as the socket delivers it */
  function membership(type: string, payload: Record<string, string>): Partial<LiveEvent> {
    return { type, actorAccountId: DM_ACCOUNT, payload };
  }

  it('drops a removed Member from the list, with no request at all', () => {
    const { result, reads } = mountFeed();
    const removal = membership(SESSION_EVENT.MEMBER_REMOVED, { accountId: PLAYER_ACCOUNT });

    arrive(removal);

    const remaining = result.current.members.map((member) => member.accountId);

    expect(remaining).toEqual([DM_ACCOUNT]);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // **The refetch storm, tested rather than reasoned about.** Before this ticket the applier
    // answered `stale` for any type it did not know, so a join or a leave re-read the whole party.
    expectNoReads(reads);
  });

  it('drops a Member who left, which is the same write and a different story', () => {
    const { result, reads } = mountFeed();
    const departure = membership(SESSION_EVENT.MEMBER_LEFT, { accountId: PLAYER_ACCOUNT });

    arrive(departure);

    const remaining = result.current.members.map((member) => member.accountId);

    expect(remaining).toEqual([DM_ACCOUNT]);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expectNoReads(reads);
  });

  it('moves the DM’s badge on a handover, and puts the new DM first', () => {
    const { result, reads } = mountFeed();

    const handover = membership(SESSION_EVENT.DM_TRANSFERRED, {
      accountId: PLAYER_ACCOUNT,
      previousAccountId: DM_ACCOUNT,
    });

    arrive(handover);

    const roles = result.current.members.map((member) => [member.accountId, member.role]);

    // DM first, which is the order a re-read would have produced — a patch that left the row where
    // it was would draw a correct badge in an order nothing else on this surface ever produces
    expect(roles).toEqual([
      [PLAYER_ACCOUNT, MEMBER_ROLE.DM],
      [DM_ACCOUNT, MEMBER_ROLE.PLAYER],
    ]);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expectNoReads(reads);
  });

  it('reads the member list and nothing else when somebody joins (criterion 3’s exemption)', () => {
    // **The one membership Event that costs a read**, and the narrowing is the assertion: a join's
    // payload carries an id and no name (v3 Req 44.3), and a member list is a list of names — so
    // there is nothing to build a row out of. What it must *not* do is re-read the characters or
    // the rules, neither of which a join touches.
    const { reads } = mountFeed();
    const arrival = membership(SESSION_EVENT.MEMBER_JOINED, { accountId: 'account-newcomer' });

    arrive(arrival);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(reads.members).toHaveBeenCalledTimes(1);
    expect(reads.characters).not.toHaveBeenCalled();
    expect(reads.rules).not.toHaveBeenCalled();
  });

  it('asks once for a burst of joins, as it does for everything else', () => {
    const { reads } = mountFeed();
    const first = membership(SESSION_EVENT.MEMBER_JOINED, { accountId: 'account-one' });
    const second = membership(SESSION_EVENT.MEMBER_JOINED, { accountId: 'account-two' });
    const third = membership(SESSION_EVENT.MEMBER_JOINED, { accountId: 'account-three' });

    arrive(first);
    arrive(second);
    arrive(third);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(reads.members).toHaveBeenCalledTimes(1);
  });

  it('leaves the member list alone for everything that is not about a seat', () => {
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

    const table = makeTable();

    expect(result.current.members).toEqual(table);
    expect(reads.members).not.toHaveBeenCalled();
  });

  it('moves a departed Member’s characters to the departed group, on the same Event', () => {
    // **Criterion 5, at the seam where it actually happens.** Nothing here moves a character:
    // `toRosterView` reads *departed* as *owns a character here and holds no seat here* (v3 Req
    // 39.3), so the patched member list is the whole of the change — which is why there is no
    // second rule about retention on this side to disagree with the server's.
    const { result, reads } = mountFeed();
    const removal = membership(SESSION_EVENT.MEMBER_REMOVED, { accountId: PLAYER_ACCOUNT });

    arrive(removal);

    const snapshot = makeSnapshot();
    const characters = result.current.characters;
    const groups = toRosterView(result.current.members, characters, snapshot, DM_ACCOUNT);
    const departed = groups.find((group) => group.member === null);
    const names = departed?.characters.map((row) => row.name);

    expect(names).toEqual(['Quackers']);
    expectNoReads(reads);
  });

  it('records no adjustment for a membership change, which is not anybody’s sheet', () => {
    // Criterion 8's client half: the adjustment log is a character's history, and a removal is not
    // an adjustment to one. `describeAdjustment` is not extended to these, and this is what would
    // fail if the newest-seen adjustment quietly started collecting them.
    const { result } = mountFeed();
    const removal = membership(SESSION_EVENT.MEMBER_REMOVED, { accountId: PLAYER_ACCOUNT });

    arrive(removal);

    expect(result.current.latest).toEqual({});
  });
});
