/**
 * The session roster (TICKET-DM-04, replacing TICKET-GAM-04's lobby and TICKET-CHAR-04's list)
 *
 * **Every case from both retired files lives here**, because the surface they tested was merged
 * rather than removed — v3 Req 49.8 asks for exactly one member list in the application, and a
 * roster with one row per Character *is* the character list. What is added is the half neither could
 * assert: the numbers.
 *
 * Six claims:
 *
 * - **The rows carry what a DM reads mid-fight** — owner, level, unspent points and every resource's
 *   current-versus-maximum (v3 Req 49.8), all of it derived from the Snapshot.
 * - **A value that cannot be calculated chips** rather than showing a confident number, which in a
 *   dense grid is the difference between one obvious gap and one quiet lie among twenty numbers.
 * - **What each reader may do to whom** is the server's rule drawn rather than guessed: a player sees
 *   *Leave* on their own row and nothing on anybody else's; a DM sees *Remove* and *Hand over* on
 *   everybody else's and **neither on their own** (v3 Req 39.6).
 * - **The connection column is real, and still says *unknown* when that is the truth**
 *   (TICKET-LIVE-03) — a live feed produces *Connected* and *Away*, and a feed that is down goes
 *   straight back to *unknown*, because *Away* is a claim about somebody that a dead socket cannot
 *   support.
 * - **Every action confirms first**, and the sentence says that nothing is deleted.
 * - **A departed player's characters are still shown** — and now with their numbers, which the lobby
 *   could not give them.
 *
 * The room's feed is mocked, the way a component test mocks a store: what is under test is the
 * roster's rendering of a decided view. That the view is right is `useLiveRoom`'s own test, and the
 * **judgement** — never *away* off a dead connection — is `presenceStateOf`, exercised for real here
 * rather than mocked.
 *
 * **Validates: v3 Req 37.5, 39.3, 39.4, 39.5, 39.6, 39.7, 40.4, 40.6, 44.8, 49.7, 49.8**
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../live/useLiveRoom', () => ({ useLiveRoom: vi.fn() }));
vi.mock('../../../services/storage', () => ({
  loadConfiguration: vi.fn(() => null),
  saveConfiguration: vi.fn(),
  loadCharacters: vi.fn(() => []),
  saveCharacters: vi.fn(),
  isStorageAvailable: vi.fn(() => true),
}));

import type { Stat } from '#shared/types/config';
import { LIVE_STATUS, type LiveRoomView } from '../../../services/liveSocket';
import { useLiveRoom } from '../../live/useLiveRoom';
import { adjustmentVocabularyFrom } from '../../play/dm/adjustmentVocabulary';
import {
  DEPARTED_ACCOUNT,
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

/** A feed in some state, as the connection would report it */
function roomView(overrides: Partial<LiveRoomView> = {}): LiveRoomView {
  return {
    status: LIVE_STATUS.LIVE,
    presentAccountIds: [],
    resyncAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // No feed at all is the default, so every case that is not about presence renders what a
  // signed-out reader would see
  vi.mocked(useLiveRoom).mockReturnValue(null);
});

/** The roster's state for a given table, defaulted to one the reader runs */
function rosterState(
  overrides: Partial<Omit<SessionRosterState, 'remove' | 'transfer'>> = {},
  documents = [makeDocument()],
  snapshot = makeSnapshot()
): Omit<SessionRosterState, 'remove' | 'transfer'> {
  const members = makeTable();
  // **Derived from the reader the case names, not from a constant.** `isYou` lives on the group,
  // because whose row it is is a fact about the list rather than about each component that draws
  // one — so a case that only overrode `accountId` would render the DM's affordances and claim to
  // be testing a player's.
  const reader = overrides.accountId ?? DM_ACCOUNT;
  const groups = toRosterView(members, documents, snapshot, reader);
  const words = adjustmentVocabularyFrom(snapshot, snapshot.stats);

  return {
    groups,
    accountId: reader,
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
    actsAsDm: (ownerAccountId: string) => ownerAccountId !== DM_ACCOUNT,
    adjustments: () => [],
    ...overrides,
  };
}

/** The roster, read by whoever a case says */
function renderRoster(
  overrides: Partial<Omit<SessionRosterState, 'remove' | 'transfer'>> = {},
  props: Partial<React.ComponentProps<typeof SessionRoster>> = {},
  documents = [makeDocument()],
  snapshot = makeSnapshot()
) {
  const onRemove = vi.fn();
  const onTransfer = vi.fn();
  const state = rosterState(overrides, documents, snapshot);

  render(
    <SessionRoster
      sessionId="session-1"
      roster={state}
      canTransfer
      canCreate
      onRemove={onRemove}
      onTransfer={onTransfer}
      {...props}
    />
  );

  return { onRemove, onTransfer, state };
}

/** Answer the confirmation that is open */
function confirmWith(verb: string) {
  fireEvent.click(screen.getByRole('button', { name: verb }));
}

describe('SessionRoster — who is here', () => {
  it('names everybody with their role and what they are playing', () => {
    renderRoster();

    expect(screen.getByText('Runs this game')).toBeTruthy();
    expect(screen.getByText('Player')).toBeTruthy();
    expect(screen.getByText('Quackers')).toBeTruthy();
    // A Member playing nothing says so rather than showing an empty gap
    expect(screen.getByText('No character yet')).toBeTruthy();
  });

  it('marks which row is yours', () => {
    renderRoster();

    expect(screen.getByText(/The DM \(you\)/)).toBeTruthy();
  });

  it('shows a refusal where the reader is looking', () => {
    renderRoster({ error: 'You run this game, so you cannot leave it.' });

    expect(screen.getByRole('alert').textContent).toContain('cannot leave it');
  });

  it('waits rather than showing an empty table', () => {
    renderRoster({ isPending: true, groups: [] });

    expect(screen.getByText('Checking who is here…')).toBeTruthy();
  });

  it('says a character is priced by this table’s copy of the rules', () => {
    // The thing a Player has to know before they spend an evening on one (D7)
    renderRoster();

    expect(screen.getByText(/copy of the rules this game plays by/)).toBeTruthy();
  });
});

describe('SessionRoster — the numbers (v3 Req 49.8)', () => {
  it('shows each character’s level, unspent points and every resource', () => {
    renderRoster();

    const level = screen.getByText('Level');
    const points = screen.getByText('Points to use');
    // The pools carry the ruleset's own words, which is the whole of v3 Req 49.2
    const vigor = screen.getByText('Vigor');
    const focus = screen.getByText('Focus');

    expect(level).toBeTruthy();
    expect(points).toBeTruthy();
    expect(vigor).toBeTruthy();
    expect(focus).toBeTruthy();
  });

  it('reads a pool as current against maximum', () => {
    renderRoster();

    // 31 of a maximum of 40, both derived rather than stored
    const current = screen.getByText('31');
    const maximum = screen.getByText('40');

    expect(current).toBeTruthy();
    expect(maximum).toBeTruthy();
  });

  it('grows a column when the Snapshot grows a resource, with no code change', () => {
    const base = makeSnapshot();
    const breath: Stat = {
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

    const widened = makeSnapshot({ stats: [...base.stats, breath] });

    renderRoster({}, {}, [makeDocument()], widened);

    const grown = screen.getByText('Breath');

    expect(grown).toBeTruthy();
  });

  it('chips a resource whose formula is broken rather than showing a number', () => {
    const base = makeSnapshot();
    const broken: Stat = {
      id: 'stat-ruin',
      name: 'Ruin',
      abbreviation: 'RUI',
      description: '',
      order: 3,
      countsTowardTotal: false,
      isResource: true,
      rounding: 'none',
      formula: 'NOPE * 2',
    };

    const snapshot = makeSnapshot({ stats: [...base.stats, broken] });

    renderRoster({}, {}, [makeDocument()], snapshot);

    const chipped = screen.getByRole('img', { name: /max:/ });

    expect(chipped).toBeTruthy();
  });

  it('chips the level rather than claiming 1 when the curve cannot price it', () => {
    const snapshot = makeSnapshot({ curves: [] });

    renderRoster({}, {}, [makeDocument()], snapshot);

    const chipped = screen.getByRole('img', { name: /Level:/ });

    expect(chipped).toBeTruthy();
  });
});

describe('SessionRoster — what a reader may do', () => {
  it('offers a DM nothing on their own row (v3 Req 39.6)', () => {
    renderRoster();

    // Leaving is refused by the server until the game is handed over, so the row does not offer it
    expect(screen.queryByRole('button', { name: 'Leave' })).toBeNull();
    // …and the two it does offer are on the *other* row
    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Hand over' })).toHaveLength(1);
  });

  it('offers a player their own seat and nobody else’s', () => {
    renderRoster({ accountId: PLAYER_ACCOUNT, isDm: false, actsAsDm: () => false });

    expect(screen.getByRole('button', { name: 'Leave' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Hand over' })).toBeNull();
  });

  it('hides Hand over on an archived table, where the server refuses it', () => {
    renderRoster({}, { canTransfer: false });

    expect(screen.queryByRole('button', { name: 'Hand over' })).toBeNull();
    // …and removing is still offered, because tidying up a finished game is allowed
    expect(screen.getByRole('button', { name: 'Remove' })).toBeTruthy();
  });

  it('asks before removing, and says nothing is deleted', () => {
    const { onRemove } = renderRoster();

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.getByText(/Their characters stay at the table/)).toBeTruthy();
    expect(screen.getByText(/Nothing is deleted/)).toBeTruthy();

    confirmWith('Remove them');
    expect(onRemove).toHaveBeenCalledWith(PLAYER_ACCOUNT);
  });

  it('asks before leaving, and lets the answer be no', () => {
    const { onRemove } = renderRoster({
      accountId: PLAYER_ACCOUNT,
      isDm: false,
      actsAsDm: () => false,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onRemove).not.toHaveBeenCalled();
  });

  it('asks before handing the game over, and names who gets it', () => {
    const { onTransfer } = renderRoster();

    fireEvent.click(screen.getByRole('button', { name: 'Hand over' }));

    expect(screen.getByText(/Ada becomes the one who runs it/)).toBeTruthy();

    confirmWith('Hand it over');
    expect(onTransfer).toHaveBeenCalledWith(PLAYER_ACCOUNT);
  });

  it('offers a sheet on your own character, and on anybody’s if you run the table', () => {
    // A Player opening somebody else's would meet a page of controls that could not save
    // (`requireCharacterPlayer`); the DM opening one is where their controls are (TICKET-DM-01)
    const { state } = renderRoster();

    const button = screen.getByRole('button', { name: 'Open as DM' });
    fireEvent.click(button);

    expect(state.openCharacter).toHaveBeenCalledWith('character-1');
  });

  it('offers a player no sheet on somebody else’s character', () => {
    renderRoster({ accountId: PLAYER_ACCOUNT, isDm: false, actsAsDm: () => false });

    // Ada owns this one, so she gets it — under her own group
    expect(screen.getByRole('button', { name: 'Open sheet' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Open as DM' })).toBeNull();
  });
});

describe('SessionRoster — the connection column', () => {
  it('says the connection is unknown rather than claiming offline, when there is no feed', () => {
    renderRoster();

    // A signed-out reader, or a table nobody is watching: there is nothing to ask, and saying so is
    // the point
    expect(screen.getAllByText('Connection unknown')).toHaveLength(2);
    expect(screen.queryByText(/offline/i)).toBeNull();
  });

  it('names who is connected and who is away, once there is a live feed', () => {
    const live = roomView({ presentAccountIds: [PLAYER_ACCOUNT] });
    vi.mocked(useLiveRoom).mockReturnValue(live);

    renderRoster();

    // GAM-04's column, finally answering: Ada's browser is on the room, the DM's is not
    expect(screen.getByText('Connected')).toBeTruthy();
    expect(screen.getByText('Away')).toBeTruthy();
    expect(screen.queryByText('Connection unknown')).toBeNull();
  });

  it('goes back to unknown the moment the feed is not live', () => {
    // The LIVE-03 discipline in one case: the last thing this browser heard was that Ada was
    // connected, and a dropped socket makes that a claim it can no longer support. *Away* here
    // would be a confident wrong answer about a person.
    const dropped = roomView({
      status: LIVE_STATUS.RECONNECTING,
      presentAccountIds: [PLAYER_ACCOUNT],
    });
    vi.mocked(useLiveRoom).mockReturnValue(dropped);

    renderRoster();

    expect(screen.getAllByText('Connection unknown')).toHaveLength(2);
    expect(screen.queryByText('Away')).toBeNull();
    expect(screen.queryByText('Connected')).toBeNull();
  });
});

describe('SessionRoster — characters whose player has gone', () => {
  it('shows them, with their numbers (v3 Req 39.3)', () => {
    const orphan = makeCharacter({ id: 'character-9', name: 'Old Quackers' });
    const documents = [
      makeDocument(),
      makeDocument({ id: 'character-9', ownerAccountId: DEPARTED_ACCOUNT, character: orphan }),
    ];

    renderRoster({}, {}, documents);

    const named = screen.getByText('Old Quackers');
    const explained = screen.getByText(/nobody can change them/);
    // The lobby could only name them; retention means the sheets stay readable
    const levels = screen.getAllByText('Level');

    expect(named).toBeTruthy();
    expect(explained).toBeTruthy();
    expect(levels.length).toBeGreaterThan(1);
  });

  it('offers nobody an action on one, the DM included', () => {
    const orphan = makeCharacter({ id: 'character-9', name: 'Old Quackers' });
    const documents = [
      makeDocument({ id: 'character-9', ownerAccountId: DEPARTED_ACCOUNT, character: orphan }),
    ];

    renderRoster({}, {}, documents);

    // `requireCharacterWriter` asks whether the owner still holds a seat before it asks anything
    // about the caller, so these are read-only for everybody (v3 Req 39.3)
    const actions = screen.queryByRole('button', { name: 'Actions' });
    const asDm = screen.queryByRole('button', { name: 'Open as DM' });

    expect(actions).toBeNull();
    expect(asDm).toBeNull();
  });

  it('says nothing about departed characters when there are none', () => {
    renderRoster();

    const explained = screen.queryByText(/nobody can change them/);

    expect(explained).toBeNull();
  });
});

describe('SessionRoster — making one', () => {
  it('offers to make one, and asks the caller to open the table’s rules', () => {
    const { state } = renderRoster();

    fireEvent.click(screen.getByRole('button', { name: 'Make a character here' }));

    expect(state.makeCharacterHere).toHaveBeenCalled();
  });

  it('cannot be pressed twice while the rules are opening', () => {
    const { state } = renderRoster({ isOpeningRules: true });

    fireEvent.click(screen.getByRole('button', { name: 'Opening the rules…' }));

    expect(state.makeCharacterHere).not.toHaveBeenCalled();
  });

  it('shows an archived table the reason rather than a button', () => {
    renderRoster({}, { canCreate: false });

    expect(screen.queryByRole('button', { name: 'Make a character here' })).toBeNull();
    expect(screen.getByText(/archived/)).toBeTruthy();
  });
});
