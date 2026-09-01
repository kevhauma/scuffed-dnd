/**
 * Who may move a character's kit (TICKET-DM-02)
 *
 * `usePassiveHandout.test.ts`'s shape one collection over, with one difference that is the whole
 * reason this hook is not that one: **a Player at a table keeps every one of these acts.** Equipping
 * your own helmet is a player action and always was (PLY-01), so the two answers here are *the
 * Player's four* and *the DM's four* rather than *some* and *none*.
 *
 * The store actions are stubbed rather than driven; what each pair then does is
 * `characterStore.test.ts`'s and `characterStore.table.test.ts`'s.
 *
 * **Validates: v3 Req 42.5, 42.7; Requirements 12.2, 12.3, 12.5, 12.6**
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
import { useInventoryActs } from './useInventoryActs';

const RULES = { id: 'config1', items: [] } as unknown as Configuration;

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

/** The picks the builder assembles, minus the identity each root mints for itself */
const DRAFT = { templateId: 'item-axe', materialId: 'mat-iron', materialLevel: 10 };

describe('useInventoryActs', () => {
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

  it('gives a Player the four on their own local sheet', () => {
    const { result } = renderHook(() => useInventoryActs('char1'));

    expect(result.current).not.toBeNull();
  });

  it('gives a Player at a table the four as well, unlike the passive handout', () => {
    // The difference this hook exists to express: there *is* a player route to the pack, and
    // TICKET-DM-02 changed nothing about it
    signedInAs('account-player');
    atTable('account-player');

    const { result } = renderHook(() => useInventoryActs('char1'));

    expect(result.current).not.toBeNull();
  });

  it('gives nothing on a sheet with no ruleset loaded to check a Player’s write against', () => {
    useConfigStore.setState({ config: null });

    const { result } = renderHook(() => useInventoryActs('char1'));

    expect(result.current).toBeNull();
  });

  it('routes a Player’s four through their own store actions, ruleset and all', () => {
    const equipItem = vi.fn();
    const unequipItem = vi.fn();
    const buildItem = vi.fn();
    const discardItem = vi.fn();
    useCharacterStore.setState({ equipItem, unequipItem, buildItem, discardItem });

    const { result } = renderHook(() => useInventoryActs('char1'));
    result.current?.equip('head_gear', 'build-77');
    result.current?.unequip('head_gear');
    result.current?.build(DRAFT);
    result.current?.discard('build-77');

    expect(equipItem).toHaveBeenCalledWith('char1', 'head_gear', 'build-77', RULES);
    expect(unequipItem).toHaveBeenCalledWith('char1', 'head_gear');
    expect(buildItem).toHaveBeenCalledWith('char1', DRAFT, RULES);
    expect(discardItem).toHaveBeenCalledWith('char1', 'build-77', RULES);
  });

  it('routes a DM’s four through the dm- store actions, which take no ruleset', () => {
    /*
     * No `Configuration` in any of the four: the server runs the Kernel rule against the
     * **Snapshot** and hands the answer back (D5), so a client-side ruleset here would be a second
     * opinion nobody reads — and, on a stale one, a wrong one.
     */
    const dmEquipItem = vi.fn();
    const dmUnequipItem = vi.fn();
    const dmBuildItem = vi.fn();
    const dmDiscardItem = vi.fn();
    const equipItem = vi.fn();
    useCharacterStore.setState({
      dmEquipItem,
      dmUnequipItem,
      dmBuildItem,
      dmDiscardItem,
      equipItem,
    });
    signedInAs('account-dm');
    atTable('account-player');

    const { result } = renderHook(() => useInventoryActs('char1'));
    result.current?.equip('head_gear', 'build-77');
    result.current?.unequip('head_gear');
    result.current?.build(DRAFT);
    result.current?.discard('build-77');

    expect(dmEquipItem).toHaveBeenCalledWith('char1', 'head_gear', 'build-77');
    expect(dmUnequipItem).toHaveBeenCalledWith('char1', 'head_gear');
    expect(dmBuildItem).toHaveBeenCalledWith('char1', DRAFT);
    expect(dmDiscardItem).toHaveBeenCalledWith('char1', 'build-77');
    expect(equipItem).not.toHaveBeenCalled();
  });

  it('gives the DM the four even with no ruleset loaded, since the server owns the rule', () => {
    // The one asymmetry with the Player's half, and it is deliberate: a DM's write is checked
    // against the Snapshot the server holds, so a browser without a ruleset is not a reason to
    // withhold the controls
    useConfigStore.setState({ config: null });
    signedInAs('account-dm');
    atTable('account-player');

    const { result } = renderHook(() => useInventoryActs('char1'));

    expect(result.current).not.toBeNull();
  });
});
