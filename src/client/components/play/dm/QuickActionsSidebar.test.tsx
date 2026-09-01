/**
 * What the DM's sidebar puts on screen, and who sees it at all (TICKET-DM-03)
 *
 * Four claims about the rendering, the derivation itself being
 * [`quickActions.test.ts`](../shared/quickActions.test.ts)'s and the store bindings being
 * [`useQuickActions.test.ts`](./useQuickActions.test.ts)'s:
 *
 * 1. **Absent for anybody who is not this table's DM** — the card is not rendered at all, rather than
 *    rendered with dead controls (v3 Req 49.10).
 * 2. **Every label is the ruleset's own word**, so a table playing *Vigor* and *Focus* reads those
 *    (v3 Req 49.1, 49.2).
 * 3. **The presets the Snapshot supplies are one press each**, and an action it supplies none for
 *    draws the box alone rather than a guessed ladder (v3 Req 49.4).
 * 4. **An accepted action reports before → after, and the undo beside it says what undo is** — an
 *    inverse rather than a rewind, which is the sentence v3 Req 49.6 asks to be stated where the DM
 *    can read it rather than only in a docblock.
 *
 * **Validates: v3 Req 49.1, 49.2, 49.4, 49.5, 49.6, 49.10**
 */

import { fireEvent, render, screen } from '@testing-library/react';
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
import { QuickActionsSidebar } from './QuickActionsSidebar';

/** Whether a control is offered dead — `jest-dom`'s matchers are not set up in this suite */
function isDisabled(element: HTMLElement): boolean {
  return (element as HTMLButtonElement).disabled;
}

/** A ruleset naming its pools nothing a hard-coded label would guess */
const ACTIONS = quickActionsFor({
  pools: [
    { id: 'stat-vigor', name: 'Vigor', max: 40 },
    { id: 'stat-focus', name: 'Focus', max: 20 },
  ],
  experienceStep: 300,
});

const WORDS: AdjustmentVocabulary = {
  names: { 'stat-vigor': 'Vigor' },
  money: (amount: number) => `${amount}`,
};

/** The action of a given kind out of a derived set */
function pick(actions: QuickAction[], kind: QuickAction['kind']): QuickAction {
  const found = actions.find((entry) => entry.kind === kind);

  if (!found) throw new Error(`no ${kind} action in the derived set`);

  return found;
}

/** One Event as the server projected it */
function anAdjustment(): CharacterAdjustment {
  return {
    id: 'event-1',
    seq: 5,
    action: DM_ACTION.ADJUST_RESOURCE,
    target: 'stat-vigor',
    before: 30,
    after: 23,
    at: 0,
    by: 'dm@example.com',
  };
}

function signedInAs(accountId: string) {
  vi.mocked(useAuth).mockReturnValue({
    accountId,
    isPending: false,
  } as unknown as ReturnType<typeof useAuth>);
}

/** Put the character at a table owned by `ownerAccountId` */
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

/** Draw the sidebar with the given action set and history */
function renderSidebar(actions: QuickAction[], adjustments: CharacterAdjustment[] = []) {
  render(
    <QuickActionsSidebar
      characterId="char1"
      characterName="Aria"
      actions={actions}
      adjustments={adjustments}
      words={WORDS}
      grantedPoints={0}
    />
  );
}

describe('QuickActionsSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCharacterStore.setState({
      characters: [],
      tableCharacter: null,
      tableCharacterOwnerId: null,
      isActing: false,
      actionError: null,
    });
    signedInAs('account-player');
  });

  it('should draw nothing at all for a Player at a table, rather than dead controls', () => {
    // v3 Req 49.10. Not one heading, not one disabled button — the whole card is absent
    atTable('account-player');

    renderSidebar(ACTIONS);

    const heading = screen.queryByText('Quick actions');
    const buttons = screen.queryAllByRole('button');

    expect(heading).toBeNull();
    expect(buttons).toHaveLength(0);
  });

  it('should label its actions from the ruleset’s own resource names', () => {
    asDungeonMaster();

    renderSidebar(ACTIONS);

    const damageVigor = screen.getByText('Damage Vigor');
    const restoreFocus = screen.getByText('Restore Focus');

    expect(damageVigor).toBeDefined();
    expect(restoreFocus).toBeDefined();
  });

  it('should offer the amounts the ruleset supplies as one press each', () => {
    // A pool that maxes at 40 offers 1, a tenth and a quarter — the pool's own scale rather than a
    // ladder somebody liked the look of
    const dmAdjustResource = vi.fn();
    useCharacterStore.setState({ dmAdjustResource });
    asDungeonMaster();
    const damage = pick(ACTIONS, QUICK_ACTION_KIND.DAMAGE);

    renderSidebar([damage]);
    const ten = screen.getByRole('button', { name: '10' });
    fireEvent.click(ten);

    expect(dmAdjustResource).toHaveBeenCalledWith('char1', 'stat-vigor', -10);
  });

  it('should draw the box alone for an action the Snapshot supplies no preset for', () => {
    // The experience actions on a ruleset whose curve cannot price the next level. Typed entry is
    // still offered, so a refusing curve costs a preset rather than the action
    asDungeonMaster();
    const bare = quickActionsFor({ pools: [], experienceStep: null });
    const award = pick(bare, QUICK_ACTION_KIND.AWARD_EXPERIENCE);

    renderSidebar([award]);

    const buttons = screen.getAllByRole('button');
    const entry = screen.getByLabelText('Award experience');

    // Just the Apply button beside the box — no preset chips at all
    expect(buttons).toHaveLength(1);
    expect(entry).toBeDefined();
  });

  it('should send what the DM typed rather than only what it offered', () => {
    const dmAwardExperience = vi.fn();
    useCharacterStore.setState({ dmAwardExperience });
    asDungeonMaster();
    const award = pick(ACTIONS, QUICK_ACTION_KIND.AWARD_EXPERIENCE);

    renderSidebar([award]);
    const entry = screen.getByLabelText('Award experience');
    fireEvent.change(entry, { target: { value: '75' } });
    const apply = screen.getByRole('button', { name: 'Apply' });
    fireEvent.click(apply);

    expect(dmAwardExperience).toHaveBeenCalledWith('char1', 75);
  });

  it('should offer no live Apply button for an empty box', () => {
    asDungeonMaster();
    const damage = pick(ACTIONS, QUICK_ACTION_KIND.DAMAGE);

    renderSidebar([damage]);
    const apply = screen.getByRole('button', { name: 'Apply' });
    const applyIsDead = isDisabled(apply);

    expect(applyIsDead).toBe(true);
  });

  it('should report what an accepted action did, and say that undo is not a rewind', () => {
    // v3 Req 49.5 and 49.6 together. The sentence beside the button is the ticket's load-bearing
    // one: the DM is the one who has to decide whether a clamped pool matters
    const dmAdjustResource = vi.fn();
    useCharacterStore.setState({ dmAdjustResource });
    asDungeonMaster();
    const damage = pick(ACTIONS, QUICK_ACTION_KIND.DAMAGE);
    const landed = anAdjustment();

    const { rerender } = render(
      <QuickActionsSidebar
        characterId="char1"
        characterName="Aria"
        actions={[damage]}
        adjustments={[]}
        words={WORDS}
        grantedPoints={0}
      />
    );

    const one = screen.getByRole('button', { name: '1' });
    fireEvent.click(one);

    rerender(
      <QuickActionsSidebar
        characterId="char1"
        characterName="Aria"
        actions={[damage]}
        adjustments={[landed]}
        words={WORDS}
        grantedPoints={0}
      />
    );

    const reported = screen.getByText('Took 7 off Vigor — 30 → 23');
    const undo = screen.getByRole('button', { name: 'Undo' });
    const caveat = screen.getByText(/not a rewind/);

    expect(reported).toBeDefined();
    expect(undo).toBeDefined();
    expect(caveat).toBeDefined();
  });

  it('should offer no undo at all before anything has been applied', () => {
    // Absent rather than disabled, as everything on this card is
    asDungeonMaster();

    const existing = anAdjustment();

    renderSidebar(ACTIONS, [existing]);

    const undo = screen.queryByRole('button', { name: 'Undo' });

    expect(undo).toBeNull();
  });

  it('should send nothing twice while an adjustment is on the wire', () => {
    const dmAdjustResource = vi.fn();
    useCharacterStore.setState({ dmAdjustResource, isActing: true });
    asDungeonMaster();
    const damage = pick(ACTIONS, QUICK_ACTION_KIND.DAMAGE);

    renderSidebar([damage]);
    const ten = screen.getByRole('button', { name: '10' });
    fireEvent.click(ten);
    const tenIsDead = isDisabled(ten);

    expect(tenIsDead).toBe(true);
    expect(dmAdjustResource).not.toHaveBeenCalled();
  });
});
