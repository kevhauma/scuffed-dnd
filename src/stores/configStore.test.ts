/**
 * Configuration Store Tests
 *
 * Tests for ConfigStore CRUD operations and auto-save functionality.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toStoredConfiguration } from '../engine/formula/references';
// Two complementary validators, both used here: the engine's checks a loaded ruleset's referential
// integrity, the service's checks *imported JSON shape* (CR-21 gave them names that say which).
import { validateConfiguration } from '../engine/validator';
import { importConfiguration, validateConfigurationShape } from '../services/importExport';
import * as storage from '../services/storage';
import type {
  Archetype,
  Configuration,
  CurrencyTier,
  Curve,
  DiceLadder,
  EquipmentSlot,
  Item,
  Material,
  MaterialCategory,
  Race,
  RollDefinition,
  Skill,
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
      expect(config?.skills).toEqual([]);
      expect(config?.materials).toEqual([]);
      expect(config?.materialCategories).toEqual([]);
      expect(config?.items).toEqual([]);
      expect(config?.equipmentSlots).toEqual([]);
      expect(config?.races).toEqual([]);
      expect(config?.currencyTiers).toEqual([]);
      expect(storage.saveConfiguration).toHaveBeenCalledWith(config);
    });

    it('should load configuration from storage', () => {
      const mockConfig = {
        id: 'test-id',
        name: 'Loaded Config',
        version: '1.0.0',
        schemaVersion: 9,
        stats: [],
        skills: [],
        materials: [],
        materialCategories: [],
        items: [],
        equipmentSlots: [],
        races: [],
        currencyTiers: [],
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
        version: '9.9.9',
      });

      // Applying an import discards the current ruleset — the app holds exactly one
      const { config, isLoaded } = useConfigStore.getState();
      expect(config?.id).toBe('imported-id');
      expect(config?.name).toBe('Imported');
      expect(config?.version).toBe('9.9.9');
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
      expect(after?.constants).toEqual(before?.constants);
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

    it('should refuse an abbreviation another stat already holds, in any case (CR-17)', () => {
      const stat: Stat = {
        id: 'health',
        name: 'Health',
        abbreviation: 'HEA',
        description: 'Hit points',
        order: 0,
        countsTowardTotal: true,
        isResource: true,
        rounding: 'none',
      };

      useConfigStore.getState().addStat(stat);
      vi.clearAllMocks();

      // Lowercase, because `scopeFor` uppercases an abbreviation into the flat space — `hea` and
      // `HEA` are one reference no matter how they are stored
      const refusal = useConfigStore
        .getState()
        .addStat({ ...stat, id: 'hardiness', name: 'Hardiness', abbreviation: 'hea' });

      expect(refusal).toMatchObject({ field: 'abbreviation', value: 'hea' });
      expect(refusal?.message).toContain('"Health"');
      expect(useConfigStore.getState().config?.stats).toHaveLength(1);
      expect(storage.saveConfiguration).not.toHaveBeenCalled();
    });

    it('should refuse a patch that moves an abbreviation onto another stat (CR-17)', () => {
      const base = {
        description: '',
        order: 0,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none' as const,
      };

      useConfigStore
        .getState()
        .addStat({ ...base, id: 'str', name: 'Strength', abbreviation: 'STR' });
      useConfigStore
        .getState()
        .addStat({ ...base, id: 'dex', name: 'Dexterity', abbreviation: 'DEX' });
      vi.clearAllMocks();

      const refusal = useConfigStore.getState().updateStat('dex', { abbreviation: 'STR' });

      expect(refusal?.field).toBe('abbreviation');
      expect(
        useConfigStore.getState().config?.stats.find((stat) => stat.id === 'dex')?.abbreviation
      ).toBe('DEX');
      expect(storage.saveConfiguration).not.toHaveBeenCalled();
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

  describe('Skills CRUD (TICKET-SKL-02)', () => {
    const melee: Skill = {
      id: 'MEL',
      name: 'Melee',
      description: 'Close combat',
      statWeights: [
        { statId: 'str', weight: 0.2 },
        { statId: 'dex', weight: 0.1 },
      ],
    };

    beforeEach(() => {
      useConfigStore.getState().initializeConfig('Test');
      vi.clearAllMocks();
    });

    it('should add a skill with its weight rows', () => {
      useConfigStore.getState().addSkill(melee);

      const { config } = useConfigStore.getState();
      expect(config?.skills).toHaveLength(1);
      expect(config?.skills[0]).toEqual(melee);
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });

    it('should update a skill by id, not by any code', () => {
      useConfigStore.getState().addSkill(melee);
      vi.clearAllMocks();

      useConfigStore.getState().updateSkill('MEL', {
        statWeights: [{ statId: 'str', weight: 0.5 }],
      });

      const { config } = useConfigStore.getState();
      expect(config?.skills[0].statWeights).toEqual([{ statId: 'str', weight: 0.5 }]);
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });

    it('should rename a skill without disturbing its weights', () => {
      useConfigStore.getState().addSkill(melee);
      vi.clearAllMocks();

      useConfigStore.getState().updateSkill('MEL', { name: 'Brawling' });

      const { config } = useConfigStore.getState();
      expect(config?.skills[0].name).toBe('Brawling');
      expect(config?.skills[0].statWeights).toEqual(melee.statWeights);
    });

    it('should remove the category rather than store an undefined one (CR-30)', () => {
      useConfigStore.getState().addSkill({ ...melee, category: 'Combat' });

      useConfigStore.getState().updateSkill('MEL', { category: undefined });

      expect(useConfigStore.getState().config?.skills[0]).not.toHaveProperty('category');
    });

    it('should delete a skill', () => {
      useConfigStore.getState().addSkill(melee);
      vi.clearAllMocks();

      useConfigStore.getState().deleteSkill('MEL');

      const { config } = useConfigStore.getState();
      expect(config?.skills).toHaveLength(0);
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

    it('should unequip an item rather than store an undefined slot type (CR-30)', () => {
      useConfigStore.getState().addItem({
        id: 'sword',
        name: 'Sword',
        description: 'A sharp blade',
        equipmentSlotType: 'main_hand',
        materialId: 'iron',
      });

      useConfigStore.getState().updateItem('sword', {
        equipmentSlotType: undefined,
        materialId: undefined,
      });

      const item = useConfigStore.getState().config?.items[0];
      expect(item).not.toHaveProperty('equipmentSlotType');
      expect(item).not.toHaveProperty('materialId');
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

  describe('Archetypes CRUD (TICKET-ARC-01)', () => {
    const strong: Archetype = {
      id: 'strong',
      name: 'Strong',
      description: 'Built for raw physical force',
      statAffinity: { STR: 'main' },
    };

    beforeEach(() => {
      useConfigStore.getState().initializeConfig('Test');
      vi.clearAllMocks();
    });

    it('should mint a fresh ruleset with no archetypes key at all', () => {
      // Absent means none, like `constants` and `curves` — a fresh ruleset does not grow an empty
      // array it would then round-trip
      expect(useConfigStore.getState().config?.archetypes).toBeUndefined();
    });

    it('should add an archetype and persist it', () => {
      useConfigStore.getState().addArchetype(strong);

      const { config } = useConfigStore.getState();
      expect(config?.archetypes).toEqual([strong]);
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });

    it('should update an archetype', () => {
      useConfigStore.getState().addArchetype(strong);
      vi.clearAllMocks();

      useConfigStore.getState().updateArchetype('strong', { name: 'Mighty' });

      expect(useConfigStore.getState().config?.archetypes?.[0].name).toBe('Mighty');
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });

    it('should delete an unreferenced archetype', () => {
      useConfigStore.getState().addArchetype(strong);
      vi.clearAllMocks();

      const references = useConfigStore.getState().deleteArchetype('strong');

      expect(references).toEqual([]);
      expect(useConfigStore.getState().config?.archetypes).toEqual([]);
      expect(storage.saveConfiguration).toHaveBeenCalled();
    });

    it('should round-trip through export and import', () => {
      useConfigStore.getState().addArchetype(strong);

      const exported = JSON.stringify(
        toStoredConfiguration(useConfigStore.getState().config as Configuration)
      );

      expect(importConfiguration(exported).archetypes).toEqual([strong]);
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
        statValues: { STR: 1 },
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
        statValues: {},
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
        statValues: {},
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

  describe('Focus stat (retired by TICKET-ARC-03)', () => {
    beforeEach(() => {
      useConfigStore.getState().initializeConfig('Test');
      vi.clearAllMocks();
    });

    it('should mint a ruleset with no focus-stat field at all', () => {
      const { config } = useConfigStore.getState();

      expect(config && 'focusStatBonusLevel' in config).toBe(false);
    });
  });

  describe('Stat point budget (retired by TICKET-RES-02)', () => {
    beforeEach(() => {
      useConfigStore.getState().initializeConfig('Test');
      vi.clearAllMocks();
    });

    it('should mint a ruleset with no budget field at all — the pool is derived now', () => {
      const { config } = useConfigStore.getState();

      expect(config && 'mainSkillPointBudget' in config).toBe(false);
    });

    it('should seed the points_per_level constant the derived budget reads', () => {
      const seeded = useConfigStore
        .getState()
        .config?.constants?.find((constant) => constant.name === 'points_per_level');

      expect(seeded?.value).toBe(3);
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
        useConfigStore.getState().renameConfig('Renamed');

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
      useConfigStore.getState().addSkill({
        id: 'id-stl',
        name: 'Stealth',
        description: '',
        statWeights: [{ statId: 'id-str', weight: 0.5 }],
      });
      // A roll's input is the second persisted formula field since TICKET-ROLL-06 replaced the
      // combat skill's `bonusFormula` — so the rename cases below still cover two of them
      useConfigStore.getState().addDiceLadder({
        id: 'id-ladder',
        name: 'Standard',
        description: '',
        dieSizes: [20, 12, 6],
        showZeroTerms: true,
        remainder: 'flat',
      });
      useConfigStore.getState().addRollDefinition({
        id: 'id-mel',
        name: 'Melee',
        description: '',
        input: 'STR / 2',
        ladderId: 'id-ladder',
        order: 0,
      });
      useConfigStore.getState().addRace({
        id: 'race1',
        name: 'Dwarf',
        description: '',
        statValues: { 'id-str': 2 },
      });
      vi.clearAllMocks();
    });

    it('rewrites every formula naming a stat whose abbreviation changes', () => {
      useConfigStore.getState().updateStat('id-str', { abbreviation: 'STG', name: 'Might' });

      const { config } = useConfigStore.getState();
      expect(config?.stats.find((candidate) => candidate.formula)?.formula).toBe('STG * 10');
      expect(config?.rollDefinitions?.find((roll) => roll.id === 'id-mel')?.input).toBe('STG / 2');
      // …and needs to rewrite nothing at all in a race's stat block, which is keyed by stat id
      // and so was never spelled in the first place (TICKET-RACE-01) — nor in a skill's weight
      // rows, which are keyed the same way (TICKET-SKL-02)
      expect(config?.races[0].statValues).toEqual({ 'id-str': 2 });
      expect(config?.skills[0].statWeights).toEqual([{ statId: 'id-str', weight: 0.5 }]);
      expect(config?.stats[0].id).toBe('id-str');
    });

    it('rewrites a formula naming a skill whose name changes (TICKET-SKL-02)', () => {
      useConfigStore.getState().updateStat('id-hp', { formula: 'skills.stealth.bonus * 2' });
      useConfigStore.getState().updateSkill('id-stl', { name: 'Sneaking' });

      expect(
        useConfigStore.getState().config?.stats.find((candidate) => candidate.formula)?.formula
      ).toBe('skills.sneaking.bonus * 2');
    });

    it('re-slugs a stat named in another formula when the stat is renamed', () => {
      useConfigStore.getState().updateRollDefinition('id-mel', { input: 'stats.health / 4' });
      useConfigStore.getState().updateStat('id-hp', { name: 'Vitality' });

      expect(
        useConfigStore.getState().config?.rollDefinitions?.find((roll) => roll.id === 'id-mel')
          ?.input
      ).toBe('stats.vitality / 4');
    });

    it('leaves an edit that renames nothing untouched', () => {
      const before = useConfigStore.getState().config;

      useConfigStore.getState().updateStat('id-str', { description: 'Raw power' });

      const after = useConfigStore.getState().config;
      // Nothing was re-spelled, so every formula in the ruleset comes back byte-identical
      expect(after?.stats.map((stat) => stat.formula)).toEqual(
        before?.stats.map((stat) => stat.formula)
      );
      expect(after?.rollDefinitions).toEqual(before?.rollDefinitions);
      expect(after?.skills).toEqual(before?.skills);
    });
  });
  describe('Guarded deletes (TICKET-REF-02)', () => {
    beforeEach(() => {
      useConfigStore.setState({
        config: {
          id: 'config1',
          name: 'Test',
          version: '1.0',
          schemaVersion: 9,
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
          skills: [],
          materials: [],
          materialCategories: [],
          items: [],
          equipmentSlots: [],
          races: [{ id: 'dwarf', name: 'Dwarf', description: '', statValues: {} }],
          currencyTiers: [],
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

    it('refuses a name another constant already holds, writing nothing (CR-17)', () => {
      const before = useConfigStore.getState().config?.constants?.length;

      const refusal = useConfigStore.getState().addConstant({
        id: 'id-clash',
        name: 'bonus_divider',
        displayName: 'Another divider',
        description: '',
        value: 7,
      });

      expect(refusal).toMatchObject({ field: 'name', value: 'bonus_divider' });
      expect(useConfigStore.getState().config?.constants?.length).toBe(before);
      expect(storage.saveConfiguration).not.toHaveBeenCalled();
    });

    it('refuses a rename onto another constant, writing nothing (CR-17)', () => {
      const apt = useConfigStore
        .getState()
        .config?.constants?.find((constant) => constant.name === 'apt_value');

      const refusal = useConfigStore
        .getState()
        .updateConstant(apt?.id as string, { name: 'bonus_divider' });

      expect(refusal?.field).toBe('name');
      expect(useConfigStore.getState().config?.constants?.find((c) => c.id === apt?.id)?.name).toBe(
        'apt_value'
      );
      expect(storage.saveConfiguration).not.toHaveBeenCalled();
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

    it('refuses a second curve with the same name or the same id, writing nothing (CR-17)', () => {
      useConfigStore.getState().addCurve(curve);
      vi.clearAllMocks();

      const sameName = useConfigStore.getState().addCurve({ ...curve, id: 'id-other' });
      expect(sameName).toMatchObject({ field: 'name', value: 'xp_table' });

      const sameId = useConfigStore.getState().addCurve({ ...curve, name: 'other_table' });
      expect(sameId).toMatchObject({ field: 'id', value: 'id-xp' });

      expect(useConfigStore.getState().config?.curves).toHaveLength(SEEDED + 1);
      expect(storage.saveConfiguration).not.toHaveBeenCalled();
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

      expect(validateConfigurationShape(config).isValid).toBe(true);
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

  describe('Dice ladders CRUD (TICKET-ROLL-03)', () => {
    const standard: DiceLadder = {
      id: 'ladder-standard',
      name: 'Standard',
      description: "The sheet's 20 | 12 | 6 ladder",
      dieSizes: [20, 12, 6],
      showZeroTerms: true,
      remainder: 'flat',
    };

    /** The fixture ladder as the store currently holds it */
    const stored = () =>
      useConfigStore
        .getState()
        .config?.diceLadders?.find((candidate) => candidate.id === 'ladder-standard');

    beforeEach(() => {
      useConfigStore.getState().initializeConfig('Test');
      vi.clearAllMocks();
    });

    it('should mint a fresh ruleset carrying the sheet ladder (TICKET-ROLL-05)', () => {
      // ROLL-03 shipped `diceLadders` absent-means-none and said ROLL-05 would seed one; this is
      // that. `[20, 12, 6]` is the best-confirmed thing in the source sheet, so it is seeded flatly
      const seeded = useConfigStore.getState().config?.diceLadders;

      expect(seeded).toHaveLength(1);
      expect(seeded?.[0].dieSizes).toEqual([20, 12, 6]);
    });

    it('should add, update and delete through the store, persisting each time', () => {
      useConfigStore.getState().addDiceLadder(standard);
      expect(stored()).toEqual(standard);

      useConfigStore.getState().updateDiceLadder('ladder-standard', { dieSizes: [100, 20, 12, 6] });
      expect(stored()?.dieSizes).toEqual([100, 20, 12, 6]);

      expect(useConfigStore.getState().deleteDiceLadder('ladder-standard')).toEqual([]);
      expect(stored()).toBeUndefined();
      expect(storage.saveConfiguration).toHaveBeenCalledTimes(3);
    });

    it('should remove the cap rather than store an undefined maxPerDie', () => {
      useConfigStore.getState().addDiceLadder({ ...standard, maxPerDie: 2 });

      useConfigStore.getState().updateDiceLadder('ladder-standard', { maxPerDie: undefined });

      expect(stored()).not.toHaveProperty('maxPerDie');
    });

    it('should round-trip through export and import', () => {
      useConfigStore.getState().addDiceLadder({ ...standard, maxPerDie: 2 });

      const exported = JSON.stringify(
        toStoredConfiguration(useConfigStore.getState().config as Configuration)
      );

      // The seeded ladder rides along, so this asserts the added one specifically
      expect(
        importConfiguration(exported).diceLadders?.find((ladder) => ladder.id === 'ladder-standard')
      ).toEqual({ ...standard, maxPerDie: 2 });
    });

    it('should refuse an imported ladder whose remainder handling this build does not have', () => {
      useConfigStore.getState().addDiceLadder(standard);
      const config = toStoredConfiguration(useConfigStore.getState().config as Configuration);
      const ladders = config.diceLadders as unknown as Array<Record<string, unknown>>;
      ladders[0].remainder = 'smallest_die';

      const result = validateConfigurationShape(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("diceLadders[0].remainder must be 'flat'");
    });

    it('should refuse to delete a ladder a roll still points at (TICKET-ROLL-05)', () => {
      // The guard ROLL-03 deferred until something could reference a ladder
      const seeded = useConfigStore.getState().config?.diceLadders?.[0];
      if (!seeded) throw new Error('a fresh ruleset should seed a ladder');

      const references = useConfigStore.getState().deleteDiceLadder(seeded.id);

      expect(references.map((reference) => reference.holderName)).toEqual([
        'Melee',
        'Ranged',
        'Evasion',
        'Endure',
      ]);
      expect(useConfigStore.getState().config?.diceLadders).toHaveLength(1);
    });
  });

  describe('Roll definitions CRUD (TICKET-ROLL-05)', () => {
    /** The ladder a fresh ruleset seeds, which the seeded rolls all point at */
    const seededLadderId = () => useConfigStore.getState().config?.diceLadders?.[0].id ?? '';

    const rollsNow = () => useConfigStore.getState().config?.rollDefinitions ?? [];

    beforeEach(() => {
      useConfigStore.getState().initializeConfig('Test');
      useCharacterStore.setState({ characters: [], isLoaded: true });
      vi.clearAllMocks();
    });

    it('should seed the sheet four rolls, all down one ladder', () => {
      expect(rollsNow().map((roll) => roll.name)).toEqual(['Melee', 'Ranged', 'Evasion', 'Endure']);
      expect(new Set(rollsNow().map((roll) => roll.ladderId))).toEqual(new Set([seededLadderId()]));
    });

    it('should seed inputs that compute on a ruleset with no stats yet', () => {
      // The to-be asked for `stats.str` and friends; a fresh ruleset has no stats, so those would
      // name members that do not exist and a brand-new configuration would open reporting errors
      expect(rollsNow().map((roll) => roll.input)).toEqual(['0', '0', '0', '0']);
      expect(
        validateConfiguration(useConfigStore.getState().config as Configuration).errors
      ).toEqual([]);
    });

    it('should say in every seeded description that the input is a placeholder', () => {
      for (const roll of rollsNow()) {
        expect(roll.description).toContain('Placeholder');
      }
    });

    it('should add, update and delete through the store, persisting each time', () => {
      const roll: RollDefinition = {
        id: 'roll-initiative',
        name: 'Initiative',
        description: '',
        input: '0',
        ladderId: seededLadderId(),
        order: 4,
      };

      useConfigStore.getState().addRollDefinition(roll);
      expect(rollsNow()).toHaveLength(5);

      useConfigStore.getState().updateRollDefinition('roll-initiative', { name: 'Init' });
      expect(rollsNow().find((candidate) => candidate.id === 'roll-initiative')?.name).toBe('Init');

      // Nothing can point at a roll — no `rolls` namespace, and history is session state
      expect(useConfigStore.getState().deleteRollDefinition('roll-initiative')).toEqual([]);
      expect(rollsNow()).toHaveLength(4);
      expect(storage.saveConfiguration).toHaveBeenCalledTimes(3);
    });

    it('should remove the category rather than store an undefined one', () => {
      const melee = rollsNow()[0];
      expect(melee.category).toBe('offence');

      useConfigStore.getState().updateRollDefinition(melee.id, { category: undefined });

      expect(rollsNow()[0]).not.toHaveProperty('category');
    });

    it("should re-spell a roll's input when the stat it reads is renamed", () => {
      useConfigStore.getState().addStat({
        id: 'id-dex',
        name: 'Dexterity',
        abbreviation: 'DEX',
        description: '',
        order: 0,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
      });
      const melee = rollsNow()[0];
      useConfigStore.getState().updateRollDefinition(melee.id, { input: 'stats.dexterity' });

      useConfigStore.getState().updateStat('id-dex', { name: 'Agility' });

      expect(rollsNow()[0].input).toBe('stats.agility');
    });

    it('should refuse to delete a stat a roll still reads', () => {
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
      const melee = rollsNow()[0];
      useConfigStore.getState().updateRollDefinition(melee.id, { input: 'stats.strength' });

      const references = useConfigStore.getState().deleteStat('id-str');

      expect(references).toEqual([
        { holderKind: 'Roll Definition', holderName: 'Melee', field: 'input', holderId: melee.id },
      ]);
    });

    it('should round-trip through export and import', () => {
      const exported = JSON.stringify(
        toStoredConfiguration(useConfigStore.getState().config as Configuration)
      );

      expect(importConfiguration(exported).rollDefinitions).toEqual(rollsNow());
    });
  });
});
