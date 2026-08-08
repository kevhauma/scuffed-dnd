/**
 * Configuration Store
 *
 * Zustand store for managing user-defined configuration data.
 * Implements CRUD operations for all config entities with auto-save to LocalStorage.
 *
 * Deletes are guarded here (TICKET-REF-02): an entity something still points at is refused, and
 * the action hands the caller the reference list instead of a silent success.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 2.5, 2.6, 17.1, 17.3; Concept 00 §6**
 */

import { create } from 'zustand';
import type { RegenerationReport } from '../engine/curveGenerator';
import { regenerateCurve as regenerateCurveTable } from '../engine/curveGenerator';
import type { EntityReference, ReferenceTargetKind } from '../engine/dependencies';
import { findReferences } from '../engine/dependencies';
import { toDisplayConfiguration, toStoredConfiguration } from '../engine/formula/references';
import { loadConfiguration, saveConfiguration } from '../services/storage';
import type {
  CombatSkill,
  Configuration,
  Constant,
  CurrencyTier,
  Curve,
  EquipmentSlot,
  Item,
  MainSkill,
  Material,
  MaterialCategory,
  Race,
  SpecialitySkill,
  Stat,
} from '../types/config';
import { useCharacterStore } from './characterStore';

/**
 * How a delete should behave when something still points at the entity
 *
 * The default is to refuse. `force` is the User overriding that decision knowingly: the entity
 * goes, and every formula naming it starts reporting an `undefined-variable` error value
 * (Concept 00 §7) rather than quietly reading as zero.
 */
export interface DeleteOptions {
  force?: boolean;
}

/**
 * Configuration store state
 */
interface ConfigState {
  config: Configuration | null;
  isLoaded: boolean;

  // Initialization
  initializeConfig: (name: string) => void;
  loadConfig: () => void;
  replaceConfig: (config: Configuration) => void;
  renameConfig: (name: string) => void;

  // Main Skills CRUD
  addMainSkill: (skill: MainSkill) => void;
  updateMainSkill: (code: string, updates: Partial<MainSkill>) => void;
  deleteMainSkill: (code: string, options?: DeleteOptions) => EntityReference[];

  // Stats CRUD
  addStat: (stat: Stat) => void;
  updateStat: (id: string, updates: Partial<Stat>) => void;
  deleteStat: (id: string, options?: DeleteOptions) => EntityReference[];

  // Speciality Skills CRUD
  addSpecialitySkill: (skill: SpecialitySkill) => void;
  updateSpecialitySkill: (code: string, updates: Partial<SpecialitySkill>) => void;
  deleteSpecialitySkill: (code: string, options?: DeleteOptions) => EntityReference[];

  // Combat Skills CRUD
  addCombatSkill: (skill: CombatSkill) => void;
  updateCombatSkill: (code: string, updates: Partial<CombatSkill>) => void;
  deleteCombatSkill: (code: string, options?: DeleteOptions) => EntityReference[];

  // Material Categories CRUD
  addMaterialCategory: (category: MaterialCategory) => void;
  updateMaterialCategory: (id: string, updates: Partial<MaterialCategory>) => void;
  deleteMaterialCategory: (id: string, options?: DeleteOptions) => EntityReference[];

  // Materials CRUD
  addMaterial: (material: Material) => void;
  updateMaterial: (id: string, updates: Partial<Material>) => void;
  deleteMaterial: (id: string, options?: DeleteOptions) => EntityReference[];

  // Items CRUD
  addItem: (item: Item) => void;
  updateItem: (id: string, updates: Partial<Item>) => void;
  deleteItem: (id: string, options?: DeleteOptions) => EntityReference[];

  // Equipment Slots CRUD
  addEquipmentSlot: (slot: EquipmentSlot) => void;
  updateEquipmentSlot: (type: string, updates: Partial<EquipmentSlot>) => void;
  deleteEquipmentSlot: (type: string, options?: DeleteOptions) => EntityReference[];

  // Races CRUD
  addRace: (race: Race) => void;
  updateRace: (id: string, updates: Partial<Race>) => void;
  deleteRace: (id: string, options?: DeleteOptions) => EntityReference[];

  // Currency Tiers CRUD
  addCurrencyTier: (tier: CurrencyTier) => void;
  updateCurrencyTier: (id: string, updates: Partial<CurrencyTier>) => void;
  deleteCurrencyTier: (id: string, options?: DeleteOptions) => EntityReference[];

  // Constants CRUD
  addConstant: (constant: Constant) => void;
  updateConstant: (id: string, updates: Partial<Constant>) => void;
  deleteConstant: (id: string, options?: DeleteOptions) => EntityReference[];

  // Curves CRUD
  addCurve: (curve: Curve) => void;
  updateCurve: (id: string, updates: Partial<Curve>) => void;
  deleteCurve: (id: string, options?: DeleteOptions) => EntityReference[];
  /** Refill a curve's generated cells, keeping every override (TICKET-CRV-02) */
  regenerateCurve: (id: string) => RegenerationReport;

  // Focus Stat Configuration
  setFocusStatBonusLevel: (level: number) => void;

  // Main Skill Point Allocation
  setMainSkillPointBudget: (budget: number | undefined) => void;
}

/**
 * The constants a fresh ruleset starts with (Concept 05's seed table)
 *
 * Seeded rather than left empty because these are the levers the source sheet actually turns, and
 * a constant is data, not behaviour: `points_per_level` is here before anything reads it
 * (TICKET-RES-02 does), which is the point — the User can retune the ruleset before the feature
 * that consumes the number exists.
 */
function createSeedConstants(): Constant[] {
  return [
    {
      id: crypto.randomUUID(),
      name: 'bonus_divider',
      displayName: 'Bonus divider',
      description:
        'How many skill levels are worth one point of bonus. Lower makes skills matter more.',
      value: 5,
    },
    {
      id: crypto.randomUUID(),
      name: 'apt_value',
      displayName: 'APT value',
      description:
        'Speed needed per attack per turn. Lower gives everyone more attacks at the same Speed.',
      value: 30,
    },
    {
      id: crypto.randomUUID(),
      name: 'points_per_level',
      displayName: 'Points per level',
      description: 'Skill points a character receives for each level gained.',
      value: 3,
      unit: 'points',
    },
    {
      id: crypto.randomUUID(),
      name: 'race_blend_divisor',
      displayName: 'Race blend divisor',
      description: 'What a blended base is divided by when a character has more than one race.',
      value: 2,
    },
  ];
}

/**
 * Create a fresh configuration
 *
 * Not "empty": a new ruleset arrives with Concept 05's seed constants already in it.
 */
function createFreshConfiguration(name: string): Configuration {
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
    constants: createSeedConstants(),
    focusStatBonusLevel: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Apply an edit that may rename something, without breaking what points at it
 *
 * References are resolved to ids first, so the patch lands on a configuration where nothing is
 * identified by a spelling; translating back afterwards re-renders every formula, racial modifier
 * and material bonus with whatever the entity is now called (Concept 00 §6). A patch that renames
 * nothing round-trips to the same configuration, which is why the update actions can use this
 * unconditionally rather than sniffing for a changed code.
 *
 * @param config - The configuration before the edit
 * @param patch - The edit, applied to the id-resolved form
 * @returns The edited configuration, back in display form
 */
function applyRenameSafely(
  config: Configuration,
  patch: (config: Configuration) => Configuration
): Configuration {
  return toDisplayConfiguration(patch(toStoredConfiguration(config)));
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
 * Delete an entity only while nothing points at it (Concept 00 §6, TICKET-REF-02)
 *
 * The guard lives here rather than in the panels because an advisory check in the UI is a check
 * that can be bypassed — every route into a delete goes through the action. Characters count as
 * references, so the walker is given the character store's data; reading it here is what the
 * ticket's "the walker reads both stores, actions call it" note asks for, and the dependency runs
 * one way only (`characterStore` never reads this store).
 *
 * **It assumes the character store is hydrated**, which `RootLayout`'s `useAppHydration()` does
 * once per page load before any configuration route renders — an un-hydrated store would report
 * an empty character list and quietly weaken the guard's character half. When LocalStorage is
 * unavailable the shell renders `StorageNotice` instead of the routes, so no delete can reach
 * here in that state either.
 *
 * The removal is applied to the **display** form, so a formula naming the deleted entity keeps
 * its spelling and reports `Undefined variable: STR` rather than a bare id.
 *
 * @param kind - Which entity kind is being deleted
 * @param id - Its identifier — a code for skills, a type for equipment slots, an id otherwise
 * @param options - `force` deletes anyway
 * @param remove - Removes the entity from a configuration
 * @returns The references that blocked the delete; **empty means the entity was deleted**
 */
function guardedDelete(
  set: (partial: Partial<ConfigState>) => void,
  get: () => ConfigState,
  kind: ReferenceTargetKind,
  id: string,
  options: DeleteOptions | undefined,
  remove: (config: Configuration) => Configuration
): EntityReference[] {
  const { config } = get();
  if (!config) return [];

  const characters = useCharacterStore.getState().characters;
  const references = findReferences({ kind, id }, config, characters);

  if (references.length > 0 && !options?.force) {
    return references;
  }

  set({ config: autoSave(remove(config)) });
  return [];
}

/**
 * Configuration store
 */
export const useConfigStore = create<ConfigState>((set, get) => ({
  config: null,
  isLoaded: false,

  // Initialize empty configuration
  initializeConfig: (name: string) => {
    const config = createFreshConfiguration(name);
    const saved = autoSave(config);
    set({ config: saved, isLoaded: true });
  },

  // Load configuration from LocalStorage
  loadConfig: () => {
    const config = loadConfiguration();
    set({ config, isLoaded: true });
  },

  /**
   * Replace the whole configuration — what applying an import means
   *
   * The Application holds one configuration at a time, so an import discards the current one
   * rather than adding to a list. The caller is responsible for validating the incoming data and
   * for confirming with the User first; by the time this runs, the decision is made.
   */
  replaceConfig: (config: Configuration) => {
    const saved = autoSave(config);
    set({ config: saved, isLoaded: true });
  },

  /** Rename the current configuration; the export filename derives from this */
  renameConfig: (name: string) => {
    const { config } = get();
    if (!config) return;

    const updated = autoSave({ ...config, name });
    set({ config: updated });
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

    const updated = autoSave(
      applyRenameSafely(config, (current) => ({
        ...current,
        mainSkills: current.mainSkills.map((skill) =>
          skill.code === code ? { ...skill, ...updates } : skill
        ),
      }))
    );
    set({ config: updated });
  },

  deleteMainSkill: (code: string, options?: DeleteOptions) =>
    guardedDelete(set, get, 'main-skill', code, options, (config) => ({
      ...config,
      mainSkills: config.mainSkills.filter((skill) => skill.code !== code),
    })),

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

    const updated = autoSave(
      applyRenameSafely(config, (current) => ({
        ...current,
        stats: current.stats.map((stat) => (stat.id === id ? { ...stat, ...updates } : stat)),
      }))
    );
    set({ config: updated });
  },

  deleteStat: (id: string, options?: DeleteOptions) =>
    guardedDelete(set, get, 'stat', id, options, (config) => ({
      ...config,
      stats: config.stats.filter((stat) => stat.id !== id),
    })),

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

    const updated = autoSave(
      applyRenameSafely(config, (current) => ({
        ...current,
        specialitySkills: current.specialitySkills.map((skill) =>
          skill.code === code ? { ...skill, ...updates } : skill
        ),
      }))
    );
    set({ config: updated });
  },

  deleteSpecialitySkill: (code: string, options?: DeleteOptions) =>
    guardedDelete(set, get, 'speciality-skill', code, options, (config) => ({
      ...config,
      specialitySkills: config.specialitySkills.filter((skill) => skill.code !== code),
    })),

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

    const updated = autoSave(
      applyRenameSafely(config, (current) => ({
        ...current,
        combatSkills: current.combatSkills.map((skill) =>
          skill.code === code ? { ...skill, ...updates } : skill
        ),
      }))
    );
    set({ config: updated });
  },

  deleteCombatSkill: (code: string, options?: DeleteOptions) =>
    guardedDelete(set, get, 'combat-skill', code, options, (config) => ({
      ...config,
      combatSkills: config.combatSkills.filter((skill) => skill.code !== code),
    })),

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
      materialCategories: config.materialCategories.map((category) =>
        category.id === id ? { ...category, ...updates } : category
      ),
    });
    set({ config: updated });
  },

  deleteMaterialCategory: (id: string, options?: DeleteOptions) =>
    guardedDelete(set, get, 'material-category', id, options, (config) => ({
      ...config,
      materialCategories: config.materialCategories.filter((category) => category.id !== id),
    })),

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
      materials: config.materials.map((material) =>
        material.id === id ? { ...material, ...updates } : material
      ),
    });
    set({ config: updated });
  },

  deleteMaterial: (id: string, options?: DeleteOptions) =>
    guardedDelete(set, get, 'material', id, options, (config) => ({
      ...config,
      materials: config.materials.filter((material) => material.id !== id),
    })),

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
      items: config.items.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    });
    set({ config: updated });
  },

  deleteItem: (id: string, options?: DeleteOptions) =>
    guardedDelete(set, get, 'item', id, options, (config) => ({
      ...config,
      items: config.items.filter((item) => item.id !== id),
    })),

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
      equipmentSlots: config.equipmentSlots.map((slot) =>
        slot.type === type ? { ...slot, ...updates } : slot
      ),
    });
    set({ config: updated });
  },

  deleteEquipmentSlot: (type: string, options?: DeleteOptions) =>
    guardedDelete(set, get, 'equipment-slot', type, options, (config) => ({
      ...config,
      equipmentSlots: config.equipmentSlots.filter((slot) => slot.type !== type),
    })),

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
      races: config.races.map((race) => (race.id === id ? { ...race, ...updates } : race)),
    });
    set({ config: updated });
  },

  deleteRace: (id: string, options?: DeleteOptions) =>
    guardedDelete(set, get, 'race', id, options, (config) => ({
      ...config,
      races: config.races.filter((race) => race.id !== id),
    })),

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
      currencyTiers: config.currencyTiers.map((tier) =>
        tier.id === id ? { ...tier, ...updates } : tier
      ),
    });
    set({ config: updated });
  },

  deleteCurrencyTier: (id: string, options?: DeleteOptions) =>
    guardedDelete(set, get, 'currency-tier', id, options, (config) => ({
      ...config,
      currencyTiers: config.currencyTiers.filter((tier) => tier.id !== id),
    })),

  // Constants CRUD
  addConstant: (constant: Constant) => {
    const { config } = get();
    if (!config) return;

    const updated = autoSave({
      ...config,
      constants: [...(config.constants ?? []), constant],
    });
    set({ config: updated });
  },

  updateConstant: (id: string, updates: Partial<Constant>) => {
    const { config } = get();
    if (!config) return;

    const updated = autoSave(
      applyRenameSafely(config, (current) => ({
        ...current,
        constants: (current.constants ?? []).map((constant) =>
          constant.id === id ? { ...constant, ...updates } : constant
        ),
      }))
    );
    set({ config: updated });
  },

  deleteConstant: (id: string, options?: DeleteOptions) =>
    guardedDelete(set, get, 'constant', id, options, (config) => ({
      ...config,
      constants: (config.constants ?? []).filter((constant) => constant.id !== id),
    })),

  // Curves CRUD
  addCurve: (curve: Curve) => {
    const { config } = get();
    if (!config) return;

    const updated = autoSave({
      ...config,
      curves: [...(config.curves ?? []), curve],
    });
    set({ config: updated });
  },

  updateCurve: (id: string, updates: Partial<Curve>) => {
    const { config } = get();
    if (!config) return;

    const updated = autoSave(
      applyRenameSafely(config, (current) => ({
        ...current,
        curves: (current.curves ?? []).map((curve) =>
          curve.id === id ? { ...curve, ...updates } : curve
        ),
      }))
    );
    set({ config: updated });
  },

  deleteCurve: (id: string, options?: DeleteOptions) =>
    guardedDelete(set, get, 'curve', id, options, (config) => ({
      ...config,
      curves: (config.curves ?? []).filter((curve) => curve.id !== id),
    })),

  regenerateCurve: (id: string) => {
    const empty: RegenerationReport = { written: 0, kept: 0, errors: [] };

    const { config } = get();
    const curve = (config?.curves ?? []).find((candidate) => candidate.id === id);
    if (!config || !curve) return empty;

    // The engine decides what the table becomes and reports what it did; the store's job is to
    // put the result somewhere and persist it
    const { curve: regenerated, report } = regenerateCurveTable(curve, config);

    const updated = autoSave({
      ...config,
      curves: (config.curves ?? []).map((candidate) =>
        candidate.id === id ? regenerated : candidate
      ),
    });
    set({ config: updated });

    return report;
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

  // Main Skill Point Allocation
  setMainSkillPointBudget: (budget: number | undefined) => {
    const { config } = get();
    if (!config) return;

    // undefined clears the limit — the field is optional and absent means unlimited
    const { mainSkillPointBudget: _removed, ...rest } = config;
    const updated = autoSave(
      budget === undefined ? rest : { ...config, mainSkillPointBudget: budget }
    );
    set({ config: updated });
  },
}));
