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
import type { Character, ComposedItem, Inventory } from '#shared/types/character';
import type { Configuration } from '#shared/types/config';

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
    schemaVersion: 10,
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
      {
        id: 'health',
        name: 'Health',
        abbreviation: 'HEA',
        description: '',
        order: 0,
        countsTowardTotal: true,
        isResource: true,
        rounding: 'none',
        formula: 'STR * 10',
      },
    ],
    skills: [],
    diceLadders: [
      {
        id: 'ladder',
        name: 'Standard',
        description: '',
        dieSizes: [20, 12, 6],
        showZeroTerms: true,
        remainder: 'flat',
      },
    ],
    // A combat skill's bonus formula is a roll's input since TICKET-ROLL-06 — the number goes
    // *into* the ladder rather than being added after the dice
    rollDefinitions: [
      {
        id: 'mel-id',
        name: 'Melee',
        description: '',
        input: 'STR',
        ladderId: 'ladder',
        category: 'offence',
        order: 0,
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
            bonuses: [{ statId: 'STR', modifier: 2 }],
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
            bonuses: [{ statId: 'STR', modifier: 3 }],
            value: { tierId: 'gold', amount: 2 },
          },
        ],
      },
    ],
    materialCategories: [{ id: 'metal', name: 'Metal', description: '' }],
    items: [
      { id: 'helm', name: 'Iron Helm', description: '', equipmentSlotType: 'helmet' },
      { id: 'blade', name: 'Steel Blade', description: '', equipmentSlotType: 'main_hand' },
      { id: 'rope', name: 'Rope', description: '' },
    ],
    equipmentSlots: [
      { type: 'helmet', name: 'Helmet', description: '' },
      { type: 'main_hand', name: 'Main Hand', description: '' },
    ],
    races: [],
    currencyTiers: [{ id: 'gold', name: 'Gold', order: 0, conversionToNext: 10 }],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

/**
 * What the fixture character has built, one per template in the ruleset above
 *
 * TICKET-INV-05 moved the material link off the template and onto the thing a Player made — an Iron
 * Helm is a *helm built out of Iron 1* now — so the stat bonuses these cases read come from here.
 * **The build's id is the template's id**, a readability choice rather than a rule: every case says
 * `miscItems: ['helm']` and means the obvious thing.
 */
const BUILDS: ComposedItem[] = [
  { id: 'helm', templateId: 'helm', materialId: 'iron', materialLevel: 1 },
  { id: 'blade', templateId: 'blade', materialId: 'steel', materialLevel: 1 },
  { id: 'rope', templateId: 'rope' },
];

function createCharacter(
  overrides: Partial<Omit<Character, 'inventory'>> & { inventory?: Partial<Inventory> } = {}
): Character {
  const { inventory, ...rest } = overrides;

  return {
    id: 'char1',
    name: 'Aria',
    configurationId: 'config1',
    raceIds: [],
    investedStatPoints: { STR: 5 },
    investedSkillPoints: {},
    currentResourceValues: { health: 50 },
    experience: 0,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...rest,
    inventory: { equippedItems: {}, miscItems: [], composedItems: BUILDS, ...inventory },
  };
}

/**
 * The row or tile an item, slot or stat is rendered in
 *
 * An equipment slot is a tile on the equipment figure now (`<li>`), not a bordered row, so this
 * accepts either. Both are real markup rather than a hook added for the tests.
 */
function rowFor(label: string | RegExp): HTMLElement {
  const cell = screen.getByText(label);
  const row = cell.closest('li, div.border-b');
  if (!row) throw new Error(`No row found for ${label}`);
  return row as HTMLElement;
}

/**
 * The current Strength total as the sheet renders it
 *
 * Hidden nodes are ignored because the row now carries an invested-points badge in front of the
 * name whose digits are `aria-hidden` — the meaning is in an `sr-only` phrase beside them — so a
 * bare numeric query matches the badge as well as the value.
 */
function renderedStrength(): string {
  return (
    within(rowFor(/Strength \(STR\)/)).getByText(/^\d+$/, {
      ignore: 'script, style, [aria-hidden="true"]',
    }).textContent ?? ''
  );
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

  it('should put a slot on the cell the ruleset placed it (TICKET-INV-03)', () => {
    useConfigStore.setState({
      config: createConfig({
        equipmentLayout: { columns: 2, rows: 2 },
        equipmentSlots: [
          {
            type: 'helmet',
            name: 'Helmet',
            description: '',
            placement: { column: 2, row: 1, glyph: 'helm' },
          },
          {
            type: 'main_hand',
            name: 'Main Hand',
            description: '',
            placement: { column: 1, row: 2, glyph: 'axe' },
          },
        ],
      }),
      isLoaded: true,
    });

    render(<InventoryPanel characterId="char1" />);

    // The arrangement is configuration now, not a recognition table keyed on the slot's name —
    // which is why an axe rather than a sword is the whole point of the assertion
    expect(rowFor('Helmet').className).toContain('col-start-2');
    expect(rowFor('Helmet').className).toContain('row-start-1');
    expect(rowFor('Main Hand').className).toContain('col-start-1');
    expect(rowFor('Main Hand').className).toContain('row-start-2');
  });

  it('should list an unplaced slot beneath the figure rather than dropping it', () => {
    useConfigStore.setState({
      config: createConfig({
        equipmentLayout: { columns: 2, rows: 2 },
        equipmentSlots: [
          {
            type: 'helmet',
            name: 'Helmet',
            description: '',
            placement: { column: 1, row: 1, glyph: 'helm' },
          },
          { type: 'main_hand', name: 'Main Hand', description: '' },
        ],
      }),
      isLoaded: true,
    });

    render(<InventoryPanel characterId="char1" />);

    expect(rowFor('Helmet').className).toContain('col-start-1');
    expect(rowFor('Main Hand').className).not.toContain('col-start-');
  });

  it('should still draw every slot when the ruleset has never been laid out', () => {
    // The pre-builder shape, and what a Player sees until someone opens Configuration → Equipment
    render(<InventoryPanel characterId="char1" />);

    expect(rowFor('Helmet').className).not.toContain('col-start-');
    expect(rowFor('Main Hand').className).not.toContain('col-start-');
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
    // `ignore` because the equipped item is also the tile's `<option>`: the picker keeps whatever
    // is worn as its current value so swapping is one gesture. This asserts the tile *shows* it.
    expect(
      within(rowFor('Helmet')).getByText('Iron Helm', { ignore: 'script, style, option' })
    ).toBeDefined();
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

  it('should build a template from the ruleset into the pack (TICKET-INV-05)', () => {
    // The picker still offers *templates*, because building one is what taking a thing means; what
    // lands in the pack is a new `ComposedItem` whose id nothing outside the character has seen
    useCharacterStore.setState({
      characters: [createCharacter({ inventory: { composedItems: [] } })],
    });

    render(<InventoryPanel characterId="char1" />);

    fireEvent.change(screen.getByLabelText('Add an item to the pack'), {
      target: { value: 'rope' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add to Pack' }));

    const built = inventory();

    expect(built.composedItems).toEqual([{ id: expect.any(String), templateId: 'rope' }]);
    expect(built.miscItems).toEqual([built.composedItems[0].id]);
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
    useCharacterStore.setState({
      characters: [createCharacter({ inventory: { composedItems: [] } })],
    });

    render(<InventoryPanel characterId="char1" />);

    fireEvent.change(screen.getByLabelText('Add an item to the pack'), {
      target: { value: 'rope' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add to Pack' }));

    const stored = useCharacterStore.getState().characters[0].inventory;

    expect(stored.miscItems).toHaveLength(1);
    expect(stored.composedItems[0].templateId).toBe('rope');
  });
});

/**
 * How many slots a ruleset has is the User's answer, not the app's (TICKET-INV-04)
 *
 * The builder was written for a variable count; the doll and the equip path were not written
 * *against* one, and nobody had checked. So each case here goes the whole way — configure the slots,
 * lay them out through the same store action the builder's effect calls, equip into one, and read
 * the board back — at one slot, at the sheet's six, at twelve, and at none.
 */
describe('a ruleset’s slot count', () => {
  /** The v4 workbook's six body slots, `Backpack` C4:D9 */
  const SHEET_SIX = [
    'head_gear',
    'upperbody_gear',
    'lowerbody_gear',
    'foot_gear',
    'right_hand',
    'left_hand',
  ];

  /** Six the seed table has never heard of, so twelve is genuinely twelve rather than six twice */
  const INVENTED_SIX = ['horns', 'tail', 'bond', 'sigil', 'familiar', 'cloak_pin'];

  /**
   * A ruleset with exactly these slots, one carried item per slot, laid out by the store
   *
   * `seedEquipmentLayout` is the action the builder's own effect calls, so the board a Player reads
   * here is the board the builder would have written.
   */
  function withSlotTypes(types: string[]) {
    const equipmentSlots = types.map((type) => ({ type, name: type, description: '' }));
    const items = types.map((type, index) => ({
      id: `item-${index}`,
      name: `Gear ${index}`,
      description: '',
      equipmentSlotType: type,
    }));
    const carried = items.map((item) => item.id);
    // One build per template, with the build's id matching the template's — the pack holds builds
    const composedItems = items.map((item) => ({ id: item.id, templateId: item.id }));

    useConfigStore.setState({ config: createConfig({ equipmentSlots, items }), isLoaded: true });
    useConfigStore.getState().seedEquipmentLayout();
    useCharacterStore.setState({
      characters: [
        createCharacter({ inventory: { equippedItems: {}, miscItems: carried, composedItems } }),
      ],
      isLoaded: true,
    });
  }

  /**
   * The doll tile for a slot
   *
   * Found by its own control rather than by the caption, because the pack rows print the slot type
   * a carried item declares and a bare text query would match both.
   */
  function tileFor(slotName: string): HTMLElement {
    const control = screen.getByLabelText(`Equip into ${slotName}`);
    const tile = control.closest('li');
    if (!tile) throw new Error(`No tile found for ${slotName}`);
    return tile;
  }

  /** Configure, render and equip into the first slot — the end-to-end pass every count makes */
  function drive(types: string[]) {
    withSlotTypes(types);
    render(<InventoryPanel characterId="char1" />);

    expect(screen.getAllByLabelText(/^Equip into /)).toHaveLength(types.length);

    const first = types[0];
    fireEvent.change(screen.getByLabelText(`Equip into ${first}`), {
      target: { value: 'item-0' },
    });

    expect(inventory().equippedItems[first]).toBe('item-0');
  }

  it('should draw a one-slot ruleset as a figure of one', () => {
    drive(['head_gear']);

    expect(tileFor('head_gear').className).toContain('col-start-2');
    expect(tileFor('head_gear').className).toContain('row-start-1');
  });

  it('should draw the sheet’s six with every one of them on the figure', () => {
    drive(SHEET_SIX);

    for (const type of SHEET_SIX) {
      expect(tileFor(type).className, `${type} was not placed`).toContain('col-start-');
    }
  });

  it('should draw twelve slots without dropping the ones it does not recognise', () => {
    drive([...SHEET_SIX, ...INVENTED_SIX]);

    // The seed knows six of them; the other six are first-class slots the User places once, and
    // until they do the sheet lists them beneath the figure rather than losing them
    for (const type of SHEET_SIX) {
      expect(tileFor(type).className, `${type} was not placed`).toContain('col-start-');
    }
    for (const type of INVENTED_SIX) {
      expect(tileFor(type).className, `${type} was placed by guesswork`).not.toContain(
        'col-start-'
      );
    }
  });

  it('should say a ruleset defines no slots rather than draw an empty board', () => {
    withSlotTypes([]);
    render(<InventoryPanel characterId="char1" />);

    expect(screen.getByText('This ruleset defines no equipment slots.')).toBeDefined();
    expect(screen.queryByLabelText(/^Equip into /)).toBeNull();
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

  it('should carry the equipment bonus through to stats and roll inputs', () => {
    render(<CharacterSheet characterId="char1" />);

    fireEvent.change(screen.getByLabelText('Equip into Helmet'), { target: { value: 'helm' } });

    // Requirement 13.3 — STR 7 drives Health (STR * 10) and the Melee roll's input (STR)
    expect(within(rowFor('Health')).getByText('of 70 max')).toBeDefined();
    expect(within(rowFor(/^Melee$/)).getByText('input 7')).toBeDefined();
  });
});
