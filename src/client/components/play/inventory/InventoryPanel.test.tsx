/**
 * Inventory Panel Tests
 *
 * The stores are real with storage mocked, so every equip really goes through a store action —
 * which is also what makes the equipment-bonus assertions meaningful: they render the whole sheet
 * and read the numbers back out.
 *
 * **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 13.1, 13.2, 13.3, 13.5**
 */

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { backpackOf } from '#shared/engine/composedItems';
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
 * `equippedItems: { helmet: 'helm' }` and means the obvious thing.
 *
 * Every one of them is in the **Backpack** unless a case wears it, because the Backpack is derived
 * as everything built and not worn (TICKET-INV-06) — there is no carried list to put them on.
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
    inventory: { equippedItems: {}, composedItems: BUILDS, ...inventory },
  };
}

/** The phrase a build goes by, as the panel derives it (TICKET-INV-06) */
const IRON_HELM = 'Iron 1 Iron Helm with empty inlay';
const STEEL_BLADE = 'Steel 1 Steel Blade with empty inlay';
const ROPE = 'Rope with empty inlay';

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

/** What the Backpack currently holds, derived exactly as the panel derives it (TICKET-INV-06) */
function backpack(): string[] {
  const character = useCharacterStore.getState().characters[0];
  const config = useConfigStore.getState().config as Configuration;

  return backpackOf(character, config).map((build) => build.id);
}

describe('InventoryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConfigStore.setState({ config: createConfig(), isLoaded: true });
    useCharacterStore.setState({ characters: [createCharacter()], isLoaded: true });
  });

  it('should render one row per configured equipment slot, each empty', () => {
    render(<InventoryPanel characterId="char1" />);

    // Requirement 12.1. `ignore` throughout because a tile with a candidate in the bag also renders
    // the picker's own "Empty" placeholder `<option>` — the assertion is about what the tile *shows*
    expect(screen.getByText('Helmet')).toBeDefined();
    expect(screen.getByText('Main Hand')).toBeDefined();
    expect(within(rowFor('Helmet')).getByText(/Empty/, { ignore: 'option' })).toBeDefined();
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

  it('should equip a build from the Backpack into its matching slot', () => {
    render(<InventoryPanel characterId="char1" />);

    // Requirement 12.2 — the slot offers what fits, and equipping takes the row out of the bag
    // without anything writing to a carried list (TICKET-INV-06)
    fireEvent.change(screen.getByLabelText('Equip into Helmet'), { target: { value: 'helm' } });

    expect(inventory().equippedItems.helmet).toBe('helm');
    expect(backpack()).toEqual(['blade', 'rope']);
    // `ignore` because the equipped item is also the tile's `<option>`: the picker keeps whatever
    // is worn as its current value so swapping is one gesture. This asserts the tile *shows* it.
    expect(
      within(rowFor('Helmet')).getByText(IRON_HELM, { ignore: 'script, style, option' })
    ).toBeDefined();
  });

  it('should only offer bagged builds that fit the slot', () => {
    useCharacterStore.setState({
      characters: [
        createCharacter({
          inventory: { composedItems: BUILDS.filter((build) => build.id !== 'helm') },
        }),
      ],
    });

    render(<InventoryPanel characterId="char1" />);

    // The blade belongs in the main hand, the rope nowhere — neither is offered for the helmet
    expect(screen.queryByLabelText('Equip into Helmet')).toBeNull();
    expect(within(rowFor('Helmet')).getByText(/nothing in the bag fits/i)).toBeDefined();

    const mainHand = screen.getByLabelText('Equip into Main Hand') as HTMLSelectElement;
    expect(Array.from(mainHand.options).map((option) => option.value)).toContain('blade');
    expect(Array.from(mainHand.options).map((option) => option.value)).not.toContain('rope');
  });

  it('should carry a build whose template declares no equipment slot type', () => {
    render(<InventoryPanel characterId="char1" />);

    // Requirement 12.4 — found by the marker rather than by the name, which the tiles also carry
    expect(within(rowFor('no slot')).getByText(ROPE)).toBeDefined();
  });

  it('should name every build by the phrase its links spell (TICKET-INV-06)', () => {
    render(<InventoryPanel characterId="char1" />);

    // `<Material N> <Template> with <Inlay N|empty> inlay`, derived every render — the sheet's own
    // concatenation, minus the double space its item cell carries. `ignore` because an equippable
    // build is named twice: once in its Backpack row, once as the tile picker's `<option>`
    expect(screen.getByText(IRON_HELM, { ignore: 'option' })).toBeDefined();
    expect(screen.getByText(STEEL_BLADE, { ignore: 'option' })).toBeDefined();
    expect(screen.getByText(ROPE)).toBeDefined();
  });

  it('should relabel every build made of a material when the material is renamed', () => {
    // The reason the phrase is derived rather than stored, in one case: nothing rewrites the
    // character, and the next render is the whole of the update
    render(<InventoryPanel characterId="char1" />);

    expect(screen.getByText(IRON_HELM, { ignore: 'option' })).toBeDefined();

    const config = createConfig();
    const renamed = config.materials.map((family) =>
      family.id === 'iron' ? { ...family, name: 'Pig Iron' } : family
    );

    act(() => {
      useConfigStore.setState({ config: { ...config, materials: renamed }, isLoaded: true });
    });

    expect(
      screen.getByText('Pig Iron 1 Iron Helm with empty inlay', { ignore: 'option' })
    ).toBeDefined();
    expect(screen.queryByText(IRON_HELM, { ignore: 'option' })).toBeNull();
  });

  it('should build a template, a material and a tier into one thing (TICKET-INV-06)', () => {
    useCharacterStore.setState({
      characters: [createCharacter({ inventory: { composedItems: [] } })],
    });

    render(<InventoryPanel characterId="char1" />);

    fireEvent.change(screen.getByLabelText('Item'), { target: { value: 'rope' } });
    fireEvent.change(screen.getByLabelText('Material'), { target: { value: 'iron' } });
    fireEvent.change(screen.getByLabelText('Material tier'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Build' }));

    const built = inventory();

    expect(built.composedItems).toEqual([
      { id: expect.any(String), templateId: 'rope', materialId: 'iron', materialLevel: 1 },
    ]);
    // And it is in the bag by virtue of not being worn — nothing put it there
    expect(backpack()).toEqual([built.composedItems[0].id]);
  });

  it('should offer only the rungs a family actually has', () => {
    // Iron has one tier and Steel has one; a family with a gap offers the rungs it holds and no
    // others, which is what makes an absent tier unpickable rather than a refusal a Player meets
    render(<InventoryPanel characterId="char1" />);

    fireEvent.change(screen.getByLabelText('Material'), { target: { value: 'iron' } });

    const tiers = screen.getByLabelText('Material tier') as HTMLSelectElement;
    const offered = Array.from(tiers.options)
      .filter((option) => !option.disabled)
      .map((option) => option.value);

    expect(offered).toEqual(['1']);
  });

  it('should not build until an item, a material and a tier are all picked', () => {
    render(<InventoryPanel characterId="char1" />);

    const button = screen.getByRole('button', { name: 'Build' }) as HTMLButtonElement;

    expect(button.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Item'), { target: { value: 'rope' } });
    expect((screen.getByRole('button', { name: 'Build' }) as HTMLButtonElement).disabled).toBe(
      true
    );

    fireEvent.change(screen.getByLabelText('Material'), { target: { value: 'iron' } });
    fireEvent.change(screen.getByLabelText('Material tier'), { target: { value: '1' } });
    expect((screen.getByRole('button', { name: 'Build' }) as HTMLButtonElement).disabled).toBe(
      false
    );
  });

  it('should move a build from a slot back to the Backpack and in again', () => {
    useCharacterStore.setState({
      characters: [createCharacter({ inventory: { equippedItems: { helmet: 'helm' } } })],
    });

    render(<InventoryPanel characterId="char1" />);

    // Requirement 12.5 — out...
    expect(backpack()).toEqual(['blade', 'rope']);
    fireEvent.click(screen.getByRole('button', { name: 'Unequip' }));
    expect(inventory().equippedItems.helmet).toBeUndefined();
    expect(backpack()).toEqual(['helm', 'blade', 'rope']);

    // ...and back in
    fireEvent.change(screen.getByLabelText('Equip into Helmet'), { target: { value: 'helm' } });
    expect(inventory().equippedItems.helmet).toBe('helm');
    expect(backpack()).toEqual(['blade', 'rope']);
  });

  it('should destroy a bagged build when it is removed', () => {
    render(<InventoryPanel characterId="char1" />);

    // Requirement 12.6 — the rope's row, found through the phrase that names it
    const row = rowFor(ROPE);
    fireEvent.click(within(row).getByRole('button', { name: 'Remove' }));

    expect(backpack()).toEqual(['helm', 'blade']);
    expect(inventory().composedItems.map((build) => build.id)).toEqual(['helm', 'blade']);
  });

  it('should persist through the store rather than storage directly', () => {
    useCharacterStore.setState({
      characters: [createCharacter({ inventory: { composedItems: [] } })],
    });

    render(<InventoryPanel characterId="char1" />);

    fireEvent.change(screen.getByLabelText('Item'), { target: { value: 'rope' } });
    fireEvent.change(screen.getByLabelText('Material'), { target: { value: 'iron' } });
    fireEvent.change(screen.getByLabelText('Material tier'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Build' }));

    const stored = useCharacterStore.getState().characters[0].inventory;

    expect(stored.composedItems).toHaveLength(1);
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
   * A ruleset with exactly these slots, one bagged build per slot, laid out by the store
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
    // One build per template, with the build's id matching the template's. None of them is worn, so
    // all of them are in the Backpack and every slot has its candidate (TICKET-INV-06)
    const composedItems = items.map((item) => ({ id: item.id, templateId: item.id }));

    useConfigStore.setState({ config: createConfig({ equipmentSlots, items }), isLoaded: true });
    useConfigStore.getState().seedEquipmentLayout();
    useCharacterStore.setState({
      characters: [createCharacter({ inventory: { equippedItems: {}, composedItems } })],
      isLoaded: true,
    });
  }

  /**
   * The doll tile for a slot
   *
   * Found by its own control rather than by the caption, because the Backpack rows print the slot
   * type a bagged build declares and a bare text query would match both.
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
      characters: [createCharacter({ inventory: { equippedItems: {} } })],
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
