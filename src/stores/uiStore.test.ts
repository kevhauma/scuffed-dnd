/**
 * UI Store Tests
 * 
 * Unit tests for the UI store managing application state.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from './uiStore';
import type { RollResult } from './uiStore';
import type { ValidationReport } from '../engine/validator';

describe('UIStore', () => {
  beforeEach(() => {
    // Reset store state
    useUIStore.setState({
      mode: 'config',
      dialogs: {},
      validationReport: null,
      rollHistory: [],
    });
  });
  
  describe('Mode Management', () => {
    it('should initialize with config mode', () => {
      expect(useUIStore.getState().mode).toBe('config');
    });
    
    it('should switch to play mode', () => {
      useUIStore.getState().setMode('play');
      expect(useUIStore.getState().mode).toBe('play');
    });
    
    it('should switch back to config mode', () => {
      useUIStore.getState().setMode('play');
      useUIStore.getState().setMode('config');
      expect(useUIStore.getState().mode).toBe('config');
    });
  });
  
  describe('Dialog Management', () => {
    describe('openDialog', () => {
      it('should open dialog without type or data', () => {
        useUIStore.getState().openDialog('test-dialog');
        
        expect(useUIStore.getState().isDialogOpen('test-dialog')).toBe(true);
      });
      
      it('should open dialog with type', () => {
        useUIStore.getState().openDialog('test-dialog', 'confirmation');
        
        const dialog = useUIStore.getState().dialogs['test-dialog'];
        expect(dialog.isOpen).toBe(true);
        expect(dialog.type).toBe('confirmation');
      });
      
      it('should open dialog with data', () => {
        const data = { message: 'Are you sure?' };
        useUIStore.getState().openDialog('test-dialog', 'confirmation', data);
        
        const dialog = useUIStore.getState().dialogs['test-dialog'];
        expect(dialog.isOpen).toBe(true);
        expect(dialog.data).toEqual(data);
      });
    });
    
    describe('closeDialog', () => {
      it('should close open dialog', () => {
        useUIStore.getState().openDialog('test-dialog');
        useUIStore.getState().closeDialog('test-dialog');
        
        expect(useUIStore.getState().isDialogOpen('test-dialog')).toBe(false);
      });
      
      it('should preserve dialog type and data when closing', () => {
        const data = { message: 'Test' };
        useUIStore.getState().openDialog('test-dialog', 'info', data);
        useUIStore.getState().closeDialog('test-dialog');
        
        const dialog = useUIStore.getState().dialogs['test-dialog'];
        expect(dialog.isOpen).toBe(false);
        expect(dialog.type).toBe('info');
        expect(dialog.data).toEqual(data);
      });
    });
    
    describe('isDialogOpen', () => {
      it('should return false for non-existent dialog', () => {
        expect(useUIStore.getState().isDialogOpen('non-existent')).toBe(false);
      });
      
      it('should return true for open dialog', () => {
        useUIStore.getState().openDialog('test-dialog');
        expect(useUIStore.getState().isDialogOpen('test-dialog')).toBe(true);
      });
      
      it('should return false for closed dialog', () => {
        useUIStore.getState().openDialog('test-dialog');
        useUIStore.getState().closeDialog('test-dialog');
        expect(useUIStore.getState().isDialogOpen('test-dialog')).toBe(false);
      });
    });
    
    describe('getDialogData', () => {
      it('should return undefined for non-existent dialog', () => {
        expect(useUIStore.getState().getDialogData('non-existent')).toBeUndefined();
      });
      
      it('should return dialog data', () => {
        const data = { message: 'Test message' };
        useUIStore.getState().openDialog('test-dialog', 'info', data);
        
        expect(useUIStore.getState().getDialogData('test-dialog')).toEqual(data);
      });
    });
  });
  
  describe('Validation Results', () => {
    it('should initialize with null validation report', () => {
      expect(useUIStore.getState().validationReport).toBeNull();
    });
    
    it('should set validation report', () => {
      const report: ValidationReport = {
        isValid: false,
        errors: [
          {
            severity: 'error',
            category: 'Formula Validation',
            message: 'Invalid formula',
          },
        ],
        warnings: [],
        timestamp: '2024-01-01T00:00:00.000Z',
      };
      
      useUIStore.getState().setValidationReport(report);
      
      expect(useUIStore.getState().validationReport).toEqual(report);
    });
    
    it('should clear validation report', () => {
      const report: ValidationReport = {
        isValid: true,
        errors: [],
        warnings: [],
        timestamp: '2024-01-01T00:00:00.000Z',
      };
      
      useUIStore.getState().setValidationReport(report);
      useUIStore.getState().clearValidationReport();
      
      expect(useUIStore.getState().validationReport).toBeNull();
    });
  });
  
  describe('Roll History', () => {
    const createRollResult = (overrides?: Partial<RollResult>): RollResult => ({
      id: 'roll-1',
      characterId: 'char-1',
      characterName: 'Test Character',
      skillCode: 'MEL',
      skillName: 'Melee',
      diceResults: { d20: [15], d6: [3, 4] },
      bonus: 5,
      total: 27,
      timestamp: '2024-01-01T00:00:00.000Z',
      ...overrides,
    });
    
    it('should initialize with empty roll history', () => {
      expect(useUIStore.getState().rollHistory).toEqual([]);
    });
    
    describe('addRollResult', () => {
      it('should add roll result to history', () => {
        const roll = createRollResult();
        useUIStore.getState().addRollResult(roll);
        
        expect(useUIStore.getState().rollHistory).toHaveLength(1);
        expect(useUIStore.getState().rollHistory[0]).toEqual(roll);
      });
      
      it('should add new rolls to the beginning of history', () => {
        const roll1 = createRollResult({ id: 'roll-1' });
        const roll2 = createRollResult({ id: 'roll-2' });
        
        useUIStore.getState().addRollResult(roll1);
        useUIStore.getState().addRollResult(roll2);
        
        expect(useUIStore.getState().rollHistory[0]).toEqual(roll2);
        expect(useUIStore.getState().rollHistory[1]).toEqual(roll1);
      });
    });
    
    describe('clearRollHistory', () => {
      it('should clear all roll history', () => {
        const roll = createRollResult();
        useUIStore.getState().addRollResult(roll);
        useUIStore.getState().clearRollHistory();
        
        expect(useUIStore.getState().rollHistory).toEqual([]);
      });
    });
    
    describe('getRollHistory', () => {
      it('should return all rolls when no character ID provided', () => {
        const roll1 = createRollResult({ id: 'roll-1', characterId: 'char-1' });
        const roll2 = createRollResult({ id: 'roll-2', characterId: 'char-2' });
        
        useUIStore.getState().addRollResult(roll1);
        useUIStore.getState().addRollResult(roll2);
        
        const history = useUIStore.getState().getRollHistory();
        expect(history).toHaveLength(2);
      });
      
      it('should filter rolls by character ID', () => {
        const roll1 = createRollResult({ id: 'roll-1', characterId: 'char-1' });
        const roll2 = createRollResult({ id: 'roll-2', characterId: 'char-2' });
        const roll3 = createRollResult({ id: 'roll-3', characterId: 'char-1' });
        
        useUIStore.getState().addRollResult(roll1);
        useUIStore.getState().addRollResult(roll2);
        useUIStore.getState().addRollResult(roll3);
        
        const history = useUIStore.getState().getRollHistory('char-1');
        expect(history).toHaveLength(2);
        expect(history[0].id).toBe('roll-3');
        expect(history[1].id).toBe('roll-1');
      });
      
      it('should return empty array for character with no rolls', () => {
        const roll = createRollResult({ characterId: 'char-1' });
        useUIStore.getState().addRollResult(roll);
        
        const history = useUIStore.getState().getRollHistory('char-2');
        expect(history).toEqual([]);
      });
    });
  });
});
