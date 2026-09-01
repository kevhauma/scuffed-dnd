/**
 * Passives Panel Tests (TICKET-PAS-01)
 *
 * The stores are real with storage mocked, so a grant really goes through the store action and back
 * out as rendered state — `SpellbookPanel.test.tsx`'s arrangement, and for its reason: what these
 * cases are about is the *loop* (pick → grant → read the resolved sentence → revoke), which a hook
 * tested in isolation cannot show.
 *
 * Four things:
 *
 * 1. **The list and the picker are one derived fact** — granting puts a row on the sheet and takes
 *    it out of the picker, with neither control touching the other.
 * 2. **A templated effect is resolved for the holder**, so Blindsight's range is a number and not a
 *    brace, while a plain-prose passive is drawn verbatim.
 * 3. **A reader with no handlers sees the list and no controls**, which is what a Player at a table
 *    gets — the handout is the DM's.
 * 4. **A passive the ruleset has lost is a row that can still be revoked**, not a crash and not a
 *    silent gap.
 *
 * **Validates: v4 systems/14; Requirements 21.1-21.5**
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '#shared/types/character';
import type { Configuration } from '#shared/types/config';

vi.mock('../../../services/storage', () => ({
  loadConfiguration: vi.fn(() => null),
  saveConfiguration: vi.fn(),
  loadCharacters: vi.fn(() => []),
  saveCharacters: vi.fn(),
  isStorageAvailable: vi.fn(() => true),
}));

import { useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';
import { PassivesPanel } from './PassivesPanel';

/** One invested stat, a skill weighted entirely off it, and the two shapes the sheet's tab holds */
function createConfig(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    schemaVersion: 10,
    stats: [
      {
        id: 'stat-per',
        name: 'Perception',
        abbreviation: 'PER',
        description: '',
        order: 0,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
      },
    ],
    skills: [
      {
        id: 'skill-perception',
        name: 'Perception',
        description: '',
        statWeights: [{ statId: 'stat-per', weight: 1 }],
      },
    ],
    materials: [],
    materialCategories: [],
    items: [],
    equipmentSlots: [],
    races: [],
    currencyTiers: [],
    passives: [
      {
        id: 'blindsight',
        name: 'Blindsight',
        effectText: 'Blindsight out to {skills.perception.level * 10} feet.',
      },
      { id: 'charmed', name: 'Charm immunity', effectText: 'You cannot be charmed.' },
    ],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  } as unknown as Configuration;
}

/** A character whose Perception stat is worth 5, so the skill's level is 5 */
function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char1',
    name: 'Aria',
    configurationId: 'config1',
    raceIds: [],
    investedStatPoints: { 'stat-per': 5 },
    investedSkillPoints: {},
    currentResourceValues: {},
    experience: 0,
    inventory: { equippedItems: {}, composedItems: [] },
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

/** Put a ruleset and one character in the stores, and draw the panel against them */
function drawPassives(
  config: Configuration,
  character: Character,
  options: { readOnly?: boolean } = {}
) {
  useConfigStore.setState({ config });
  useCharacterStore.setState({ characters: [character], isLoaded: true, actionError: null });

  // `readOnly` is a Player **at a table**, where the handout is the DM's — which is the one state
  // that draws the list and no controls. Which pair a reader gets is `usePassiveHandout`'s decision
  // and has its own test file; here the local sheet is the default because that is the one every
  // other case is about.
  return render(<PassivesPanel characterId={character.id} atTable={options.readOnly === true} />);
}

/** The character as the store now holds it */
function stored(): Character {
  return useCharacterStore.getState().characters[0];
}

/** Hand out whatever the picker is currently showing */
function grant(name: string) {
  fireEvent.change(screen.getByLabelText('Hand out a passive'), {
    target: { value: name },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Grant' }));
}

describe('PassivesPanel', () => {
  beforeEach(() => {
    useCharacterStore.setState({ characters: [], isLoaded: false, actionError: null });
    useConfigStore.setState({ config: null });
    vi.clearAllMocks();
  });

  it('draws nothing at all for a ruleset that names no passives', () => {
    const { container } = drawPassives(createConfig({ passives: [] }), createCharacter());

    expect(container.innerHTML).toBe('');
  });

  it('says the character has none before anything is handed out', () => {
    drawPassives(createConfig(), createCharacter());

    expect(screen.getByText('No passive abilities yet.')).toBeDefined();
  });

  it('grants a passive, and it leaves the picker as it joins the list', () => {
    // One derived list read two ways — the whole reason neither control has to tell the other
    drawPassives(createConfig(), createCharacter());

    grant('charmed');

    expect(stored().passiveIds).toEqual(['charmed']);
    expect(screen.getByText('Charm immunity')).toBeDefined();
    expect(screen.queryByRole('option', { name: 'Charm immunity' })).toBeNull();
  });

  it('resolves a templated effect for the holder rather than showing the braces', () => {
    // Blindsight's range is `perception level × 10` and this character's Perception level is 5
    drawPassives(createConfig(), createCharacter({ passiveIds: ['blindsight'] }));

    expect(screen.getByText(/Blindsight out to/)).toBeDefined();
    expect(screen.getByText('50')).toBeDefined();
    expect(screen.queryByText(/\{/)).toBeNull();
  });

  it('draws a plain-prose effect verbatim', () => {
    drawPassives(createConfig(), createCharacter({ passiveIds: ['charmed'] }));

    expect(screen.getByText('You cannot be charmed.')).toBeDefined();
  });

  it('revokes one, and the last one leaves the character with no field at all', () => {
    drawPassives(createConfig(), createCharacter({ passiveIds: ['charmed'] }));

    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));

    expect('passiveIds' in stored()).toBe(false);
    expect(screen.getByText('No passive abilities yet.')).toBeDefined();
  });

  it('draws a passive the ruleset has lost, and lets it be revoked', () => {
    // The force-delete leftover. Dropping the row would leave an id no surface shows and no control
    // can clear — and the revoke consults no ruleset precisely so that this works.
    drawPassives(createConfig(), createCharacter({ passiveIds: ['deleted-under-them'] }));

    expect(screen.getByText('A passive this ruleset no longer has')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));

    expect('passiveIds' in stored()).toBe(false);
  });

  it('keeps the panel drawable when a force-delete emptied the catalog under a holder', () => {
    // `hasPassives` is a catalog **or** a held row: gating on the catalog alone would hide the one
    // control that can clear the leftover — SPL-02's browser finding, one entity over
    const { container } = drawPassives(
      createConfig({ passives: [] }),
      createCharacter({ passiveIds: ['deleted-under-them'] })
    );

    expect(container.innerHTML).not.toBe('');
    expect(screen.getByRole('button', { name: 'Revoke' })).toBeDefined();
  });

  it('says so when every passive has already been handed out', () => {
    drawPassives(createConfig(), createCharacter({ passiveIds: ['blindsight', 'charmed'] }));

    expect(
      screen.getByText('Every passive in this ruleset has already been handed out.')
    ).toBeDefined();
  });

  it('shows a reader with no handlers the list and no controls at all', () => {
    // A Player at a table: the handout is the DM's, and an absent control says *not yours* where a
    // disabled one would say *not now*
    drawPassives(createConfig(), createCharacter({ passiveIds: ['charmed'] }), { readOnly: true });

    expect(screen.getByText('Charm immunity')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Revoke' })).toBeNull();
    expect(screen.queryByLabelText('Hand out a passive')).toBeNull();
  });

  it('reports a duplicate rather than adding a second entry', () => {
    drawPassives(createConfig(), createCharacter({ passiveIds: ['charmed'] }));

    // The picker cannot offer it, so the duplicate is reached the way a stale render would reach it
    useCharacterStore.getState().grantPassive('char1', 'charmed', createConfig());

    expect(stored().passiveIds).toEqual(['charmed']);
    expect(useCharacterStore.getState().actionError).toContain('already has Charm immunity');
  });
});
