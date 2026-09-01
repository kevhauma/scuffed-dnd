/**
 * Rolling at a table (TICKET-ROLL-07)
 *
 * **A second file rather than more cases in `useRoller.test.tsx`**, for `characterStore.table`'s
 * reason: the ticket asks that the existing roller tests pass **unchanged**, which is the cheapest
 * proof that a solo Player's dice did not move. Everything here is about the other home.
 *
 * Three claims:
 *
 * 1. **The client does not roll — it asks.** No `Math.random`, no engine call, no preview: the
 *    request carries which roll and nothing else, and the answer is adopted whole.
 * 2. **The history is the table's log**, so it is there before anything is rolled — the property
 *    `useUIStore`'s in-memory list never had.
 * 3. **A local character still rolls locally**, with `fetch` stubbed to throw.
 *
 * **Validates: v3 Req 41.6, 45.2**
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROLL_EVENT } from '#shared/types/api';
import type { Character } from '#shared/types/character';
import type { Configuration } from '#shared/types/config';
import type { LiveEventMessage } from '#shared/types/liveSocket';

/** The room, faked at the connection so that `useLiveSession`'s own logic still runs */
const subscribe = vi.fn();
const unsubscribe = vi.fn();
let listeners: ((message: LiveEventMessage) => void)[] = [];

vi.mock('../../../services/liveSocket', () => ({
  liveConnection: () => ({
    subscribe,
    unsubscribe,
    addListener: (listener: (message: LiveEventMessage) => void) => {
      listeners.push(listener);

      return () => {
        listeners = listeners.filter((held) => held !== listener);
      };
    },
    close: vi.fn(),
  }),
}));

vi.mock('../../../services/storage', () => ({
  loadCharacters: vi.fn(() => []),
  saveCharacters: vi.fn(),
}));

// Signed in, because the log is narrowed by the Account that rolled — `?rolledBy=` is what keeps a
// Player's own rolls from falling off a busy table's capped window
vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    accountId: 'account-1',
    email: 'pat@example.test',
    isPending: false,
    isSignedIn: true,
  }),
}));

import { useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';
import { useUIStore } from '../../../stores/uiStore';
import { useRoller } from './useRoller';

/** One roll over a one-rung ladder, so a pool is predictable */
const RULES = {
  id: 'config-1',
  name: 'Test',
  version: '1.0',
  schemaVersion: 10,
  stats: [],
  skills: [],
  materials: [],
  materialCategories: [],
  items: [],
  equipmentSlots: [],
  races: [],
  currencyTiers: [],
  diceLadders: [{ id: 'ladder-1', name: 'Standard', dieSizes: [6] }],
  rollDefinitions: [
    {
      id: 'roll-1',
      name: 'Melee',
      category: 'Offence',
      order: 0,
      input: '8',
      ladderId: 'ladder-1',
    },
  ],
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
} as unknown as Configuration;

function aCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char-1',
    name: 'Quackers',
    configurationId: 'config-1',
    raceIds: [],
    investedStatPoints: {},
    investedSkillPoints: {},
    currentResourceValues: {},
    experience: 0,
    inventory: { equippedItems: {}, composedItems: [] },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** What the engine would have produced, as the server's answer */
const OUTCOME = {
  rollId: 'roll-1',
  rollName: 'Melee',
  input: 8,
  dice: [{ size: 6, rolls: [5], total: 5 }],
  diceTotal: 5,
  flat: 2,
  total: 7,
  notation: '1D6 + 2',
  timestamp: '2026-08-27T00:00:00.000Z',
};

/** One entry of the table's log, as `GET /api/sessions/:id/rolls` answers it */
const LOGGED = {
  ...OUTCOME,
  id: 'event-1',
  seq: 1,
  characterId: 'char-1',
  characterName: 'Quackers',
  rolledBy: 'Pat Player',
};

/** A `fetch` that answers the log with one body and every POST with another */
function respondWith(log: unknown[], rolled: unknown, status = 200) {
  globalThis.fetch = vi.fn(async (_url: string, init?: RequestInit) =>
    Promise.resolve(
      new Response(JSON.stringify(init?.method === 'POST' ? rolled : { rolls: log }), {
        status: init?.method === 'POST' ? status : 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
  ) as unknown as typeof fetch;
}

/** The requests this case made, as `[method, path]` pairs */
function requests(): [string, string][] {
  return vi
    .mocked(globalThis.fetch)
    .mock.calls.map(([url, init]) => [(init as RequestInit)?.method ?? 'GET', url as string]);
}

const original = globalThis.fetch;

/** The calculated character the sheet would hand in — unused on the table path, and that is a claim */
const CALCULATED = {
  name: 'Quackers',
  rollInputs: { 'roll-1': 8 },
} as never;

/** One roll, as the table broadcasts it */
function aRollFrame(id: string, seq: number, characterId = 'char-1'): LiveEventMessage {
  return {
    type: 'event',
    sessionId: 'session-1',
    event: {
      id,
      seq,
      type: ROLL_EVENT,
      actorAccountId: 'account-2',
      at: 1_700_000_000_000,
      payload: { characterId, outcome: { ...OUTCOME, total: seq } },
    },
  } as LiveEventMessage;
}

/** Deliver one frame to everything listening */
function broadcast(frame: LiveEventMessage): void {
  act(() => {
    for (const listener of listeners) listener(frame);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  listeners = [];
  globalThis.fetch = original;
  useUIStore.setState({ rollHistory: [] });
  useConfigStore.setState({ config: RULES, isLoaded: true });
  useCharacterStore.setState({
    characters: [],
    isLoaded: true,
    tableCharacter: aCharacter(),
    tableSessionId: 'session-1',
  });
});

/** What `renderHook` hands back, narrowed to this hook */
type Rendered = { current: ReturnType<typeof useRoller> };

/**
 * The roll handler a Player gets, insisted upon
 *
 * `handleRoll` became optional at TICKET-DM-05: it is `undefined` for the **table's DM**, whose roll
 * `rollDice.ts` refuses. Every case here is the character's own Player — `tableCharacterOwnerId` is
 * never set to somebody else — so an absent handler is a regression rather than a state to handle,
 * and this says so by name instead of the call sites reaching past the type.
 *
 * @param rendered The rendered hook, read fresh at each call site
 * @returns The handler, ready to be thrown inside the caller's own `act`
 */
function rollerOf(rendered: Rendered): (rollId: string) => void {
  const handleRoll = rendered.current.handleRoll;
  if (handleRoll === undefined) throw new Error('Expected a roll handler on a Player’s own sheet');

  return handleRoll;
}

describe('rolling at a table', () => {
  it('asks the server for the roll and adopts what came back', async () => {
    respondWith([], OUTCOME);

    const { result } = renderHook(() => useRoller('char-1', CALCULATED));
    await waitFor(() => expect(requests().length).toBeGreaterThan(0));

    const handleRoll = rollerOf(result);
    await act(async () => {
      handleRoll('roll-1');
    });

    await waitFor(() => expect(result.current.results['roll-1']).toBeDefined());

    const posted = requests().find(([method]) => method === 'POST');
    expect(posted?.[1]).toBe('/api/characters/char-1/roll');
    expect(result.current.results['roll-1'].total).toBe(7);
  });

  it('sends which roll and nothing else — no total, no dice', async () => {
    // A client that could report its own result is a client that could report any result, and the
    // server refuses one that tries. This is the other half of that, at the only place that sends.
    respondWith([], OUTCOME);

    const { result } = renderHook(() => useRoller('char-1', CALCULATED));

    const handleRoll = rollerOf(result);
    await act(async () => {
      handleRoll('roll-1');
    });
    await waitFor(() => expect(result.current.results['roll-1']).toBeDefined());

    const post = vi
      .mocked(globalThis.fetch)
      .mock.calls.find(([, init]) => (init as RequestInit)?.method === 'POST');

    expect(JSON.parse((post?.[1] as RequestInit).body as string)).toEqual({ rollId: 'roll-1' });
  });

  it('shows the table’s log before anything has been rolled in this tab', async () => {
    // The property `useUIStore`'s in-memory list never had: a roll made yesterday, or in another
    // browser, is there when the sheet opens
    respondWith([LOGGED], OUTCOME);

    const { result } = renderHook(() => useRoller('char-1', CALCULATED));

    await waitFor(() => expect(result.current.history).toHaveLength(1));
    expect(result.current.history[0].total).toBe(7);
    // Narrowed by the route rather than in the browser: a table-wide window filtered afterwards is
    // how a Player's own rolls fall off their own sheet once the log is capped
    expect(requests()[0]).toEqual(['GET', '/api/sessions/session-1/rolls?rolledBy=account-1']);
  });

  it('puts the roll it just made at the top without re-reading the whole log', async () => {
    respondWith([], { ...OUTCOME, id: 'event-9', seq: 9, characterId: 'char-1' });

    const { result } = renderHook(() => useRoller('char-1', CALCULATED));
    await waitFor(() => expect(requests()).toHaveLength(1));

    const handleRoll = rollerOf(result);
    await act(async () => {
      handleRoll('roll-1');
    });
    await waitFor(() => expect(result.current.history).toHaveLength(1));

    // One read on mount and one POST — and no second read for the row the answer already carried
    expect(requests().filter(([method]) => method === 'GET')).toHaveLength(1);
    expect(result.current.history[0].id).toBe('event-9');
  });

  it('leaves another character’s rolls out of this sheet’s list', async () => {
    respondWith([LOGGED, { ...LOGGED, id: 'event-2', characterId: 'char-2' }], OUTCOME);

    const { result } = renderHook(() => useRoller('char-1', CALCULATED));

    await waitFor(() => expect(result.current.history).toHaveLength(1));
    expect(result.current.history[0].characterId).toBe('char-1');
  });

  it('reports a refusal beside the roll and records nothing', async () => {
    respondWith(
      [],
      { error: { code: 'bad_request', message: 'This game has no such roll.' } },
      400
    );

    const { result } = renderHook(() => useRoller('char-1', CALCULATED));

    const handleRoll = rollerOf(result);
    await act(async () => {
      handleRoll('roll-1');
    });

    await waitFor(() => expect(result.current.errors['roll-1']).toBeDefined());
    expect(result.current.errors['roll-1']).toBe('This game has no such roll.');
    expect(result.current.results['roll-1']).toBeUndefined();
    expect(useUIStore.getState().rollHistory).toEqual([]);
  });

  it('never writes to the browser’s own roll history', async () => {
    respondWith([LOGGED], OUTCOME);

    const { result } = renderHook(() => useRoller('char-1', CALCULATED));

    const handleRoll = rollerOf(result);
    await act(async () => {
      handleRoll('roll-1');
    });
    await waitFor(() => expect(result.current.results['roll-1']).toBeDefined());

    // `useUIStore`'s list is local mode's and stays empty — the table's log is the server's
    expect(useUIStore.getState().rollHistory).toEqual([]);
  });
});

/** Wait for the mount read to have gone out */
async function untilRead(): Promise<void> {
  await waitFor(() => {
    const made = requests();

    expect(made.length).toBeGreaterThan(0);
  });
}

describe('a roll broadcast by the table (TICKET-LIVE-02)', () => {
  it('appears in the log without asking for it again', async () => {
    respondWith([], OUTCOME);

    const { result } = renderHook(() => useRoller('char-1', CALCULATED));
    await untilRead();

    expect(subscribe).toHaveBeenCalledWith('session-1');

    const rolled = aRollFrame('event-9', 9);
    broadcast(rolled);

    const { history } = result.current;

    expect(history).toHaveLength(1);
    expect(history[0].total).toBe(9);

    // One read on mount and nothing since: the frame *is* the update
    const made = requests();

    expect(made).toHaveLength(1);
  });

  it('keeps a roll that arrived while the log was being read', async () => {
    // **The window is real, not theoretical**: the server's fan-out is synchronous with the write,
    // so a roll made after the `SELECT` ran and before its response landed reaches the browser as a
    // frame *first*. A mount read that replaced state would throw it away and leave the log missing
    // its newest row until something else happened.
    let answer: (rolls: unknown[]) => void = () => undefined;

    globalThis.fetch = vi.fn(
      async () =>
        new Promise<Response>((resolve) => {
          answer = (rolls) => {
            const body = JSON.stringify({ rolls });
            const response = new Response(body, {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });

            resolve(response);
          };
        })
    ) as unknown as typeof fetch;

    const { result } = renderHook(() => useRoller('char-1', CALCULATED));
    await untilRead();

    const live = aRollFrame('event-live', 7);
    broadcast(live);

    await act(async () => {
      answer([LOGGED]);
    });

    const ids = result.current.history.map((roll) => roll.id);

    expect(ids).toEqual(['event-live', LOGGED.id]);
  });

  it('orders by seq, not by the order the frames arrived', async () => {
    respondWith([], OUTCOME);

    const { result } = renderHook(() => useRoller('char-1', CALCULATED));
    await untilRead();

    // Two rolls made at once, delivered out of order — only the log knows which came first
    const second = aRollFrame('event-2', 2);
    const third = aRollFrame('event-3', 3);

    broadcast(second);
    broadcast(third);

    // Read by the Event id rather than by `seq`, because what the hook hands back is a
    // `RollResult` — the sequence number is how the rows were *ordered*, not something the sheet
    // shows, and a cast to reach it would be the test asserting on an implementation detail
    const order = result.current.history.map((roll) => roll.id);

    expect(order).toEqual(['event-3', 'event-2']);
  });

  it('shows a Player’s own roll once, though it arrives twice', async () => {
    respondWith([], LOGGED);

    const { result } = renderHook(() => useRoller('char-1', CALCULATED));
    await untilRead();

    const handleRoll = rollerOf(result);
    await act(async () => {
      handleRoll('roll-1');
    });
    await waitFor(() => {
      const shown = result.current.results['roll-1'];

      expect(shown).toBeDefined();
    });

    // The same Event the `POST` answered with, now coming back round the room. Deduplicated by the
    // Event's id, which is the id the route minted and the row carries.
    const echoed = aRollFrame(LOGGED.id, LOGGED.seq);
    broadcast(echoed);

    const { history } = result.current;

    expect(history).toHaveLength(1);
  });

  it('ignores a roll made by somebody else’s character', async () => {
    respondWith([], OUTCOME);

    const { result } = renderHook(() => useRoller('char-1', CALCULATED));
    await untilRead();

    const somebodyElse = aRollFrame('event-4', 4, 'another-character');
    broadcast(somebodyElse);

    // This hook is one character's; the table-wide feed is TICKET-DM-04's
    const { history } = result.current;

    expect(history).toEqual([]);
  });

  it('joins no room for the table’s DM, whose log is empty for a reason', () => {
    // **The half-filled log this ticket ruled out.** A DM's mount read is narrowed to their own
    // Account and comes back empty (the gap DM-05 recorded and DM-04 owns), so subscribing anyway
    // would append rows from socket-open onward and turn an empty panel into one that looks right
    // and silently omits everything before it. The DM's *character* feed is unaffected — that is
    // `useTableCharacterFeed`'s subscription, and the connection counts its rooms.
    useCharacterStore.setState({ tableCharacterOwnerId: 'somebody-else' });

    const { result } = renderHook(() => useRoller('char-1', CALCULATED));

    expect(subscribe).not.toHaveBeenCalled();

    const rolled = aRollFrame('event-9', 9);
    broadcast(rolled);

    const { history } = result.current;

    expect(history).toEqual([]);
  });

  it('joins no room for a character in this browser', () => {
    useCharacterStore.setState({
      characters: [aCharacter({ id: 'local-1' })],
      tableCharacter: null,
      tableSessionId: null,
    });

    renderHook(() => useRoller('local-1', CALCULATED, { rng: () => 0.5 }));

    expect(subscribe).not.toHaveBeenCalled();
  });
});

describe('rolling a character in this browser', () => {
  it('asks the network nothing, even while another character is open at a table', async () => {
    useCharacterStore.setState({
      characters: [aCharacter({ id: 'local-1' })],
      tableCharacter: aCharacter({ id: 'char-1' }),
      tableSessionId: 'session-1',
    });

    globalThis.fetch = vi.fn(() => {
      throw new Error('local mode must not reach the network');
    }) as unknown as typeof fetch;

    const { result } = renderHook(() =>
      useRoller('local-1', { name: 'Local', rollInputs: { 'roll-1': 8 } } as never, {
        rng: () => 0.5,
      })
    );

    const handleRoll = rollerOf(result);
    act(() => {
      handleRoll('roll-1');
    });

    expect(result.current.results['roll-1'].notation).toBe('1D6 + 2');
    expect(useUIStore.getState().rollHistory).toHaveLength(1);
  });
});
