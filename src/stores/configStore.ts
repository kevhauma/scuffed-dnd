/**
 * Configuration Store
 * 
 * Zustand store for managing user-defined configuration data.
 * Implements CRUD operations for all config entities with auto-save to LocalStorage.
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 17.1, 17.3**
 */

import { create } from 'zustand';
import type {
  Configuration,
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
import { saveConfiguration, loadConfiguration } from '../services/storage';

/**
 * Configuration store state
 */
interface ConfigState {
  config: Configuration | null;
  isLoaded: boolean;
  
  // Initialization
  initializeConfig: (name: string) => void;
  loadConfig: () => void;
  
  // Main Skills CRUD
  addMainSkill: (skill: MainSkill) => void;
  updateMainSkill: (code: string, updates: Partial<MainSkill>) => void;
  deleteMainSkill: (code: string) => void;
  
  // Stats CRUD
  addStat: (stat: Stat) => void;
  updateStat: (id: string, updates: Partial<Stat>) => void;
  deleteStat: (id: string) => void;
  
  // Speciality Skills CRUD
  addSpecialitySkill: (skill: SpecialitySkill) => void;
  updateSpecialitySkill: (code: string, updates: Partial<SpecialitySkill>) => void;
  deleteSpecialitySkill: (code: string) => void;
  
  // Combat Skills CRUD
  addCombatSkill: (skill: CombatSkill) => void;
  updateCombatSkill: (code: string, updates: Partial<CombatSkill>) => void;
  deleteCombatSkill: (code: string) => void;
  
  // Material Categories CRUD
  addMaterialCategory: (category: MaterialCategory) => void;
  updateMaterialCategory: (id: string, updates: Partial<MaterialCategory>) => void;
  deleteMaterialCategory: (id: string) => void;
  
  // Materials CRUD
  addMaterial: (material: Material) => void;
  updateMaterial: (id: string, updates: Partial<Material>) => void;
  deleteMaterial: (id: string) => void;
  
  // Items CRUD
  addItem: (item: Item) => void;
  updateItem: (id: string, updates: Partial<Item>) => void;
  deleteItem: (id: string) => void;
  
  // Equipment Slots CRUD
  addEquipmentSlot: (slot: EquipmentSlot) => void;
  updateEquipmentSlot: (type: string, updates: Partial<EquipmentSlot>) => void;
  deleteEquipmentSlot: (type: string) => void;
  
  // Races CRUD
  addRace: (race: Race) => void;
  updateRace: (id: string, updates: Partial<Race>) => void;
  deleteRace: (id: string) => void;
  
  // Currency Tiers CRUD
  addCurrencyTier: (tier: CurrencyTier) => void;
  updateCurrencyTier: (id: string, updates: Partial<CurrencyTier>) => void;
  deleteCurrencyTier: (id: string) => void;
  
  // Focus Stat Configuration
  setFocusStatBonusLevel: (level: number) => void;
}

/**
 * Create empty configuration
 */
function createEmptyConfiguration(name: string): Configuration {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
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
    focusStatBonusLevel: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Auto-save helper - saves config and updates timestamp
 */
function autoSave(config: Configuration): Configuration {
  const updated = {
    ...config,
    updatedAt: new Date().toISOString(),
  };
  saveConfiguration(updated);
  return updated;
}

/**
 * Configuration store
 */
export const useConfigStore = create<ConfigState>((set, get) => ({
  config: null,
  isLoaded: false,
  
  // Initialize empty configuration
  initializeConfig: (name: string) => {
    const config = createEmptyConfiguration(name);
    const saved = autoSave(config);
    set({ config: saved, isLoaded: true });
  },
  
  // Load configuration from LocalStorage
  loadConfig: () => {
    const config = loadConfiguration();
    set({ config, isLoaded: true });
  },
  
  // Main Skills CRUD
  addMainSkill: (skill: MainSkill) => {
    const { config } = get();
    if (!config) return;
    
    const updated = autoSave({
      ...config,
      mainSkills: [...config.mainSkills, skill],
    });
    set({ config: updated });
  },
  
  updateMainSkill: (code: string, updates: Partial<MainSkill>) => {
    const { config } = get();
    if (!config) return;
    
    const updated = autoSave({
      ...config,
      mainSkills: config.mainSkills.map(skill =>
        skill.code === code ? { ...skill, ...updates } : skill
      ),
    });
    set({ config: updated });
  },
  
  deleteMainSkill: (code: string) => {
    const { config } = get();
    if (!config) return;
    
    const updated = autoSave({
      ...config,
      mainSkills: config.mainSkills.filter(skill => skill.code !== code),
    });
    set({ config: updated });
  },
  
  // Stats CRUD
  addStat: (stat: Stat) => {
    const { config } = get();
    if (!config) return;
    
    const updated = autoSave({
      ...config,
      stats: [...config.stats, stat],
    });
    set({ config: updated });
  },
  
  updateStat: (id: string, updates: Partial<Stat>) => {
    const { config } = get();
    if (!config) return;
    
    const updated = autoSave({
      ...config,
      stats: config.stats.map(stat =>
        stat.id === id ? { ...stat, ...updates } : stat
      ),
    });
    set({ config: updated });
  },
  
  deleteStat: (id: string) => {
    const { config } = get();
    if (!config) return;
    
    const updated = autoSave({
      ...config,
      stats: config.stats.filter(stat => stat.id !== id),
    });
    set({ config: updated });
  },
  
  // Speciality Skills CRUD
  addSpecialitySkill: (skill: SpecialitySkill) => {
    const { config } = get();
    if (!config) return;
    
    const updated = autoSave({
      ...config,
      specialitySkills: [...config.specialitySkills, skill],
    });
    set({ config: updated });
  },
  
  updateSpecialitySkill: (code: string, updates: Partial<SpecialitySkill>) => {
    const { config } = get();
    if (!config) return;
    
    const updated = autoSave({
      ...config,
      specialitySkills: config.specialitySkills.map(skill =>
        skill.code === code ? { ...skill, ...updates } : skill
      ),
    });
    set({ config: updated });
  },
  
  deleteSpecialitySkill: (code: string) => {
    const { config } = get();
    if (!config) return;
    
    const updated = autoSave({
      ...config,
      specialitySkills: config.specialitySkills.filter(skill => skill.code !== code),
    });
    set({ config: updated });
  },
  
  // Combat Skills CRUD
  addCombatSkill: (skill: CombatSkill) => {
    const { config } = get();
    if (!config) return;
    
    const updated = autoSave({
      ...config,
      combatSkills: [...config.combatSkills, skill],
    });
    set({ config: updated });
  },
  
  updateCombatSkill: (code: string, updates: Partial<CombatSkill>) => {
    const { config } = get();
    if (!config) return;
    
    const updated = autoSave({
      ...config,
      combatSkills: config.combatSkills.map(skill =>
        skill.code === code ? { ...skill, ...updates } : skill
      ),
    });
    set({ config: updated });
  },
  
  deleteCombatSkill: (code: string) => {
    const { config } = get();
    if (!config) return;
    
    const updated = autoSave({
      ...config,
      combatSkills: config.combatSkills.filter(skill => skill.code !== code),
    });
    set({ config: updated });
  },
  
  // Material Categories CRUD
  addMaterialCategory: (category: MaterialCategory) => {
    const { config } = get();
    if (!config) return;
    
    const updated = autoSave({
      ...config,
      materialCategories: [...config.materialCategories, category],
    });
    set({ config: updated });
  },
  
  updateMaterialCategory: (id: string, updates: Partial<MaterialCategory>) => {
    const { config } = get();
    if (!config) return;
    
    const updated = autoSave({
      ...config,
      materialCategories: config.materialCategories.map(category =>
        category.id === id ? { ...category, ...updates } : category
      ),
    });
    set({ config: updated });
  },
  
  deleteMaterialCategory: (id: string) => {
    const { config } = get();
    if (!config) return;
    
    const updated = autoSave({
      ...config,
      materialCategories: config.materialCategories.filter(category => category.id !== id),
    });
    set({ config: updated });
  },
  
  // Materials CRUD
  addMaterial: (material: Material) => {
    const { config } = get();
    if (!config) return;
    
    const updated = autoSave({
      ...config,
      materials: [...config.materials, material],
    });
    set({ config: updated });
  },
  
  updateMaterial: (id: string, updates: Partial<Material>) => {
    const { config } = get();
    if (!config) return;
    
    const updated = autoSave({
      ...config,
      materials: config.materials.map(material =>
        material.id === id ? { ...material, ...updates } : material
      ),
    });
    set({ config: updated });
  },
  
  deleteMaterial: (id: string) => {
    const { config } = get();
    if (!config) return;
    
    const updated = autoSave({
      ...config,
      materials: config.materials.filter(material => material.id !== id),
    });
    set({ config: updated });
  },
  
  // Items CRUD
  addItem: (item: Item) => {
    const { config } = get();
    if (!config) return;
    
    const updated = autoSave({
      ...config,
      items: [...config.items, item],
    });
    set({ config: updated });
  },
  
  updateItem: (id: string, updates: Partial<Item>) => {
    const { config } = get();
    if (!config) return;
    
    const updated = autoSave({
      ...config,
      items: config.items.map(item =>
        item.id === id ? { ...item, ...updates } : item
      ),
    });
    set({ config: updated });
  },
  
  deleteItem: (id: string) => {
    const { config } = get();
    if (!config) return;
    
    const updated = autoSave({
      ...config,
      items: config.items.filter(item => item.id !== id),
    });
    set({ config: updated });
  },
  
  // Equipment Slots CRUD
  addEquipmentSlot: (slot: EquipmentSlot) => {
    const { config } = get();
    if (!config) return;
    
    const updated = autoSave({
      ...config,
      equipmentSlots: [...config.equipmentSlots, slot],
    });
    set({ config: updated });
  },
  
  updateEquipmentSlot: (type: string, updates: Partial<EquipmentSlot>) => {
    const { config } = get();
    if (!config) return;
    
    const updated = autoSave({
      ...config,
      equipmentSlots: config.equipmentSlots.map(slot =>
        slot.type === type ? { ...slot, ...updates } : slot
      ),
    });
    set({ config: updated });
  },
  
  deleteEquipmentSlot: (type: string) => {
    const { config } = get();
    if (!config) return;
    
    const updated = autoSave({
      ...config,
      equipmentSlots: config.equipmentSlots.filter(slot => slot.type !== type),
    });
    set({ config: updated });
  },
  
  // Races CRUD
  addRace: (race: Race) => {
    const { config } = get();
    if (!config) return;
    
    const updated = autoSave({
      ...config,
      races: [...config.races, race],
    });
    set({ config: updated });
  },
  
  updateRace: (id: string, updates: Partial<Race>) => {
    const { config } = get();
    if (!config) return;
    
    const updated = autoSave({
      ...config,
      races: config.races.map(race =>
        race.id === id ? { ...race, ...updates } : race
      ),
    });
    set({ config: updated });
  },
  
  deleteRace: (id: string) => {
    const { config } = get();
    if (!config) return;
    
    const updated = autoSave({
      ...config,
      races: config.races.filter(race => race.id !== id),
    });
    set({ config: updated });
  },
  
  // Currency Tiers CRUD
  addCurrencyTier: (tier: CurrencyTier) => {
    const { config } = get();
    if (!config) return;
    
    const updated = autoSave({
      ...config,
      currencyTiers: [...config.currencyTiers, tier],
    });
    set({ config: updated });
  },
  
  updateCurrencyTier: (id: string, updates: Partial<CurrencyTier>) => {
    const { config } = get();
    if (!config) return;
    
    const updated = autoSave({
      ...config,
      currencyTiers: config.currencyTiers.map(tier =>
        tier.id === id ? { ...tier, ...updates } : tier
      ),
    });
    set({ config: updated });
  },
  
  deleteCurrencyTier: (id: string) => {
    const { config } = get();
    if (!config) return;
    
    const updated = autoSave({
      ...config,
      currencyTiers: config.currencyTiers.filter(tier => tier.id !== id),
    });
    set({ config: updated });
  },
  
  // Focus Stat Configuration
  setFocusStatBonusLevel: (level: number) => {
    const { config } = get();
    if (!config) return;
    
    const updated = autoSave({
      ...config,
      focusStatBonusLevel: level,
    });
    set({ config: updated });
  },
}));
