/**
 * Which store action each quick action reaches, and who may reach one (TICKET-DM-03)
 *
 * `usePurseControls.test.ts`'s shape one surface over. Three claims:
 *
 * 1. **Absent, not disabled.** A Player — on their own local sheet or at a table — gets `null`, so
 *    the sidebar renders nothing at all (v3 Req 49.10).
 * 2. **Every action is a shortcut to a route that already exists**, and a *resource* one goes out as
 *    a **delta**: nothing here reads the pool, so *take 7 off them* is seven off whatever the pool
 *    turned out to be rather than off what the sheet was showing (v3 Req 49.4, TICKET-RES-03's rule).
 * 3. **An accepted action reports before → after and can be undone by its inverse; a refused one
 *    reports neither and offers no undo** (v3 Req 49.5, 49.6).
 *
 * The store actions are stubbed rather than driven — what each then puts on the wire is
 * `characterStore.table.test.ts`'s claim, and it asserts the path by name.
 *
 * **Validates: v3 Req 49.3, 49.4, 49.5, 49.6, 49.10**
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../auth/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../../../services/storage', () => ({
  loadConfiguration: vi.fn(() => null),
  saveConfiguration: vi.fn(),
  loadCharacters: vi.fn(() => []),
  saveCharacters: vi.fn(),
  isStorageAvailable: vi.fn(() => true),
}));

import type { CharacterAdjustment } from '#shared/types/api';
import { DM_ACTION } from '#shared/types/api';
import { useCharacterStore } from '../../../stores/characterStore';
import { useAuth } from '../../auth/useAuth';
import type { QuickAction } from '../shared/quickActions';
import { QUICK_ACTION_KIND, quickActionsFor } from '../shared/quickActions';
import type { AdjustmentVocabulary } from './adjustmentVocabulary';
import { useQuickActions } from './useQuickActions';

/** A ruleset with one pool, named nothing a hard-coded label would guess */
const ACTIONS = quickActionsFor({
  pools: [{ id: 'stat-vigor', name: 'Vigor', max: 40 }],
  experienceStep: 300,
});

/** How this ruleset spells what an adjustment can name */
const WORDS: AdjustmentVocabulary = {
  names: { 'stat-vigor': 'Vigor' },
  money: (amount: number) => `${amount}`,
};

/** No history yet — the ordinary state of a sheet nobody has adjusted */
const NO_ADJUSTMENTS: CharacterAdjustment[] = [];

/** The action of a given kind out of the derived set */
function pick(kind: QuickAction['kind']): QuickAction {
  const found = ACTIONS.find((entry) => entry.kind === kind);

  if (!found) throw new Error(`no ${kind} action in the derived set`);

  return found;
}

/** One Event as the server projected it */
function anAdjustment(overrides: Partial<CharacterAdjustment> = {}): CharacterAdjustment {
  return {
    id: 'event-1',
    seq: 5,
    action: DM_ACTION.ADJUST_RESOURCE,
    target: 'stat-vigor',
    before: 30,
    after: 23,
    at: 0,
    by: 'dm@example.com',
    ...overrides,
  };
}

function signedOut() {
  vi.mocked(useAuth).mockReturnValue({
    accountId: null,
    isPending: false,
  } as unknown as ReturnType<typeof useAuth>);
}

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

/** Signed in as the DM of a table holding somebody else's character */
function asDungeonMaster() {
  signedInAs('account-dm');
  atTable('account-player');
}

/** The four store actions this hook can reach, all stubbed */
function stubStore() {
  const dmAdjustResource = vi.fn();
  const dmSetGrantedPoints = vi.fn();
  const dmAwardExperience = vi.fn();
  const dmDeductExperience = vi.fn();

  useCharacterStore.setState({
    dmAdjustResource,
    dmSetGrantedPoints,
    dmAwardExperience,
    dmDeductExperience,
  });

  return { dmAdjustResource, dmSetGrantedPoints, dmAwardExperience, dmDeductExperience };
}

/** Render the hook for a character with the given history and grant */
function render(adjustments: CharacterAdjustment[], grantedPoints = 0) {
  return renderHook(
    (props: { adjustments: CharacterAdjustment[] }) =>
      useQuickActions('char1', props.adjustments, WORDS, grantedPoints),
    { initialProps: { adjustments } }
  );
}

/**
 * Render with the character id as a prop, so a rerender can change *which sheet* is open
 *
 * `routes/play/character.$id.tsx` renders `<CharacterSheet characterId={id} />` with **no `key`**, so
 * a route param change reuses the instance and this hook's state survives it — which is the shape the
 * case below reproduces.
 */
function renderForCharacter(characterId: string, adjustments: CharacterAdjustment[]) {
  return renderHook(
    (props: { characterId: string; adjustments: CharacterAdjustment[] }) =>
      useQuickActions(props.characterId, props.adjustments, WORDS, 0),
    { initialProps: { characterId, adjustments } }
  );
}

describe('useQuickActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCharacterStore.setState({
      characters: [],
      tableCharacter: null,
      tableCharacterOwnerId: null,
      isActing: false,
      actionError: null,
    });
    signedOut();
  });

  it('should give a Player at a table nothing at all, rather than a disabled set', () => {
    // v3 Req 49.10. A disabled control tells a Player a power exists and invites a request to use it
    signedInAs('account-player');
    atTable('account-player');

    const { result } = render(NO_ADJUSTMENTS);

    expect(result.current).toBeNull();
  });

  it('should give a Player on their own local sheet nothing, because there is no DM signed out', () => {
    const { result } = render(NO_ADJUSTMENTS);

    expect(result.current).toBeNull();
  });

  it('should give nothing while the browser has not resolved its cookie yet', () => {
    // A frame of the DM's sidebar on a Player's own sheet is what this prevents
    atTable('account-player');

    const { result } = render(NO_ADJUSTMENTS);

    expect(result.current).toBeNull();
  });

  it('should give the table’s DM the whole set for somebody else’s character', () => {
    asDungeonMaster();

    const { result } = render(NO_ADJUSTMENTS);

    expect(result.current).not.toBeNull();
  });

  it('should send a damage as a delta on the pool rather than as a value computed here', () => {
    // v3 Req 49.4 and TICKET-RES-03's rule together: the delta lands on what is **stored**, so a
    // current left above a fallen maximum loses exactly what was asked for and stays flagged
    const { dmAdjustResource } = stubStore();
    asDungeonMaster();
    const damage = pick(QUICK_ACTION_KIND.DAMAGE);

    const { result } = render(NO_ADJUSTMENTS);
    act(() => result.current?.apply(damage, 7));

    expect(dmAdjustResource).toHaveBeenCalledWith('char1', 'stat-vigor', -7);
  });

  it('should send a restore as the same delta the other way', () => {
    const { dmAdjustResource } = stubStore();
    asDungeonMaster();
    const restore = pick(QUICK_ACTION_KIND.RESTORE);

    const { result } = render(NO_ADJUSTMENTS);
    act(() => result.current?.apply(restore, 7));

    expect(dmAdjustResource).toHaveBeenCalledWith('char1', 'stat-vigor', 7);
  });

  it('should send a point grant as a total on top of what is already granted', () => {
    // `dm-grant-points` takes a total deliberately (TICKET-DM-01), so *give 5* is 3 + 5. That is not
    // the stale read the resource delta avoids — the grant moves only when a DM moves it
    const { dmSetGrantedPoints } = stubStore();
    asDungeonMaster();
    const give = pick(QUICK_ACTION_KIND.GIVE_POINTS);

    const { result } = render(NO_ADJUSTMENTS, 3);
    act(() => result.current?.apply(give, 5));

    expect(dmSetGrantedPoints).toHaveBeenCalledWith('char1', 8);
  });

  it('should send a revocation as the total below the current grant', () => {
    const { dmSetGrantedPoints } = stubStore();
    asDungeonMaster();
    const take = pick(QUICK_ACTION_KIND.TAKE_POINTS);

    const { result } = render(NO_ADJUSTMENTS, 3);
    act(() => result.current?.apply(take, 2));

    expect(dmSetGrantedPoints).toHaveBeenCalledWith('char1', 1);
  });

  it('should send experience through DM-01’s own award and deduct actions', () => {
    const { dmAwardExperience, dmDeductExperience } = stubStore();
    asDungeonMaster();
    const award = pick(QUICK_ACTION_KIND.AWARD_EXPERIENCE);
    const deduct = pick(QUICK_ACTION_KIND.DEDUCT_EXPERIENCE);

    const { result } = render(NO_ADJUSTMENTS);
    act(() => result.current?.apply(award, 300));
    act(() => result.current?.apply(deduct, 50));

    expect(dmAwardExperience).toHaveBeenCalledWith('char1', 300);
    expect(dmDeductExperience).toHaveBeenCalledWith('char1', 50);
  });

  it('should decline an amount that is not a positive whole quantity, without calling the store', () => {
    // Not a rule — the Kernel owns those — but a dead button rather than a request that cannot land
    const { dmAdjustResource } = stubStore();
    asDungeonMaster();
    const damage = pick(QUICK_ACTION_KIND.DAMAGE);

    const { result } = render(NO_ADJUSTMENTS);
    act(() => result.current?.apply(damage, 0));
    act(() => result.current?.apply(damage, -3));
    act(() => result.current?.apply(damage, 1.5));
    act(() => result.current?.apply(damage, Number.NaN));

    expect(dmAdjustResource).not.toHaveBeenCalled();
  });

  it('should report before → after from the Event the action wrote', () => {
    // v3 Req 49.5. Read off the Event rather than computed here, so a restore that clamped reads as
    // the points it actually put back
    stubStore();
    asDungeonMaster();
    const damage = pick(QUICK_ACTION_KIND.DAMAGE);

    const { result, rerender } = render(NO_ADJUSTMENTS);
    act(() => result.current?.apply(damage, 7));
    const landed = anAdjustment();
    rerender({ adjustments: [landed] });
    const reported = result.current?.outcome;

    expect(reported).toBe('Took 7 off Vigor — 30 → 23');
  });

  it('should ignore a row that was already there, so an older adjustment is not read as this one', () => {
    // The mark is the newest seq at the moment of sending; a feed that has not caught up yet says
    // nothing rather than repeating what somebody else did five minutes ago
    stubStore();
    asDungeonMaster();
    const damage = pick(QUICK_ACTION_KIND.DAMAGE);
    const existing = anAdjustment({ seq: 5 });

    const { result } = render([existing]);
    act(() => result.current?.apply(damage, 7));
    const reported = result.current?.outcome;

    expect(reported).toBeNull();
  });

  it('should report nothing and offer no undo when the server refuses', () => {
    // v3 Req 49.5's second half: the surface stays on the pre-action state, and the sheet's own
    // banner carries the server's sentence
    stubStore();
    asDungeonMaster();
    const deduct = pick(QUICK_ACTION_KIND.DEDUCT_EXPERIENCE);

    const { result, rerender } = render(NO_ADJUSTMENTS);
    act(() => result.current?.apply(deduct, 500));
    act(() => useCharacterStore.setState({ actionError: 'That would take Aria below zero' }));
    const landed = anAdjustment();
    rerender({ adjustments: [landed] });
    const reported = result.current?.outcome;
    const undo = result.current?.undo;

    expect(reported).toBeNull();
    expect(undo).toBeNull();
  });

  it('should offer no undo before anything has been applied', () => {
    stubStore();
    asDungeonMaster();

    const existing = anAdjustment();

    const { result } = render([existing]);
    const undo = result.current?.undo;

    expect(undo).toBeNull();
  });

  it('should undo the most recent action by applying its inverse through the same store action', () => {
    // v3 Req 49.6. A restore of the same 7, not a write of the value the pool used to hold — which
    // is why a fallen maximum makes the two differ and why the sidebar says so
    const { dmAdjustResource } = stubStore();
    asDungeonMaster();
    const damage = pick(QUICK_ACTION_KIND.DAMAGE);

    const { result, rerender } = render(NO_ADJUSTMENTS);
    act(() => result.current?.apply(damage, 7));
    const landed = anAdjustment();
    rerender({ adjustments: [landed] });
    act(() => result.current?.undo?.());

    expect(dmAdjustResource).toHaveBeenNthCalledWith(1, 'char1', 'stat-vigor', -7);
    expect(dmAdjustResource).toHaveBeenNthCalledWith(2, 'char1', 'stat-vigor', 7);
  });

  it('should offer no undo once a different character is open, even when a newer row has landed', () => {
    /*
     * The DM-03 review's blocking finding. `character.$id.tsx` renders the sheet with **no `key`**,
     * so opening a second character reuses the component and this hook's `last` survives the switch.
     * `seq` cannot tell the two apart — it is **session**-scoped, so the next character's feed will
     * very plausibly clear the mark on its own — and an undo offered here would send the inverse to
     * the wrong sheet, silently. TICKET-DM-04 puts this hook on a roster, where several characters
     * are on screen at once, so the guard matters twice.
     */
    const { dmAdjustResource } = stubStore();
    signedInAs('account-dm');
    atTable('account-player');
    const damage = pick(QUICK_ACTION_KIND.DAMAGE);

    const { result, rerender } = renderForCharacter('char1', NO_ADJUSTMENTS);
    act(() => result.current?.apply(damage, 7));

    // The DM closes that sheet and opens somebody else's at the same table, whose feed already has
    // rows above the mark the first action recorded
    act(() =>
      useCharacterStore.setState({
        tableCharacter: { id: 'char2', name: 'Bram' } as never,
        tableCharacterOwnerId: 'account-player',
      })
    );
    const theirs = anAdjustment({ id: 'event-2', seq: 9 });
    rerender({ characterId: 'char2', adjustments: [theirs] });

    const reported = result.current?.outcome;
    const undo = result.current?.undo;

    expect(reported).toBeNull();
    expect(undo).toBeNull();
    // And nothing was sent to the second character on the way through
    expect(dmAdjustResource).toHaveBeenCalledTimes(1);
    expect(dmAdjustResource).toHaveBeenCalledWith('char1', 'stat-vigor', -7);
  });

  it('should undo an experience award as a deduction of the same amount', () => {
    // Which is refused exactly when any other deduction below zero would be — the whole point of
    // undoing through the same route rather than restoring a stored total
    const { dmAwardExperience, dmDeductExperience } = stubStore();
    asDungeonMaster();
    const award = pick(QUICK_ACTION_KIND.AWARD_EXPERIENCE);

    const { result, rerender } = render(NO_ADJUSTMENTS);
    act(() => result.current?.apply(award, 300));
    const landed = anAdjustment({ action: DM_ACTION.AWARD_EXPERIENCE });
    rerender({ adjustments: [landed] });
    act(() => result.current?.undo?.());

    expect(dmAwardExperience).toHaveBeenCalledWith('char1', 300);
    expect(dmDeductExperience).toHaveBeenCalledWith('char1', 300);
  });
});
