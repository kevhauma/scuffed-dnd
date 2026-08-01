/**
 * Character Sheet Tests
 *
 * Navigation is mocked at the router boundary; the stores are real, with storage mocked, so an
 * edit really goes through the store action and back out as rendered state.
 *
 * **Validates: Requirements 8.5, 9.3, 13.4, 14.1, 14.2, 14.3, 14.4, 14.5, 21.1-21.5**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
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

import { calculateCharacter } from '../../../engine/calculator';
import { useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';
import { CharacterSheet } from './CharacterSheet';

function createConfig(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    mainSkills: [
      { code: 'STR', name: 'Strength', description: '', maxLevel: 20 },
      { code: 'DEX', name: 'Dexterity', description: '', maxLevel: 20 },
    ],
    stats: [
      { id: 'health', name: 'Health', description: '', formula: 'STR * 10' },
      { id: 'mana', name: 'Mana', description: '', formula: 'DEX * 5' },
    ],
    specialitySkills: [
      { code: 'STL', name: 'Stealth', description: '', maxBaseLevel: 10, bonusFormula: 'DEX' },
    ],
    combatSkills: [
      {
        code: 'MEL',
        name: 'Melee',
        description: '',
        dice: { d4: 0, d6: 2, d8: 0, d10: 0, d12: 0, d20: 1 },
        bonusFormula: 'STR + STL',
      },
    ],
    materials: [],
    materialCategories: [],
    items: [],
    equipmentSlots: [],
    races: [
      {
        id: 'elf',
        name: 'Elf',
        description: '',
        skillModifiers: [{ skillCode: 'DEX', modifier: 2 }],
      },
      {
        id: 'human',
        name: 'Human',
        description: '',
        skillModifiers: [{ skillCode: 'DEX', modifier: 1 }],
      },
    ],
    currencyTiers: [],
    focusStatBonusLevel: 3,
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
    mainSkillLevels: { STR: 6, DEX: 4 },
    focusStatCode: 'STL',
    specialitySkillBaseLevels: { STL: 3 },
    currentStatValues: { health: 60, mana: 30 },
    inventory: { equippedItems: {}, miscItems: [] },
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

/**
 * The row a skill or stat is rendered in, found by its visible label
 *
 * Every row type — skill breakdown, stat editor, combat skill — is the one element carrying the
 * separator border, so that is what identifies the row rather than a test-only attribute.
 */
function rowFor(label: string | RegExp): HTMLElement {
  const cell = screen.getByText(label);
  const row = cell.closest('div.border-b');
  if (!row) throw new Error(`No row found for ${label}`);
  return row as HTMLElement;
}

describe('CharacterSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConfigStore.setState({ config: createConfig(), isLoaded: true });
    useCharacterStore.setState({ characters: [createCharacter()], isLoaded: true });
  });

  it('should render the header, every section, and the character identity', () => {
    render(<CharacterSheet characterId="char1" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Aria' })).toBeDefined();
    expect(screen.getByText(/Level 10 · Elf · focus: STL/)).toBeDefined();

    for (const section of [
      'Racial Modifiers',
      'Main Skills',
      'Stats',
      'Speciality Skills',
      'Combat Skills',
    ]) {
      expect(screen.getByRole('heading', { name: section })).toBeDefined();
    }
  });

  it('should combine racial modifiers additively across multiple races', () => {
    // Elf gives DEX +2, Human gives DEX +1 (Requirement 8.5, 8.3, 8.4)
    useCharacterStore.setState({
      characters: [createCharacter({ raceIds: ['elf', 'human'] })],
    });

    render(<CharacterSheet characterId="char1" />);

    expect(screen.getByText('DEX +3')).toBeDefined();
    expect(within(rowFor(/Dexterity \(DEX\)/)).getByText('racial +3')).toBeDefined();
  });

  it("should show a main skill's contributions separately from its total", () => {
    render(<CharacterSheet characterId="char1" />);

    const dexterity = rowFor(/Dexterity \(DEX\)/);
    // Allocated and racial are shown apart (Requirement 13.4), not folded into the total
    expect(within(dexterity).getByText('allocated +4')).toBeDefined();
    expect(within(dexterity).getByText('racial +2')).toBeDefined();
    expect(within(dexterity).getByText('6')).toBeDefined();
  });

  it('should mark the focus stat and show the bonus it grants', () => {
    render(<CharacterSheet characterId="char1" />);

    const stealth = rowFor(/Stealth \(STL\)/);
    expect(within(stealth).getByText('focus stat')).toBeDefined();
    expect(within(stealth).getByText('focus +3')).toBeDefined();
  });

  it('should render values that match calculateCharacter for the same character', () => {
    const config = createConfig();
    const character = createCharacter();
    const expected = calculateCharacter(character, config);

    render(<CharacterSheet characterId="char1" />);

    // Main skills, speciality totals, combat bonuses and stat maxima all come from the engine
    expect(within(rowFor(/Strength \(STR\)/)).getByText(String(expected.totalMainSkillLevels.STR)))
      .toBeDefined();
    expect(within(rowFor(/Dexterity \(DEX\)/)).getByText(String(expected.totalMainSkillLevels.DEX)))
      .toBeDefined();
    expect(
      within(rowFor(/Stealth \(STL\)/)).getByText(String(expected.specialitySkillTotalLevels.STL))
    ).toBeDefined();
    expect(
      within(rowFor(/Melee \(MEL\)/)).getByText(`+${expected.combatSkillBonuses.MEL}`)
    ).toBeDefined();
    expect(within(rowFor('Health')).getByText(`of ${expected.maxStatValues.health} max`))
      .toBeDefined();
  });

  it('should list each combat skill with its dice notation and bonus', () => {
    render(<CharacterSheet characterId="char1" />);

    expect(within(rowFor(/Melee \(MEL\)/)).getByText('2d6 + 1d20')).toBeDefined();
  });

  it('should show both current and maximum values for every stat', () => {
    render(<CharacterSheet characterId="char1" />);

    // Requirement 14.1 — STR 6 gives Health a max of 60, DEX 6 gives Mana a max of 30
    expect((within(rowFor('Health')).getByLabelText('Health') as HTMLInputElement).value).toBe('60');
    expect(within(rowFor('Health')).getByText('of 60 max')).toBeDefined();
    expect((within(rowFor('Mana')).getByLabelText('Mana') as HTMLInputElement).value).toBe('30');
    expect(within(rowFor('Mana')).getByText('of 30 max')).toBeDefined();
  });

  it('should persist a changed current stat value through the store', () => {
    render(<CharacterSheet characterId="char1" />);

    fireEvent.change(within(rowFor('Mana')).getByLabelText('Mana'), { target: { value: '12' } });

    // Requirement 14.2, 14.5 — the store holds it and the sheet re-reads it
    expect(useCharacterStore.getState().characters[0].currentStatValues.mana).toBe(12);
    expect((within(rowFor('Mana')).getByLabelText('Mana') as HTMLInputElement).value).toBe('12');
  });

  it('should clamp a current stat value at its maximum', () => {
    render(<CharacterSheet characterId="char1" />);

    const health = within(rowFor('Health')).getByLabelText('Health');
    fireEvent.change(health, { target: { value: '999' } });
    fireEvent.blur(health);

    // Requirement 14.3 — the store refuses to store more than the calculated max of 60
    expect(useCharacterStore.getState().characters[0].currentStatValues.health).toBe(60);
    expect((within(rowFor('Health')).getByLabelText('Health') as HTMLInputElement).value).toBe('60');
  });

  it('should allow a negative current stat value', () => {
    render(<CharacterSheet characterId="char1" />);

    fireEvent.change(within(rowFor('Health')).getByLabelText('Health'), {
      target: { value: '-5' },
    });

    // Requirement 14.4 — the clamp is one-sided
    expect(useCharacterStore.getState().characters[0].currentStatValues.health).toBe(-5);
  });

  it('should step a stat down with the decrease control', () => {
    render(<CharacterSheet characterId="char1" />);

    fireEvent.click(screen.getByLabelText('Decrease Health'));

    expect(useCharacterStore.getState().characters[0].currentStatValues.health).toBe(59);
  });

  it('should navigate back to the character list', () => {
    render(<CharacterSheet characterId="char1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Back to Characters' }));

    expect(navigate).toHaveBeenCalledWith({ to: '/play' });
  });

  describe('states without a sheet', () => {
    it('should explain that no ruleset is loaded', () => {
      useConfigStore.setState({ config: null, isLoaded: true });

      render(<CharacterSheet characterId="char1" />);

      expect(screen.getByRole('heading', { name: 'No Ruleset Yet' })).toBeDefined();
      expect(screen.queryByRole('heading', { name: 'Main Skills' })).toBeNull();
    });

    it('should explain that no character has this id', () => {
      render(<CharacterSheet characterId="missing" />);

      expect(screen.getByRole('heading', { name: 'Character Not Found' })).toBeDefined();
      expect(screen.queryByRole('heading', { name: 'Main Skills' })).toBeNull();
    });

    it('should explain that the character belongs to another ruleset', () => {
      useCharacterStore.setState({
        characters: [createCharacter({ configurationId: 'another-config' })],
      });

      render(<CharacterSheet characterId="char1" />);

      expect(screen.getByRole('heading', { name: 'Different Ruleset Loaded' })).toBeDefined();
      expect(screen.queryByRole('heading', { name: 'Main Skills' })).toBeNull();
    });

    it('should surface a formula that does not evaluate', () => {
      useConfigStore.setState({
        config: createConfig({
          stats: [{ id: 'health', name: 'Health', description: '', formula: 'NOPE * 10' }],
        }),
        isLoaded: true,
      });

      render(<CharacterSheet characterId="char1" />);

      expect(screen.getByRole('heading', { name: 'Ruleset Formula Error' })).toBeDefined();
      expect(screen.queryByRole('heading', { name: 'Main Skills' })).toBeNull();
    });
  });
});
