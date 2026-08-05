/**
 * Inventory Panel Tests
 *
 * The stores are real with storage mocked, so every equip really goes through a store action —
 * which is also what makes the equipment-bonus assertions meaningful: they render the whole sheet
 * and read the numbers back out.
 *
 * **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 13.1, 13.2, 13.3, 13.5**
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

import { useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';
import { CharacterSheet } from '../sheet/CharacterSheet';
import { InventoryPanel } from './InventoryPanel';

function createConfig(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    mainSkills: [{ id: 'STR', code: 'STR', name: 'Strength', description: '', maxLevel: 20 }],
    stats: [{ id: 'health', name: 'Health', description: '', formula: 'STR * 10' }],
    specialitySkills: [],
    combatSkills: [
      {
        id: 'MEL',
        code: 'MEL',
        name: 'Melee',
        description: '',
        dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 0 },
        bonusFormula: 'STR',
      },
    ],
    materials: [
      {
        id: 'iron',
        name: 'Iron',
        description: '',
        categoryId: 'metal',
        levels: [
          {
            level: 1,
            name: 'Iron',
            bonuses: [{ skillCode: 'STR', modifier: 2 }],
            value: { tierId: 'gold', amount: 1 },
          },
        ],
      },
      {
        id: 'steel',
        name: 'Steel',
        description: '',
        categoryId: 'metal',
        levels: [
          {
            level: 1,
            name: 'Steel',
            bonuses: [{ skillCode: 'STR', modifier: 3 }],
            value: { tierId: 'gold', amount: 2 },
          },
        ],
      },
    ],
    materialCategories: [{ id: 'metal', name: 'Metal', description: '' }],
    items: [
      {
        id: 'helm',
        name: 'Iron Helm',
        description: '',
        equipmentSlotType: 'helmet',
        materialId: 'iron',
        materialLevel: 1,
      },
      {
        id: 'blade',
        name: 'Steel Blade',
        description: '',
        equipmentSlotType: 'main_hand',
        materialId: 'steel',
        materialLevel: 1,
      },
      { id: 'rope', name: 'Rope', description: '' },
    ],
    equipmentSlots: [
      { type: 'helmet', name: 'Helmet', description: '' },
      { type: 'main_hand', name: 'Main Hand', description: '' },
    ],
    races: [],
    currencyTiers: [{ id: 'gold', name: 'Gold', order: 0, conversionToNext: 10 }],
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
    raceIds: [],
    mainSkillLevels: { STR: 5 },
    specialitySkillBaseLevels: {},
    currentStatValues: { health: 50 },
    inventory: { equippedItems: {}, miscItems: [] },
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

/** The row an item or slot is rendered in */
function rowFor(label: string | RegExp): HTMLElement {
  const cell = screen.getByText(label);
  const row = cell.closest('div.border-b');
  if (!row) throw new Error(`No row found for ${label}`);
  return row as HTMLElement;
}

/** The current Strength total as the sheet renders it */
function renderedStrength(): string {
  return within(rowFor(/Strength \(STR\)/)).getByText(/^\d+$/).textContent ?? '';
}

function inventory() {
  return useCharacterStore.getState().characters[0].inventory;
}

describe('InventoryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConfigStore.setState({ config: createConfig(), isLoaded: true });
    useCharacterStore.setState({ characters: [createCharacter()], isLoaded: true });
  });

  it('should render one row per configured equipment slot, each empty', () => {
    render(<InventoryPanel characterId="char1" />);

    // Requirement 12.1
    expect(screen.getByText('Helmet')).toBeDefined();
    expect(screen.getByText('Main Hand')).toBeDefined();
    expect(within(rowFor('Helmet')).getByText(/Empty/)).toBeDefined();
  });

  it('should equip a carried item into its matching slot', () => {
    useCharacterStore.setState({
      characters: [createCharacter({ inventory: { equippedItems: {}, miscItems: ['helm'] } })],
    });

    render(<InventoryPanel characterId="char1" />);

    // Requirement 12.2 — the slot offers what fits and equipping moves it out of the pack
    fireEvent.change(screen.getByLabelText('Equip into Helmet'), { target: { value: 'helm' } });

    expect(inventory().equippedItems.helmet).toBe('helm');
    expect(inventory().miscItems).toEqual([]);
    expect(within(rowFor('Helmet')).getByText('Iron Helm')).toBeDefined();
  });

  it('should only offer carried items that fit the slot', () => {
    useCharacterStore.setState({
      characters: [
        createCharacter({ inventory: { equippedItems: {}, miscItems: ['blade', 'rope'] } }),
      ],
    });

    render(<InventoryPanel characterId="char1" />);

    // The blade belongs in the main hand, the rope nowhere — neither is offered for the helmet
    expect(screen.queryByLabelText('Equip into Helmet')).toBeNull();
    expect(within(rowFor('Helmet')).getByText(/nothing carried fits/i)).toBeDefined();

    const mainHand = screen.getByLabelText('Equip into Main Hand') as HTMLSelectElement;
    expect(Array.from(mainHand.options).map((option) => option.value)).toContain('blade');
    expect(Array.from(mainHand.options).map((option) => option.value)).not.toContain('rope');
  });

  it('should carry an item that declares no equipment slot type', () => {
    useCharacterStore.setState({
      characters: [createCharacter({ inventory: { equippedItems: {}, miscItems: ['rope'] } })],
    });

    render(<InventoryPanel characterId="char1" />);

    // Requirement 12.4 — found by the marker, since the item name also appears in the add picker
    expect(within(rowFor('no slot')).getByText('Rope')).toBeDefined();
  });

  it('should add an item from the ruleset to the pack', () => {
    render(<InventoryPanel characterId="char1" />);

    fireEvent.change(screen.getByLabelText('Add an item to the pack'), {
      target: { value: 'rope' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add to Pack' }));

    expect(inventory().miscItems).toEqual(['rope']);
  });

  it('should move an item from a slot back to the pack and in again', () => {
    useCharacterStore.setState({
      characters: [
        createCharacter({ inventory: { equippedItems: { helmet: 'helm' }, miscItems: [] } }),
      ],
    });

    render(<InventoryPanel characterId="char1" />);

    // Requirement 12.5 — out...
    fireEvent.click(screen.getByRole('button', { name: 'Unequip' }));
    expect(inventory().equippedItems.helmet).toBeUndefined();
    expect(inventory().miscItems).toEqual(['helm']);

    // ...and back in
    fireEvent.change(screen.getByLabelText('Equip into Helmet'), { target: { value: 'helm' } });
    expect(inventory().equippedItems.helmet).toBe('helm');
    expect(inventory().miscItems).toEqual([]);
  });

  it('should remove a carried item from the inventory', () => {
    useCharacterStore.setState({
      characters: [createCharacter({ inventory: { equippedItems: {}, miscItems: ['rope'] } })],
    });

    render(<InventoryPanel characterId="char1" />);

    // Requirement 12.6
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(inventory().miscItems).toEqual([]);
  });

  it('should persist through the store rather than storage directly', () => {
    render(<InventoryPanel characterId="char1" />);

    fireEvent.change(screen.getByLabelText('Add an item to the pack'), {
      target: { value: 'rope' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add to Pack' }));

    expect(useCharacterStore.getState().characters[0].inventory.miscItems).toEqual(['rope']);
  });
});

describe('equipment bonuses on the sheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConfigStore.setState({ config: createConfig(), isLoaded: true });
    useCharacterStore.setState({
      characters: [
        createCharacter({ inventory: { equippedItems: {}, miscItems: ['helm', 'blade'] } }),
      ],
      isLoaded: true,
    });
  });

  it('should raise the affected values when an item is equipped and restore them when it is not', () => {
    render(<CharacterSheet characterId="char1" />);

    // Requirement 13.1, 13.3 — Iron grants STR +2 on top of the allocated 5
    expect(renderedStrength()).toBe('5');

    fireEvent.change(screen.getByLabelText('Equip into Helmet'), { target: { value: 'helm' } });
    expect(renderedStrength()).toBe('7');
    expect(within(rowFor(/Strength \(STR\)/)).getByText('equipment +2')).toBeDefined();

    // Requirement 13.5 — unequipping takes the bonus away again
    fireEvent.click(screen.getByRole('button', { name: 'Unequip' }));
    expect(renderedStrength()).toBe('5');
  });

  it('should combine bonuses from several equipped items additively', () => {
    render(<CharacterSheet characterId="char1" />);

    fireEvent.change(screen.getByLabelText('Equip into Helmet'), { target: { value: 'helm' } });
    fireEvent.change(screen.getByLabelText('Equip into Main Hand'), { target: { value: 'blade' } });

    // Requirement 13.2 — iron +2 and steel +3 on the same skill
    expect(renderedStrength()).toBe('10');
    expect(within(rowFor(/Strength \(STR\)/)).getByText('equipment +5')).toBeDefined();
  });

  it('should carry the equipment bonus through to stats and combat skills', () => {
    render(<CharacterSheet characterId="char1" />);

    fireEvent.change(screen.getByLabelText('Equip into Helmet'), { target: { value: 'helm' } });

    // Requirement 13.3 — STR 7 drives Health (STR * 10) and the Melee bonus (STR)
    expect(within(rowFor('Health')).getByText('of 70 max')).toBeDefined();
    expect(within(rowFor(/Melee \(MEL\)/)).getByText('+7')).toBeDefined();
  });
});
