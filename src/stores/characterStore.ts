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
import { asNumber } from '../engine/formula/errors';
import { loadCharacters, saveCharacters } from '../services/storage';
import type { Character, CharacterCreationData, Inventory } from '../types/character';
import type { Configuration } from '../types/config';
import type { FormulaResult } from '../types/formula';

/**
 * Character store state
 */
interface CharacterState {
  characters: Character[];
  isLoaded: boolean;

  // Initialization
  loadCharacters: () => void;

  // Character CRUD
  createCharacter: (data: CharacterCreationData, config: Configuration) => Character;
  updateCharacter: (id: string, updates: Partial<Character>) => void;
  deleteCharacter: (id: string) => void;
  getCharacter: (id: string) => Character | undefined;
  renameSkillCode: (previousCode: string, nextCode: string) => void;

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
    focusStatCode: data.focusStatCode,
    specialitySkillBaseLevels: data.specialitySkillBaseLevels,
    currentResourceValues: {},
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
 * Whether a character has anything filed under a skill code
 *
 * Stat investment is keyed by **id** since TICKET-STAT-01, so renaming a stat cannot orphan it
 * and this only has to cover the two spellings that are still keys.
 */
function holdsSkillCode(character: Character, code: string): boolean {
  return code in character.specialitySkillBaseLevels || character.focusStatCode === code;
}

/**
 * Move one key of a code-keyed map, leaving insertion order and every other entry alone
 *
 * A key already present under `nextCode` would be a duplicate code, which the configuration
 * refuses; the rename still wins so the value follows the skill rather than being dropped.
 */
function rekey(
  values: Record<string, number>,
  previousCode: string,
  nextCode: string
): Record<string, number> {
  if (!(previousCode in values)) return values;

  const { [previousCode]: moved, ...rest } = values;
  return { ...rest, [nextCode]: moved };
}

/**
 * Auto-save helper - saves characters and updates timestamp
 */
function autoSave(characters: Character[]): Character[] {
  saveCharacters(characters);
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

  // Create new character
  createCharacter: (data: CharacterCreationData, config: Configuration) => {
    const character = createCharacterFromData(data, config);
    const { characters } = get();
    const updated = autoSave([...characters, character]);
    set({ characters: updated });
    return character;
  },

  // Update character
  updateCharacter: (id: string, updates: Partial<Character>) => {
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

  /**
   * Follow a skill code rename through every character (TICKET-REF-01)
   *
   * A character's allocations are keyed by skill code, so a rename in the configuration would
   * otherwise orphan them — the formula would read the new code as an unallocated 0 while the
   * player's levels sat under a key nothing names. Re-keying here is the character-store half of
   * the rename; the configuration half is `configStore`'s `applyRenameSafely`. TICKET-STAT-01
   * replaces these code-keyed maps with id-keyed ones and this action retires with them.
   *
   * @param previousCode - The code the skill had
   * @param nextCode - The code it has now
   */
  renameSkillCode: (previousCode: string, nextCode: string) => {
    if (previousCode === nextCode) return;

    const { characters } = get();
    if (!characters.some((char) => holdsSkillCode(char, previousCode))) return;

    const updated = autoSave(
      characters.map((char) => ({
        ...char,
        specialitySkillBaseLevels: rekey(char.specialitySkillBaseLevels, previousCode, nextCode),
        ...(char.focusStatCode === previousCode ? { focusStatCode: nextCode } : {}),
      }))
    );
    set({ characters: updated });
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
}));
