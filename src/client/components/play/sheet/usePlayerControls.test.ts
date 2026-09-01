/**
 * Who may make the sheet's own writes (TICKET-DM-05)
 *
 * `usePurseControls.test.ts`'s shape over six handlers instead of two, and the answers differ from
 * that hook's in the way that matters: the purse is the **DM's** at a table, and these six are the
 * **Player's** wherever the character lives. So there are three readers and only one of them is told
 * no.
 *
 * - A Player on their **own local sheet** — every handler, signed out, no DM in the world.
 * - A Player **at a table** — every handler still. `requireCharacterPlayer` is the writer rule minus
 *   the DM, not minus the table, and this is the case most likely to break silently if somebody later
 *   reaches for *is this at a table* instead of *whose character is this*.
 * - The table's **DM** — none, because every one of the six routes refuses them.
 *
 * The store actions are stubbed rather than driven: what this hook decides is *whether* the handlers
 * exist and which store action each reaches. What each action then does is `characterStore.test.ts`'s
 * and `characterStore.table.test.ts`'s.
 *
 * **Validates: v3 Req 41.1, 42.7, 49.10**
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

import type { Character } from '#shared/types/character';
import type { Configuration } from '#shared/types/config';
import { useCharacterStore } from '../../../stores/characterStore';
import { useAuth } from '../../auth/useAuth';
import { usePlayerControls } from './usePlayerControls';

/** Enough of a ruleset for the handlers to be handed one — none of them reads it here */
const RULES = { id: 'config1', name: 'Test', skills: [] } as unknown as Configuration;

/** Enough of a character for the handlers to name one */
const ARIA = { id: 'char1', name: 'Aria' } as unknown as Character;

/** Nobody is signed in — the local sheet's ordinary state (D6) */
function signedOut() {
  const session = { accountId: null, isPending: false } as unknown as ReturnType<typeof useAuth>;
  vi.mocked(useAuth).mockReturnValue(session);
}

/** Signed in as `accountId`, which is what tells a DM's view from a Player's */
function signedInAs(accountId: string) {
  const session = { accountId, isPending: false } as unknown as ReturnType<typeof useAuth>;
  vi.mocked(useAuth).mockReturnValue(session);
}

/** Put the character at a table owned by `ownerAccountId` */
function atTable(ownerAccountId: string) {
  const open = { id: 'char1', name: 'Aria' } as unknown as Character;
  useCharacterStore.setState({ tableCharacter: open, tableCharacterOwnerId: ownerAccountId });
}

/** The hook as the sheet calls it */
function renderControls() {
  return renderHook(() => usePlayerControls('char1', ARIA, RULES));
}

/**
 * Every handler the sheet passes down, by name
 *
 * Enumerated rather than spot-checked, which is the ticket's first criterion read at hook level: a
 * seventh reader-dependent write added without a case here would slip through a test that only ever
 * asked about the stat spend.
 */
const HANDLERS = [
  'handleChangeStatValue',
  'handleAdjustStatValue',
  'handleResetStatValueToMax',
  'handleChangeInvestedPoints',
  'handleChangeInvestedSkillPoints',
  'handleSelectFocusSkill',
] as const;

describe('usePlayerControls', () => {
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

  it.each(HANDLERS)('should give a Player %s on their own local sheet', (handler) => {
    const { result } = renderControls();

    expect(result.current[handler]).toBeDefined();
  });

  it.each(HANDLERS)(
    'should give a Player %s at a table too, the writes being their own',
    (handler) => {
      // `requireCharacterPlayer` is the writer rule minus the **DM**, not minus the table — a Player
      // spends, moves their pools and picks their focus at a table exactly as they do at home
      signedInAs('account-player');
      atTable('account-player');

      const { result } = renderControls();

      expect(result.current[handler]).toBeDefined();
    }
  );

  it.each(HANDLERS)('should give the table’s DM no %s, the server refusing it', (handler) => {
    signedInAs('account-dm');
    atTable('account-player');

    const { result } = renderControls();

    expect(result.current[handler]).toBeUndefined();
  });

  it('should give nothing away while the browser has not resolved its cookie yet', () => {
    // The predicate says *no DM* until the cookie lands, so the Player's own controls are what a
    // half-resolved browser draws — the safe direction, and the one that cannot flash a DM's view
    atTable('account-player');

    const { result } = renderControls();

    expect(result.current.handleChangeInvestedPoints).toBeDefined();
  });

  it('should spend a stat point through the Player’s own store action', () => {
    const setInvestedStatPoints = vi.fn();
    useCharacterStore.setState({ setInvestedStatPoints });

    const { result } = renderControls();
    const invest = result.current.handleChangeInvestedPoints;
    invest?.('STR', 4);

    expect(setInvestedStatPoints).toHaveBeenCalledWith('char1', 'STR', 4, RULES);
  });

  it('should spend a skill point through the same store, out of the same pool', () => {
    const setInvestedSkillPoints = vi.fn();
    useCharacterStore.setState({ setInvestedSkillPoints });

    const { result } = renderControls();
    const invest = result.current.handleChangeInvestedSkillPoints;
    invest?.('STL', 2);

    expect(setInvestedSkillPoints).toHaveBeenCalledWith('char1', 'STL', 2, RULES);
  });

  it('should move a pool by a delta rather than doing the arithmetic itself', () => {
    const adjustCurrentStatValue = vi.fn();
    useCharacterStore.setState({ adjustCurrentStatValue });

    const { result } = renderControls();
    const adjust = result.current.handleAdjustStatValue;
    adjust?.('health', -7);

    expect(adjustCurrentStatValue).toHaveBeenCalledWith('char1', 'health', -7, RULES);
  });

  it('should send the whole focus list when one slot changes (TICKET-SKL-05)', () => {
    // Addressed by slot at the picker and stored as a list, so the store gets the picks that were
    // made and no sentinel for the ones that were not
    const setFocusSkills = vi.fn();
    useCharacterStore.setState({ setFocusSkills });

    const { result } = renderControls();
    const select = result.current.handleSelectFocusSkill;
    select?.(0, 'STL');

    expect(setFocusSkills).toHaveBeenCalledWith('char1', ['STL'], RULES);
  });

  it('should reach no store action at all for the DM, there being no handler to press', () => {
    const setInvestedStatPoints = vi.fn();
    useCharacterStore.setState({ setInvestedStatPoints });
    signedInAs('account-dm');
    atTable('account-player');

    const { result } = renderControls();

    expect(result.current.handleChangeInvestedPoints).toBeUndefined();
    expect(setInvestedStatPoints).not.toHaveBeenCalled();
  });
});
