/**
 * Character Store Tests
 *
 * Unit tests for the character store with auto-save functionality.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character, CharacterCreationData } from '#shared/types/character';
import type { Configuration } from '#shared/types/config';
import * as storage from '../services/storage';
import { useCharacterStore } from './characterStore';

// Mock storage service
vi.mock('../services/storage', () => ({
  saveCharacters: vi.fn(),
  loadCharacters: vi.fn(() => []),
}));

/**
 * Create through the store, failing the test rather than the typechecker when it refuses
 *
 * `createCharacter` is nullable since TICKET-RACE-02. Tests about *what* gets created say so once
 * here; the tests about the refusal itself call the action directly and assert the `null`.
 */
function createOrFail(data: CharacterCreationData, config: Configuration): Character {
  const character = useCharacterStore.getState().createCharacter(data, config);
  if (!character) throw new Error('The store refused to create the character');
  return character;
}

describe('CharacterStore', () => {
  beforeEach(() => {
    // Reset store state
    useCharacterStore.setState({ characters: [], isLoaded: false });
    vi.clearAllMocks();
  });

  describe('loadCharacters', () => {
    it('should load characters from storage', () => {
      const mockCharacters: Character[] = [
        {
          id: 'char-1',
          name: 'Test Character',
          configurationId: 'config-1',
          raceIds: ['race-1'],
          investedStatPoints: { STR: 10 },
          investedSkillPoints: {},
          currentResourceValues: {},
          experience: 0,
          inventory: { equippedItems: {}, miscItems: [] },
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      vi.mocked(storage.loadCharacters).mockReturnValue(mockCharacters);

      useCharacterStore.getState().loadCharacters();

      expect(useCharacterStore.getState().characters).toEqual(mockCharacters);
      expect(useCharacterStore.getState().isLoaded).toBe(true);
    });
  });

  describe('createCharacter', () => {
    /** A ruleset with one stat, so seeded current values are observable */
    const testConfig: Configuration = {
      id: 'config-1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 9,
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
          id: 'DEX',
          name: 'Dexterity',
          abbreviation: 'DEX',
          description: '',
          order: 1,
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
      materials: [],
      materialCategories: [],
      items: [],
      equipmentSlots: [{ type: 'main_hand', name: 'Main Hand', description: '' }],
      races: [],
      currencyTiers: [],
      // Since TICKET-RES-02 creation is refused when the derived budget cannot pay for the
      // allocation, so this block prices a pool generous enough that each case still tests the one
      // thing it names. The refusal itself has its own cases below.
      constants: [
        {
          id: 'const-ppl',
          name: 'points_per_level',
          displayName: 'Points per level',
          description: '',
          value: 100,
        },
      ],
      curves: [
        {
          id: 'curve-xp',
          name: 'xp_thresholds',
          displayName: 'XP thresholds',
          description: '',
          keyName: 'level',
          columns: [{ id: 'curve-xp-col', name: 'xp_required' }],
          rows: [
            { key: 1, values: [0] },
            { key: 2, values: [300] },
          ],
          interpolation: 'step',
          outOfRange: 'extrapolate',
          lookupDirection: 'reverse',
        },
      ],
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    it('should refuse an allocation the derived budget cannot pay for (TICKET-RES-02)', () => {
      // The wizard's step blocks this too, but the judgement belongs to the store — a second
      // creation path must not be able to mint an over-budget character
      const poor: Configuration = {
        ...testConfig,
        constants: [
          {
            id: 'const-ppl',
            name: 'points_per_level',
            displayName: 'Points per level',
            description: '',
            value: 3,
          },
        ],
      };

      const refused = useCharacterStore.getState().createCharacter(
        {
          name: 'Too Rich',
          raceIds: [],
          investedStatPoints: { STR: 10 },
          investedSkillPoints: {},
        },
        poor
      );

      expect(refused).toBeNull();
      expect(useCharacterStore.getState().characters).toHaveLength(0);
      expect(storage.saveCharacters).not.toHaveBeenCalled();
    });

    it('should refuse creation entirely when the budget cannot be derived', () => {
      const noCurve: Configuration = { ...testConfig, curves: [] };

      expect(
        useCharacterStore
          .getState()
          .createCharacter(
            { name: 'Unpriced', raceIds: [], investedStatPoints: {}, investedSkillPoints: {} },
            noCurve
          )
      ).toBeNull();
    });

    it('should create a new character and save to storage', () => {
      const creationData: CharacterCreationData = {
        name: 'New Character',
        raceIds: ['race-1'],
        investedStatPoints: { STR: 10, DEX: 8 },
        archetypeId: 'strong',
        investedSkillPoints: { SWD: 5 },
      };

      const character = createOrFail(creationData, testConfig);

      expect(character.name).toBe('New Character');
      expect(character.raceIds).toEqual(['race-1']);
      expect(character.investedStatPoints).toEqual({ STR: 10, DEX: 8 });
      expect(character.archetypeId).toBe('strong');
      expect(character.configurationId).toBe('config-1');
      expect(character.id).toBeDefined();
      expect(character.createdAt).toBeDefined();
      expect(character.updatedAt).toBeDefined();

      expect(useCharacterStore.getState().characters).toHaveLength(1);
      expect(storage.saveCharacters).toHaveBeenCalledWith([character]);
    });

    it('should initialize empty inventory', () => {
      const creationData: CharacterCreationData = {
        name: 'Test',
        raceIds: [],
        investedStatPoints: {},
        investedSkillPoints: {},
      };

      const character = createOrFail(creationData, testConfig);

      expect(character.inventory).toEqual({
        equippedItems: {},
        miscItems: [],
      });
    });

    it('should seed current stat values to their calculated maxima', () => {
      const creationData: CharacterCreationData = {
        name: 'Full Health',
        raceIds: [],
        investedStatPoints: { STR: 7 },
        investedSkillPoints: {},
      };

      const character = createOrFail(creationData, testConfig);

      // health = STR * 10, so a new character starts at full rather than at zero
      expect(character.currentResourceValues).toEqual({ health: 70 });
    });

    it('should still create the character when a stat formula does not evaluate', () => {
      const brokenConfig: Configuration = {
        ...testConfig,
        stats: [
          // STR is kept alongside the broken stat: since TICKET-RES-02 an allocation naming an id
          // the ruleset does not define is itself a refusal, and this case is about the *formula*
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
            id: 'mana',
            name: 'Mana',
            abbreviation: 'MAN',
            description: '',
            order: 1,
            countsTowardTotal: true,
            isResource: false,
            rounding: 'none',
            formula: 'WIS * 5',
          },
        ],
      };
      const creationData: CharacterCreationData = {
        name: 'Survivor',
        raceIds: [],
        investedStatPoints: { STR: 3 },
        investedSkillPoints: {},
      };

      const character = createOrFail(creationData, brokenConfig);

      expect(character.name).toBe('Survivor');
      expect(character.currentResourceValues).toEqual({});
      expect(useCharacterStore.getState().characters).toHaveLength(1);
    });

    it('should seed the stats that calculate and leave out only the broken one', () => {
      // TICKET-FORM-05: one broken formula no longer costs the Player every other stat's seed
      const partlyBrokenConfig: Configuration = {
        ...testConfig,
        stats: [
          ...testConfig.stats.filter((stat) => stat.formula === undefined),
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
          {
            id: 'mana',
            name: 'Mana',
            abbreviation: 'MAN',
            description: '',
            order: 0,
            countsTowardTotal: true,
            isResource: true,
            rounding: 'none',
            formula: 'WIS * 5',
          }, // WIS is undefined
        ],
      };
      const creationData: CharacterCreationData = {
        name: 'Half Broken',
        raceIds: [],
        investedStatPoints: { STR: 4 },
        investedSkillPoints: {},
      };

      const character = createOrFail(creationData, partlyBrokenConfig);

      expect(character.currentResourceValues).toEqual({ health: 40 });
      expect(character.currentResourceValues.mana).toBeUndefined();
    });

    it('should refuse a third race, storing nothing (TICKET-RACE-02)', () => {
      // The blend is defined over two; a third has no base to compute, so the write is refused
      // rather than a character being stored that the composition cannot answer for
      const creationData: CharacterCreationData = {
        name: 'Chimera',
        raceIds: ['race-1', 'race-2', 'race-3'],
        investedStatPoints: {},
        investedSkillPoints: {},
      };

      const character = useCharacterStore.getState().createCharacter(creationData, testConfig);

      expect(character).toBeNull();
      expect(useCharacterStore.getState().characters).toHaveLength(0);
      expect(storage.saveCharacters).not.toHaveBeenCalled();
    });

    it('should accept none, one or two races', () => {
      const forRaces = (raceIds: string[]): CharacterCreationData => ({
        name: raceIds.join('-') || 'raceless',
        raceIds,
        investedStatPoints: {},
        investedSkillPoints: {},
      });

      // Zero stays legal: a ruleset may define no races at all (Requirement 11.2)
      expect(createOrFail(forRaces([]), testConfig).raceIds).toEqual([]);
      expect(createOrFail(forRaces(['race-1']), testConfig).raceIds).toEqual(['race-1']);
      expect(createOrFail(forRaces(['race-1', 'race-2']), testConfig).raceIds).toEqual([
        'race-1',
        'race-2',
      ]);
    });
  });

  describe('updateCharacter', () => {
    it('should update character and save to storage', () => {
      const character: Character = {
        id: 'char-1',
        name: 'Original Name',
        configurationId: 'config-1',
        raceIds: [],
        investedStatPoints: {},
        investedSkillPoints: {},
        currentResourceValues: {},
        experience: 0,
        inventory: { equippedItems: {}, miscItems: [] },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      useCharacterStore.setState({ characters: [character], isLoaded: true });

      useCharacterStore.getState().updateCharacter('char-1', { name: 'Updated Name' });

      const updated = useCharacterStore.getState().characters[0];
      expect(updated.name).toBe('Updated Name');
      expect(updated.updatedAt).not.toBe(character.updatedAt);
      expect(storage.saveCharacters).toHaveBeenCalled();
    });

    it('should refuse a patch that would give a character a third race (TICKET-RACE-02)', () => {
      const character: Character = {
        id: 'char-1',
        name: 'Hybrid',
        configurationId: 'config-1',
        raceIds: ['race-1', 'race-2'],
        investedStatPoints: {},
        investedSkillPoints: {},
        currentResourceValues: {},
        experience: 0,
        inventory: { equippedItems: {}, miscItems: [] },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      useCharacterStore.setState({ characters: [character], isLoaded: true });

      useCharacterStore
        .getState()
        .updateCharacter('char-1', { raceIds: ['race-1', 'race-2', 'race-3'] });

      // Nothing moved — not the races, and not the rest of the patch either
      expect(useCharacterStore.getState().characters[0]).toEqual(character);
      expect(storage.saveCharacters).not.toHaveBeenCalled();
    });

    it('should not accept the fields a guarded action owns (CR-12)', () => {
      const update = useCharacterStore.getState().updateCharacter;

      // Compile-time assertions: each of these has a home elsewhere, and `CharacterPatch` is what
      // keeps this action from being the obvious-looking way around it. A `@ts-expect-error` that
      // stops erroring fails the typecheck, so widening the patch cannot pass unnoticed.
      // @ts-expect-error — XP is `awardExperience`/`deductExperience`; level derives from it
      update('char-1', { experience: 9999 });
      // @ts-expect-error — the allocation budget is refused in `setInvestedStatPoints`
      update('char-1', { investedStatPoints: { 'str-id': 9999 } });
      // @ts-expect-error — identity, not content
      update('char-1', { id: 'someone-else' });
      // @ts-expect-error — identity, not content
      update('char-1', { configurationId: 'another-ruleset' });

      // And the point of the type: nothing above reached the store
      expect(useCharacterStore.getState().characters).toEqual([]);
    });
  });

  describe('deleteCharacter', () => {
    it('should delete character and save to storage', () => {
      const character: Character = {
        id: 'char-1',
        name: 'Test',
        configurationId: 'config-1',
        raceIds: [],
        investedStatPoints: {},
        investedSkillPoints: {},
        currentResourceValues: {},
        experience: 0,
        inventory: { equippedItems: {}, miscItems: [] },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      useCharacterStore.setState({ characters: [character], isLoaded: true });

      useCharacterStore.getState().deleteCharacter('char-1');

      expect(useCharacterStore.getState().characters).toHaveLength(0);
      expect(storage.saveCharacters).toHaveBeenCalledWith([]);
    });
  });

  describe('getCharacter', () => {
    it('should return character by ID', () => {
      const character: Character = {
        id: 'char-1',
        name: 'Test',
        configurationId: 'config-1',
        raceIds: [],
        investedStatPoints: {},
        investedSkillPoints: {},
        currentResourceValues: {},
        experience: 0,
        inventory: { equippedItems: {}, miscItems: [] },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      useCharacterStore.setState({ characters: [character], isLoaded: true });

      const found = useCharacterStore.getState().getCharacter('char-1');
      expect(found).toEqual(character);
    });

    it('should return undefined for non-existent character', () => {
      const found = useCharacterStore.getState().getCharacter('non-existent');
      expect(found).toBeUndefined();
    });
  });

  describe('Inventory Management', () => {
    let character: Character;

    /**
     * `item-1` and `item-2` are helmets; `item-gloves` belongs to another slot and `item-loose`
     * declares no slot at all — the two cases Requirement 12.3 has to refuse.
     */
    const inventoryConfig: Configuration = {
      id: 'config-1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 9,
      stats: [],
      skills: [],
      materials: [],
      materialCategories: [],
      items: [
        { id: 'item-1', name: 'Iron Helm', description: '', equipmentSlotType: 'helmet' },
        { id: 'item-2', name: 'Steel Helm', description: '', equipmentSlotType: 'helmet' },
        { id: 'item-gloves', name: 'Gloves', description: '', equipmentSlotType: 'hands' },
        { id: 'item-loose', name: 'Rope', description: '' },
      ],
      equipmentSlots: [
        { type: 'helmet', name: 'Helmet', description: '' },
        { type: 'hands', name: 'Hands', description: '' },
      ],
      races: [],
      currencyTiers: [],
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    beforeEach(() => {
      character = {
        id: 'char-1',
        name: 'Test',
        configurationId: 'config-1',
        raceIds: [],
        investedStatPoints: {},
        investedSkillPoints: {},
        currentResourceValues: {},
        experience: 0,
        inventory: { equippedItems: {}, miscItems: [] },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      useCharacterStore.setState({ characters: [character], isLoaded: true });
    });

    describe('equipItem', () => {
      it('should equip item to slot', () => {
        useCharacterStore.getState().equipItem('char-1', 'helmet', 'item-1', inventoryConfig);

        const updated = useCharacterStore.getState().characters[0];
        expect(updated.inventory.equippedItems.helmet).toBe('item-1');
        expect(storage.saveCharacters).toHaveBeenCalled();
      });

      it('should replace existing item in slot', () => {
        useCharacterStore.setState({
          characters: [
            {
              ...character,
              inventory: {
                equippedItems: { helmet: 'item-1' },
                miscItems: [],
              },
            },
          ],
          isLoaded: true,
        });

        useCharacterStore.getState().equipItem('char-1', 'helmet', 'item-2', inventoryConfig);

        const updated = useCharacterStore.getState().characters[0];
        expect(updated.inventory.equippedItems.helmet).toBe('item-2');
      });

      it('should refuse an item whose slot type does not match', () => {
        // Requirement 12.3 — gloves are not headwear, and the rule lives here, not in the panel
        useCharacterStore.getState().equipItem('char-1', 'helmet', 'item-gloves', inventoryConfig);

        const updated = useCharacterStore.getState().characters[0];
        expect(updated.inventory.equippedItems.helmet).toBeUndefined();
        expect(storage.saveCharacters).not.toHaveBeenCalled();
      });

      it('should refuse an item that declares no slot type', () => {
        useCharacterStore.getState().equipItem('char-1', 'helmet', 'item-loose', inventoryConfig);

        expect(
          useCharacterStore.getState().characters[0].inventory.equippedItems.helmet
        ).toBeUndefined();
      });

      it('should refuse an item the configuration does not define', () => {
        useCharacterStore.getState().equipItem('char-1', 'helmet', 'ghost-item', inventoryConfig);

        expect(
          useCharacterStore.getState().characters[0].inventory.equippedItems.helmet
        ).toBeUndefined();
      });
    });

    describe('unequipItem', () => {
      it('should remove item from slot', () => {
        useCharacterStore.setState({
          characters: [
            {
              ...character,
              inventory: {
                equippedItems: { helmet: 'item-1' },
                miscItems: [],
              },
            },
          ],
          isLoaded: true,
        });

        useCharacterStore.getState().unequipItem('char-1', 'helmet');

        const updated = useCharacterStore.getState().characters[0];
        expect(updated.inventory.equippedItems.helmet).toBeUndefined();
        expect(storage.saveCharacters).toHaveBeenCalled();
      });
    });

    describe('addMiscItem', () => {
      it('should add item to miscellaneous inventory', () => {
        useCharacterStore.getState().addMiscItem('char-1', 'item-1');

        const updated = useCharacterStore.getState().characters[0];
        expect(updated.inventory.miscItems).toContain('item-1');
        expect(storage.saveCharacters).toHaveBeenCalled();
      });
    });

    describe('removeMiscItem', () => {
      it('should remove item from miscellaneous inventory', () => {
        useCharacterStore.setState({
          characters: [
            {
              ...character,
              inventory: {
                equippedItems: {},
                miscItems: ['item-1', 'item-2'],
              },
            },
          ],
          isLoaded: true,
        });

        useCharacterStore.getState().removeMiscItem('char-1', 'item-1');

        const updated = useCharacterStore.getState().characters[0];
        expect(updated.inventory.miscItems).toEqual(['item-2']);
        expect(storage.saveCharacters).toHaveBeenCalled();
      });
    });

    describe('moveItemToMisc', () => {
      it('should move equipped item to miscellaneous inventory', () => {
        useCharacterStore.setState({
          characters: [
            {
              ...character,
              inventory: {
                equippedItems: { helmet: 'item-1' },
                miscItems: [],
              },
            },
          ],
          isLoaded: true,
        });

        useCharacterStore.getState().moveItemToMisc('char-1', 'helmet');

        const updated = useCharacterStore.getState().characters[0];
        expect(updated.inventory.equippedItems.helmet).toBeUndefined();
        expect(updated.inventory.miscItems).toContain('item-1');
        expect(storage.saveCharacters).toHaveBeenCalled();
      });
    });

    describe('moveItemToEquipment', () => {
      it('should move miscellaneous item to equipment slot', () => {
        useCharacterStore.setState({
          characters: [
            {
              ...character,
              inventory: {
                equippedItems: {},
                miscItems: ['item-1'],
              },
            },
          ],
          isLoaded: true,
        });

        useCharacterStore
          .getState()
          .moveItemToEquipment('char-1', 'item-1', 'helmet', inventoryConfig);

        const updated = useCharacterStore.getState().characters[0];
        expect(updated.inventory.equippedItems.helmet).toBe('item-1');
        expect(updated.inventory.miscItems).not.toContain('item-1');
        expect(storage.saveCharacters).toHaveBeenCalled();
      });

      it('should refuse an item whose slot type does not match', () => {
        useCharacterStore.setState({
          characters: [
            {
              ...character,
              inventory: { equippedItems: {}, miscItems: ['item-gloves'] },
            },
          ],
          isLoaded: true,
        });

        useCharacterStore
          .getState()
          .moveItemToEquipment('char-1', 'item-gloves', 'helmet', inventoryConfig);

        const updated = useCharacterStore.getState().characters[0];
        expect(updated.inventory.equippedItems.helmet).toBeUndefined();
        expect(updated.inventory.miscItems).toContain('item-gloves');
      });

      it('should swap the displaced item back into the pack rather than losing it', () => {
        useCharacterStore.setState({
          characters: [
            {
              ...character,
              inventory: { equippedItems: { helmet: 'item-1' }, miscItems: ['item-2'] },
            },
          ],
          isLoaded: true,
        });

        useCharacterStore
          .getState()
          .moveItemToEquipment('char-1', 'item-2', 'helmet', inventoryConfig);

        const updated = useCharacterStore.getState().characters[0];
        expect(updated.inventory.equippedItems.helmet).toBe('item-2');
        expect(updated.inventory.miscItems).toEqual(['item-1']);
      });
    });
  });

  describe('Current Stat Value Updates', () => {
    let character: Character;

    /**
     * `STR 10` gives Health a maximum of 100 and Mana a maximum of 50, so the fixture's stored
     * values start exactly at their maxima and any increase has to be clamped.
     */
    const statConfig: Configuration = {
      id: 'config-1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 9,
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
        {
          id: 'mana',
          name: 'Mana',
          abbreviation: 'MAN',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: true,
          rounding: 'none',
          formula: 'STR * 5',
        },
      ],
      skills: [],
      materials: [],
      materialCategories: [],
      items: [],
      equipmentSlots: [],
      races: [],
      currencyTiers: [],
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    beforeEach(() => {
      character = {
        id: 'char-1',
        name: 'Test',
        configurationId: 'config-1',
        raceIds: [],
        investedStatPoints: { STR: 10 },
        investedSkillPoints: {},
        currentResourceValues: { health: 100, mana: 50 },
        experience: 0,
        inventory: { equippedItems: {}, miscItems: [] },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      useCharacterStore.setState({ characters: [character], isLoaded: true });
    });

    describe('updateCurrentStatValue', () => {
      it('should update single stat value', () => {
        useCharacterStore.getState().updateCurrentStatValue('char-1', 'health', 80, statConfig);

        const updated = useCharacterStore.getState().characters[0];
        expect(updated.currentResourceValues.health).toBe(80);
        expect(updated.currentResourceValues.mana).toBe(50);
        expect(storage.saveCharacters).toHaveBeenCalled();
      });

      it('should allow negative values', () => {
        useCharacterStore.getState().updateCurrentStatValue('char-1', 'health', -10, statConfig);

        const updated = useCharacterStore.getState().characters[0];
        expect(updated.currentResourceValues.health).toBe(-10);
      });

      it('should clamp a value above the calculated maximum', () => {
        // Requirement 14.3 — the cap lives in the action, so no caller can write past it
        useCharacterStore.getState().updateCurrentStatValue('char-1', 'health', 999, statConfig);

        const updated = useCharacterStore.getState().characters[0];
        expect(updated.currentResourceValues.health).toBe(100);
      });

      it('should drop a value for a stat the configuration does not define', () => {
        // Only a resource has a current value, and the store is where that is decided — a
        // component cannot write one for a stat that has none (TICKET-STAT-01)
        useCharacterStore.getState().updateCurrentStatValue('char-1', 'stamina', 42, statConfig);

        const updated = useCharacterStore.getState().characters[0];
        expect(updated.currentResourceValues.stamina).toBeUndefined();
      });

      it('should write through unclamped when the ruleset has a broken formula', () => {
        const brokenConfig: Configuration = {
          ...statConfig,
          stats: [
            {
              id: 'health',
              name: 'Health',
              abbreviation: 'HEA',
              description: '',
              order: 0,
              countsTowardTotal: true,
              isResource: true,
              rounding: 'none',
              formula: 'UNKNOWN * 10',
            },
          ],
        };

        useCharacterStore.getState().updateCurrentStatValue('char-1', 'health', 999, brokenConfig);

        const updated = useCharacterStore.getState().characters[0];
        expect(updated.currentResourceValues.health).toBe(999);
      });
    });

    describe('updateCurrentStatValues', () => {
      it('should update multiple stat values', () => {
        useCharacterStore.getState().updateCurrentStatValues(
          'char-1',
          {
            health: 90,
            mana: 40,
          },
          statConfig
        );

        const updated = useCharacterStore.getState().characters[0];
        expect(updated.currentResourceValues.health).toBe(90);
        expect(updated.currentResourceValues.mana).toBe(40);
        expect(storage.saveCharacters).toHaveBeenCalled();
      });

      it('should merge with existing values', () => {
        useCharacterStore.getState().updateCurrentStatValues('char-1', { mana: 30 }, statConfig);

        const updated = useCharacterStore.getState().characters[0];
        expect(updated.currentResourceValues.health).toBe(100);
        expect(updated.currentResourceValues.mana).toBe(30);
      });

      it('should clamp each value independently', () => {
        useCharacterStore
          .getState()
          .updateCurrentStatValues('char-1', { health: 500, mana: -5 }, statConfig);

        const updated = useCharacterStore.getState().characters[0];
        expect(updated.currentResourceValues.health).toBe(100);
        expect(updated.currentResourceValues.mana).toBe(-5);
      });
    });

    /** Concept 20's quick entry (TICKET-RES-03) */
    describe('adjustCurrentStatValue', () => {
      const health = () => useCharacterStore.getState().characters[0].currentResourceValues.health;

      it('should take a delta off the stored value', () => {
        useCharacterStore.getState().adjustCurrentStatValue('char-1', 'health', -7, statConfig);

        expect(health()).toBe(93);
      });

      it('should add a delta, still clamping at the maximum', () => {
        useCharacterStore.getState().adjustCurrentStatValue('char-1', 'health', -20, statConfig);
        useCharacterStore.getState().adjustCurrentStatValue('char-1', 'health', 50, statConfig);

        // 80 + 50 = 130, capped at the calculated 100 (Requirement 14.3)
        expect(health()).toBe(100);
      });

      it('should allow a delta to take a pool below zero', () => {
        // Requirement 14.4 — the clamp is one-sided, and quick entry is how a Player gets there
        useCharacterStore.getState().adjustCurrentStatValue('char-1', 'health', -130, statConfig);

        expect(health()).toBe(-30);
      });

      it('should apply the delta to what is stored, not to a clamped reading of it', () => {
        // A pool above a shrunken maximum must lose exactly what was asked for before the clamp
        useCharacterStore.setState({
          characters: [{ ...character, currentResourceValues: { health: 400, mana: 50 } }],
        });

        useCharacterStore.getState().adjustCurrentStatValue('char-1', 'health', -50, statConfig);

        // 400 − 50 = 350, then clamped to 100 — never 100 − 50
        expect(health()).toBe(100);
      });

      it('should treat a stat with no stored value as standing at zero', () => {
        useCharacterStore.setState({
          characters: [{ ...character, currentResourceValues: {} }],
        });

        useCharacterStore.getState().adjustCurrentStatValue('char-1', 'health', 5, statConfig);

        expect(health()).toBe(5);
      });

      it('should ignore a non-finite delta and an unknown character', () => {
        useCharacterStore
          .getState()
          .adjustCurrentStatValue('char-1', 'health', Number.NaN, statConfig);
        useCharacterStore.getState().adjustCurrentStatValue('missing', 'health', -5, statConfig);

        expect(health()).toBe(100);
      });
    });

    /** Concept 20's "Regain mana to full" (TICKET-RES-03) */
    describe('resetCurrentStatValueToMax', () => {
      const health = () => useCharacterStore.getState().characters[0].currentResourceValues.health;

      it('should fill a spent pool to its calculated maximum', () => {
        useCharacterStore.getState().updateCurrentStatValue('char-1', 'health', 12, statConfig);
        useCharacterStore.getState().resetCurrentStatValueToMax('char-1', 'health', statConfig);

        expect(health()).toBe(100);
      });

      it('should leave a pool alone when its maximum cannot be calculated', () => {
        const broken: Configuration = {
          ...statConfig,
          stats: statConfig.stats.map((stat) =>
            stat.id === 'health' ? { ...stat, formula: 'UNKNOWN * 10' } : stat
          ),
        };

        useCharacterStore.getState().resetCurrentStatValueToMax('char-1', 'health', broken);

        // Writing 0 would be the one "reset" that empties a pool instead of filling it
        expect(health()).toBe(100);
        expect(storage.saveCharacters).not.toHaveBeenCalled();
      });

      it('should ignore an unknown character and an unknown stat', () => {
        useCharacterStore.getState().resetCurrentStatValueToMax('missing', 'health', statConfig);
        useCharacterStore.getState().resetCurrentStatValueToMax('char-1', 'stamina', statConfig);

        expect(health()).toBe(100);
      });
    });
  });
  /**
   * `renameSkillCode` is gone (TICKET-SKL-02)
   *
   * It existed to chase a rename through two code-keyed character maps: `investedStatPoints`,
   * re-keyed by id in TICKET-STAT-01, and `specialitySkillBaseLevels`, re-keyed by id here. With
   * both keyed by an id a rename cannot reach, there is no second half of a rename left to apply
   * and the action deleted itself.
   *
   * **And nothing code-keyed survives it.** The one field that did — the focus stat's stored
   * abbreviation — went with the mechanic in TICKET-ARC-03, so every character field is keyed by
   * an id a rename cannot reach and the rename problem is closed rather than merely managed.
   */
  /**
   * The level-up mechanic (TICKET-RES-02): points earned by levelling stay spendable, and the
   * store refuses anything the derived budget cannot pay for rather than clamping it.
   */
  describe('setInvestedStatPoints', () => {
    /** Level 2 at 300 XP, 5 points per level — a pool of 10 */
    const budgetConfig: Configuration = {
      id: 'config-1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 9,
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
          order: 1,
          countsTowardTotal: true,
          isResource: true,
          rounding: 'none',
          formula: 'STR * 10',
        },
      ],
      skills: [],
      materials: [],
      materialCategories: [],
      items: [],
      equipmentSlots: [],
      races: [],
      currencyTiers: [],
      constants: [
        {
          id: 'const-ppl',
          name: 'points_per_level',
          displayName: 'Points per level',
          description: '',
          value: 5,
        },
      ],
      curves: [
        {
          id: 'curve-xp',
          name: 'xp_thresholds',
          displayName: 'XP thresholds',
          description: '',
          keyName: 'level',
          columns: [{ id: 'curve-xp-col', name: 'xp_required' }],
          rows: [
            { key: 1, values: [0] },
            { key: 2, values: [300] },
          ],
          interpolation: 'step',
          outOfRange: 'extrapolate',
          lookupDirection: 'reverse',
        },
      ],
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    beforeEach(() => {
      useCharacterStore.setState({
        characters: [
          {
            id: 'char-1',
            name: 'Test',
            configurationId: 'config-1',
            raceIds: [],
            investedStatPoints: { STR: 4 },
            investedSkillPoints: {},
            currentResourceValues: {},
            experience: 300,
            inventory: { equippedItems: {}, miscItems: [] },
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        isLoaded: true,
      });
      vi.clearAllMocks();
    });

    const invested = () => useCharacterStore.getState().characters[0].investedStatPoints.STR;

    it('should write a spend the budget covers, and persist it', () => {
      useCharacterStore.getState().setInvestedStatPoints('char-1', 'STR', 9, budgetConfig);

      expect(invested()).toBe(9);
      expect(storage.saveCharacters).toHaveBeenCalled();
    });

    it('should accept a spend exactly at the budget', () => {
      useCharacterStore.getState().setInvestedStatPoints('char-1', 'STR', 10, budgetConfig);

      expect(invested()).toBe(10);
    });

    it('should refuse a spend one point over the budget rather than clamping it', () => {
      useCharacterStore.getState().setInvestedStatPoints('char-1', 'STR', 11, budgetConfig);

      expect(invested()).toBe(4);
      expect(storage.saveCharacters).not.toHaveBeenCalled();
    });

    it('should let the spend grow when experience does — that is the level-up mechanic', () => {
      useCharacterStore.getState().setInvestedStatPoints('char-1', 'STR', 11, budgetConfig);
      expect(invested()).toBe(4);

      // Level 3 is off the end of the fixture curve, extrapolated to 600 XP, so the pool is 15
      useCharacterStore.getState().awardExperience('char-1', 300);
      useCharacterStore.getState().setInvestedStatPoints('char-1', 'STR', 11, budgetConfig);

      expect(invested()).toBe(11);
    });

    it('should refuse a negative or fractional number of points', () => {
      useCharacterStore.getState().setInvestedStatPoints('char-1', 'STR', -1, budgetConfig);
      useCharacterStore.getState().setInvestedStatPoints('char-1', 'STR', 2.5, budgetConfig);

      expect(invested()).toBe(4);
    });

    it('should refuse points put into a derived stat, which computes its own value', () => {
      useCharacterStore.getState().setInvestedStatPoints('char-1', 'health', 1, budgetConfig);

      expect(useCharacterStore.getState().characters[0].investedStatPoints.health).toBeUndefined();
    });

    it('should refuse every spend when the budget cannot be derived', () => {
      const noCurve: Configuration = { ...budgetConfig, curves: [] };

      useCharacterStore.getState().setInvestedStatPoints('char-1', 'STR', 5, noCurve);

      expect(invested()).toBe(4);
    });

    it('should ignore an unknown character', () => {
      useCharacterStore.getState().setInvestedStatPoints('missing', 'STR', 5, budgetConfig);

      expect(invested()).toBe(4);
      expect(storage.saveCharacters).not.toHaveBeenCalled();
    });
  });

  /**
   * Skill points, which are deliberately not budgeted
   *
   * The counterpart to `setInvestedStatPoints`, minus the pool — because the ruleset has none for
   * skills. These pin that the absence is a decision rather than an oversight.
   */
  describe('setInvestedSkillPoints', () => {
    beforeEach(() => {
      useCharacterStore.setState({
        characters: [
          {
            id: 'char1',
            name: 'Test',
            configurationId: 'config1',
            raceIds: [],
            investedStatPoints: {},
            investedSkillPoints: { STL: 3 },
            currentResourceValues: {},
            experience: 0,
            inventory: { equippedItems: {}, miscItems: [] },
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          },
        ],
        isLoaded: true,
      });
      vi.clearAllMocks();
    });

    it('should put points into a skill and persist through the store', () => {
      useCharacterStore.getState().setInvestedSkillPoints('char1', 'STL', 5);

      expect(useCharacterStore.getState().characters[0].investedSkillPoints).toEqual({ STL: 5 });
      expect(storage.saveCharacters).toHaveBeenCalled();
    });

    it('should add a skill that had no points yet, leaving the others alone', () => {
      useCharacterStore.getState().setInvestedSkillPoints('char1', 'ALC', 2);

      expect(useCharacterStore.getState().characters[0].investedSkillPoints).toEqual({
        STL: 3,
        ALC: 2,
      });
    });

    it('should refuse a negative or fractional number', () => {
      useCharacterStore.getState().setInvestedSkillPoints('char1', 'STL', -1);
      useCharacterStore.getState().setInvestedSkillPoints('char1', 'STL', 2.5);

      expect(useCharacterStore.getState().characters[0].investedSkillPoints).toEqual({ STL: 3 });
      expect(storage.saveCharacters).not.toHaveBeenCalled();
    });

    it('should accept any whole number, because skills have no pool to overspend', () => {
      // Not an oversight: `skillAllocation.ts` prices stat points and defines no skill budget, and
      // the creation wizard already lets a Player type any number in. Refusing here would make the
      // sheet stricter than the wizard that produced the character. If a ticket gives skills a
      // pool, the refusal goes in beside `setInvestedStatPoints`'s and this expectation changes.
      useCharacterStore.getState().setInvestedSkillPoints('char1', 'STL', 9999);

      expect(useCharacterStore.getState().characters[0].investedSkillPoints.STL).toBe(9999);
    });

    it('should do nothing for a character that is not there', () => {
      useCharacterStore.getState().setInvestedSkillPoints('nope', 'STL', 5);

      expect(useCharacterStore.getState().characters[0].investedSkillPoints).toEqual({ STL: 3 });
      expect(storage.saveCharacters).not.toHaveBeenCalled();
    });
  });

  /**
   * The purse (Concept 16)
   *
   * The sheet has one at `Charactersheet!Q18:S23` and the app had no field for it, so a ruleset
   * could define gold and silver and a Player could never hold a coin.
   */
  describe('setWalletAmount', () => {
    beforeEach(() => {
      useCharacterStore.setState({
        characters: [
          {
            id: 'char1',
            name: 'Test',
            configurationId: 'config1',
            raceIds: [],
            investedStatPoints: {},
            investedSkillPoints: {},
            currentResourceValues: {},
            experience: 0,
            inventory: { equippedItems: {}, miscItems: [] },
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          },
        ],
        isLoaded: true,
      });
      vi.clearAllMocks();
    });

    it('should open a purse on a character that has never had one', () => {
      // The field is optional and absent on every character saved before it existed
      expect(useCharacterStore.getState().characters[0].wallet).toBeUndefined();

      useCharacterStore.getState().setWalletAmount('char1', 'gold', 3);

      expect(useCharacterStore.getState().characters[0].wallet).toEqual({ gold: 3 });
      expect(storage.saveCharacters).toHaveBeenCalled();
    });

    it('should hold each tier separately and never roll one into another', () => {
      // 15 silver stays 15 silver. Normalising is a display choice, and a purse that reorganises
      // itself the moment you look away is one a Player cannot reconcile against the table.
      useCharacterStore.getState().setWalletAmount('char1', 'silver', 15);
      useCharacterStore.getState().setWalletAmount('char1', 'copper', 40);

      expect(useCharacterStore.getState().characters[0].wallet).toEqual({
        silver: 15,
        copper: 40,
      });
    });

    it('should refuse a negative amount rather than clamping it', () => {
      useCharacterStore.getState().setWalletAmount('char1', 'gold', 5);
      useCharacterStore.getState().setWalletAmount('char1', 'gold', -1);

      // Owing money may well be a thing a table wants, but it is a mechanic, and inventing it
      // here silently would be worse than not having it
      expect(useCharacterStore.getState().characters[0].wallet).toEqual({ gold: 5 });
    });

    it('should allow a fraction, because a rate of 10 makes half a gold ordinary', () => {
      useCharacterStore.getState().setWalletAmount('char1', 'gold', 0.5);

      expect(useCharacterStore.getState().characters[0].wallet).toEqual({ gold: 0.5 });
    });

    it('should do nothing for a character that is not there', () => {
      useCharacterStore.getState().setWalletAmount('nope', 'gold', 3);

      expect(useCharacterStore.getState().characters[0].wallet).toBeUndefined();
      expect(storage.saveCharacters).not.toHaveBeenCalled();
    });
  });

  describe('what a rename does to a character now (TICKET-SKL-02)', () => {
    beforeEach(() => {
      useCharacterStore.setState({
        characters: [
          {
            id: 'char1',
            name: 'Test',
            configurationId: 'config1',
            raceIds: [],
            investedStatPoints: { STR: 6, DEX: 4 },
            investedSkillPoints: { STL: 3 },
            currentResourceValues: {},
            experience: 0,
            inventory: { equippedItems: {}, miscItems: [] },
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          },
        ],
        isLoaded: true,
      });
      vi.clearAllMocks();
    });

    it('offers no rename action at all, because nothing on a character is code-keyed', () => {
      // The guard against this test rotting into a tautology: if a future ticket re-introduces a
      // code-keyed character field, it has to re-introduce the action too, and this fails first.
      expect(
        Object.keys(useCharacterStore.getState()).filter((key) => key.startsWith('rename'))
      ).toEqual([]);
    });

    it('keeps both investment maps addressable by id after a stat is renamed', () => {
      // Nothing is called: the maps are keyed by stat id (TICKET-STAT-01) and skill id
      // (TICKET-SKL-02), so a rename in the configuration does not touch the character at all
      const character = useCharacterStore.getState().characters[0];

      expect(character.investedStatPoints).toEqual({ STR: 6, DEX: 4 });
      expect(character.investedSkillPoints).toEqual({ STL: 3 });
      expect(storage.saveCharacters).not.toHaveBeenCalled();
    });
  });

  /**
   * Experience (Concept 20, TICKET-RES-01)
   *
   * XP is the input the whole progression chain hangs off since level derives from it, so the
   * rules about what may be written are asserted here rather than in the control that calls them.
   */
  describe('Experience', () => {
    beforeEach(() => {
      useCharacterStore.setState({
        characters: [
          {
            id: 'char1',
            name: 'Test',
            configurationId: 'config1',
            raceIds: [],
            investedStatPoints: {},
            investedSkillPoints: {},
            currentResourceValues: {},
            experience: 500,
            inventory: { equippedItems: {}, miscItems: [] },
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          },
        ],
        isLoaded: true,
      });
      vi.clearAllMocks();
    });

    const experienceOf = () => useCharacterStore.getState().characters[0].experience;

    it('should add experience and persist it', () => {
      useCharacterStore.getState().awardExperience('char1', 300);

      expect(experienceOf()).toBe(800);
      expect(storage.saveCharacters).toHaveBeenCalledTimes(1);
    });

    it('should accumulate across awards rather than replacing the total', () => {
      useCharacterStore.getState().awardExperience('char1', 100);
      useCharacterStore.getState().awardExperience('char1', 250);

      expect(experienceOf()).toBe(850);
    });

    it('should have no maximum', () => {
      useCharacterStore.getState().awardExperience('char1', 10_000_000);

      expect(experienceOf()).toBe(10_000_500);
    });

    it('should deduct experience and persist it', () => {
      useCharacterStore.getState().deductExperience('char1', 200);

      expect(experienceOf()).toBe(300);
      expect(storage.saveCharacters).toHaveBeenCalledTimes(1);
    });

    it('should allow a deduction down to exactly zero', () => {
      useCharacterStore.getState().deductExperience('char1', 500);

      expect(experienceOf()).toBe(0);
    });

    it('should refuse a deduction that would go below zero, writing nothing', () => {
      // A refusal rather than a clamp to 0: quietly deducting less than asked would leave the
      // table believing a penalty landed in full
      useCharacterStore.getState().deductExperience('char1', 501);

      expect(experienceOf()).toBe(500);
      expect(storage.saveCharacters).not.toHaveBeenCalled();
    });

    it.each([0, -100, Number.NaN, Number.POSITIVE_INFINITY])(
      'should refuse %s as an award amount',
      (amount) => {
        useCharacterStore.getState().awardExperience('char1', amount);

        expect(experienceOf()).toBe(500);
        expect(storage.saveCharacters).not.toHaveBeenCalled();
      }
    );

    it.each([0, -100, Number.NaN])('should refuse %s as a deduction amount', (amount) => {
      // A negative deduction would otherwise be an award that skipped the below-zero check
      useCharacterStore.getState().deductExperience('char1', amount);

      expect(experienceOf()).toBe(500);
      expect(storage.saveCharacters).not.toHaveBeenCalled();
    });

    it('should never reset experience — no action offers it', () => {
      // The guard against a future ticket adding one quietly: level derives from XP, so a reset
      // is a level reset, and that needs a decision rather than a helper
      expect(
        Object.keys(useCharacterStore.getState()).filter((key) => /resetExperience/i.test(key))
      ).toEqual([]);
    });

    it('should leave other characters untouched', () => {
      const { characters } = useCharacterStore.getState();
      useCharacterStore.setState({
        characters: [...characters, { ...characters[0], id: 'char2', experience: 42 }],
      });

      useCharacterStore.getState().awardExperience('char1', 100);

      expect(useCharacterStore.getState().characters[1].experience).toBe(42);
    });

    it('should write nothing for an unknown character', () => {
      useCharacterStore.getState().awardExperience('nope', 100);

      expect(storage.saveCharacters).not.toHaveBeenCalled();
    });

    it('should refuse to compute on a character whose stored total is not a number', () => {
      // `loadCharacters` filters these out, but a total of `undefined` reaching here would compute
      // `undefined + amount` and persist `NaN`, which reads as level 1 forever and cannot be undone
      // from the UI. Refused rather than repaired — inventing a total is inventing a level.
      const { characters } = useCharacterStore.getState();
      useCharacterStore.setState({
        characters: [{ ...characters[0], experience: undefined as unknown as number }],
      });

      useCharacterStore.getState().awardExperience('char1', 100);
      useCharacterStore.getState().deductExperience('char1', 100);

      expect(useCharacterStore.getState().characters[0].experience).toBeUndefined();
      expect(storage.saveCharacters).not.toHaveBeenCalled();
    });
  });
});
