/**
 * Who may hand out a passive (TICKET-PAS-01)
 *
 * The ticket's one real question, tested where it is answered. Three readers and three answers:
 * a Player on their **own local sheet** writes it themselves (signed out there is no DM), a Player
 * **at a table** may not, and the table's **DM** may — through different store actions with a
 * different guard behind them.
 *
 * The store actions themselves are stubbed here rather than driven, because what this hook decides
 * is *which pair* — the pairs' own behaviour is `characterStore.test.ts`'s and
 * `characterStore.table.test.ts`'s.
 *
 * **Validates: v4 systems/14**
 */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Configuration } from '#shared/types/config';

vi.mock('../../auth/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../../../services/storage', () => ({
  loadConfiguration: vi.fn(() => null),
  saveConfiguration: vi.fn(),
  loadCharacters: vi.fn(() => []),
  saveCharacters: vi.fn(),
  isStorageAvailable: vi.fn(() => true),
}));

import { useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';
import { useAuth } from '../../auth/useAuth';
import { usePassiveHandout } from './usePassiveHandout';

const RULES = { id: 'config1', passives: [] } as unknown as Configuration;

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

describe('usePassiveHandout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCharacterStore.setState({
      characters: [],
      tableCharacter: null,
      tableCharacterOwnerId: null,
      isActing: false,
    });
    useConfigStore.setState({ config: RULES });
    signedOut();
  });

  it('gives a Player the pair on their own local sheet, where there is no DM', () => {
    const { result } = renderHook(() => usePassiveHandout('char1', false));

    expect(result.current).not.toBeNull();
  });

  it('gives a Player at a table nothing at all', () => {
    // The handout is the DM's there, and an absent control says *not yours* where a disabled one
    // would say *not now*
    signedInAs('account-player');
    atTable('account-player');

    const { result } = renderHook(() => usePassiveHandout('char1', true));

    expect(result.current).toBeNull();
  });

  it('gives the table’s DM the pair for somebody else’s character', () => {
    // *At a table and not mine* has exactly one meaning: the server opens a character to its owner
    // or to the DM of its table and nobody else
    signedInAs('account-dm');
    atTable('account-player');

    const { result } = renderHook(() => usePassiveHandout('char1', true));

    expect(result.current).not.toBeNull();
  });

  it('gives nothing while the browser has not resolved its cookie yet', () => {
    // A frame of the DM's controls on a Player's own sheet is what this prevents
    atTable('account-player');

    const { result } = renderHook(() => usePassiveHandout('char1', true));

    expect(result.current).toBeNull();
  });

  it('gives nothing on a local sheet with no ruleset loaded', () => {
    // The grant rule checks the catalog, so there is nothing to check against
    useConfigStore.setState({ config: null });

    const { result } = renderHook(() => usePassiveHandout('char1', false));

    expect(result.current).toBeNull();
  });

  it('routes a local grant through the Player’s own store action', () => {
    const grantPassive = vi.fn();
    useCharacterStore.setState({ grantPassive });

    const { result } = renderHook(() => usePassiveHandout('char1', false));
    result.current?.grant('passive-charmed');

    expect(grantPassive).toHaveBeenCalledWith('char1', 'passive-charmed', RULES);
  });

  it('routes a DM grant through the dm- store action instead', () => {
    // The two pairs write the same field and are different acts, which is why they are named apart
    const dmGrantPassive = vi.fn();
    const grantPassive = vi.fn();
    useCharacterStore.setState({ dmGrantPassive, grantPassive });
    signedInAs('account-dm');
    atTable('account-player');

    const { result } = renderHook(() => usePassiveHandout('char1', true));
    result.current?.grant('passive-charmed');

    expect(dmGrantPassive).toHaveBeenCalledWith('char1', 'passive-charmed');
    expect(grantPassive).not.toHaveBeenCalled();
  });

  it('routes a DM revoke through the dm- store action, which takes no ruleset', () => {
    const dmRevokePassive = vi.fn();
    useCharacterStore.setState({ dmRevokePassive });
    signedInAs('account-dm');
    atTable('account-player');

    const { result } = renderHook(() => usePassiveHandout('char1', true));
    result.current?.revoke('passive-gone');

    expect(dmRevokePassive).toHaveBeenCalledWith('char1', 'passive-gone');
  });
});
