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
import {
  clearCurveOverride as clearCurveOverrideCell,
  regenerateCurve as regenerateCurveTable,
  setCurveCell as setCurveCellValue,
} from '../engine/curveGenerator';
import {
  addCurveColumn as addColumnToCurve,
  addCurveRow as addRowToCurve,
  removeCurveColumn,
  removeCurveRow,
} from '../engine/curveTable';
import type { EntityReference, ReferenceTargetKind } from '../engine/dependencies';
import { findReferences } from '../engine/dependencies';
import { toDisplayConfiguration, toStoredConfiguration } from '../engine/formula/references';
import { clearAllData, loadConfiguration, saveConfiguration } from '../services/storage';
import type {
  Archetype,
  CombatSkill,
  Configuration,
  Constant,
  CurrencyTier,
  Curve,
  CurveColumn,
  EquipmentSlot,
  Item,
  Material,
  MaterialCategory,
  Race,
  Skill,
  Stat,
} from '../types/config';
import { POINT_BUY_CURVE_NAME, SUPPORTED_SCHEMA_VERSION } from '../types/config';
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
  /**
   * Throw away everything LocalStorage holds and start from nothing (TICKET-IO-03)
   *
   * The **only** path that clears the keys. Data this build cannot open is refused on load and
   * left exactly where it is; it goes away when — and only when — the User confirms this, having
   * been offered a backup first.
   */
  discardStoredData: () => void;

  // Stats CRUD
  addStat: (stat: Stat) => void;
  updateStat: (id: string, updates: Partial<Stat>) => void;
  deleteStat: (id: string, options?: DeleteOptions) => EntityReference[];
  /**
   * Put the stats in the given order and renumber `order` to match (TICKET-STAT-02)
   *
   * Takes the whole ordering rather than a from/to pair so the array and the field can never
   * disagree: `order` is rewritten from each stat's position, and the stored array is written in
   * that same sequence, which is what makes every `config.stats.map(…)` in the app display in
   * the User's order without each caller remembering to sort.
   *
   * Ids not in the list keep their relative order at the end; unknown ids are ignored. Reordering
   * never changes a value — references are by id (Concept 01).
   */
  reorderStats: (orderedIds: string[]) => void;

  // Speciality Skills CRUD
  addSkill: (skill: Skill) => void;
  updateSkill: (id: string, updates: Partial<Skill>) => void;
  deleteSkill: (id: string, options?: DeleteOptions) => EntityReference[];

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

  // Archetypes CRUD (Concept 03, TICKET-ARC-01)
  addArchetype: (archetype: Archetype) => void;
  updateArchetype: (id: string, updates: Partial<Archetype>) => void;
  deleteArchetype: (id: string, options?: DeleteOptions) => EntityReference[];

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

  /**
   * Curve grid editing (TICKET-CRV-03)
   *
   * Separate actions rather than `updateCurve` calls because `columns`, `rows[].values` and
   * `rows[].overridden` are three arrays addressed by one index: a caller that patches `columns`
   * alone moves every override flag onto the wrong cell. Routing the structural edits through
   * `engine/curveTable.ts` is what makes that unrepresentable rather than merely documented.
   */
  addCurveColumn: (curveId: string, column: CurveColumn) => void;
  /**
   * Guarded like every other delete: a column is a referenceable entity now that it is renamable,
   * so a formula reading `curve.point_buy.main(x)` refuses the removal of `main`.
   */
  deleteCurveColumn: (
    curveId: string,
    columnId: string,
    options?: DeleteOptions
  ) => EntityReference[];
  addCurveRow: (curveId: string, key: number) => void;
  deleteCurveRow: (curveId: string, key: number) => void;
  /** Type a number into a cell — which is what makes a generated cell an override */
  setCurveCell: (curveId: string, key: number, columnName: string, value: number) => void;
  /** Drop a cell's override, putting the generated value back */
  clearCurveOverride: (curveId: string, key: number, columnName: string) => void;

  // Focus Stat Configuration
  setFocusStatBonusLevel: (level: number) => void;
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
 * The `non` and `sub` point-buy columns, as the source sheet actually holds them
 *
 * Hand-authored, not generated: Concept 06 measured them as "near-linear with rounding" and no
 * clean formula was confirmed, so inventing one here would replace the User's ruleset with our
 * guess at it. The `4.642857142857` at 9 points comes across too. It is almost certainly an
 * accident — every neighbour is an integer — but the concept page is explicit that it needs a
 * decision rather than a silent rounding, and a number nobody can see cannot be decided about.
 */
const POINT_BUY_HAND_ROWS: readonly (readonly [key: number, non: number, sub: number])[] = [
  [0, 0, 0],
  [1, 1, 1],
  [2, 1, 1],
  [3, 1, 2],
  [4, 2, 2],
  [5, 2, 3],
  [6, 2, 3],
  [7, 3, 4],
  [8, 3, 4],
  [9, 3, 4.642857142857],
  [10, 4, 5],
  [11, 4, 5],
  [12, 4, 6],
  [13, 4, 6],
  [14, 5, 7],
  [15, 5, 7],
];

/**
 * The curves a fresh ruleset starts with (Concept 06's seed tables)
 *
 * Two, for the same reason the constants are seeded: they are the tables the rest of the
 * milestone reads, and a table is easier to retune than to author.
 *
 * **`point_buy`** is the confirmed one. Its `main` column is `0.75 × (points + 1)` exactly, so it
 * ships as a **generator** rather than as sixteen literals — which is what makes Concept 06's
 * "flatten the archetype advantage" a one-field edit. The cells it ships with come from running
 * that generator through the formula engine, not from arithmetic written a second time here: one
 * progression, one source of truth, and retuning the string cannot leave the shipped table
 * disagreeing with it.
 *
 * **`xp_thresholds`** is the shape only. Its numbers are Concept 06's open question #8 — the
 * single most campaign-defining lever in the ruleset — so it arrives with one row (level 1 costs
 * nothing) and waits for the User, rather than pretending a made-up progression is a default.
 */
function createSeedCurves(): Curve[] {
  const pointBuy: Curve = {
    id: crypto.randomUUID(),
    name: POINT_BUY_CURVE_NAME,
    displayName: 'Point buy',
    description:
      'What a point spent on a stat is worth, by how much the archetype favours that stat.',
    keyName: 'points',
    columns: [
      { id: crypto.randomUUID(), name: 'non' },
      { id: crypto.randomUUID(), name: 'sub' },
      { id: crypto.randomUUID(), name: 'main', generator: '0.75 * (key + 1)' },
    ],
    // The generated column starts empty and is filled by its own generator, below
    rows: POINT_BUY_HAND_ROWS.map(([key, non, sub]) => ({ key, values: [non, sub, 0] })),
    interpolation: 'step',
    outOfRange: 'error',
    lookupDirection: 'forward',
  };

  return [
    regenerateCurveTable(pointBuy).curve,
    {
      id: crypto.randomUUID(),
      name: 'xp_thresholds',
      displayName: 'XP thresholds',
      description:
        'Total experience needed for each level. Read backwards: given the XP, which level. ' +
        'Placeholder — set your own thresholds before anyone levels.',
      keyName: 'level',
      columns: [{ id: crypto.randomUUID(), name: 'xp_required' }],
      rows: [{ key: 1, values: [0] }],
      interpolation: 'step',
      outOfRange: 'extrapolate',
      lookupDirection: 'reverse',
    },
  ];
}

/**
 * Create a fresh configuration
 *
 * Not "empty": a new ruleset arrives with Concept 05's seed constants and Concept 06's seed
 * curves already in it.
 */
function createFreshConfiguration(name: string): Configuration {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    version: '1.0.0',
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    stats: [],
    skills: [],
    combatSkills: [],
    materials: [],
    materialCategories: [],
    items: [],
    equipmentSlots: [],
    races: [],
    currencyTiers: [],
    constants: createSeedConstants(),
    curves: createSeedCurves(),
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
 * Merge a patch where an explicit `undefined` **clears** an optional field
 *
 * A plain spread would leave `min: undefined` sitting on the record — a key that is present,
 * reads as absent, and disappears the next time the ruleset is serialised. The data model's rule
 * is that an optional field is deleted rather than stored empty, so a caller clearing a bound or a
 * formula gets the key removed.
 *
 * @param entity - The record being edited
 * @param updates - The patch; a key set to `undefined` is a removal, an absent key is a no-op
 * @returns The merged record, with no `undefined`-valued keys
 */
function mergeClearingAbsent<T extends object>(entity: T, updates: Partial<T>): T {
  const merged = { ...entity, ...updates } as Record<string, unknown>;
  for (const key of Object.keys(merged)) {
    if (merged[key] === undefined) delete merged[key];
  }
  return merged as T;
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
 * Apply one engine edit to one curve and persist the result
 *
 * The shared body of the six grid actions (TICKET-CRV-03). The engine decides what the table
 * becomes; the store's job is to put it somewhere and save. An edit that does not apply — a key
 * already taken, a column that isn't there — comes back as the same curve and still saves, which
 * is a no-op write rather than a wrong one.
 *
 * Deliberately **not** rename-safe: none of these edits changes a spelling. Renaming a column
 * goes through `updateCurve`, which is, so the two paths stay separate.
 *
 * @param curveId - Which curve
 * @param edit - The engine function to apply, given the curve and the ruleset around it
 */
function editCurve(
  set: (partial: Partial<ConfigState>) => void,
  get: () => ConfigState,
  curveId: string,
  edit: (curve: Curve, config: Configuration) => Curve
): void {
  const { config } = get();
  if (!config) return;

  const curve = (config.curves ?? []).find((candidate) => candidate.id === curveId);
  if (!curve) return;

  const edited = edit(curve, config);
  const updated = autoSave({
    ...config,
    curves: (config.curves ?? []).map((candidate) =>
      candidate.id === curveId ? edited : candidate
    ),
  });
  set({ config: updated });
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

  discardStoredData: () => {
    clearAllData();
    // Loaded, and what was loaded is nothing — which is what lets the dashboard offer a fresh
    // ruleset rather than sitting on a spinner
    set({ config: null, isLoaded: true });
    useCharacterStore.getState().resetCharacters();
  },

  /** Rename the current configuration; the export filename derives from this */
  renameConfig: (name: string) => {
    const { config } = get();
    if (!config) return;

    const updated = autoSave({ ...config, name });
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

    const updated = autoSave(
      applyRenameSafely(config, (current) => ({
        ...current,
        // `undefined` clears rather than sticks: a User who empties `max` or `formula` is
        // making the stat unbounded or invested, and the key goes with it
        stats: current.stats.map((stat) =>
          stat.id === id ? mergeClearingAbsent(stat, updates) : stat
        ),
      }))
    );
    set({ config: updated });
  },

  deleteStat: (id: string, options?: DeleteOptions) =>
    guardedDelete(set, get, 'stat', id, options, (config) => ({
      ...config,
      stats: config.stats.filter((stat) => stat.id !== id),
    })),

  reorderStats: (orderedIds: string[]) => {
    const { config } = get();
    if (!config) return;

    const byId = new Map(config.stats.map((stat) => [stat.id, stat]));
    const named = orderedIds
      .map((id) => byId.get(id))
      .filter((stat): stat is Stat => stat !== undefined);
    // Anything the caller left out keeps its relative position, at the end — a partial list
    // reorders what it names rather than dropping the rest
    const namedIds = new Set(named.map((stat) => stat.id));
    const rest = config.stats.filter((stat) => !namedIds.has(stat.id));

    const updated = autoSave({
      ...config,
      stats: [...named, ...rest].map((stat, index) => ({ ...stat, order: index })),
    });
    set({ config: updated });
  },

  // Skills CRUD (Concept 02, TICKET-SKL-02)
  addSkill: (skill: Skill) => {
    const { config } = get();
    if (!config) return;

    const updated = autoSave({
      ...config,
      skills: [...config.skills, skill],
    });
    set({ config: updated });
  },

  updateSkill: (id: string, updates: Partial<Skill>) => {
    const { config } = get();
    if (!config) return;

    // Renaming a skill re-spells every `skills.<name>` that points at it, the same way renaming a
    // stat does — the formulas hold the skill's id, so nothing has to chase the change
    const updated = autoSave(
      applyRenameSafely(config, (current) => ({
        ...current,
        skills: current.skills.map((skill) => (skill.id === id ? { ...skill, ...updates } : skill)),
      }))
    );
    set({ config: updated });
  },

  deleteSkill: (id: string, options?: DeleteOptions) =>
    guardedDelete(set, get, 'skill', id, options, (config) => ({
      ...config,
      skills: config.skills.filter((skill) => skill.id !== id),
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

  // Archetypes CRUD (Concept 03, TICKET-ARC-01)
  addArchetype: (archetype: Archetype) => {
    const { config } = get();
    if (!config) return;

    // `archetypes` is optional and absent means none, so the first one creates the array rather
    // than a fresh ruleset shipping an empty one — the treatment `constants` and `curves` get
    const updated = autoSave({
      ...config,
      archetypes: [...(config.archetypes ?? []), archetype],
    });
    set({ config: updated });
  },

  updateArchetype: (id: string, updates: Partial<Archetype>) => {
    const { config } = get();
    if (!config) return;

    const updated = autoSave({
      ...config,
      archetypes: (config.archetypes ?? []).map((archetype) =>
        archetype.id === id ? { ...archetype, ...updates } : archetype
      ),
    });
    set({ config: updated });
  },

  deleteArchetype: (id: string, options?: DeleteOptions) =>
    guardedDelete(set, get, 'archetype', id, options, (config) => ({
      ...config,
      archetypes: (config.archetypes ?? []).filter((archetype) => archetype.id !== id),
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

  addCurveColumn: (curveId: string, column: CurveColumn) =>
    editCurve(set, get, curveId, (curve) => addColumnToCurve(curve, column)),

  deleteCurveColumn: (curveId: string, columnId: string, options?: DeleteOptions) =>
    guardedDelete(set, get, 'curve-column', columnId, options, (config) => ({
      ...config,
      curves: (config.curves ?? []).map((curve) =>
        curve.id === curveId ? removeCurveColumn(curve, columnId) : curve
      ),
    })),

  addCurveRow: (curveId: string, key: number) =>
    editCurve(set, get, curveId, (curve) => addRowToCurve(curve, key)),

  deleteCurveRow: (curveId: string, key: number) =>
    editCurve(set, get, curveId, (curve) => removeCurveRow(curve, key)),

  setCurveCell: (curveId: string, key: number, columnName: string, value: number) =>
    editCurve(set, get, curveId, (curve) => setCurveCellValue(curve, key, columnName, value)),

  clearCurveOverride: (curveId: string, key: number, columnName: string) =>
    editCurve(set, get, curveId, (curve, config) =>
      clearCurveOverrideCell(curve, key, columnName, config)
    ),

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
}));
