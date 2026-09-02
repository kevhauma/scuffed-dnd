/**
 * The two placements cannot offer different actions or apply them differently
 * (TICKET-DM-04, v3 Req 49.7, 49.10)
 *
 * The ticket's second and third criteria, and the reason both are tests rather than prose: *one
 * definition* is a claim about code that stops being true silently. Four claims:
 *
 * - **The same Snapshot produces the same set on both surfaces** — asserted against the sheet hook's
 *   real output and the roster mapper's real output, not against one function called twice.
 * - **They move together.** Widening the Snapshot widens both, which is what makes the first claim
 *   about a shared derivation rather than about two lists that happen to match today.
 * - **The same kind of action issues the same request** on both, taken off the one table
 *   `quickActionRoutes.test.ts` already checks against `apiRouter` as text.
 * - **A `player` sees no action controls at all** — absent, not disabled (v3 Req 49.10) — and neither
 *   does a DM on their *own* character, whom `requireCharacterDM` refuses.
 *
 * **Validates: v3 Req 49.2, 49.7, 49.10**
 */

import { act, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../../auth/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../../live/useLiveRoom', () => ({ useLiveRoom: vi.fn(() => null) }));
vi.mock('../../../services/storage', () => ({
  loadConfiguration: vi.fn(() => null),
  saveConfiguration: vi.fn(),
  loadCharacters: vi.fn(() => []),
  saveCharacters: vi.fn(),
  isStorageAvailable: vi.fn(() => true),
}));

import type { Stat } from '#shared/types/config';
import { useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';
import { useAuth } from '../../auth/useAuth';
import { adjustmentVocabularyFrom } from '../../play/dm/adjustmentVocabulary';
import { useQuickActionBindings, useQuickActions } from '../../play/dm/useQuickActions';
import { QUICK_ACTION_KIND } from '../../play/shared/quickActions';
import { useCharacterSheet } from '../../play/sheet/useCharacterSheet';
import {
  DM_ACCOUNT,
  makeCharacter,
  makeDocument,
  makeSnapshot,
  makeTable,
  PLAYER_ACCOUNT,
} from './roster.fixtures';
import { toRosterView } from './rosterView';
import { SessionRoster } from './SessionRoster';
import type { SessionRosterState } from './useSessionRoster';

/** Signed in as somebody */
function signedInAs(accountId: string) {
  vi.mocked(useAuth).mockReturnValue({
    accountId,
    isPending: false,
  } as unknown as ReturnType<typeof useAuth>);
}

/** The sheet's own quick actions for the fixture character, as `useCharacterSheet` derives them */
function sheetActions(config = makeSnapshot()) {
  const character = makeCharacter();

  useConfigStore.setState({ config, isLoaded: true });
  useCharacterStore.setState({ characters: [character], isLoaded: true });

  const { result } = renderHook(() => useCharacterSheet(character.id));

  return result.current.quickActions;
}

/** …and the roster's, for the same character against the same Snapshot */
function rosterActions(config = makeSnapshot()) {
  const members = makeTable();
  const documents = [makeDocument()];
  const groups = toRosterView(members, documents, config, DM_ACCOUNT);
  const rows = groups.flatMap((group) => group.characters);

  return rows[0].quickActions;
}

/** A fourth resource, so the Snapshot can be widened and both placements watched */
const BREATH: Stat = {
  id: 'stat-breath',
  name: 'Breath',
  abbreviation: 'BRE',
  description: '',
  order: 3,
  countsTowardTotal: false,
  isResource: true,
  rounding: 'none',
  formula: '12',
};

/** The roster's state, defaulted to a table this reader runs */
function rosterState(
  overrides: Partial<Omit<SessionRosterState, 'remove' | 'transfer'>> = {}
): Omit<SessionRosterState, 'remove' | 'transfer'> {
  const snapshot = makeSnapshot();
  const members = makeTable();
  const documents = [makeDocument()];
  const groups = toRosterView(members, documents, snapshot, DM_ACCOUNT);
  const words = adjustmentVocabularyFrom(snapshot, snapshot.stats);

  return {
    groups,
    accountId: DM_ACCOUNT,
    isDm: true,
    words,
    rolls: [],
    areRollsPending: false,
    isPending: false,
    isBusy: false,
    error: null,
    isOpeningRules: false,
    makeCharacterHere: vi.fn(),
    openCharacter: vi.fn(),
    actsAsDm: () => true,
    adjustments: () => [],
    ...overrides,
  };
}

/** The roster, read by whoever a case says */
function renderRoster(overrides: Partial<Omit<SessionRosterState, 'remove' | 'transfer'>> = {}) {
  const state = rosterState(overrides);

  render(
    <SessionRoster
      sessionId="session-1"
      roster={state}
      canTransfer
      canCreate
      onRemove={vi.fn()}
      onTransfer={vi.fn()}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  signedInAs(DM_ACCOUNT);
  useCharacterStore.setState({ tableCharacter: null, tableCharacterOwnerId: null });
});

describe('one definition, two placements', () => {
  it('derives the same action set on the sheet and on the roster (v3 Req 49.7)', () => {
    const onTheSheet = sheetActions();
    const onTheRoster = rosterActions();

    expect(onTheRoster).toEqual(onTheSheet);
    // …and not vacuously: this ruleset has two pools, so there are eight actions to agree about
    expect(onTheSheet).toHaveLength(8);
  });

  it('moves both when the Snapshot gains a resource, rather than one of them', () => {
    const base = makeSnapshot();
    const widened = makeSnapshot({ stats: [...base.stats, BREATH] });

    const onTheSheet = sheetActions(widened);
    const onTheRoster = rosterActions(widened);

    expect(onTheRoster).toEqual(onTheSheet);
    expect(onTheSheet).toHaveLength(10);

    const labels = onTheRoster.map((action) => action.label);
    expect(labels).toContain('Damage Breath');
  });

  it('issues the identical request for each kind of action (v3 Req 49.3)', () => {
    // The sidebar's hook is gated on the store's open character; the roster's is not, because a
    // roster has none open. What must not differ is what each kind *sends*.
    const words = adjustmentVocabularyFrom(null, []);
    const character = makeCharacter();

    useCharacterStore.setState({
      tableCharacter: character as never,
      tableCharacterOwnerId: PLAYER_ACCOUNT,
    });

    const sidebar = renderHook(() => useQuickActions(character.id, [], words, 0));
    const row = renderHook(() => useQuickActionBindings(character.id, [], words, 0));

    expect(sidebar.result.current).not.toBeNull();
    expect(row.result.current.requests).toEqual(sidebar.result.current?.requests);
  });

  it('reaches the same store action with the same arguments from either placement', () => {
    const dmAdjustResource = vi.fn();
    const words = adjustmentVocabularyFrom(null, []);
    const character = makeCharacter();

    useCharacterStore.setState({
      tableCharacter: character as never,
      tableCharacterOwnerId: PLAYER_ACCOUNT,
      dmAdjustResource,
    });

    const actions = rosterActions();
    const damage = actions.find((action) => action.kind === QUICK_ACTION_KIND.DAMAGE);

    if (!damage) throw new Error('no damage action in the derived set');

    const sidebar = renderHook(() => useQuickActions(character.id, [], words, 0));
    const row = renderHook(() => useQuickActionBindings(character.id, [], words, 0));

    act(() => {
      sidebar.result.current?.apply(damage, 7);
    });
    act(() => {
      row.result.current.apply(damage, 7);
    });

    const calls = dmAdjustResource.mock.calls;

    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual(calls[0]);
    // …and it is a **delta**, so *take 7 off them* is seven off whatever the pool turned out to be
    expect(calls[0]).toEqual([character.id, damage.statId, -7]);
  });
});

describe('who the roster offers them to', () => {
  it('offers a DM the actions on somebody else’s character', () => {
    renderRoster();

    const offered = screen.getByRole('button', { name: 'Actions' });

    expect(offered).toBeTruthy();
  });

  it('offers a player none at all — absent, not disabled (v3 Req 49.10)', () => {
    renderRoster({ isDm: false, accountId: PLAYER_ACCOUNT, actsAsDm: () => false });

    const offered = screen.queryByRole('button', { name: 'Actions' });
    // …and the roster really did render, so this is not passing by showing nothing at all
    const drawn = screen.getByText('Quackers');

    expect(offered).toBeNull();
    expect(drawn).toBeTruthy();
  });

  it('offers a DM none on their own character, whom the server refuses them', () => {
    // `requireCharacterDM` is `requireCharacterWriter` minus the owner, so a DM pressing a `dm-`
    // action on their own sheet is refused a 404 — a row offering one would be offering a button
    // that cannot work. This case proves the *surface* honours the predicate; the predicate itself
    // is `actsAsDungeonMasterOver`, tested directly in `useSessionRoster.test.ts`. The stub below
    // is deliberately a copy: an earlier comment here claimed it was the real rule, which meant
    // deleting the *and not mine* clause failed nothing at all.
    const snapshot = makeSnapshot();
    const members = makeTable();
    const mine = makeDocument({ ownerAccountId: DM_ACCOUNT });
    const groups = toRosterView(members, [mine], snapshot, DM_ACCOUNT);

    renderRoster({
      groups,
      actsAsDm: (ownerAccountId) => ownerAccountId !== DM_ACCOUNT,
    });

    const offered = screen.queryByRole('button', { name: 'Actions' });
    // …and the row is drawn, so the DM still reads their own character's numbers
    const drawn = screen.getByText('Quackers');

    expect(offered).toBeNull();
    expect(drawn).toBeTruthy();
  });
});
