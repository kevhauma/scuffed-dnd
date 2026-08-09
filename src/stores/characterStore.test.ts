/**
 * Character Store Tests
 *
 * Unit tests for the character store with auto-save functionality.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as storage from '../services/storage';
import type { Character, CharacterCreationData } from '../types/character';
import type { Configuration } from '../types/config';
import { useCharacterStore } from './characterStore';

// Mock storage service
vi.mock('../services/storage', () => ({
  saveCharacters: vi.fn(),
  loadCharacters: vi.fn(() => []),
}));

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
          specialitySkillBaseLevels: {},
          currentResourceValues: {},
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
      schemaVersion: 3,
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
      specialitySkills: [],
      combatSkills: [],
      materials: [],
      materialCategories: [],
      items: [],
      equipmentSlots: [{ type: 'main_hand', name: 'Main Hand', description: '' }],
      races: [],
      currencyTiers: [],
      focusStatBonusLevel: 0,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    it('should create a new character and save to storage', () => {
      const creationData: CharacterCreationData = {
        name: 'New Character',
        raceIds: ['race-1'],
        investedStatPoints: { STR: 10, DEX: 8 },
        focusStatCode: 'STR',
        specialitySkillBaseLevels: { SWD: 5 },
      };

      const character = useCharacterStore.getState().createCharacter(creationData, testConfig);

      expect(character.name).toBe('New Character');
      expect(character.raceIds).toEqual(['race-1']);
      expect(character.investedStatPoints).toEqual({ STR: 10, DEX: 8 });
      expect(character.focusStatCode).toBe('STR');
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
        specialitySkillBaseLevels: {},
      };

      const character = useCharacterStore.getState().createCharacter(creationData, testConfig);

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
        specialitySkillBaseLevels: {},
      };

      const character = useCharacterStore.getState().createCharacter(creationData, testConfig);

      // health = STR * 10, so a new character starts at full rather than at zero
      expect(character.currentResourceValues).toEqual({ health: 70 });
    });

    it('should still create the character when a stat formula does not evaluate', () => {
      const brokenConfig: Configuration = {
        ...testConfig,
        stats: [
          {
            id: 'mana',
            name: 'Mana',
            abbreviation: 'MAN',
            description: '',
            order: 0,
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
        specialitySkillBaseLevels: {},
      };

      const character = useCharacterStore.getState().createCharacter(creationData, brokenConfig);

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
        specialitySkillBaseLevels: {},
      };

      const character = useCharacterStore
        .getState()
        .createCharacter(creationData, partlyBrokenConfig);

      expect(character.currentResourceValues).toEqual({ health: 40 });
      expect(character.currentResourceValues.mana).toBeUndefined();
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
        specialitySkillBaseLevels: {},
        currentResourceValues: {},
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
  });

  describe('deleteCharacter', () => {
    it('should delete character and save to storage', () => {
      const character: Character = {
        id: 'char-1',
        name: 'Test',
        configurationId: 'config-1',
        raceIds: [],
        investedStatPoints: {},
        specialitySkillBaseLevels: {},
        currentResourceValues: {},
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
        specialitySkillBaseLevels: {},
        currentResourceValues: {},
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
      schemaVersion: 3,
      stats: [],
      specialitySkills: [],
      combatSkills: [],
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
      focusStatBonusLevel: 0,
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
        specialitySkillBaseLevels: {},
        currentResourceValues: {},
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
      schemaVersion: 3,
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
      specialitySkills: [],
      combatSkills: [],
      materials: [],
      materialCategories: [],
      items: [],
      equipmentSlots: [],
      races: [],
      currencyTiers: [],
      focusStatBonusLevel: 0,
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
        specialitySkillBaseLevels: {},
        currentResourceValues: { health: 100, mana: 50 },
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
  });
  describe('renameSkillCode (TICKET-REF-01)', () => {
    beforeEach(() => {
      useCharacterStore.setState({
        characters: [
          {
            id: 'char1',
            name: 'Test',
            configurationId: 'config1',
            raceIds: [],
            investedStatPoints: { STR: 6, DEX: 4 },
            specialitySkillBaseLevels: { STL: 3 },
            focusStatCode: 'STR',
            currentResourceValues: {},
            inventory: { equippedItems: {}, miscItems: [] },
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          },
        ],
        isLoaded: true,
      });
      vi.clearAllMocks();
    });

    it('moves the focus stat onto the new code, leaving id-keyed investment alone', () => {
      useCharacterStore.getState().renameSkillCode('STR', 'STG');

      const character = useCharacterStore.getState().characters[0];
      // Investment is keyed by stat id since TICKET-STAT-01, so a rename cannot orphan it and
      // there is nothing here to move
      expect(character.investedStatPoints).toEqual({ STR: 6, DEX: 4 });
      expect(character.focusStatCode).toBe('STG');
      expect(storage.saveCharacters).toHaveBeenCalled();
    });

    it('moves a speciality base level too', () => {
      useCharacterStore.getState().renameSkillCode('STL', 'SNK');

      expect(useCharacterStore.getState().characters[0].specialitySkillBaseLevels).toEqual({
        SNK: 3,
      });
    });

    it('leaves characters and storage alone when nothing holds the code', () => {
      useCharacterStore.getState().renameSkillCode('ZZZ', 'YYY');

      expect(useCharacterStore.getState().characters[0].investedStatPoints).toEqual({
        STR: 6,
        DEX: 4,
      });
      expect(storage.saveCharacters).not.toHaveBeenCalled();
    });
  });
});
