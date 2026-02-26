/**
 * Character Store Tests
 * 
 * Unit tests for the character store with auto-save functionality.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCharacterStore } from './characterStore';
import type { Character, CharacterCreationData } from '../types/character';
import * as storage from '../services/storage';

// Mock storage service
vi.mock('../services/storage', () => ({
  saveCharacters: vi.fn(),
  loadCharacters: vi.fn(() => []),
}));

describe('CharacterStore', () => {
  beforeEach(() => {
    // Reset store state
    useCharacterStore.setState({ characters: [], isLoaded: false });
    vi.clearAllMocks();
  });
  
  describe('loadCharacters', () => {
    it('should load characters from storage', () => {
      const mockCharacters: Character[] = [
        {
          id: 'char-1',
          name: 'Test Character',
          configurationId: 'config-1',
          raceIds: ['race-1'],
          mainSkillLevels: { STR: 10 },
          specialitySkillBaseLevels: {},
          currentStatValues: {},
          inventory: { equippedItems: {}, miscItems: [] },
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ];
      
      vi.mocked(storage.loadCharacters).mockReturnValue(mockCharacters);
      
      useCharacterStore.getState().loadCharacters();
      
      expect(useCharacterStore.getState().characters).toEqual(mockCharacters);
      expect(useCharacterStore.getState().isLoaded).toBe(true);
    });
  });
  
  describe('createCharacter', () => {
    it('should create a new character and save to storage', () => {
      const creationData: CharacterCreationData = {
        name: 'New Character',
        raceIds: ['race-1'],
        mainSkillLevels: { STR: 10, DEX: 8 },
        focusStatCode: 'STR',
        specialitySkillBaseLevels: { SWD: 5 },
      };
      
      const character = useCharacterStore.getState().createCharacter(creationData, 'config-1');
      
      expect(character.name).toBe('New Character');
      expect(character.raceIds).toEqual(['race-1']);
      expect(character.mainSkillLevels).toEqual({ STR: 10, DEX: 8 });
      expect(character.focusStatCode).toBe('STR');
      expect(character.configurationId).toBe('config-1');
      expect(character.id).toBeDefined();
      expect(character.createdAt).toBeDefined();
      expect(character.updatedAt).toBeDefined();
      
      expect(useCharacterStore.getState().characters).toHaveLength(1);
      expect(storage.saveCharacters).toHaveBeenCalledWith([character]);
    });
    
    it('should initialize empty inventory', () => {
      const creationData: CharacterCreationData = {
        name: 'Test',
        raceIds: [],
        mainSkillLevels: {},
        specialitySkillBaseLevels: {},
      };
      
      const character = useCharacterStore.getState().createCharacter(creationData, 'config-1');
      
      expect(character.inventory).toEqual({
        equippedItems: {},
        miscItems: [],
      });
    });
  });
  
  describe('updateCharacter', () => {
    it('should update character and save to storage', () => {
      const character: Character = {
        id: 'char-1',
        name: 'Original Name',
        configurationId: 'config-1',
        raceIds: [],
        mainSkillLevels: {},
        specialitySkillBaseLevels: {},
        currentStatValues: {},
        inventory: { equippedItems: {}, miscItems: [] },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      
      useCharacterStore.setState({ characters: [character], isLoaded: true });
      
      useCharacterStore.getState().updateCharacter('char-1', { name: 'Updated Name' });
      
      const updated = useCharacterStore.getState().characters[0];
      expect(updated.name).toBe('Updated Name');
      expect(updated.updatedAt).not.toBe(character.updatedAt);
      expect(storage.saveCharacters).toHaveBeenCalled();
    });
  });
  
  describe('deleteCharacter', () => {
    it('should delete character and save to storage', () => {
      const character: Character = {
        id: 'char-1',
        name: 'Test',
        configurationId: 'config-1',
        raceIds: [],
        mainSkillLevels: {},
        specialitySkillBaseLevels: {},
        currentStatValues: {},
        inventory: { equippedItems: {}, miscItems: [] },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      
      useCharacterStore.setState({ characters: [character], isLoaded: true });
      
      useCharacterStore.getState().deleteCharacter('char-1');
      
      expect(useCharacterStore.getState().characters).toHaveLength(0);
      expect(storage.saveCharacters).toHaveBeenCalledWith([]);
    });
  });
  
  describe('getCharacter', () => {
    it('should return character by ID', () => {
      const character: Character = {
        id: 'char-1',
        name: 'Test',
        configurationId: 'config-1',
        raceIds: [],
        mainSkillLevels: {},
        specialitySkillBaseLevels: {},
        currentStatValues: {},
        inventory: { equippedItems: {}, miscItems: [] },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      
      useCharacterStore.setState({ characters: [character], isLoaded: true });
      
      const found = useCharacterStore.getState().getCharacter('char-1');
      expect(found).toEqual(character);
    });
    
    it('should return undefined for non-existent character', () => {
      const found = useCharacterStore.getState().getCharacter('non-existent');
      expect(found).toBeUndefined();
    });
  });
  
  describe('Inventory Management', () => {
    let character: Character;
    
    beforeEach(() => {
      character = {
        id: 'char-1',
        name: 'Test',
        configurationId: 'config-1',
        raceIds: [],
        mainSkillLevels: {},
        specialitySkillBaseLevels: {},
        currentStatValues: {},
        inventory: { equippedItems: {}, miscItems: [] },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      useCharacterStore.setState({ characters: [character], isLoaded: true });
    });
    
    describe('equipItem', () => {
      it('should equip item to slot', () => {
        useCharacterStore.getState().equipItem('char-1', 'helmet', 'item-1');
        
        const updated = useCharacterStore.getState().characters[0];
        expect(updated.inventory.equippedItems['helmet']).toBe('item-1');
        expect(storage.saveCharacters).toHaveBeenCalled();
      });
      
      it('should replace existing item in slot', () => {
        useCharacterStore.setState({
          characters: [{
            ...character,
            inventory: {
              equippedItems: { helmet: 'item-1' },
              miscItems: [],
            },
          }],
          isLoaded: true,
        });
        
        useCharacterStore.getState().equipItem('char-1', 'helmet', 'item-2');
        
        const updated = useCharacterStore.getState().characters[0];
        expect(updated.inventory.equippedItems['helmet']).toBe('item-2');
      });
    });
    
    describe('unequipItem', () => {
      it('should remove item from slot', () => {
        useCharacterStore.setState({
          characters: [{
            ...character,
            inventory: {
              equippedItems: { helmet: 'item-1' },
              miscItems: [],
            },
          }],
          isLoaded: true,
        });
        
        useCharacterStore.getState().unequipItem('char-1', 'helmet');
        
        const updated = useCharacterStore.getState().characters[0];
        expect(updated.inventory.equippedItems['helmet']).toBeUndefined();
        expect(storage.saveCharacters).toHaveBeenCalled();
      });
    });
    
    describe('addMiscItem', () => {
      it('should add item to miscellaneous inventory', () => {
        useCharacterStore.getState().addMiscItem('char-1', 'item-1');
        
        const updated = useCharacterStore.getState().characters[0];
        expect(updated.inventory.miscItems).toContain('item-1');
        expect(storage.saveCharacters).toHaveBeenCalled();
      });
    });
    
    describe('removeMiscItem', () => {
      it('should remove item from miscellaneous inventory', () => {
        useCharacterStore.setState({
          characters: [{
            ...character,
            inventory: {
              equippedItems: {},
              miscItems: ['item-1', 'item-2'],
            },
          }],
          isLoaded: true,
        });
        
        useCharacterStore.getState().removeMiscItem('char-1', 'item-1');
        
        const updated = useCharacterStore.getState().characters[0];
        expect(updated.inventory.miscItems).toEqual(['item-2']);
        expect(storage.saveCharacters).toHaveBeenCalled();
      });
    });
    
    describe('moveItemToMisc', () => {
      it('should move equipped item to miscellaneous inventory', () => {
        useCharacterStore.setState({
          characters: [{
            ...character,
            inventory: {
              equippedItems: { helmet: 'item-1' },
              miscItems: [],
            },
          }],
          isLoaded: true,
        });
        
        useCharacterStore.getState().moveItemToMisc('char-1', 'helmet');
        
        const updated = useCharacterStore.getState().characters[0];
        expect(updated.inventory.equippedItems['helmet']).toBeUndefined();
        expect(updated.inventory.miscItems).toContain('item-1');
        expect(storage.saveCharacters).toHaveBeenCalled();
      });
    });
    
    describe('moveItemToEquipment', () => {
      it('should move miscellaneous item to equipment slot', () => {
        useCharacterStore.setState({
          characters: [{
            ...character,
            inventory: {
              equippedItems: {},
              miscItems: ['item-1'],
            },
          }],
          isLoaded: true,
        });
        
        useCharacterStore.getState().moveItemToEquipment('char-1', 'item-1', 'helmet');
        
        const updated = useCharacterStore.getState().characters[0];
        expect(updated.inventory.equippedItems['helmet']).toBe('item-1');
        expect(updated.inventory.miscItems).not.toContain('item-1');
        expect(storage.saveCharacters).toHaveBeenCalled();
      });
    });
  });
  
  describe('Current Stat Value Updates', () => {
    let character: Character;
    
    beforeEach(() => {
      character = {
        id: 'char-1',
        name: 'Test',
        configurationId: 'config-1',
        raceIds: [],
        mainSkillLevels: {},
        specialitySkillBaseLevels: {},
        currentStatValues: { health: 100, mana: 50 },
        inventory: { equippedItems: {}, miscItems: [] },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      useCharacterStore.setState({ characters: [character], isLoaded: true });
    });
    
    describe('updateCurrentStatValue', () => {
      it('should update single stat value', () => {
        useCharacterStore.getState().updateCurrentStatValue('char-1', 'health', 80);
        
        const updated = useCharacterStore.getState().characters[0];
        expect(updated.currentStatValues['health']).toBe(80);
        expect(updated.currentStatValues['mana']).toBe(50);
        expect(storage.saveCharacters).toHaveBeenCalled();
      });
      
      it('should allow negative values', () => {
        useCharacterStore.getState().updateCurrentStatValue('char-1', 'health', -10);
        
        const updated = useCharacterStore.getState().characters[0];
        expect(updated.currentStatValues['health']).toBe(-10);
      });
    });
    
    describe('updateCurrentStatValues', () => {
      it('should update multiple stat values', () => {
        useCharacterStore.getState().updateCurrentStatValues('char-1', {
          health: 90,
          mana: 40,
        });
        
        const updated = useCharacterStore.getState().characters[0];
        expect(updated.currentStatValues['health']).toBe(90);
        expect(updated.currentStatValues['mana']).toBe(40);
        expect(storage.saveCharacters).toHaveBeenCalled();
      });
      
      it('should merge with existing values', () => {
        useCharacterStore.getState().updateCurrentStatValues('char-1', {
          stamina: 60,
        });
        
        const updated = useCharacterStore.getState().characters[0];
        expect(updated.currentStatValues['health']).toBe(100);
        expect(updated.currentStatValues['mana']).toBe(50);
        expect(updated.currentStatValues['stamina']).toBe(60);
      });
    });
  });
});
