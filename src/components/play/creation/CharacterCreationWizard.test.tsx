/**
 * Character Creation Wizard Tests
 *
 * **Validates: Requirements 11.1-11.6, 21.1-21.5**
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
import { CharacterCreationWizard } from './CharacterCreationWizard';

function createConfig(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    mainSkills: [
      { code: 'STR', name: 'Strength', description: '', maxLevel: 10 },
      { code: 'DEX', name: 'Dexterity', description: '', maxLevel: 10 },
    ],
    stats: [{ id: 'health', name: 'Health', description: '', formula: 'STR * 10' }],
    specialitySkills: [
      { code: 'STL', name: 'Stealth', description: '', maxBaseLevel: 5, bonusFormula: 'DEX / 2' },
    ],
    combatSkills: [
      {
        code: 'MEL',
        name: 'Melee',
        description: '',
        dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 0 },
        bonusFormula: 'STR + STL',
      },
    ],
    materials: [],
    materialCategories: [],
    items: [],
    equipmentSlots: [{ type: 'main_hand', name: 'Main Hand', description: '' }],
    races: [
      {
        id: 'elf',
        name: 'Elf',
        description: '',
        skillModifiers: [{ skillCode: 'DEX', modifier: 2 }],
      },
      { id: 'human', name: 'Human', description: '', skillModifiers: [] },
    ],
    currencyTiers: [],
    focusStatBonusLevel: 3,
    mainSkillPointBudget: 12,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

const next = () => fireEvent.click(screen.getByRole('button', { name: 'Next' }));
const back = () => fireEvent.click(screen.getByRole('button', { name: 'Back' }));
const nameField = () => screen.getByLabelText(/Character Name/i);

/** Fill step 1 and advance to step 2 */
function toSkillsStep(name = 'Aria') {
  fireEvent.change(nameField(), { target: { value: name } });
  next();
}

describe('CharacterCreationWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConfigStore.setState({ config: createConfig(), isLoaded: true });
    useCharacterStore.setState({ characters: [], isLoaded: true });
  });

  it('should block step 1 until a name is entered, saying why', () => {
    render(<CharacterCreationWizard />);

    expect(screen.getByText(/Give your character a name/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);

    fireEvent.change(nameField(), { target: { value: 'Aria' } });

    expect(screen.queryByText(/Give your character a name/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false);
  });

  it('should preserve entered values when moving back and forward', () => {
    render(<CharacterCreationWizard />);

    toSkillsStep('Aria');
    fireEvent.change(screen.getByLabelText(/Strength \(STR\)/), { target: { value: '4' } });

    back();
    expect((nameField() as HTMLInputElement).value).toBe('Aria');

    next();
    expect((screen.getByLabelText(/Strength \(STR\)/) as HTMLInputElement).value).toBe('4');
  });

  it('should allow selecting zero or more races', () => {
    render(<CharacterCreationWizard />);

    // Zero races is valid — the name alone unblocks step 1
    fireEvent.change(nameField(), { target: { value: 'Aria' } });
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false);

    fireEvent.click(screen.getByLabelText('Elf'));
    fireEvent.click(screen.getByLabelText('Human'));

    expect((screen.getByLabelText('Elf') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Human') as HTMLInputElement).checked).toBe(true);
  });

  it('should show the racial modifier separately from the allocated base level', () => {
    render(<CharacterCreationWizard />);

    fireEvent.change(nameField(), { target: { value: 'Aria' } });
    fireEvent.click(screen.getByLabelText('Elf')); // DEX +2
    next();

    fireEvent.change(screen.getByLabelText(/Dexterity \(DEX\)/), { target: { value: '3' } });

    // The input still holds the allocated 3; the racial +2 and the total are shown beside it
    expect((screen.getByLabelText(/Dexterity \(DEX\)/) as HTMLInputElement).value).toBe('3');
    expect(screen.getByText(/\+2 racial/)).toBeDefined();
    expect(screen.getByText(/total 5/)).toBeDefined();
  });

  it('should block progress when a skill exceeds its max level', () => {
    render(<CharacterCreationWizard />);

    toSkillsStep();
    fireEvent.change(screen.getByLabelText(/Strength \(STR\)/), { target: { value: '11' } });

    expect(screen.getByText(/Strength cannot go above 10/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
  });

  it('should block progress when the allocation exceeds the point budget', () => {
    render(<CharacterCreationWizard />);

    toSkillsStep();
    fireEvent.change(screen.getByLabelText(/Strength \(STR\)/), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText(/Dexterity \(DEX\)/), { target: { value: '5' } });

    // Budget is 12; 15 allocated
    expect(screen.getByText(/3 point\(s\) over the budget of 12/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
  });

  it('should report points spent and remaining from the allocation validator', () => {
    render(<CharacterCreationWizard />);

    toSkillsStep();
    fireEvent.change(screen.getByLabelText(/Strength \(STR\)/), { target: { value: '4' } });

    expect(screen.getByText(/4 of 12 points spent · 8 remaining/)).toBeDefined();
  });

  it('should offer a focus stat from both main and speciality skills, stating the bonus', () => {
    render(<CharacterCreationWizard />);

    toSkillsStep();
    next();

    const select = screen.getByLabelText(/Focus stat/i) as HTMLSelectElement;
    const optionValues = [...select.options].map((option) => option.value);

    expect(optionValues).toContain('STR');
    expect(optionValues).toContain('DEX');
    expect(optionValues).toContain('STL');
    expect(screen.getByText(/\+3 levels/)).toBeDefined();
  });

  it('should show review values that match calculateCharacter for the same data', () => {
    render(<CharacterCreationWizard />);

    fireEvent.change(nameField(), { target: { value: 'Aria' } });
    fireEvent.click(screen.getByLabelText('Elf'));
    next();
    fireEvent.change(screen.getByLabelText(/Strength \(STR\)/), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/Stealth \(STL\)/), { target: { value: '1' } });
    next();
    next();

    const expected = calculateCharacter(
      {
        id: 'x',
        name: 'Aria',
        configurationId: 'config1',
        raceIds: ['elf'],
        mainSkillLevels: { STR: 5, DEX: 0 },
        specialitySkillBaseLevels: { STL: 1 },
        currentStatValues: {},
        inventory: { equippedItems: {}, miscItems: [] },
        createdAt: '',
        updatedAt: '',
      },
      createConfig()
    );

    // Read each summary row by its label, since several derived values share a number
    const rowValue = (label: string) => screen.getByText(label).parentElement?.textContent ?? '';

    expect(screen.getByText('Aria')).toBeDefined();
    expect(rowValue('Health')).toBe(`Health${expected.maxStatValues.health}`);
    expect(rowValue('Stealth (STL)')).toBe(
      `Stealth (STL)${expected.specialitySkillTotalLevels.STL}`
    );
    expect(rowValue('Melee (MEL)')).toBe(`Melee (MEL)${expected.combatSkillBonuses.MEL}`);
    expect(rowValue('Dexterity (DEX)')).toBe(`Dexterity (DEX)${expected.totalMainSkillLevels.DEX}`);
  });

  it('should create the character once and navigate to its sheet', () => {
    render(<CharacterCreationWizard />);

    fireEvent.change(nameField(), { target: { value: 'Aria' } });
    fireEvent.click(screen.getByLabelText('Elf'));
    next();
    fireEvent.change(screen.getByLabelText(/Strength \(STR\)/), { target: { value: '5' } });
    next();
    fireEvent.change(screen.getByLabelText(/Focus stat/i), { target: { value: 'STR' } });
    next();

    fireEvent.click(screen.getByRole('button', { name: 'Create Character' }));

    const characters = useCharacterStore.getState().characters;
    expect(characters).toHaveLength(1);
    expect(characters[0]).toMatchObject({
      name: 'Aria',
      raceIds: ['elf'],
      mainSkillLevels: { STR: 5 },
      focusStatCode: 'STR',
      configurationId: 'config1',
    });
    // Empty inventory — slots come from the configuration, not from the character (Req 11.6)
    expect(characters[0].inventory).toEqual({ equippedItems: {}, miscItems: [] });

    expect(navigate).toHaveBeenCalledWith({
      to: '/play/character/$id',
      params: { id: characters[0].id },
    });
  });

  it('should render an explanatory state and no form without a configuration', () => {
    useConfigStore.setState({ config: null, isLoaded: true });

    render(<CharacterCreationWizard />);

    expect(screen.getByText('No Ruleset Yet')).toBeDefined();
    expect(screen.queryByLabelText(/Character Name/i)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  });
});
