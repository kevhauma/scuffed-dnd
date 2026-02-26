/**
 * Configuration Store Tests
 * 
 * Tests for ConfigStore CRUD operations and auto-save functionality.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useConfigStore } from './configStore';
import * as storage from '../services/storage';
import type {
  MainSkill,
  Stat,
  SpecialitySkill,
  CombatSkill,
  Material,
  MaterialCategory,
  Item,
  EquipmentSlot,
  Race,
  CurrencyTier,
} from '../types/config';

// Mock storage service
vi.mock('../services/storage', () => ({
  saveConfiguration: vi.fn(),
  loadConfiguration: vi.fn(),
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
      expect(config?.mainSkills).toEqual([]);
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
        mainSkills: [],
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
      };
      
      vi.mocked(storage.loadConfiguration).mockReturnValue(mockConfig);
      
      const { loadConfig } = useConfigStore.getState();
      loadConfig();
      
      const { config, isLoaded } = useConfigStore.getState();
      expect(isLoaded).toBe(true);
      expect(config).toEqual(mockConfig);
    });
  });

  describe('Main Skills CRUD', () => {
    beforeEach(() => {
      useConfigStore.getState().initializeConfig('Test');
      vi.clearAllMocks();
    });

    it('should add main skill', () => {
      const skill: MainSkill = {
        code: 'STR',
        name: 'Strength',
        description: 'Physical power',
        maxLevel: 10,
      };
      
      useConfigStore.getState().addMainSkill(skill);
      
      const { config } = useConfigStore.getState();
      expect(config?.mainSkills).toHaveLength(1);
      expect(config?.mainSkills[0]).toEqual(skill);
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });

    it('should update main skill', () => {
      const skill: MainSkill = {
        code: 'STR',
        name: 'Strength',
        description: 'Physical power',
        maxLevel: 10,
      };
      
      useConfigStore.getState().addMainSkill(skill);
      vi.clearAllMocks();
      
      useConfigStore.getState().updateMainSkill('STR', { maxLevel: 20 });
      
      const { config } = useConfigStore.getState();
      expect(config?.mainSkills[0].maxLevel).toBe(20);
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });

    it('should delete main skill', () => {
      const skill: MainSkill = {
        code: 'STR',
        name: 'Strength',
        description: 'Physical power',
        maxLevel: 10,
      };
      
      useConfigStore.getState().addMainSkill(skill);
      vi.clearAllMocks();
      
      useConfigStore.getState().deleteMainSkill('STR');
      
      const { config } = useConfigStore.getState();
      expect(config?.mainSkills).toHaveLength(0);
      expect(storage.saveConfiguration).toHaveBeenCalled();
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
        description: 'Hit points',
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
        description: 'Hit points',
        formula: 'STR * 10',
      };
      
      useConfigStore.getState().addStat(stat);
      vi.clearAllMocks();
      
      useConfigStore.getState().updateStat('health', { formula: 'STR * 20' });
      
      const { config } = useConfigStore.getState();
      expect(config?.stats[0].formula).toBe('STR * 20');
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });

    it('should delete stat', () => {
      const stat: Stat = {
        id: 'health',
        name: 'Health',
        description: 'Hit points',
        formula: 'STR * 10',
      };
      
      useConfigStore.getState().addStat(stat);
      vi.clearAllMocks();
      
      useConfigStore.getState().deleteStat('health');
      
      const { config } = useConfigStore.getState();
      expect(config?.stats).toHaveLength(0);
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });
  });

  describe('Speciality Skills CRUD', () => {
    beforeEach(() => {
      useConfigStore.getState().initializeConfig('Test');
      vi.clearAllMocks();
    });

    it('should add speciality skill', () => {
      const skill: SpecialitySkill = {
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
        code: 'ATK',
        name: 'Attack',
        description: 'Basic attack',
        dice: { d4: 0, d6: 2, d8: 0, d10: 0, d12: 0, d20: 0 },
        bonusFormula: 'STR + MEL',
      };
      
      useConfigStore.getState().addCombatSkill(skill);
      vi.clearAllMocks();
      
      useConfigStore.getState().updateCombatSkill('ATK', { 
        dice: { d4: 0, d6: 0, d8: 2, d10: 0, d12: 0, d20: 0 } 
      });
      
      const { config } = useConfigStore.getState();
      expect(config?.combatSkills[0].dice.d8).toBe(2);
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });

    it('should delete combat skill', () => {
      const skill: CombatSkill = {
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
      const skill: MainSkill = {
        code: 'STR',
        name: 'Strength',
        description: 'Physical power',
        maxLevel: 10,
      };
      
      useConfigStore.getState().addMainSkill(skill);
      expect(storage.saveConfiguration).toHaveBeenCalledTimes(1);
      
      useConfigStore.getState().updateMainSkill('STR', { maxLevel: 20 });
      expect(storage.saveConfiguration).toHaveBeenCalledTimes(2);
      
      useConfigStore.getState().deleteMainSkill('STR');
      expect(storage.saveConfiguration).toHaveBeenCalledTimes(3);
    });
  });
});
