/**
 * Character Store
 *
 * Zustand store for managing player character data.
 * Implements character CRUD operations, inventory management, and stat updates
 * with auto-save to LocalStorage.
 *
 * **Validates: Requirements 11.1, 12.2, 12.3, 12.5, 12.6, 14.2, 14.3, 14.4, 14.5, 17.2, 17.4**
 */

import { create } from 'zustand';
import { calculateCharacter } from '../engine/calculator';
import { MAX_RACE_COUNT } from '../engine/calculators/statCalculator';
import { asNumber } from '../engine/formula/errors';
import { validateStatAllocation } from '../engine/skillAllocation';
import { loadCharacters, saveCharacters } from '../services/storage';
import type { Character, CharacterCreationData, Inventory } from '../types/character';
import type { Configuration } from '../types/config';
import type { FormulaResult } from '../types/formula';
import { useUIStore } from './uiStore';

/**
 * What {@link CharacterState.updateCharacter} may patch (CR-12)
 *
 * The three fields of a character that are plain content: what they are called, what they are, and
 * how they grow. Everything else on `Character` is either an invariant somebody else enforces
 * (`experience`, `investedStatPoints`, `currentResourceValues`, `inventory`) or identity nothing
 * may rewrite (`id`, `configurationId`, `createdAt`, `updatedAt`). Widening this type is how a
 * future feature says it needs a new patchable field — and the place to ask whether that field
 * wants a guarded action of its own instead.
 *
 * Module-local: callers pass object literals and TypeScript infers, so exporting it would be
 * supported API nothing consumes (the CR-39 rule).
 */
type CharacterPatch = Partial<Pick<Character, 'name' | 'raceIds' | 'archetypeId'>>;

/**
 * Character store state
 */
interface CharacterState {
  characters: Character[];
  isLoaded: boolean;

  // Initialization
  loadCharacters: () => void;
  /**
   * Forget every loaded character without writing anything (TICKET-IO-03)
   *
   * Half of the start-fresh path: `configStore.discardStoredData` clears the keys and calls this
   * so the in-memory list matches the now-empty storage. It persists nothing itself — the keys
   * are already gone by the time it runs.
   */
  resetCharacters: () => void;

  // Character CRUD
  /**
   * Write a new character, or `null` when the data is one the model cannot hold
   *
   * Nullable since TICKET-RACE-02: more races than the blend is defined over is the first thing
   * this action refuses outright rather than storing. A caller that gets `null` should stay where
   * it is — nothing was saved. TICKET-RES-02 added the second refusal: an allocation the derived
   * budget cannot pay for, checked here as well as in the wizard so the rule has one home.
   */
  createCharacter: (data: CharacterCreationData, config: Configuration) => Character | null;
  /**
   * Patch the fields of a character that no other action owns
   *
   * Deliberately **not** `Partial<Character>` (CR-12). A free-form patch could write `experience`,
   * which only `awardExperience`/`deductExperience` may touch since `level` derives from it; or
   * `investedStatPoints`, whose budget refusal has one home in `setInvestedStatPoints`; or
   * `id`/`configurationId`/`createdAt`, which are identity rather than content. Every one of those
   * has a guarded action, so this one takes only what is left: see {@link CharacterPatch}.
   */
  updateCharacter: (id: string, updates: CharacterPatch) => void;
  deleteCharacter: (id: string) => void;
  getCharacter: (id: string) => Character | undefined;

  // Inventory Management
  equipItem: (
    characterId: string,
    equipmentSlotType: string,
    itemId: string,
    config: Configuration
  ) => void;
  unequipItem: (characterId: string, equipmentSlotType: string) => void;
  addMiscItem: (characterId: string, itemId: string) => void;
  removeMiscItem: (characterId: string, itemId: string) => void;
  moveItemToMisc: (characterId: string, equipmentSlotType: string) => void;
  moveItemToEquipment: (
    characterId: string,
    itemId: string,
    equipmentSlotType: string,
    config: Configuration
  ) => void;

  // Current Stat Value Updates
  updateCurrentStatValue: (
    characterId: string,
    statId: string,
    value: number,
    config: Configuration
  ) => void;
  updateCurrentStatValues: (
    characterId: string,
    values: Record<string, number>,
    config: Configuration
  ) => void;

  /**
   * Put points into one invested stat, refusing anything the derived budget cannot pay for
   *
   * The level-up mechanic (TICKET-RES-02): unspent points stay spendable, so a Player who gains a
   * level simply has more to allocate and does it here rather than through a second wizard. The
   * refusal is a **refusal**, not a clamp — silently spending fewer points than asked would leave
   * a Player believing an investment landed. It takes the `Configuration` because the budget is
   * derived from the character's level, which is never stored on them.
   */
  setInvestedStatPoints: (
    characterId: string,
    statId: string,
    points: number,
    config: Configuration
  ) => void;

  /**
   * Move a resource pool by a delta rather than setting it (Concept 20's quick entry)
   *
   * `-7` off a pool of 30 leaves 23. The delta applies to what is **stored**, not to what is
   * displayed, so a pool already above a shrunken maximum loses exactly what was asked for. The
   * write still clamps at the maximum and still allows a negative result (Requirements 14.3, 14.4).
   */
  adjustCurrentStatValue: (
    characterId: string,
    statId: string,
    delta: number,
    config: Configuration
  ) => void;
  /**
   * Fill a resource pool to its calculated maximum — Concept 20's "Regain mana to full"
   *
   * The maximum is derived, so this is the one write that reads it: a pool whose formula cannot be
   * evaluated has no maximum to reset to and is left alone rather than zeroed.
   */
  resetCurrentStatValueToMax: (characterId: string, statId: string, config: Configuration) => void;

  // Experience (Concept 20, TICKET-RES-01) — level derives from this, so nothing else may write it
  /** Add experience. A non-positive or non-finite amount is refused rather than treated as a deduct. */
  awardExperience: (characterId: string, amount: number) => void;
  /**
   * Remove experience, refusing to take a character below 0.
   *
   * A **refusal**, not a clamp: `exp.gs` deducts a stated amount, and quietly deducting less than
   * asked would leave the table believing a penalty landed in full. Nothing is written when the
   * amount is more than the character has.
   */
  deductExperience: (characterId: string, amount: number) => void;
}

/**
 * Clamp requested current stat values to their calculated maxima
 *
 * Requirement 14.3 caps a current value at its maximum and Requirement 14.4 allows it to go
 * negative, so this is a one-sided clamp. It lives in the store rather than in the stat editor so
 * no caller can write an out-of-range value, and it takes the `Configuration` because the maxima
 * are derived from the stat formulas — they are never stored on the character.
 *
 * A stat with no calculated maximum (an unknown id, or a ruleset whose formulas do not evaluate)
 * is written through unclamped: refusing the edit would leave a Player unable to track anything on
 * a broken ruleset, and the sheet surfaces the formula error separately.
 */
function clampToMaxStatValues(
  character: Character,
  values: Record<string, number>,
  config: Configuration
): Record<string, number> {
  let statValues: Record<string, FormulaResult>;
  try {
    statValues = calculateCharacter(character, config).statValues;
  } catch {
    return values;
  }

  const clamped: Record<string, number> = {};
  for (const [statId, value] of Object.entries(values)) {
    // `asNumber` is undefined both when the stat has no maximum and when its formula is broken;
    // either way there is no ceiling to clamp against, so the Player's value goes through.
    const max = asNumber(statValues[statId]);
    clamped[statId] = max === undefined ? value : Math.min(value, max);
  }

  return clamped;
}

/**
 * One stat's calculated maximum, or undefined when there isn't one
 *
 * The same reading `clampToMaxStatValues` does, for the one action that needs a single stat's
 * ceiling rather than a batch of them: `undefined` covers an unknown id, a ruleset whose formulas
 * do not evaluate, and an engine that threw — three ways of having no ceiling, all of which mean
 * the same thing to a caller.
 */
function maxStatValue(
  character: Character,
  statId: string,
  config: Configuration
): number | undefined {
  try {
    return asNumber(calculateCharacter(character, config).statValues[statId]);
  } catch {
    return undefined;
  }
}

/**
 * Whether a set of races is one the composition can blend (TICKET-RACE-02)
 *
 * The upper bound is the rule: past {@link MAX_RACE_COUNT} the sheet's hybrid has no meaning, so
 * the store refuses the write rather than storing a character whose bases cannot be computed.
 *
 * **No lower bound.** Concept 04 describes a character as one or two creatures, but a ruleset is
 * free to define no races at all, and a raceless character is a coherent state the sheet already
 * has an empty state for (Requirement 11.2). Requiring one would make the wizard unusable on a
 * ruleset that has none — see the ticket's implementation note.
 */
function hasBlendableRaces(raceIds: string[]): boolean {
  return raceIds.length <= MAX_RACE_COUNT;
}

/**
 * Create character from creation data
 *
 * A new character starts at full: `currentResourceValues` is seeded to the calculated maxima,
 * since a Player expects a fresh character to be at full health rather than at zero. Seeding
 * happens here, where the rest of the character shape is assembled, rather than in the wizard.
 *
 * **Only `isResource` stats are seeded** (TICKET-STAT-01). v1 gave every stat a current value,
 * which is what made "current Strength" a thing the app believed in; a stat you cannot spend has
 * no current distinct from its value.
 */
function createCharacterFromData(data: CharacterCreationData, config: Configuration): Character {
  const now = new Date().toISOString();
  const character: Character = {
    id: crypto.randomUUID(),
    name: data.name,
    configurationId: config.id,
    raceIds: data.raceIds,
    investedStatPoints: data.investedStatPoints,
    archetypeId: data.archetypeId,
    investedSkillPoints: data.investedSkillPoints,
    currentResourceValues: {},
    // A fresh character has earned nothing, which the seeded curve reads as level 1 (TICKET-RES-01)
    experience: 0,
    inventory: {
      equippedItems: {},
      miscItems: [],
    },
    createdAt: now,
    updatedAt: now,
  };

  try {
    // Seed only the resource stats that actually produced a number; a stat with a broken formula
    // starts absent rather than at a made-up zero.
    const statValues = calculateCharacter(character, config).statValues;
    const resourceIds = new Set(
      config.stats.filter((stat) => stat.isResource).map((stat) => stat.id)
    );

    const seeded: Record<string, number> = {};
    for (const [statId, result] of Object.entries(statValues)) {
      if (!resourceIds.has(statId)) continue;
      const max = asNumber(result);
      if (max !== undefined) seeded[statId] = max;
    }

    return { ...character, currentResourceValues: seeded };
  } catch {
    // A ruleset with a broken formula must not block character creation; the sheet will
    // surface the formula error where it can be acted on.
    return character;
  }
}

/**
 * Decide whether an item may occupy an equipment slot
 *
 * Requirement 12.3: an item goes in the slot type it declares, and only that one. An item the
 * configuration does not define, or one with no `equipmentSlotType` at all, fits nowhere — a
 * strict equality against the declared type covers all three cases at once.
 *
 * This lives in the store so the rule holds for every caller, not only for a panel that happens to
 * offer the right options.
 */
function fitsSlot(itemId: string, equipmentSlotType: string, config: Configuration): boolean {
  const item = config.items.find((candidate) => candidate.id === itemId);
  return item?.equipmentSlotType === equipmentSlotType;
}

/**
 * An equipped-items map with one slot emptied
 */
function withoutSlot(
  equippedItems: Inventory['equippedItems'],
  equipmentSlotType: string
): Inventory['equippedItems'] {
  return Object.fromEntries(
    Object.entries(equippedItems).filter(([slotType]) => slotType !== equipmentSlotType)
  );
}

/**
 * Apply a change to one character's inventory, then stamp and persist
 *
 * Every inventory action is the same three steps — find the character, replace its `Inventory`,
 * save — differing only in how the new inventory is derived. That difference is the `update`
 * callback; returning the inventory unchanged is how an action declines to do anything.
 */
function patchInventory(
  set: (partial: Partial<CharacterState>) => void,
  get: () => CharacterState,
  characterId: string,
  update: (inventory: Inventory) => Inventory
): void {
  const { characters } = get();

  const updated = autoSave(
    characters.map((char) => {
      if (char.id !== characterId) return char;

      const inventory = update(char.inventory);
      if (inventory === char.inventory) return char;

      return updateTimestamp({ ...char, inventory });
    })
  );

  set({ characters: updated });
}

/**
 * Whether an amount is a real, positive quantity of experience
 *
 * Award and deduct each state their own direction, so a negative amount is a caller mistake rather
 * than a way to reverse the operation — accepting it would let `awardExperience(-100)` take XP away
 * without passing the below-zero refusal.
 */
function isAwardableAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0;
}

/**
 * Apply one experience change, then stamp and persist
 *
 * The counterpart to `updateCharacterInventory`, and takes its arguments in the same order:
 * `change` returns the new total, or `undefined` to refuse — in which case nothing is written,
 * nothing is stamped, and the array identity is unchanged so no subscriber re-renders over a no-op.
 */
function applyExperienceChange(
  set: (partial: Partial<CharacterState>) => void,
  get: () => CharacterState,
  characterId: string,
  change: (experience: number) => number | undefined
): void {
  const { characters } = get();

  let changed = false;
  const next = characters.map((char) => {
    if (char.id !== characterId) return char;

    // Belt and braces with `loadCharacters`' filter: a character whose stored total is not a
    // number would compute `undefined + amount` and persist `NaN`, which reads as level 1 forever
    // and cannot be undone from the UI. Refused rather than repaired — inventing a total is the
    // same mistake as inventing a level.
    if (!Number.isFinite(char.experience)) return char;

    const experience = change(char.experience);
    if (experience === undefined) return char;

    changed = true;
    return updateTimestamp({ ...char, experience });
  });

  if (!changed) return;

  set({ characters: autoSave(next) });
}

/**
 * Auto-save helper — saves characters and reports a write that did not land
 *
 * The configuration store's `autoSave` for the same reason and with the same contract (CR-11):
 * this is the one place a write can fail, and on failure what comes back is the character list
 * already in memory, so the caller's `set` is a no-op and memory keeps matching disk.
 *
 * @param characters - The list to persist
 * @returns What the store should now hold: the saved list, or the unchanged current one
 */
function autoSave(characters: Character[]): Character[] {
  try {
    saveCharacters(characters);
  } catch (error) {
    useUIStore.getState().reportStorageFailure(error);
    return useCharacterStore.getState().characters;
  }

  return characters;
}

/**
 * Update character timestamp
 */
function updateTimestamp(character: Character): Character {
  return {
    ...character,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Character store
 */
export const useCharacterStore = create<CharacterState>((set, get) => ({
  characters: [],
  isLoaded: false,

  // Load characters from LocalStorage
  loadCharacters: () => {
    const characters = loadCharacters();
    set({ characters, isLoaded: true });
  },

  resetCharacters: () => {
    set({ characters: [], isLoaded: true });
  },

  // Create new character
  createCharacter: (data: CharacterCreationData, config: Configuration) => {
    if (!hasBlendableRaces(data.raceIds)) return null;

    const character = createCharacterFromData(data, config);

    // The same engine verdict `setInvestedStatPoints` asks for, so creation and the level-up spend
    // cannot disagree about what is affordable. The wizard's step already blocks this, but the
    // judgement belongs to the store rather than to a hook — a second creation path, or a bug in
    // that one, would otherwise mint an over-budget character with nothing to refuse it.
    if (!validateStatAllocation(character, config).isValid) return null;

    const { characters } = get();
    const updated = autoSave([...characters, character]);
    set({ characters: updated });
    return character;
  },

  // Update character — see `CharacterPatch` for what this may and may not touch
  updateCharacter: (id: string, updates: CharacterPatch) => {
    // Same rule as on create: a patch that would put a character past the blend is not applied
    if (updates.raceIds !== undefined && !hasBlendableRaces(updates.raceIds)) return;

    const { characters } = get();
    const updated = autoSave(
      characters.map((char) => (char.id === id ? updateTimestamp({ ...char, ...updates }) : char))
    );
    set({ characters: updated });
  },

  // Delete character
  deleteCharacter: (id: string) => {
    const { characters } = get();
    const updated = autoSave(characters.filter((char) => char.id !== id));
    set({ characters: updated });
  },

  // Get character by ID
  getCharacter: (id: string) => {
    const { characters } = get();
    return characters.find((char) => char.id === id);
  },

  // Equip item to equipment slot
  equipItem: (
    characterId: string,
    equipmentSlotType: string,
    itemId: string,
    config: Configuration
  ) => {
    if (!fitsSlot(itemId, equipmentSlotType, config)) return;

    patchInventory(set, get, characterId, (inventory) => ({
      ...inventory,
      equippedItems: { ...inventory.equippedItems, [equipmentSlotType]: itemId },
    }));
  },

  // Unequip item from equipment slot
  unequipItem: (characterId: string, equipmentSlotType: string) => {
    patchInventory(set, get, characterId, (inventory) => ({
      ...inventory,
      equippedItems: withoutSlot(inventory.equippedItems, equipmentSlotType),
    }));
  },

  // Add item to miscellaneous inventory
  addMiscItem: (characterId: string, itemId: string) => {
    patchInventory(set, get, characterId, (inventory) => ({
      ...inventory,
      miscItems: [...inventory.miscItems, itemId],
    }));
  },

  // Remove item from miscellaneous inventory
  removeMiscItem: (characterId: string, itemId: string) => {
    patchInventory(set, get, characterId, (inventory) => ({
      ...inventory,
      miscItems: inventory.miscItems.filter((id) => id !== itemId),
    }));
  },

  // Move equipped item to miscellaneous inventory
  moveItemToMisc: (characterId: string, equipmentSlotType: string) => {
    patchInventory(set, get, characterId, (inventory) => {
      const itemId = inventory.equippedItems[equipmentSlotType];
      if (!itemId) return inventory;

      return {
        equippedItems: withoutSlot(inventory.equippedItems, equipmentSlotType),
        miscItems: [...inventory.miscItems, itemId],
      };
    });
  },

  // Move miscellaneous item to equipment slot
  moveItemToEquipment: (
    characterId: string,
    itemId: string,
    equipmentSlotType: string,
    config: Configuration
  ) => {
    if (!fitsSlot(itemId, equipmentSlotType, config)) return;

    patchInventory(set, get, characterId, (inventory) => {
      // A slot holds one item, so whatever was in it swaps back to misc rather than vanishing
      const displaced = inventory.equippedItems[equipmentSlotType];
      const miscItems = inventory.miscItems.filter((id) => id !== itemId);

      return {
        equippedItems: { ...inventory.equippedItems, [equipmentSlotType]: itemId },
        miscItems: displaced ? [...miscItems, displaced] : miscItems,
      };
    });
  },

  // Update single current stat value
  updateCurrentStatValue: (
    characterId: string,
    statId: string,
    value: number,
    config: Configuration
  ) => {
    get().updateCurrentStatValues(characterId, { [statId]: value }, config);
  },

  // Update multiple current stat values
  updateCurrentStatValues: (
    characterId: string,
    values: Record<string, number>,
    config: Configuration
  ) => {
    const { characters } = get();
    const updated = autoSave(
      characters.map((char) => {
        if (char.id !== characterId) return char;

        // Only a resource has a current value distinct from its composed one, so ids for
        // anything else are dropped here rather than trusted from the caller (TICKET-STAT-01)
        const resourceIds = new Set(
          config.stats.filter((stat) => stat.isResource).map((stat) => stat.id)
        );
        const resourceValues = Object.fromEntries(
          Object.entries(values).filter(([statId]) => resourceIds.has(statId))
        );

        return updateTimestamp({
          ...char,
          currentResourceValues: {
            ...char.currentResourceValues,
            ...clampToMaxStatValues(char, resourceValues, config),
          },
        });
      })
    );
    set({ characters: updated });
  },

  adjustCurrentStatValue: (
    characterId: string,
    statId: string,
    delta: number,
    config: Configuration
  ) => {
    const character = get().characters.find((candidate) => candidate.id === characterId);
    if (!character || !Number.isFinite(delta)) return;

    // Read from the stored value, not from anything a component is showing — a pool left above a
    // shrunken maximum (TICKET-RES-03's kept-and-flagged rule) must lose exactly what was asked for
    const current = character.currentResourceValues[statId] ?? 0;
    get().updateCurrentStatValue(characterId, statId, current + delta, config);
  },

  resetCurrentStatValueToMax: (characterId: string, statId: string, config: Configuration) => {
    const character = get().characters.find((candidate) => candidate.id === characterId);
    if (!character) return;

    const max = maxStatValue(character, statId, config);
    // No maximum means nothing to fill to. Writing 0 would be the one case where "reset" empties a
    // pool instead of filling it, which is the opposite of what the control says it does.
    if (max === undefined) return;

    get().updateCurrentStatValue(characterId, statId, max, config);
  },

  setInvestedStatPoints: (
    characterId: string,
    statId: string,
    points: number,
    config: Configuration
  ) => {
    const { characters } = get();
    const character = characters.find((candidate) => candidate.id === characterId);
    if (!character) return;

    if (!Number.isInteger(points) || points < 0) return;

    const proposed: Character = {
      ...character,
      investedStatPoints: { ...character.investedStatPoints, [statId]: points },
    };

    // The engine decides, so the sheet and the wizard cannot disagree about what is affordable.
    // An unavailable budget lands here as `isValid: false`, which is the right answer: a ruleset
    // that cannot say how many points exist cannot say this spend is allowed either.
    if (!validateStatAllocation(proposed, config).isValid) return;

    const updated = autoSave(
      characters.map((candidate) =>
        candidate.id === characterId ? updateTimestamp(proposed) : candidate
      )
    );
    set({ characters: updated });
  },

  awardExperience: (characterId: string, amount: number) => {
    applyExperienceChange(set, get, characterId, (experience) =>
      isAwardableAmount(amount) ? experience + amount : undefined
    );
  },

  deductExperience: (characterId: string, amount: number) => {
    applyExperienceChange(set, get, characterId, (experience) => {
      if (!isAwardableAmount(amount)) return undefined;
      // Refused rather than clamped: a partial deduction would read as a penalty that landed
      return amount > experience ? undefined : experience - amount;
    });
  },
}));
