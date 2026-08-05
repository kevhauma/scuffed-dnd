/**
 * Character Sheet Tests
 *
 * Navigation is mocked at the router boundary; the stores are real, with storage mocked, so an
 * edit really goes through the store action and back out as rendered state.
 *
 * **Validates: Requirements 8.5, 9.3, 13.4, 14.1, 14.2, 14.3, 14.4, 14.5, 21.1-21.5**
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
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
      { id: 'STR', code: 'STR', name: 'Strength', description: '', maxLevel: 20 },
      { id: 'DEX', code: 'DEX', name: 'Dexterity', description: '', maxLevel: 20 },
    ],
    stats: [
      { id: 'health', name: 'Health', description: '', formula: 'STR * 10' },
      { id: 'mana', name: 'Mana', description: '', formula: 'DEX * 5' },
    ],
    specialitySkills: [
      {
        id: 'STL',
        code: 'STL',
        name: 'Stealth',
        description: '',
        maxBaseLevel: 10,
        bonusFormula: 'DEX',
      },
    ],
    combatSkills: [
      {
        id: 'MEL',
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
    expect(
      within(rowFor(/Strength \(STR\)/)).getByText(String(expected.totalMainSkillLevels.STR))
    ).toBeDefined();
    expect(
      within(rowFor(/Dexterity \(DEX\)/)).getByText(String(expected.totalMainSkillLevels.DEX))
    ).toBeDefined();
    expect(
      within(rowFor(/Stealth \(STL\)/)).getByText(String(expected.specialitySkillTotalLevels.STL))
    ).toBeDefined();
    expect(
      within(rowFor(/Melee \(MEL\)/)).getByText(`+${expected.combatSkillBonuses.MEL}`)
    ).toBeDefined();
    expect(
      within(rowFor('Health')).getByText(`of ${expected.maxStatValues.health} max`)
    ).toBeDefined();
  });

  it('should list each combat skill with its dice notation and bonus', () => {
    render(<CharacterSheet characterId="char1" />);

    expect(within(rowFor(/Melee \(MEL\)/)).getByText('2d6 + 1d20')).toBeDefined();
  });

  it('should show both current and maximum values for every stat', () => {
    render(<CharacterSheet characterId="char1" />);

    // Requirement 14.1 — STR 6 gives Health a max of 60, DEX 6 gives Mana a max of 30
    expect((within(rowFor('Health')).getByLabelText('Health') as HTMLInputElement).value).toBe(
      '60'
    );
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
    expect((within(rowFor('Health')).getByLabelText('Health') as HTMLInputElement).value).toBe(
      '60'
    );
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
  });

  describe('a formula that does not evaluate (TICKET-FORM-06)', () => {
    /**
     * The v1.0 known bug's regression: a ruleset gains a reference the characters cannot satisfy.
     * Before FORM-05/06 this blanked the entire sheet; now it costs exactly the broken value.
     */
    function renderWithBrokenStat() {
      useConfigStore.setState({
        config: createConfig({
          stats: [
            { id: 'health', name: 'Health', description: '', formula: 'NOPE * 10' },
            { id: 'evasion', name: 'Evasion', description: '', formula: 'DEX * 2' },
          ],
        }),
        isLoaded: true,
      });

      render(<CharacterSheet characterId="char1" />);
    }

    it('should keep the sheet rendering rather than replacing it with an error page', () => {
      renderWithBrokenStat();

      expect(screen.queryByRole('heading', { name: 'Ruleset Formula Error' })).toBeNull();
      expect(screen.getByRole('heading', { name: 'Main Skills' })).toBeDefined();
      expect(screen.getByRole('heading', { name: 'Stats' })).toBeDefined();
      expect(screen.getByRole('heading', { name: 'Speciality Skills' })).toBeDefined();
    });

    it('should show one chip carrying the provenance text, on the broken value only', () => {
      renderWithBrokenStat();

      const chips = screen.getAllByRole('img', { name: /Undefined variable: NOPE/ });

      expect(chips).toHaveLength(1);
      expect(chips[0].getAttribute('aria-label')).toContain('Stat "Health"');
    });

    it('should chip a broken speciality total and the combat skill that reads it', () => {
      // Melee is `STR + STL`, so breaking Stealth's own formula breaks Melee too — and the
      // combat chip must name Stealth as the cause, which is the whole point of the chain.
      useConfigStore.setState({
        config: createConfig({
          specialitySkills: [
            {
              id: 'STL',
              code: 'STL',
              name: 'Stealth',
              description: '',
              maxBaseLevel: 10,
              bonusFormula: 'MAG',
            },
          ],
        }),
        isLoaded: true,
      });

      render(<CharacterSheet characterId="char1" />);

      // The speciality's own total is unavailable
      expect(
        within(rowFor(/Stealth \(STL\)/)).getByRole('img', { name: /Undefined variable: MAG/ })
      ).toBeDefined();

      // …and Melee's chip names Stealth as the upstream cause
      const meleeChip = within(rowFor(/Melee \(MEL\)/)).getByRole('img', { name: /STL/ });
      const chain = meleeChip.getAttribute('aria-label') ?? '';
      expect(chain).toContain('Combat Skill "Melee"');
      expect(chain).toContain('Speciality Skill "Stealth"');
      expect(chain).toContain('Undefined variable: MAG');
    });

    it('should refuse to roll a combat skill whose bonus could not be calculated', () => {
      useConfigStore.setState({
        config: createConfig({
          combatSkills: [
            {
              id: 'MEL',
              code: 'MEL',
              name: 'Melee',
              description: '',
              dice: { d4: 0, d6: 2, d8: 0, d10: 0, d12: 0, d20: 1 },
              bonusFormula: 'MAG',
            },
          ],
        }),
        isLoaded: true,
      });

      render(<CharacterSheet characterId="char1" />);

      const rollButton = within(rowFor(/Melee \(MEL\)/)).getByRole('button', { name: 'Roll MEL' });
      expect((rollButton as HTMLButtonElement).disabled).toBe(true);
    });

    it('should still render every other section its numbers', () => {
      renderWithBrokenStat();

      // Evasion's own formula is fine, so its maximum is still shown: DEX 4 + elf racial 2 = 6,
      // and the formula doubles it
      expect(within(rowFor('Evasion')).getByText('of 12 max')).toBeDefined();

      // …as are the main skill totals, which never depended on the broken formula
      expect(within(rowFor(/Strength \(STR\)/)).getByText('6')).toBeDefined();
      expect(within(rowFor(/Stealth \(STL\)/)).getByText('12')).toBeDefined();
    });
  });

  describe('a main skill no character allocated (TICKET-CALC-02)', () => {
    it('should calculate a new stat over it rather than chipping the sheet', () => {
      // The original report: the User adds something to the ruleset, and every existing
      // character's sheet goes blank with `Undefined variable`. FORM-06 reduced that to one chip;
      // CALC-02 removes the chip too — a configured main skill nobody allocated is simply 0.
      useConfigStore.setState({
        config: createConfig({
          mainSkills: [
            { id: 'STR', code: 'STR', name: 'Strength', description: '', maxLevel: 20 },
            { id: 'DEX', code: 'DEX', name: 'Dexterity', description: '', maxLevel: 20 },
            { id: 'WIS', code: 'WIS', name: 'Wisdom', description: '', maxLevel: 20 }, // newly added
          ],
          stats: [
            { id: 'health', name: 'Health', description: '', formula: 'STR * 10' },
            { id: 'insight', name: 'Insight', description: '', formula: 'WIS * 3' }, // newly added
          ],
        }),
        isLoaded: true,
      });

      render(<CharacterSheet characterId="char1" />);

      // The sheet is still a sheet
      expect(screen.getByRole('heading', { level: 1, name: 'Aria' })).toBeDefined();
      expect(screen.getByRole('heading', { name: 'Stats' })).toBeDefined();

      // Health still calculates from the levels the character does have
      expect(within(rowFor('Health')).getByText('of 60 max')).toBeDefined();

      // …the new main skill reads as 0 rather than as a missing variable…
      expect(within(rowFor(/Wisdom \(WIS\)/)).getByText('0')).toBeDefined();

      // …so the new stat is a number, and nothing on the sheet is chipped
      expect(within(rowFor('Insight')).getByText('of 0 max')).toBeDefined();
      expect(screen.queryAllByRole('img', { name: /Undefined variable/ })).toHaveLength(0);
    });
  });
});
