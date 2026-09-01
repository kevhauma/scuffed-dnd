/**
 * Who may change a character's money (TICKET-DM-02)
 *
 * `usePassiveHandout.test.ts`'s shape one field over, and the same three readers with three
 * answers: a Player on their **own local sheet** writes their own purse (signed out there is no DM),
 * a Player **at a table** may not — there is no player route to a purse at all — and the table's
 * **DM** may, through the `dm-` pair this ticket added.
 *
 * The store actions are stubbed rather than driven, because what this hook decides is *which pair*.
 * What each pair then does is `characterStore.test.ts`'s and `characterStore.table.test.ts`'s.
 *
 * **Validates: v3 Req 42.5, 42.7, 43.1**
 */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../auth/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../../../services/storage', () => ({
  loadConfiguration: vi.fn(() => null),
  saveConfiguration: vi.fn(),
  loadCharacters: vi.fn(() => []),
  saveCharacters: vi.fn(),
  isStorageAvailable: vi.fn(() => true),
}));

import { useCharacterStore } from '../../../stores/characterStore';
import { useAuth } from '../../auth/useAuth';
import { usePurseControls } from './usePurseControls';

/** Nobody is signed in — the local sheet's ordinary state (D6) */
function signedOut() {
  vi.mocked(useAuth).mockReturnValue({
    accountId: null,
    isPending: false,
  } as unknown as ReturnType<typeof useAuth>);
}

/** Signed in as `accountId`, which is what tells a DM's view from a Player's */
function signedInAs(accountId: string) {
  vi.mocked(useAuth).mockReturnValue({
    accountId,
    isPending: false,
  } as unknown as ReturnType<typeof useAuth>);
}

/** Put a character at a table owned by `ownerAccountId` */
function atTable(ownerAccountId: string) {
  useCharacterStore.setState({
    tableCharacter: { id: 'char1', name: 'Aria' } as never,
    tableCharacterOwnerId: ownerAccountId,
  });
}

describe('usePurseControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCharacterStore.setState({
      characters: [],
      tableCharacter: null,
      tableCharacterOwnerId: null,
      isActing: false,
    });
    signedOut();
  });

  it('gives a Player the pair on their own local sheet, where there is no DM', () => {
    const { result } = renderHook(() => usePurseControls('char1', false));

    expect(result.current).not.toBeNull();
  });

  it('gives a Player at a table nothing, because coin is handed out at the table', () => {
    // v3 Req 42.5. The card they are shown is the amount with no entry box — a display rather than
    // a disabled control, which is the distinction criterion 6 draws
    signedInAs('account-player');
    atTable('account-player');

    const { result } = renderHook(() => usePurseControls('char1', true));

    expect(result.current).toBeNull();
  });

  it('gives the table’s DM the pair for somebody else’s character', () => {
    signedInAs('account-dm');
    atTable('account-player');

    const { result } = renderHook(() => usePurseControls('char1', true));

    expect(result.current).not.toBeNull();
  });

  it('gives nothing while the browser has not resolved its cookie yet', () => {
    // A frame of the DM's purse box on a Player's own sheet is what this prevents
    atTable('account-player');

    const { result } = renderHook(() => usePurseControls('char1', true));

    expect(result.current).toBeNull();
  });

  it('routes a local set and adjust through the Player’s own store actions', () => {
    const setPurse = vi.fn();
    const adjustPurse = vi.fn();
    useCharacterStore.setState({ setPurse, adjustPurse });

    const { result } = renderHook(() => usePurseControls('char1', false));
    result.current?.set(340);
    result.current?.adjust(-12);

    expect(setPurse).toHaveBeenCalledWith('char1', 340);
    expect(adjustPurse).toHaveBeenCalledWith('char1', -12);
  });

  it('routes a DM set and adjust through the dm- store actions instead', () => {
    // The two pairs write the same field and are different acts — one is somebody moving a number
    // on their own sheet, the other is the DM moving somebody else's and is logged as such
    const dmSetPurse = vi.fn();
    const dmAdjustPurse = vi.fn();
    const setPurse = vi.fn();
    useCharacterStore.setState({ dmSetPurse, dmAdjustPurse, setPurse });
    signedInAs('account-dm');
    atTable('account-player');

    const { result } = renderHook(() => usePurseControls('char1', true));
    result.current?.set(340);
    result.current?.adjust(-12);

    expect(dmSetPurse).toHaveBeenCalledWith('char1', 340);
    expect(dmAdjustPurse).toHaveBeenCalledWith('char1', -12);
    expect(setPurse).not.toHaveBeenCalled();
  });
});
