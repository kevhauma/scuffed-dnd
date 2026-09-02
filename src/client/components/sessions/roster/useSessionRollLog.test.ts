/**
 * The table's whole roll log (TICKET-DM-04, v3 Req 41.6, 49.9)
 *
 * **This is the gap DM-05 and TICKET-LIVE-02 both recorded against this ticket, closed.** A DM
 * reading a player's sheet sees an empty roll history because that log is narrowed to the reader's
 * own Account, and a DM has never rolled as somebody else's character. Both tickets refused to paper
 * over it with a live feed, which would have filled an empty panel from socket-open and silently
 * omitted everything before that.
 *
 * The fix asserted here is that this read is **narrowed by nothing** — `listRolls` answers the
 * table's log by default — so the roster is complete from the table's first roll. The first case is
 * the one that would catch a regression to `?rolledBy=`: it asserts the request carries no narrowing
 * argument at all.
 *
 * Two more claims, both inherited from `useTableRollLog` and both about the fold:
 *
 * - **A row cannot appear twice**, deduplicated by the Event's id — which the read and the broadcast
 *   both carry.
 * - **Rows are in the log's order**, by `seq`, not the network's.
 *
 * **Validates: v3 Req 41.6, 44.7, 49.9**
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionRoll } from '#shared/types/api';
import { ROLL_EVENT } from '#shared/types/api';
import type { RollOutcome } from '#shared/types/formula';
import type { LiveEvent, LiveEventMessage } from '#shared/types/liveSocket';

/** What the hook subscribed with, so a case can push frames at it */
let deliver: ((message: LiveEventMessage) => void) | null = null;

vi.mock('../../play/shared/useLiveSession', () => ({
  useLiveSession: (_sessionId: string | null, onEvent: (message: LiveEventMessage) => void) => {
    deliver = onEvent;
  },
}));

const fetchSessionRolls = vi.fn();

vi.mock('../../../services/characterSync', () => ({
  fetchSessionRolls: (...args: unknown[]) => fetchSessionRolls(...args),
}));

import type { RollNames } from './useSessionRollLog';
import { useSessionRollLog } from './useSessionRollLog';

/** How this table spells the two things a roll names */
const NAMES: RollNames = {
  character: (characterId: string) =>
    characterId === 'character-1' ? 'Quackers' : 'A departed character',
  account: (accountId: string | null) => (accountId === null ? null : 'Ada'),
};

/** One outcome, as the engine produced it */
function anOutcome(overrides: Partial<RollOutcome> = {}): RollOutcome {
  return {
    rollId: 'roll-attack',
    rollName: 'Attack',
    input: 22,
    dice: [],
    diceTotal: 14,
    flat: 2,
    total: 16,
    notation: '1D20 + 1D12 + 2',
    timestamp: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** One row, as the fetched log carries it */
function aRow(overrides: Partial<SessionRoll> = {}): SessionRoll {
  const outcome = anOutcome();

  return {
    ...outcome,
    id: 'event-1',
    seq: 1,
    characterId: 'character-1',
    characterName: 'Quackers',
    rolledBy: 'Ada',
    ...overrides,
  };
}

/** One frame carrying a roll */
function aFrame(event: Partial<LiveEvent> = {}): LiveEventMessage {
  return {
    type: 'event',
    sessionId: 'session-1',
    event: {
      id: 'event-2',
      seq: 2,
      type: ROLL_EVENT,
      actorAccountId: 'account-ada',
      at: 1_700_000_000_000,
      payload: { characterId: 'character-1', outcome: anOutcome({ total: 25 }) },
      ...event,
    },
  } as LiveEventMessage;
}

/** Push one frame at the mounted hook */
function arrive(event: Partial<LiveEvent> = {}): void {
  const push = deliver;
  expect(push, 'the hook should be listening').not.toBeNull();

  const frame = aFrame(event);

  act(() => {
    push?.(frame);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  deliver = null;
  fetchSessionRolls.mockResolvedValue({ rolls: [] });
});

describe('useSessionRollLog', () => {
  it('asks for the table’s whole log, narrowed by nobody', async () => {
    // The regression this guards: `?rolledBy=<the reader>` is what makes a DM's sheet panel read
    // empty, and re-introducing it here would make the roster's log wrong in the same silent way
    renderHook(() => useSessionRollLog('session-1', NAMES));

    await waitFor(() => {
      expect(fetchSessionRolls).toHaveBeenCalled();
    });

    expect(fetchSessionRolls).toHaveBeenCalledWith('session-1');
  });

  it('asks for nothing at all when no table is open', () => {
    renderHook(() => useSessionRollLog(null, NAMES));

    expect(fetchSessionRolls).not.toHaveBeenCalled();
  });

  it('reads every Member’s rolls, not one character’s', async () => {
    const mine = aRow();
    const theirs = aRow({ id: 'event-9', seq: 9, characterId: 'character-2' });

    fetchSessionRolls.mockResolvedValue({ rolls: [theirs, mine] });

    const { result } = renderHook(() => useSessionRollLog('session-1', NAMES));

    await waitFor(() => {
      expect(result.current.rolls).toHaveLength(2);
    });
  });

  it('adds a roll that arrives live, spelled from the table’s own names', async () => {
    const { result } = renderHook(() => useSessionRollLog('session-1', NAMES));

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    arrive();

    expect(result.current.rolls).toHaveLength(1);
    expect(result.current.rolls[0].characterName).toBe('Quackers');
    // Resolved at read time, never stored in the payload — so a rename cannot leave the log calling
    // somebody by a name they no longer have
    expect(result.current.rolls[0].rolledBy).toBe('Ada');
  });

  it('never adds a row twice, however it arrives', async () => {
    // A roll made just after the read's SELECT ran arrives as a frame first and then in the answer.
    // Deduplicated by the Event's id, which the route minted and both carry.
    const overlapping = aRow({ id: 'event-2', seq: 2 });

    fetchSessionRolls.mockResolvedValue({ rolls: [overlapping] });

    const { result } = renderHook(() => useSessionRollLog('session-1', NAMES));

    arrive({ id: 'event-2', seq: 2 });

    await waitFor(() => {
      expect(result.current.rolls).toHaveLength(1);
    });
  });

  it('folds the read into what is on screen rather than writing over it', async () => {
    // The window is real: the server's fan-out is synchronous with the write, so a roll made after
    // the SELECT and before its answer arrives as a frame first, and a bare `setRolls(rows)` would
    // throw it away
    const older = aRow({ id: 'event-1', seq: 1 });
    let settle: (value: { rolls: SessionRoll[] }) => void = () => {};

    fetchSessionRolls.mockReturnValue(
      new Promise<{ rolls: SessionRoll[] }>((resolve) => {
        settle = resolve;
      })
    );

    const { result } = renderHook(() => useSessionRollLog('session-1', NAMES));

    arrive({ id: 'event-2', seq: 2 });

    await act(async () => {
      settle({ rolls: [older] });
    });

    await waitFor(() => {
      expect(result.current.rolls).toHaveLength(2);
    });

    // …and in the log's own order, newest first, which is `seq` rather than arrival
    const order = result.current.rolls.map((roll) => roll.seq);
    expect(order).toEqual([2, 1]);
  });

  it('ignores an Event that is not a roll', async () => {
    const { result } = renderHook(() => useSessionRollLog('session-1', NAMES));

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    arrive({ type: 'dm-award-experience' });

    expect(result.current.rolls).toEqual([]);
  });

  it('stays empty rather than breaking the roster when the log cannot be read', async () => {
    const offline = new Error('offline');

    fetchSessionRolls.mockRejectedValue(offline);

    const { result } = renderHook(() => useSessionRollLog('session-1', NAMES));

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.rolls).toEqual([]);
  });
});
