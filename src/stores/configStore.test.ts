/**
 * Configuration Store Tests
 *
 * Tests for ConfigStore CRUD operations and auto-save functionality.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toStoredConfiguration } from '../engine/formula/references';
import { importConfiguration, validateConfiguration } from '../services/importExport';
import * as storage from '../services/storage';
import type {
  CombatSkill,
  Configuration,
  CurrencyTier,
  Curve,
  EquipmentSlot,
  Item,
  Material,
  MaterialCategory,
  Race,
  SpecialitySkill,
  Stat,
} from '../types/config';
import { useCharacterStore } from './characterStore';
import { useConfigStore } from './configStore';

// Mock storage service
vi.mock('../services/storage', () => ({
  saveConfiguration: vi.fn(),
  loadConfiguration: vi.fn(),
  clearAllData: vi.fn(),
}));

describe('ConfigStore', () => {
  beforeEach(() => {
    // Reset store state
    useConfigStore.setState({ config: null, isLoaded: false });
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize empty configuration', () => {
      const { initializeConfig } = useConfigStore.getState();

      initializeConfig('Test Config');

      const { config, isLoaded } = useConfigStore.getState();
      expect(isLoaded).toBe(true);
      expect(config).toBeDefined();
      expect(config?.name).toBe('Test Config');
      expect(config?.stats).toEqual([]);
      expect(config?.specialitySkills).toEqual([]);
      expect(config?.combatSkills).toEqual([]);
      expect(config?.materials).toEqual([]);
      expect(config?.materialCategories).toEqual([]);
      expect(config?.items).toEqual([]);
      expect(config?.equipmentSlots).toEqual([]);
      expect(config?.races).toEqual([]);
      expect(config?.currencyTiers).toEqual([]);
      expect(config?.focusStatBonusLevel).toBe(0);
      expect(storage.saveConfiguration).toHaveBeenCalledWith(config);
    });

    it('should load configuration from storage', () => {
      const mockConfig = {
        id: 'test-id',
        name: 'Loaded Config',
        version: '1.0.0',
        schemaVersion: 2,
        stats: [],
        specialitySkills: [],
        combatSkills: [],
        materials: [],
        materialCategories: [],
        items: [],
        equipmentSlots: [],
        races: [],
        currencyTiers: [],
        focusStatBonusLevel: 5,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      } as Configuration;

      vi.mocked(storage.loadConfiguration).mockReturnValue(mockConfig);

      const { loadConfig } = useConfigStore.getState();
      loadConfig();

      const { config, isLoaded } = useConfigStore.getState();
      expect(isLoaded).toBe(true);
      expect(config).toEqual(mockConfig);
    });

    it('should replace the whole configuration and persist it', () => {
      useConfigStore.getState().initializeConfig('Original');
      const original = useConfigStore.getState().config;
      if (!original) throw new Error('initializeConfig produced no configuration');

      useConfigStore.getState().replaceConfig({
        ...original,
        id: 'imported-id',
        name: 'Imported',
        focusStatBonusLevel: 4,
      });

      // Applying an import discards the current ruleset — the app holds exactly one
      const { config, isLoaded } = useConfigStore.getState();
      expect(config?.id).toBe('imported-id');
      expect(config?.name).toBe('Imported');
      expect(config?.focusStatBonusLevel).toBe(4);
      expect(isLoaded).toBe(true);
      expect(storage.saveConfiguration).toHaveBeenCalledWith(config);
    });

    it('should rename the configuration without touching anything else', () => {
      useConfigStore.getState().initializeConfig('Original');
      const before = useConfigStore.getState().config;

      useConfigStore.getState().renameConfig('Grimdark Hollow');

      const after = useConfigStore.getState().config;
      expect(after?.name).toBe('Grimdark Hollow');
      expect(after?.id).toBe(before?.id);
      expect(after?.focusStatBonusLevel).toBe(before?.focusStatBonusLevel);
      expect(storage.saveConfiguration).toHaveBeenCalledWith(after);
    });

    it('should ignore a rename when there is no configuration', () => {
      useConfigStore.getState().renameConfig('Nothing To Rename');

      expect(useConfigStore.getState().config).toBeNull();
      expect(storage.saveConfiguration).not.toHaveBeenCalled();
    });

    describe('discardStoredData (TICKET-IO-03)', () => {
      it('should clear both keys and empty both stores', () => {
        useConfigStore.getState().initializeConfig('To Be Discarded');
        useCharacterStore.setState({
          characters: [{ id: 'aria' }] as never,
          isLoaded: true,
        });
        vi.clearAllMocks();

        useConfigStore.getState().discardStoredData();

        expect(storage.clearAllData).toHaveBeenCalledTimes(1);
        expect(useConfigStore.getState().config).toBeNull();
        expect(useConfigStore.getState().isLoaded).toBe(true);
        expect(useCharacterStore.getState().characters).toEqual([]);
        expect(useCharacterStore.getState().isLoaded).toBe(true);
      });

      it('should not write a replacement over what it cleared', () => {
        useConfigStore.getState().initializeConfig('To Be Discarded');
        vi.clearAllMocks();

        useConfigStore.getState().discardStoredData();

        // Start-fresh means *nothing*, not a fresh default — the dashboard offers that next
        expect(storage.saveConfiguration).not.toHaveBeenCalled();
      });
    });
  });

  describe('Stats CRUD', () => {
    beforeEach(() => {
      useConfigStore.getState().initializeConfig('Test');
      vi.clearAllMocks();
    });

    it('should add stat', () => {
      const stat: Stat = {
        id: 'health',
        name: 'Health',
        abbreviation: 'HEA',
        description: 'Hit points',
        order: 0,
        countsTowardTotal: true,
        isResource: true,
        rounding: 'none',
        formula: 'STR * 10',
      };

      useConfigStore.getState().addStat(stat);

      const { config } = useConfigStore.getState();
      expect(config?.stats).toHaveLength(1);
      expect(config?.stats[0]).toEqual(stat);
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });

    it('should update stat', () => {
      const stat: Stat = {
        id: 'health',
        name: 'Health',
        abbreviation: 'HEA',
        description: 'Hit points',
        order: 0,
        countsTowardTotal: true,
        isResource: true,
        rounding: 'none',
        formula: 'STR * 10',
      };

      useConfigStore.getState().addStat(stat);
      vi.clearAllMocks();

      useConfigStore.getState().updateStat('health', { formula: 'STR * 20' });

      const { config } = useConfigStore.getState();
      expect(config?.stats.find((candidate) => candidate.formula)?.formula).toBe('STR * 20');
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });

    it('should delete stat', () => {
      const stat: Stat = {
        id: 'health',
        name: 'Health',
        abbreviation: 'HEA',
        description: 'Hit points',
        order: 0,
        countsTowardTotal: true,
        isResource: true,
        rounding: 'none',
        formula: 'STR * 10',
      };

      useConfigStore.getState().addStat(stat);
      vi.clearAllMocks();

      useConfigStore.getState().deleteStat('health');

      const { config } = useConfigStore.getState();
      expect(config?.stats).toHaveLength(0);
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });

    describe('reorderStats (TICKET-STAT-02)', () => {
      const statNamed = (id: string): Stat => ({
        id,
        name: id,
        abbreviation: id.toUpperCase(),
        description: '',
        order: 0,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
      });

      beforeEach(() => {
        for (const id of ['str', 'dex', 'con']) {
          useConfigStore.getState().addStat(statNamed(id));
        }
        vi.clearAllMocks();
      });

      it('should write the array and the order field from the same sequence', () => {
        useConfigStore.getState().reorderStats(['con', 'str', 'dex']);

        expect(
          useConfigStore.getState().config?.stats.map((stat) => [stat.id, stat.order])
        ).toEqual([
          ['con', 0],
          ['str', 1],
          ['dex', 2],
        ]);
        expect(storage.saveConfiguration).toHaveBeenCalled();
      });

      it('should keep a stat the caller did not name, at the end', () => {
        useConfigStore.getState().reorderStats(['con']);

        // A partial list reorders what it names rather than dropping the rest
        expect(useConfigStore.getState().config?.stats.map((stat) => stat.id)).toEqual([
          'con',
          'str',
          'dex',
        ]);
      });

      it('should ignore an id that is not a stat', () => {
        useConfigStore.getState().reorderStats(['nope', 'dex', 'str', 'con']);

        expect(useConfigStore.getState().config?.stats.map((stat) => stat.id)).toEqual([
          'dex',
          'str',
          'con',
        ]);
      });

      it('should change no value but the order', () => {
        const before = useConfigStore.getState().config?.stats.find((stat) => stat.id === 'str');

        useConfigStore.getState().reorderStats(['con', 'dex', 'str']);

        const after = useConfigStore.getState().config?.stats.find((stat) => stat.id === 'str');
        // Reordering never affects values — references are by id (Concept 01)
        expect({ ...after, order: 0 }).toEqual({ ...before, order: 0 });
      });
    });
  });

  describe('Speciality Skills CRUD', () => {
    beforeEach(() => {
      useConfigStore.getState().initializeConfig('Test');
      vi.clearAllMocks();
    });

    it('should add speciality skill', () => {
      const skill: SpecialitySkill = {
        id: 'MEL',
        code: 'MEL',
        name: 'Melee',
        description: 'Close combat',
        maxBaseLevel: 10,
        bonusFormula: 'STR + DEX',
      };

      useConfigStore.getState().addSpecialitySkill(skill);

      const { config } = useConfigStore.getState();
      expect(config?.specialitySkills).toHaveLength(1);
      expect(config?.specialitySkills[0]).toEqual(skill);
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });

    it('should update speciality skill', () => {
      const skill: SpecialitySkill = {
        id: 'MEL',
        code: 'MEL',
        name: 'Melee',
        description: 'Close combat',
        maxBaseLevel: 10,
        bonusFormula: 'STR + DEX',
      };

      useConfigStore.getState().addSpecialitySkill(skill);
      vi.clearAllMocks();

      useConfigStore.getState().updateSpecialitySkill('MEL', { maxBaseLevel: 20 });

      const { config } = useConfigStore.getState();
      expect(config?.specialitySkills[0].maxBaseLevel).toBe(20);
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });

    it('should delete speciality skill', () => {
      const skill: SpecialitySkill = {
        id: 'MEL',
        code: 'MEL',
        name: 'Melee',
        description: 'Close combat',
        maxBaseLevel: 10,
        bonusFormula: 'STR + DEX',
      };

      useConfigStore.getState().addSpecialitySkill(skill);
      vi.clearAllMocks();

      useConfigStore.getState().deleteSpecialitySkill('MEL');

      const { config } = useConfigStore.getState();
      expect(config?.specialitySkills).toHaveLength(0);
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });
  });

  describe('Combat Skills CRUD', () => {
    beforeEach(() => {
      useConfigStore.getState().initializeConfig('Test');
      vi.clearAllMocks();
    });

    it('should add combat skill', () => {
      const skill: CombatSkill = {
        id: 'ATK',
        code: 'ATK',
        name: 'Attack',
        description: 'Basic attack',
        dice: { d4: 0, d6: 2, d8: 0, d10: 0, d12: 0, d20: 0 },
        bonusFormula: 'STR + MEL',
      };

      useConfigStore.getState().addCombatSkill(skill);

      const { config } = useConfigStore.getState();
      expect(config?.combatSkills).toHaveLength(1);
      expect(config?.combatSkills[0]).toEqual(skill);
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });

    it('should update combat skill', () => {
      const skill: CombatSkill = {
        id: 'ATK',
        code: 'ATK',
        name: 'Attack',
        description: 'Basic attack',
        dice: { d4: 0, d6: 2, d8: 0, d10: 0, d12: 0, d20: 0 },
        bonusFormula: 'STR + MEL',
      };

      useConfigStore.getState().addCombatSkill(skill);
      vi.clearAllMocks();

      useConfigStore.getState().updateCombatSkill('ATK', {
        dice: { d4: 0, d6: 0, d8: 2, d10: 0, d12: 0, d20: 0 },
      });

      const { config } = useConfigStore.getState();
      expect(config?.combatSkills[0].dice.d8).toBe(2);
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });

    it('should delete combat skill', () => {
      const skill: CombatSkill = {
        id: 'ATK',
        code: 'ATK',
        name: 'Attack',
        description: 'Basic attack',
        dice: { d4: 0, d6: 2, d8: 0, d10: 0, d12: 0, d20: 0 },
        bonusFormula: 'STR + MEL',
      };

      useConfigStore.getState().addCombatSkill(skill);
      vi.clearAllMocks();

      useConfigStore.getState().deleteCombatSkill('ATK');

      const { config } = useConfigStore.getState();
      expect(config?.combatSkills).toHaveLength(0);
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });
  });

  describe('Material Categories CRUD', () => {
    beforeEach(() => {
      useConfigStore.getState().initializeConfig('Test');
      vi.clearAllMocks();
    });

    it('should add material category', () => {
      const category: MaterialCategory = {
        id: 'metals',
        name: 'Metals',
        description: 'Metal materials',
      };

      useConfigStore.getState().addMaterialCategory(category);

      const { config } = useConfigStore.getState();
      expect(config?.materialCategories).toHaveLength(1);
      expect(config?.materialCategories[0]).toEqual(category);
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });

    it('should update material category', () => {
      const category: MaterialCategory = {
        id: 'metals',
        name: 'Metals',
        description: 'Metal materials',
      };

      useConfigStore.getState().addMaterialCategory(category);
      vi.clearAllMocks();

      useConfigStore.getState().updateMaterialCategory('metals', { name: 'Alloys' });

      const { config } = useConfigStore.getState();
      expect(config?.materialCategories[0].name).toBe('Alloys');
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });

    it('should delete material category', () => {
      const category: MaterialCategory = {
        id: 'metals',
        name: 'Metals',
        description: 'Metal materials',
      };

      useConfigStore.getState().addMaterialCategory(category);
      vi.clearAllMocks();

      useConfigStore.getState().deleteMaterialCategory('metals');

      const { config } = useConfigStore.getState();
      expect(config?.materialCategories).toHaveLength(0);
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });
  });

  describe('Materials CRUD', () => {
    beforeEach(() => {
      useConfigStore.getState().initializeConfig('Test');
      vi.clearAllMocks();
    });

    it('should add material', () => {
      const material: Material = {
        id: 'iron',
        name: 'Iron',
        description: 'Common metal',
        categoryId: 'metals',
        levels: [],
      };

      useConfigStore.getState().addMaterial(material);

      const { config } = useConfigStore.getState();
      expect(config?.materials).toHaveLength(1);
      expect(config?.materials[0]).toEqual(material);
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });

    it('should update material', () => {
      const material: Material = {
        id: 'iron',
        name: 'Iron',
        description: 'Common metal',
        categoryId: 'metals',
        levels: [],
      };

      useConfigStore.getState().addMaterial(material);
      vi.clearAllMocks();

      useConfigStore.getState().updateMaterial('iron', { name: 'Steel' });

      const { config } = useConfigStore.getState();
      expect(config?.materials[0].name).toBe('Steel');
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });

    it('should delete material', () => {
      const material: Material = {
        id: 'iron',
        name: 'Iron',
        description: 'Common metal',
        categoryId: 'metals',
        levels: [],
      };

      useConfigStore.getState().addMaterial(material);
      vi.clearAllMocks();

      useConfigStore.getState().deleteMaterial('iron');

      const { config } = useConfigStore.getState();
      expect(config?.materials).toHaveLength(0);
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });
  });

  describe('Items CRUD', () => {
    beforeEach(() => {
      useConfigStore.getState().initializeConfig('Test');
      vi.clearAllMocks();
    });

    it('should add item', () => {
      const item: Item = {
        id: 'sword',
        name: 'Sword',
        description: 'A sharp blade',
        categoryId: 'weapons',
        materialId: 'iron',
        materialLevel: 1,
        equipmentSlotType: 'main_hand',
      };

      useConfigStore.getState().addItem(item);

      const { config } = useConfigStore.getState();
      expect(config?.items).toHaveLength(1);
      expect(config?.items[0]).toEqual(item);
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });

    it('should update item', () => {
      const item: Item = {
        id: 'sword',
        name: 'Sword',
        description: 'A sharp blade',
      };

      useConfigStore.getState().addItem(item);
      vi.clearAllMocks();

      useConfigStore.getState().updateItem('sword', { name: 'Longsword' });

      const { config } = useConfigStore.getState();
      expect(config?.items[0].name).toBe('Longsword');
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });

    it('should delete item', () => {
      const item: Item = {
        id: 'sword',
        name: 'Sword',
        description: 'A sharp blade',
      };

      useConfigStore.getState().addItem(item);
      vi.clearAllMocks();

      useConfigStore.getState().deleteItem('sword');

      const { config } = useConfigStore.getState();
      expect(config?.items).toHaveLength(0);
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });
  });

  describe('Equipment Slots CRUD', () => {
    beforeEach(() => {
      useConfigStore.getState().initializeConfig('Test');
      vi.clearAllMocks();
    });

    it('should add equipment slot', () => {
      const slot: EquipmentSlot = {
        type: 'helmet',
        name: 'Helmet',
        description: 'Head protection',
      };

      useConfigStore.getState().addEquipmentSlot(slot);

      const { config } = useConfigStore.getState();
      expect(config?.equipmentSlots).toHaveLength(1);
      expect(config?.equipmentSlots[0]).toEqual(slot);
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });

    it('should update equipment slot', () => {
      const slot: EquipmentSlot = {
        type: 'helmet',
        name: 'Helmet',
        description: 'Head protection',
      };

      useConfigStore.getState().addEquipmentSlot(slot);
      vi.clearAllMocks();

      useConfigStore.getState().updateEquipmentSlot('helmet', { name: 'Headgear' });

      const { config } = useConfigStore.getState();
      expect(config?.equipmentSlots[0].name).toBe('Headgear');
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });

    it('should delete equipment slot', () => {
      const slot: EquipmentSlot = {
        type: 'helmet',
        name: 'Helmet',
        description: 'Head protection',
      };

      useConfigStore.getState().addEquipmentSlot(slot);
      vi.clearAllMocks();

      useConfigStore.getState().deleteEquipmentSlot('helmet');

      const { config } = useConfigStore.getState();
      expect(config?.equipmentSlots).toHaveLength(0);
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });
  });

  describe('Races CRUD', () => {
    beforeEach(() => {
      useConfigStore.getState().initializeConfig('Test');
      vi.clearAllMocks();
    });

    it('should add race', () => {
      const race: Race = {
        id: 'human',
        name: 'Human',
        description: 'Versatile race',
        skillModifiers: [{ skillCode: 'STR', modifier: 1 }],
      };

      useConfigStore.getState().addRace(race);

      const { config } = useConfigStore.getState();
      expect(config?.races).toHaveLength(1);
      expect(config?.races[0]).toEqual(race);
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });

    it('should update race', () => {
      const race: Race = {
        id: 'human',
        name: 'Human',
        description: 'Versatile race',
        skillModifiers: [],
      };

      useConfigStore.getState().addRace(race);
      vi.clearAllMocks();

      useConfigStore.getState().updateRace('human', { name: 'Humans' });

      const { config } = useConfigStore.getState();
      expect(config?.races[0].name).toBe('Humans');
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });

    it('should delete race', () => {
      const race: Race = {
        id: 'human',
        name: 'Human',
        description: 'Versatile race',
        skillModifiers: [],
      };

      useConfigStore.getState().addRace(race);
      vi.clearAllMocks();

      useConfigStore.getState().deleteRace('human');

      const { config } = useConfigStore.getState();
      expect(config?.races).toHaveLength(0);
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });
  });

  describe('Currency Tiers CRUD', () => {
    beforeEach(() => {
      useConfigStore.getState().initializeConfig('Test');
      vi.clearAllMocks();
    });

    it('should add currency tier', () => {
      const tier: CurrencyTier = {
        id: 'copper',
        name: 'Copper',
        order: 0,
        conversionToNext: 10,
      };

      useConfigStore.getState().addCurrencyTier(tier);

      const { config } = useConfigStore.getState();
      expect(config?.currencyTiers).toHaveLength(1);
      expect(config?.currencyTiers[0]).toEqual(tier);
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });

    it('should update currency tier', () => {
      const tier: CurrencyTier = {
        id: 'copper',
        name: 'Copper',
        order: 0,
        conversionToNext: 10,
      };

      useConfigStore.getState().addCurrencyTier(tier);
      vi.clearAllMocks();

      useConfigStore.getState().updateCurrencyTier('copper', { conversionToNext: 100 });

      const { config } = useConfigStore.getState();
      expect(config?.currencyTiers[0].conversionToNext).toBe(100);
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });

    it('should delete currency tier', () => {
      const tier: CurrencyTier = {
        id: 'copper',
        name: 'Copper',
        order: 0,
        conversionToNext: 10,
      };

      useConfigStore.getState().addCurrencyTier(tier);
      vi.clearAllMocks();

      useConfigStore.getState().deleteCurrencyTier('copper');

      const { config } = useConfigStore.getState();
      expect(config?.currencyTiers).toHaveLength(0);
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });
  });

  describe('Focus Stat Configuration', () => {
    beforeEach(() => {
      useConfigStore.getState().initializeConfig('Test');
      vi.clearAllMocks();
    });

    it('should set focus stat bonus level', () => {
      useConfigStore.getState().setFocusStatBonusLevel(5);

      const { config } = useConfigStore.getState();
      expect(config?.focusStatBonusLevel).toBe(5);
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });
  });

  describe('Main Skill Point Budget', () => {
    beforeEach(() => {
      useConfigStore.getState().initializeConfig('Test');
      vi.clearAllMocks();
    });

    it('should start with no budget, meaning unlimited', () => {
      expect(useConfigStore.getState().config?.mainSkillPointBudget).toBeUndefined();
    });

    it('should set the main skill point budget and persist it', () => {
      useConfigStore.getState().setMainSkillPointBudget(20);

      expect(useConfigStore.getState().config?.mainSkillPointBudget).toBe(20);
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });

    it('should accept a budget of zero', () => {
      useConfigStore.getState().setMainSkillPointBudget(0);

      expect(useConfigStore.getState().config?.mainSkillPointBudget).toBe(0);
    });

    it('should remove the field entirely when cleared, rather than storing undefined', () => {
      useConfigStore.getState().setMainSkillPointBudget(20);
      useConfigStore.getState().setMainSkillPointBudget(undefined);

      const { config } = useConfigStore.getState();
      expect(config?.mainSkillPointBudget).toBeUndefined();
      expect(config && 'mainSkillPointBudget' in config).toBe(false);
    });
  });

  describe('Auto-save', () => {
    beforeEach(() => {
      useConfigStore.getState().initializeConfig('Test');
      vi.clearAllMocks();
    });

    it('should update timestamp on every change', () => {
      const initialConfig = useConfigStore.getState().config;
      const initialTimestamp = initialConfig?.updatedAt;

      // Wait a bit to ensure timestamp changes
      setTimeout(() => {
        useConfigStore.getState().setFocusStatBonusLevel(10);

        const updatedConfig = useConfigStore.getState().config;
        expect(updatedConfig?.updatedAt).not.toBe(initialTimestamp);
      }, 10);
    });

    it('should call saveConfiguration on every CRUD operation', () => {
      const stat: Stat = {
        id: 'str',
        name: 'Strength',
        abbreviation: 'STR',
        description: 'Physical power',
        order: 0,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
      };

      useConfigStore.getState().addStat(stat);
      expect(storage.saveConfiguration).toHaveBeenCalledTimes(1);

      useConfigStore.getState().updateStat('str', { name: 'Might' });
      expect(storage.saveConfiguration).toHaveBeenCalledTimes(2);

      useConfigStore.getState().deleteStat('str');
      expect(storage.saveConfiguration).toHaveBeenCalledTimes(3);
    });
  });
  describe('Rename safety (TICKET-REF-01)', () => {
    beforeEach(() => {
      useConfigStore.getState().initializeConfig('Test');
      useConfigStore.getState().addStat({
        id: 'id-str',
        name: 'Strength',
        abbreviation: 'STR',
        description: '',
        order: 0,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
      });
      useConfigStore.getState().addStat({
        id: 'id-hp',
        name: 'Health',
        abbreviation: 'HEA',
        description: '',
        order: 0,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
        formula: 'STR * 10',
      });
      useConfigStore.getState().addSpecialitySkill({
        id: 'id-stl',
        code: 'STL',
        name: 'Stealth',
        description: '',
        maxBaseLevel: 10,
        bonusFormula: 'STR / 2',
      });
      useConfigStore.getState().addRace({
        id: 'race1',
        name: 'Dwarf',
        description: '',
        skillModifiers: [{ skillCode: 'STR', modifier: 2 }],
      });
      vi.clearAllMocks();
    });

    it('rewrites every formula naming a stat whose abbreviation changes', () => {
      useConfigStore.getState().updateStat('id-str', { abbreviation: 'STG', name: 'Might' });

      const { config } = useConfigStore.getState();
      expect(config?.stats.find((candidate) => candidate.formula)?.formula).toBe('STG * 10');
      expect(config?.specialitySkills[0].bonusFormula).toBe('STG / 2');
      expect(config?.races[0].skillModifiers[0].skillCode).toBe('STG');
      expect(config?.stats[0].id).toBe('id-str');
    });

    it('rewrites a formula naming a speciality skill whose code changes', () => {
      useConfigStore.getState().updateStat('id-hp', { formula: 'skills.STL.level * 2' });
      useConfigStore.getState().updateSpecialitySkill('STL', { code: 'SNK' });

      expect(
        useConfigStore.getState().config?.stats.find((candidate) => candidate.formula)?.formula
      ).toBe('skills.SNK.level * 2');
    });

    it('re-slugs a stat named in another formula when the stat is renamed', () => {
      useConfigStore.getState().updateSpecialitySkill('STL', { bonusFormula: 'stats.health / 4' });
      useConfigStore.getState().updateStat('id-hp', { name: 'Vitality' });

      expect(useConfigStore.getState().config?.specialitySkills[0].bonusFormula).toBe(
        'stats.vitality / 4'
      );
    });

    it('leaves an edit that renames nothing untouched', () => {
      const before = useConfigStore.getState().config;

      useConfigStore.getState().updateStat('id-str', { description: 'Raw power' });

      const after = useConfigStore.getState().config;
      // Nothing was re-spelled, so every formula in the ruleset comes back byte-identical
      expect(after?.stats.map((stat) => stat.formula)).toEqual(
        before?.stats.map((stat) => stat.formula)
      );
      expect(after?.specialitySkills).toEqual(before?.specialitySkills);
    });
  });
  describe('Guarded deletes (TICKET-REF-02)', () => {
    beforeEach(() => {
      useConfigStore.setState({
        config: {
          id: 'config1',
          name: 'Test',
          version: '1.0',
          schemaVersion: 2,
          stats: [
            {
              id: 'id-str',
              name: 'Strength',
              abbreviation: 'STR',
              description: '',
              order: 0,
              countsTowardTotal: true,
              isResource: false,
              rounding: 'none',
            },
            {
              id: 'id-hp',
              name: 'Health',
              abbreviation: 'HEA',
              description: '',
              order: 0,
              countsTowardTotal: true,
              isResource: false,
              rounding: 'none',
              formula: 'STR * 10',
            },
          ],
          specialitySkills: [],
          combatSkills: [],
          materials: [],
          materialCategories: [],
          items: [],
          equipmentSlots: [],
          races: [{ id: 'dwarf', name: 'Dwarf', description: '', skillModifiers: [] }],
          currencyTiers: [],
          focusStatBonusLevel: 0,
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
        isLoaded: true,
      });
      useCharacterStore.setState({ characters: [], isLoaded: true });
      vi.clearAllMocks();
    });

    it('refuses a delete while something points at the entity, and says what', () => {
      const references = useConfigStore.getState().deleteStat('id-str');

      expect(references.map((reference) => reference.holderName)).toEqual(['Health']);
      expect(useConfigStore.getState().config?.stats).toHaveLength(2);
      expect(storage.saveConfiguration).not.toHaveBeenCalled();
    });

    it('counts a character as a reference', () => {
      useCharacterStore.setState({
        characters: [
          {
            id: 'char1',
            name: 'Aria',
            configurationId: 'config1',
            raceIds: ['dwarf'],
            investedStatPoints: {},
            specialitySkillBaseLevels: {},
            currentResourceValues: {},
            inventory: { equippedItems: {}, miscItems: [] },
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          },
        ],
        isLoaded: true,
      });

      const references = useConfigStore.getState().deleteRace('dwarf');

      expect(references.map((reference) => reference.holderKind)).toEqual(['Character']);
      expect(useConfigStore.getState().config?.races).toHaveLength(1);
    });

    it('deletes an unreferenced entity cleanly and returns nothing', () => {
      const references = useConfigStore.getState().deleteRace('dwarf');

      expect(references).toEqual([]);
      expect(useConfigStore.getState().config?.races).toHaveLength(0);
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });

    it('force deletes anyway, leaving the dependent formula as written', () => {
      const references = useConfigStore.getState().deleteStat('id-str', { force: true });

      expect(references).toEqual([]);
      expect(useConfigStore.getState().config?.stats).toHaveLength(1);
      // The formula keeps its spelling, so the sheet can name what went missing
      expect(
        useConfigStore.getState().config?.stats.find((candidate) => candidate.formula)?.formula
      ).toBe('STR * 10');
    });
  });
  describe('Constants (TICKET-CST-01)', () => {
    beforeEach(() => {
      useConfigStore.getState().initializeConfig('Test');
      useCharacterStore.setState({ characters: [], isLoaded: true });
      vi.clearAllMocks();
    });

    it('seeds a fresh configuration with the concept-page constants, each described', () => {
      const constants = useConfigStore.getState().config?.constants ?? [];

      expect(constants.map((constant) => constant.name).sort()).toEqual([
        'apt_value',
        'bonus_divider',
        'points_per_level',
        'race_blend_divisor',
      ]);
      expect(constants.map((constant) => constant.value)).toEqual([5, 30, 3, 2]);
      expect(constants.every((constant) => constant.description.length > 0)).toBe(true);
      expect(constants.every((constant) => Boolean(constant.id))).toBe(true);
    });

    it('adds, updates and deletes through the store, persisting each time', () => {
      useConfigStore.getState().addConstant({
        id: 'id-new',
        name: 'crit_multiplier',
        displayName: 'Crit multiplier',
        description: 'Damage multiplier on a critical hit',
        value: 2,
      });
      expect(storage.saveConfiguration).toHaveBeenCalledTimes(1);

      useConfigStore.getState().updateConstant('id-new', { value: 3 });
      const added = useConfigStore
        .getState()
        .config?.constants?.find((constant) => constant.id === 'id-new');
      expect(added?.value).toBe(3);

      expect(useConfigStore.getState().deleteConstant('id-new')).toEqual([]);
      expect(useConfigStore.getState().config?.constants?.some((c) => c.id === 'id-new')).toBe(
        false
      );
      expect(storage.saveConfiguration).toHaveBeenCalledTimes(3);
    });

    it('refuses to delete a constant a formula names, and says which', () => {
      useConfigStore.getState().addStat({
        id: 'id-hp',
        name: 'Health',
        abbreviation: 'HEA',
        description: '',
        order: 0,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
        formula: '10 / const.bonus_divider',
      });
      const divider = useConfigStore
        .getState()
        .config?.constants?.find((constant) => constant.name === 'bonus_divider');

      const references = useConfigStore.getState().deleteConstant(divider?.id as string);

      expect(references.map((reference) => reference.holderName)).toEqual(['Health']);
      expect(useConfigStore.getState().config?.constants?.some((c) => c.id === divider?.id)).toBe(
        true
      );
    });

    it('re-spells every formula naming a constant when its identifier is renamed', () => {
      useConfigStore.getState().addStat({
        id: 'id-hp',
        name: 'Health',
        abbreviation: 'HEA',
        description: '',
        order: 0,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
        formula: '10 / const.bonus_divider',
      });
      const divider = useConfigStore
        .getState()
        .config?.constants?.find((constant) => constant.name === 'bonus_divider');

      useConfigStore.getState().updateConstant(divider?.id as string, { name: 'bonus_scale' });

      expect(
        useConfigStore.getState().config?.stats.find((candidate) => candidate.formula)?.formula
      ).toBe('10 / const.bonus_scale');
    });
  });

  describe('Curves (TICKET-CRV-01)', () => {
    /**
     * The fixture is named `xp_table`, not `xp_thresholds`: TICKET-CRV-03 seeds a curve by that
     * name, and two curves sharing one identifier is exactly the ambiguity `references.ts`
     * refuses to resolve.
     */
    const curve: Curve = {
      id: 'id-xp',
      name: 'xp_table',
      displayName: 'XP table',
      description: 'Cumulative XP required per level',
      keyName: 'level',
      columns: [{ id: 'col-xp', name: 'xp_required' }],
      rows: [
        { key: 1, values: [0] },
        { key: 2, values: [300] },
      ],
      interpolation: 'step',
      outOfRange: 'extrapolate',
      lookupDirection: 'reverse',
    };

    /** The fixture curve as the store currently holds it */
    const stored = () =>
      useConfigStore.getState().config?.curves?.find((candidate) => candidate.id === 'id-xp');

    /** How many curves a fresh ruleset arrives with (TICKET-CRV-03) */
    const SEEDED = 2;

    beforeEach(() => {
      useConfigStore.getState().initializeConfig('Test');
      useCharacterStore.setState({ characters: [], isLoaded: true });
      vi.clearAllMocks();
    });

    it('adds, updates and deletes through the store, persisting each time', () => {
      useConfigStore.getState().addCurve(curve);
      expect(storage.saveConfiguration).toHaveBeenCalledTimes(1);
      expect(useConfigStore.getState().config?.curves).toHaveLength(SEEDED + 1);

      useConfigStore.getState().updateCurve('id-xp', { interpolation: 'linear' });
      expect(stored()?.interpolation).toBe('linear');

      expect(useConfigStore.getState().deleteCurve('id-xp')).toEqual([]);
      expect(stored()).toBeUndefined();
      expect(storage.saveConfiguration).toHaveBeenCalledTimes(3);
    });

    it('refuses to delete a curve a formula calls, and says which', () => {
      useConfigStore.getState().addCurve(curve);
      useConfigStore.getState().addStat({
        id: 'id-level',
        name: 'Level',
        abbreviation: 'LEV',
        description: '',
        order: 0,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
        formula: 'curve.xp_table(STR)',
      });

      const references = useConfigStore.getState().deleteCurve('id-xp');

      expect(references.map((reference) => reference.holderName)).toEqual(['Level']);
      expect(stored()).toBeDefined();
    });

    it('re-spells every formula calling a curve when its identifier is renamed', () => {
      useConfigStore.getState().addCurve(curve);
      useConfigStore.getState().addStat({
        id: 'id-level',
        name: 'Level',
        abbreviation: 'LEV',
        description: '',
        order: 0,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
        formula: 'curve.xp_table(STR)',
      });

      useConfigStore.getState().updateCurve('id-xp', { name: 'level_table' });

      expect(
        useConfigStore.getState().config?.stats.find((candidate) => candidate.formula)?.formula
      ).toBe('curve.level_table(STR)');
    });

    it('regenerates a curve through the store, persisting the result (TICKET-CRV-02)', () => {
      useConfigStore.getState().addCurve({
        ...curve,
        columns: [{ id: 'col-xp', name: 'xp_required', generator: 'const.points_per_level * key' }],
        rows: [
          { key: 1, values: [0] },
          { key: 2, values: [0], overridden: [true] },
        ],
      });
      vi.clearAllMocks();

      const report = useConfigStore.getState().regenerateCurve('id-xp');

      // `points_per_level` is a seeded constant worth 3, so row 1 becomes 3 and row 2 is kept
      expect(report).toEqual({ written: 1, kept: 1, errors: [] });
      expect(
        useConfigStore
          .getState()
          .config?.curves?.find((c) => c.id === 'id-xp')
          ?.rows.map((row) => row.values[0])
      ).toEqual([3, 0]);
      expect(storage.saveConfiguration).toHaveBeenCalledTimes(1);
    });

    it('re-spells a generator when a constant it names is renamed (TICKET-CRV-02)', () => {
      useConfigStore.getState().addCurve({
        ...curve,
        columns: [{ id: 'col-xp', name: 'xp_required', generator: 'key * const.points_per_level' }],
      });
      const perLevel = useConfigStore
        .getState()
        .config?.constants?.find((constant) => constant.name === 'points_per_level');

      useConfigStore.getState().updateConstant(perLevel?.id as string, { name: 'xp_step' });

      // A generator is a persisted formula, so it is id-resolved like every other (TICKET-REF-01)
      expect(
        useConfigStore.getState().config?.curves?.find((c) => c.id === 'id-xp')?.columns[0]
          .generator
      ).toBe('key * const.xp_step');
    });

    it('refuses to delete a constant a generator names, and says which', () => {
      useConfigStore.getState().addCurve({
        ...curve,
        columns: [{ id: 'col-xp', name: 'xp_required', generator: 'key * const.points_per_level' }],
      });
      const perLevel = useConfigStore
        .getState()
        .config?.constants?.find((constant) => constant.name === 'points_per_level');

      const references = useConfigStore.getState().deleteConstant(perLevel?.id as string);

      expect(references.map((reference) => reference.field)).toEqual(['generator']);
      expect(useConfigStore.getState().config?.constants?.some((c) => c.id === perLevel?.id)).toBe(
        true
      );
    });

    it('reports nothing and writes nothing for a curve that is not there', () => {
      const report = useConfigStore.getState().regenerateCurve('missing');

      expect(report).toEqual({ written: 0, kept: 0, errors: [] });
      expect(storage.saveConfiguration).not.toHaveBeenCalled();
    });

    it('keeps the column segment when it re-spells a call that names one', () => {
      useConfigStore.getState().addCurve({
        ...curve,
        columns: [
          { id: 'col-a', name: 'low' },
          { id: 'col-b', name: 'high' },
        ],
        rows: [{ key: 1, values: [0, 1] }],
      });
      useConfigStore.getState().addStat({
        id: 'id-level',
        name: 'Level',
        abbreviation: 'LEV',
        description: '',
        order: 0,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
        formula: 'curve.xp_table.high(STR)',
      });

      useConfigStore.getState().updateCurve('id-xp', { name: 'level_table' });

      expect(
        useConfigStore.getState().config?.stats.find((candidate) => candidate.formula)?.formula
      ).toBe('curve.level_table.high(STR)');
    });

    it('re-spells every formula reading a column when the column is renamed (TICKET-CRV-03)', () => {
      useConfigStore.getState().addCurve({
        ...curve,
        columns: [
          { id: 'col-a', name: 'low' },
          { id: 'col-b', name: 'high' },
        ],
        rows: [{ key: 1, values: [0, 1] }],
      });
      useConfigStore.getState().addStat({
        id: 'id-level',
        name: 'Level',
        abbreviation: 'LEV',
        description: '',
        order: 0,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
        formula: 'curve.xp_table.high(STR)',
      });

      useConfigStore.getState().updateCurve('id-xp', {
        columns: [
          { id: 'col-a', name: 'low' },
          { id: 'col-b', name: 'highest' },
        ],
      });

      expect(
        useConfigStore.getState().config?.stats.find((candidate) => candidate.formula)?.formula
      ).toBe('curve.xp_table.highest(STR)');
    });
  });

  describe('Seed curves (TICKET-CRV-03)', () => {
    beforeEach(() => {
      useConfigStore.getState().initializeConfig('Test');
      vi.clearAllMocks();
    });

    const seed = (name: string) =>
      useConfigStore.getState().config?.curves?.find((curve) => curve.name === name);

    it('seeds point_buy and xp_thresholds into a fresh ruleset', () => {
      expect(useConfigStore.getState().config?.curves?.map((curve) => curve.name)).toEqual([
        'point_buy',
        'xp_thresholds',
      ]);
    });

    it('reproduces main = 0.75 × (points + 1) on every point_buy row', () => {
      const curve = seed('point_buy');
      const mainIndex = curve?.columns.findIndex((column) => column.name === 'main') ?? -1;

      expect(curve?.columns[mainIndex].generator).toBe('0.75 * (key + 1)');
      for (const row of curve?.rows ?? []) {
        expect(row.values[mainIndex]).toBeCloseTo(0.75 * (row.key + 1), 10);
      }
    });

    it('carries the concept page’s 15-point row exactly', () => {
      // 5 / 7 / 12 — the row the point-buy table is anchored on (Concept 06)
      expect(seed('point_buy')?.rows.find((row) => row.key === 15)?.values).toEqual([5, 7, 12]);
    });

    it('keeps the sheet’s 9-point sub-type anomaly rather than rounding it away', () => {
      // Concept 06 is explicit that this needs a decision, not a silent fix
      expect(seed('point_buy')?.rows.find((row) => row.key === 9)?.values[1]).toBe(4.642857142857);
    });

    it('seeds xp_thresholds as a shape, not as invented numbers', () => {
      const curve = seed('xp_thresholds');

      expect(curve?.keyName).toBe('level');
      expect(curve?.columns.map((column) => column.name)).toEqual(['xp_required']);
      expect(curve?.lookupDirection).toBe('reverse');
      expect(curve?.interpolation).toBe('step');
      expect(curve?.outOfRange).toBe('extrapolate');
      expect(curve?.rows).toEqual([{ key: 1, values: [0] }]);
    });

    it('exports and re-imports both seeds unchanged', () => {
      const config = useConfigStore.getState().config as Configuration;

      // The persisted form is id-resolved, so this proves the seeds survive the boundary they
      // will actually cross — a shared ruleset file (TICKET-CRV-03)
      const exported = JSON.stringify(toStoredConfiguration(config), null, 2);

      expect(validateConfiguration(config).isValid).toBe(true);
      expect(importConfiguration(exported)).toEqual(config);
    });

    it('regenerates the point_buy seed to the same numbers it shipped with', () => {
      const curve = seed('point_buy');
      const before = curve?.rows.map((row) => [...row.values]);

      useConfigStore.getState().regenerateCurve(curve?.id as string);

      expect(seed('point_buy')?.rows.map((row) => row.values)).toEqual(before);
    });
  });

  describe('Curve grid editing (TICKET-CRV-03)', () => {
    const curveId = () =>
      useConfigStore.getState().config?.curves?.find((curve) => curve.name === 'point_buy')
        ?.id as string;

    const pointBuy = () =>
      useConfigStore.getState().config?.curves?.find((curve) => curve.name === 'point_buy');

    beforeEach(() => {
      useConfigStore.getState().initializeConfig('Test');
      vi.clearAllMocks();
    });

    it('adds a column and gives every row a cell for it', () => {
      useConfigStore.getState().addCurveColumn(curveId(), { id: 'col-hyper', name: 'hyper' });

      expect(pointBuy()?.columns.map((column) => column.name)).toEqual([
        'non',
        'sub',
        'main',
        'hyper',
      ]);
      for (const row of pointBuy()?.rows ?? []) {
        expect(row.values).toHaveLength(4);
      }
      expect(storage.saveConfiguration).toHaveBeenCalledTimes(1);
    });

    it('removes a column without shifting the surviving override flags', () => {
      const id = curveId();
      // Flag `main` at 3 points, then remove the column to its left
      useConfigStore.getState().setCurveCell(id, 3, 'main', 99);
      useConfigStore.getState().deleteCurveColumn(id, pointBuy()?.columns[0].id as string);

      const row = pointBuy()?.rows.find((candidate) => candidate.key === 3);
      expect(pointBuy()?.columns.map((column) => column.name)).toEqual(['sub', 'main']);
      expect(row?.values).toEqual([2, 99]);
      expect(row?.overridden).toEqual([false, true]);
    });

    it('adds and removes rows in key order', () => {
      const id = curveId();

      useConfigStore.getState().addCurveRow(id, 16);
      expect(pointBuy()?.rows.at(-1)).toEqual({ key: 16, values: [0, 0, 0] });

      useConfigStore.getState().deleteCurveRow(id, 16);
      expect(pointBuy()?.rows.some((row) => row.key === 16)).toBe(false);
    });

    it('flags a generated cell the User types into, and unflags it on clear', () => {
      const id = curveId();

      useConfigStore.getState().setCurveCell(id, 2, 'main', 5);
      expect(pointBuy()?.rows.find((row) => row.key === 2)?.overridden).toEqual([
        false,
        false,
        true,
      ]);

      useConfigStore.getState().clearCurveOverride(id, 2, 'main');
      const row = pointBuy()?.rows.find((candidate) => candidate.key === 2);
      expect(row?.values[2]).toBeCloseTo(2.25, 10);
      expect(row?.overridden).toBeUndefined();
    });

    it('keeps an override through a regeneration', () => {
      const id = curveId();
      useConfigStore.getState().setCurveCell(id, 2, 'main', 5);

      const report = useConfigStore.getState().regenerateCurve(id);

      expect(report.kept).toBe(1);
      expect(pointBuy()?.rows.find((row) => row.key === 2)?.values[2]).toBe(5);
    });

    it('writes nothing for a curve that is not there', () => {
      useConfigStore.getState().addCurveRow('missing', 1);

      expect(storage.saveConfiguration).not.toHaveBeenCalled();
    });
  });
});
