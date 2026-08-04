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
  let maxStatValues: Record<string, FormulaResult>;
  try {
    maxStatValues = calculateCharacter(character, config).maxStatValues;
  } catch {
    return values;
  }

  const clamped: Record<string, number> = {};
  for (const [statId, value] of Object.entries(values)) {
    // `asNumber` is undefined both when the stat has no maximum and when its formula is broken;
    // either way there is no ceiling to clamp against, so the Player's value goes through.
    const max = asNumber(maxStatValues[statId]);
    clamped[statId] = max === undefined ? value : Math.min(value, max);
  }

  return clamped;
}

/**
 * Create character from creation data
 *
 * A new character starts at full: `currentStatValues` is seeded to the calculated maxima, since a
 * Player expects a fresh character to be at full health rather than at zero. Seeding happens here,
 * where the rest of the character shape is assembled, rather than in the creation wizard.
 */
function createCharacterFromData(data: CharacterCreationData, config: Configuration): Character {
  const now = new Date().toISOString();
  const character: Character = {
    id: crypto.randomUUID(),
    name: data.name,
    configurationId: config.id,
    raceIds: data.raceIds,
    mainSkillLevels: data.mainSkillLevels,
    focusStatCode: data.focusStatCode,
    specialitySkillBaseLevels: data.specialitySkillBaseLevels,
    currentStatValues: {},
    inventory: {
      equippedItems: {},
      miscItems: [],
    },
    createdAt: now,
    updatedAt: now,
  };

  try {
    // Seed only the stats that actually produced a number; a stat with a broken formula starts
    // absent rather than at a made-up zero.
    const maxStatValues = calculateCharacter(character, config).maxStatValues;
    const seeded: Record<string, number> = {};
    for (const [statId, result] of Object.entries(maxStatValues)) {
      const max = asNumber(result);
      if (max !== undefined) seeded[statId] = max;
    }

    return { ...character, currentStatValues: seeded };
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

        return updateTimestamp({
          ...char,
          currentStatValues: {
            ...char.currentStatValues,
            ...clampToMaxStatValues(char, values, config),
          },
        });
      })
    );
    set({ characters: updated });
  },
}));
