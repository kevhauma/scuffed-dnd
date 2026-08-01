/**
 * Character Store
 * 
 * Zustand store for managing player character data.
 * Implements character CRUD operations, inventory management, and stat updates
 * with auto-save to LocalStorage.
 * 
 * **Validates: Requirements 11.1, 12.5, 12.6, 14.2, 14.3, 14.4, 14.5, 17.2, 17.4**
 */

import { create } from 'zustand';
import { calculateCharacter } from '../engine/calculator';
import type { Character, CharacterCreationData } from '../types/character';
import type { Configuration } from '../types/config';
import { saveCharacters, loadCharacters } from '../services/storage';

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
  equipItem: (characterId: string, equipmentSlotType: string, itemId: string) => void;
  unequipItem: (characterId: string, equipmentSlotType: string) => void;
  addMiscItem: (characterId: string, itemId: string) => void;
  removeMiscItem: (characterId: string, itemId: string) => void;
  moveItemToMisc: (characterId: string, equipmentSlotType: string) => void;
  moveItemToEquipment: (characterId: string, itemId: string, equipmentSlotType: string) => void;
  
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
  let maxStatValues: Record<string, number>;
  try {
    maxStatValues = calculateCharacter(character, config).maxStatValues;
  } catch {
    return values;
  }

  const clamped: Record<string, number> = {};
  for (const [statId, value] of Object.entries(values)) {
    const max = maxStatValues[statId];
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
function createCharacterFromData(
  data: CharacterCreationData,
  config: Configuration
): Character {
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
    return {
      ...character,
      currentStatValues: { ...calculateCharacter(character, config).maxStatValues },
    };
  } catch {
    // A ruleset with a broken formula must not block character creation; the sheet will
    // surface the formula error where it can be acted on.
    return character;
  }
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
      characters.map(char =>
        char.id === id ? updateTimestamp({ ...char, ...updates }) : char
      )
    );
    set({ characters: updated });
  },
  
  // Delete character
  deleteCharacter: (id: string) => {
    const { characters } = get();
    const updated = autoSave(characters.filter(char => char.id !== id));
    set({ characters: updated });
  },
  
  // Get character by ID
  getCharacter: (id: string) => {
    const { characters } = get();
    return characters.find(char => char.id === id);
  },
  
  // Equip item to equipment slot
  equipItem: (characterId: string, equipmentSlotType: string, itemId: string) => {
    const { characters } = get();
    const updated = autoSave(
      characters.map(char => {
        if (char.id !== characterId) return char;
        
        return updateTimestamp({
          ...char,
          inventory: {
            ...char.inventory,
            equippedItems: {
              ...char.inventory.equippedItems,
              [equipmentSlotType]: itemId,
            },
          },
        });
      })
    );
    set({ characters: updated });
  },
  
  // Unequip item from equipment slot
  unequipItem: (characterId: string, equipmentSlotType: string) => {
    const { characters } = get();
    const updated = autoSave(
      characters.map(char => {
        if (char.id !== characterId) return char;
        
        const { [equipmentSlotType]: removed, ...remaining } = char.inventory.equippedItems;
        
        return updateTimestamp({
          ...char,
          inventory: {
            ...char.inventory,
            equippedItems: remaining,
          },
        });
      })
    );
    set({ characters: updated });
  },
  
  // Add item to miscellaneous inventory
  addMiscItem: (characterId: string, itemId: string) => {
    const { characters } = get();
    const updated = autoSave(
      characters.map(char => {
        if (char.id !== characterId) return char;
        
        return updateTimestamp({
          ...char,
          inventory: {
            ...char.inventory,
            miscItems: [...char.inventory.miscItems, itemId],
          },
        });
      })
    );
    set({ characters: updated });
  },
  
  // Remove item from miscellaneous inventory
  removeMiscItem: (characterId: string, itemId: string) => {
    const { characters } = get();
    const updated = autoSave(
      characters.map(char => {
        if (char.id !== characterId) return char;
        
        return updateTimestamp({
          ...char,
          inventory: {
            ...char.inventory,
            miscItems: char.inventory.miscItems.filter(id => id !== itemId),
          },
        });
      })
    );
    set({ characters: updated });
  },
  
  // Move equipped item to miscellaneous inventory
  moveItemToMisc: (characterId: string, equipmentSlotType: string) => {
    const { characters } = get();
    const character = characters.find(char => char.id === characterId);
    if (!character) return;
    
    const itemId = character.inventory.equippedItems[equipmentSlotType];
    if (!itemId) return;
    
    const updated = autoSave(
      characters.map(char => {
        if (char.id !== characterId) return char;
        
        const { [equipmentSlotType]: removed, ...remaining } = char.inventory.equippedItems;
        
        return updateTimestamp({
          ...char,
          inventory: {
            equippedItems: remaining,
            miscItems: [...char.inventory.miscItems, itemId],
          },
        });
      })
    );
    set({ characters: updated });
  },
  
  // Move miscellaneous item to equipment slot
  moveItemToEquipment: (characterId: string, itemId: string, equipmentSlotType: string) => {
    const { characters } = get();
    const updated = autoSave(
      characters.map(char => {
        if (char.id !== characterId) return char;
        
        return updateTimestamp({
          ...char,
          inventory: {
            equippedItems: {
              ...char.inventory.equippedItems,
              [equipmentSlotType]: itemId,
            },
            miscItems: char.inventory.miscItems.filter(id => id !== itemId),
          },
        });
      })
    );
    set({ characters: updated });
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
      characters.map(char => {
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
