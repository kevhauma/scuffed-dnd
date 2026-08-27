/**
 * Opening a sheet for a character that lives on the server (TICKET-PLY-01)
 *
 * Two claims, and the first is the one D6 rests on: **a signed-out browser asks the server nothing**,
 * proven with `fetch` stubbed to *throw* rather than counted, because a hook that fetched and
 * swallowed the answer would satisfy a call count and still have made local mode reach the network.
 *
 * The second is the ordering: the character says which table it plays at and the table says which
 * rules it is priced by, so the two reads are sequential — and the flag has to stay true across both
 * or the sheet renders *Different Ruleset Loaded* in between, which is a real state and the wrong
 * answer.
 *
 * **Validates: v3 Req 36.2, 40.4, 41.1**
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = { accountId: null as string | null, email: null, isPending: false, isSignedIn: false };
vi.mock('../../auth/useAuth', () => ({ useAuth: () => auth }));

const openTableCharacter = vi.fn(async () => 'session-1' as string | null);
const openSessionSnapshot = vi.fn(async () => true);

let storeState = {
  isLoaded: true,
  characters: [] as { id: string }[],
  tableCharacter: null as { id: string } | null,
  openTableCharacter,
};

vi.mock('../../../stores/characterStore', () => ({
  useCharacterStore: (selector: (state: typeof storeState) => unknown) => selector(storeState),
}));

vi.mock('../../../stores/configStore', () => ({
  useConfigStore: (selector: (state: { openSessionSnapshot: unknown }) => unknown) =>
    selector({ openSessionSnapshot }),
}));

import { useOpenTableCharacter } from './useOpenTableCharacter';

beforeEach(() => {
  vi.clearAllMocks();
  openTableCharacter.mockResolvedValue('session-1');
  auth.isSignedIn = false;
  auth.accountId = null;
  storeState = { isLoaded: true, characters: [], tableCharacter: null, openTableCharacter };
});

describe('useOpenTableCharacter', () => {
  it('asks the server nothing while nobody is signed in', () => {
    globalThis.fetch = vi.fn(() => {
      throw new Error('local mode must not reach the network');
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useOpenTableCharacter('character-1'));

    expect(result.current).toBe(false);
    expect(openTableCharacter).not.toHaveBeenCalled();
  });

  it('asks the server nothing for a character this browser already holds', () => {
    auth.isSignedIn = true;
    storeState.characters = [{ id: 'character-1' }];

    renderHook(() => useOpenTableCharacter('character-1'));

    expect(openTableCharacter).not.toHaveBeenCalled();
  });

  it('waits for hydration, so a local character is never fetched by mistake', () => {
    auth.isSignedIn = true;
    storeState.isLoaded = false;

    renderHook(() => useOpenTableCharacter('character-1'));

    expect(openTableCharacter).not.toHaveBeenCalled();
  });

  it('reads the character, then the rules its table plays by, and reports while it does', async () => {
    auth.isSignedIn = true;
    auth.accountId = 'account-1';

    const { result } = renderHook(() => useOpenTableCharacter('character-1'));

    expect(result.current).toBe(true);

    await waitFor(() => expect(result.current).toBe(false));

    expect(openTableCharacter).toHaveBeenCalledWith('character-1');
    expect(openSessionSnapshot).toHaveBeenCalledWith('session-1');
  });

  it('stops rather than opening a Snapshot when the character could not be read', async () => {
    auth.isSignedIn = true;
    openTableCharacter.mockResolvedValue(null);

    const { result } = renderHook(() => useOpenTableCharacter('character-1'));
    await waitFor(() => expect(result.current).toBe(false));

    // Navigating on would drop the Player into a sheet running against whatever was already open —
    // the mistake `useSessionCharacters` avoids on the way in, and the same one here
    expect(openSessionSnapshot).not.toHaveBeenCalled();
  });

  it('does not read again once the character is open', async () => {
    auth.isSignedIn = true;

    const { rerender, result } = renderHook(() => useOpenTableCharacter('character-1'));
    await waitFor(() => expect(result.current).toBe(false));

    act(() => {
      storeState = { ...storeState, tableCharacter: { id: 'character-1' } };
    });
    rerender();

    expect(openTableCharacter).toHaveBeenCalledTimes(1);
  });

  it('settles even though its own success re-runs the effect', async () => {
    // **The defect the browser check found.** Opening the character sets `tableCharacter`, which
    // flips `isOpen`, which is a dependency — so the effect re-runs *while the first run is still
    // in flight*. The first draft cleaned up with a `cancelled` flag and skipped its
    // `setIsOpening(false)` when cancelled, so the flag never cleared and the sheet sat on
    // "Opening this character…" with two successful 200s behind it. Reproduced here by having the
    // store flip mid-promise, exactly as the real one does.
    auth.isSignedIn = true;
    openTableCharacter.mockImplementation(async () => {
      storeState = { ...storeState, tableCharacter: { id: 'character-1' } };
      return 'session-1';
    });

    const { result, rerender } = renderHook(() => useOpenTableCharacter('character-1'));

    expect(result.current).toBe(true);

    await waitFor(() => {
      rerender();
      expect(result.current).toBe(false);
    });

    // …and the re-run must not start a second read
    expect(openTableCharacter).toHaveBeenCalledTimes(1);
  });
});
