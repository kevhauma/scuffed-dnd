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
import type { Character } from '#shared/types/character';
import type { Configuration } from '#shared/types/config';

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

beforeEach(() => {
  vi.clearAllMocks();
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
