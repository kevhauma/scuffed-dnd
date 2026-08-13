/**
 * Character List Tests
 *
 * Navigation is mocked at the router boundary; the stores are real, with storage mocked.
 *
 * **Validates: Requirements 11.1, 17.4, 21.1-21.5**
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '../../../types/character';
import type { Configuration } from '../../../types/config';

const navigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
}));

vi.mock('../../../services/storage', () => ({
  loadConfiguration: vi.fn(() => null),
  saveConfiguration: vi.fn(),
  loadCharacters: vi.fn(() => []),
  saveCharacters: vi.fn(),
  isStorageAvailable: vi.fn(() => true),
}));

import { useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';
import { CharacterList } from './CharacterList';

function createConfig(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    schemaVersion: 4,
    stats: [
      {
        id: 'STR',
        name: 'Strength',
        abbreviation: 'STR',
        description: '',
        order: 0,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
      },
    ],
    specialitySkills: [],
    combatSkills: [],
    materials: [],
    materialCategories: [],
    items: [],
    equipmentSlots: [],
    races: [
      { id: 'elf', name: 'Elf', description: '', statValues: {} },
      { id: 'human', name: 'Human', description: '', statValues: {} },
    ],
    currencyTiers: [],
    focusStatBonusLevel: 0,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char1',
    name: 'Aria',
    configurationId: 'config1',
    raceIds: ['elf'],
    investedStatPoints: { STR: 5 },
    specialitySkillBaseLevels: {},
    currentResourceValues: {},
    inventory: { equippedItems: {}, miscItems: [] },
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

describe('CharacterList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConfigStore.setState({ config: createConfig(), isLoaded: true });
    useCharacterStore.setState({ characters: [], isLoaded: true });
  });

  it('should render one card per character, with race names and a derived level', () => {
    useCharacterStore.setState({
      characters: [
        createCharacter(),
        createCharacter({
          id: 'char2',
          name: 'Borin',
          raceIds: ['human'],
          investedStatPoints: { STR: 3 },
        }),
      ],
    });

    render(<CharacterList />);

    expect(screen.getByText('Aria')).toBeDefined();
    expect(screen.getByText('Borin')).toBeDefined();
    expect(screen.getByText(/Level 5 · Elf/)).toBeDefined();
    expect(screen.getByText(/Level 3 · Human/)).toBeDefined();
  });

  it('should show race names rather than ids, degrading gracefully for a deleted race', () => {
    useCharacterStore.setState({
      characters: [createCharacter({ raceIds: ['elf', 'gone'] })],
    });

    render(<CharacterList />);

    expect(screen.getByText(/Elf, Unknown race/)).toBeDefined();
    expect(screen.queryByText(/gone/)).toBeNull();
  });

  it('should show an empty state offering creation when there are no characters', () => {
    render(<CharacterList />);

    expect(screen.getByText('No Characters Yet')).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Create Character' }).length).toBeGreaterThan(0);
  });

  it('should say there is no ruleset, and not offer creation, without a configuration', () => {
    useConfigStore.setState({ config: null, isLoaded: true });

    render(<CharacterList />);

    expect(screen.getByText('No Ruleset Yet')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Create Character' })).toBeNull();
  });

  it('should navigate to the creation wizard', () => {
    render(<CharacterList />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Create Character' })[0]);

    expect(navigate).toHaveBeenCalledWith({ to: '/play/create' });
  });

  it('should navigate to the character sheet when a character is opened', () => {
    useCharacterStore.setState({ characters: [createCharacter()] });

    render(<CharacterList />);

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    expect(navigate).toHaveBeenCalledWith({
      to: '/play/character/$id',
      params: { id: 'char1' },
    });
  });

  it('should require confirmation before deleting, and delete the right character', () => {
    useCharacterStore.setState({
      characters: [createCharacter(), createCharacter({ id: 'char2', name: 'Borin' })],
    });

    render(<CharacterList />);

    // Nothing is deleted merely by asking
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[1]);
    expect(useCharacterStore.getState().characters).toHaveLength(2);
    expect(screen.getByText(/Delete Borin\?/)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Character' }));

    const remaining = useCharacterStore.getState().characters;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('char1');
  });

  it('should leave the character intact when the confirmation is cancelled', () => {
    useCharacterStore.setState({ characters: [createCharacter()] });

    render(<CharacterList />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(useCharacterStore.getState().characters).toHaveLength(1);
    expect(screen.queryByText(/This cannot be undone/)).toBeNull();
  });
});
