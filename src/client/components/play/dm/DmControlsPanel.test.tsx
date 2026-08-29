/**
 * The Dungeon Master's controls, and who gets to see them (TICKET-DM-01)
 *
 * Two halves of v3 Req 42.7. The **panel** is composition: each control sends the number that was
 * typed and decides nothing, which is what makes *the Kernel owns the rule* true on this side too.
 * The **gate** is `useDmControls`, and it is the assertion that matters most on the client: a Player
 * must never be shown a DM control, and the rule that answers it is a comparison rather than a
 * request — the server opens a character to its owner or to the DM of its table and nobody else, so
 * *at a table and not mine* has exactly one meaning.
 *
 * **Validates: v3 Req 42.1, 42.2, 42.3, 42.5, 42.7**
 */

import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.fn(() => ({
  accountId: 'account-dm' as string | null,
  email: null,
  isPending: false,
  isSignedIn: true,
}));
vi.mock('../../auth/useAuth', () => ({ useAuth: () => auth() }));

vi.mock('../../../services/storage', () => ({
  loadCharacters: vi.fn(() => []),
  saveCharacters: vi.fn(),
}));

import type { Character } from '#shared/types/character';
import { useCharacterStore } from '../../../stores/characterStore';
import type { StatBreakdown } from '../sheet/useCharacterSheet';
import { DmControlsPanel } from './DmControlsPanel';
import { useDmControls } from './useDmControls';

/** One pool, as the sheet hands it to the panel */
const HEALTH: StatBreakdown = {
  id: 'stat-health',
  name: 'Health',
  abbreviation: 'HP',
  isResource: true,
  isDerived: true,
  invested: 0,
  gain: { value: 0, error: null },
  race: 0,
  equipment: 0,
  current: 12,
  max: { value: 30, error: null },
  isOverMax: false,
};

const BUDGET = {
  pointsSpent: 4,
  grantedPoints: 2,
  pointBudget: { value: 8, error: null },
  pointsRemaining: { value: 4, error: null },
  isOverBudget: false,
};

/** The panel with every handler spied on */
function renderPanel() {
  const handlers = {
    onAwardExperience: vi.fn(),
    onDeductExperience: vi.fn(),
    onSetLevel: vi.fn(),
    onSetGrantedPoints: vi.fn(),
    onSetResource: vi.fn(),
    onSetDreamLevel: vi.fn(),
  };

  render(
    <DmControlsPanel
      characterName="Quackers"
      experience={120}
      budget={BUDGET}
      dreamLevel={2}
      resources={[HEALTH]}
      isBusy={false}
      {...handlers}
    />
  );

  return handlers;
}

/** Type into a labelled box and press the button beside it */
function submit(label: string, value: string, button: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: button }));
}

function aCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'character-1',
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

beforeEach(() => {
  auth.mockReturnValue({
    accountId: 'account-dm',
    email: null,
    isPending: false,
    isSignedIn: true,
  });
  useCharacterStore.setState({
    characters: [],
    isLoaded: true,
    tableCharacter: null,
    tableSessionId: null,
    tableCharacterOwnerId: null,
    isActing: false,
    actionError: null,
  });
});

describe('the DM controls panel', () => {
  it('sends the experience that was typed, in the direction the button names', () => {
    const handlers = renderPanel();

    submit('Experience', '300', 'Award XP');
    expect(handlers.onAwardExperience).toHaveBeenCalledWith(300);

    submit('Experience', '50', 'Deduct XP');
    expect(handlers.onDeductExperience).toHaveBeenCalledWith(50);
  });

  it('sends a level as a level, leaving what it costs to the server', () => {
    const handlers = renderPanel();

    submit('Set level to', '4', 'Set level');

    expect(handlers.onSetLevel).toHaveBeenCalledWith(4);
  });

  it('sends a grant as the new total rather than as a delta', () => {
    const handlers = renderPanel();

    submit('Points granted', '5', 'Set grant');

    expect(handlers.onSetGrantedPoints).toHaveBeenCalledWith(5);
  });

  it('sends a dream level as the new total, and says where it stands now', () => {
    const handlers = renderPanel();

    // TICKET-RES-04: the DM raises it, and what the box holds is the number that gets stored
    expect(screen.getByText(/2 now — their archetype's gains grow with it/)).not.toBeNull();

    submit('Dream level', '3', 'Set dream level');

    expect(handlers.onSetDreamLevel).toHaveBeenCalledWith(3);
  });

  it('names the pool it is setting, so one row cannot write another', () => {
    const handlers = renderPanel();

    submit('Health', '7', 'Set');

    expect(handlers.onSetResource).toHaveBeenCalledWith('stat-health', 7);
  });

  it('says where the grant and the pool stand now, rather than pre-filling the box', () => {
    renderPanel();

    // Stated beside the control, so the DM types the number they want rather than editing one
    expect(screen.getByText(/2 now, on top of the pool/)).not.toBeNull();
    expect(screen.getByText('12 of 30')).not.toBeNull();
    expect((screen.getByLabelText('Points granted') as HTMLInputElement).value).toBe('');
  });

  it('offers no dead button for an empty box', () => {
    renderPanel();

    const button = screen.getByRole('button', { name: 'Set level' }) as HTMLButtonElement;

    expect(button.disabled).toBe(true);
  });
});

describe('who is shown the DM controls', () => {
  it("says yes for the DM reading somebody else's sheet at a table", () => {
    useCharacterStore.setState({
      tableCharacter: aCharacter(),
      tableCharacterOwnerId: 'account-player',
    });

    expect(renderHook(() => useDmControls('character-1')).result.current.isDungeonMaster).toBe(
      true
    );
  });

  it('says no on the reader’s own character, however they got to it', () => {
    useCharacterStore.setState({
      tableCharacter: aCharacter(),
      tableCharacterOwnerId: 'account-dm',
    });

    expect(renderHook(() => useDmControls('character-1')).result.current.isDungeonMaster).toBe(
      false
    );
  });

  it('says no for a character in this browser, where there is no DM at all (D6)', () => {
    useCharacterStore.setState({ characters: [aCharacter()] });

    expect(renderHook(() => useDmControls('character-1')).result.current.isDungeonMaster).toBe(
      false
    );
  });

  it('says no while the browser has not resolved who is signed in', () => {
    // Answering *yes* here would flash the DM's panel onto a Player's own sheet for a frame
    auth.mockReturnValue({ accountId: null, email: null, isPending: true, isSignedIn: false });
    useCharacterStore.setState({
      tableCharacter: aCharacter(),
      tableCharacterOwnerId: 'account-player',
    });

    expect(renderHook(() => useDmControls('character-1')).result.current.isDungeonMaster).toBe(
      false
    );
  });
});
