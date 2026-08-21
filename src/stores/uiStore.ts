/**
 * UI Store
 *
 * Zustand store for managing application UI state.
 * Handles mode switching, dialog states, validation results, and roll history.
 *
 * **Validates: Requirements 19.3, 15.5**
 */

import { create } from 'zustand';
import type { ValidationReport } from '../engine/validator';
import type { RollOutcome } from '../types/formula';

/**
 * Application mode
 */
export type AppMode = 'config' | 'play';

/**
 * Dialog state
 *
 * Not exported (CR-39): it describes this store's own `dialogs` record and had no importer.
 */
interface DialogState {
  isOpen: boolean;
  type?: string;
  data?: unknown;
}

/**
 * Dice roll result for history tracking
 *
 * A `RollOutcome` straight from `engine/dice`, tagged with who rolled it. The roll's own shape is
 * not restated here — one dice-result shape exists in the codebase, not two.
 */
export interface RollResult extends RollOutcome {
  id: string;
  characterId: string;
  characterName: string;
}

/**
 * UI store state
 */
interface UIState {
  // Mode management
  mode: AppMode;
  setMode: (mode: AppMode) => void;

  // Dialog management
  dialogs: Record<string, DialogState>;
  openDialog: (dialogId: string, type?: string, data?: unknown) => void;
  closeDialog: (dialogId: string) => void;
  isDialogOpen: (dialogId: string) => boolean;
  getDialogData: (dialogId: string) => unknown;

  // Validation results
  validationReport: ValidationReport | null;
  setValidationReport: (report: ValidationReport | null) => void;
  clearValidationReport: () => void;

  // Roll history
  rollHistory: RollResult[];
  addRollResult: (result: RollResult) => void;
  clearRollHistory: () => void;
  getRollHistory: (characterId?: string) => RollResult[];
}

/**
 * UI store
 */
export const useUIStore = create<UIState>((set, get) => ({
  // Mode management
  mode: 'config',

  setMode: (mode: AppMode) => {
    set({ mode });
  },

  // Dialog management
  dialogs: {},

  openDialog: (dialogId: string, type?: string, data?: unknown) => {
    set((state) => ({
      dialogs: {
        ...state.dialogs,
        [dialogId]: {
          isOpen: true,
          type,
          data,
        },
      },
    }));
  },

  closeDialog: (dialogId: string) => {
    set((state) => ({
      dialogs: {
        ...state.dialogs,
        [dialogId]: {
          isOpen: false,
          type: state.dialogs[dialogId]?.type,
          data: state.dialogs[dialogId]?.data,
        },
      },
    }));
  },

  isDialogOpen: (dialogId: string) => {
    const { dialogs } = get();
    return dialogs[dialogId]?.isOpen ?? false;
  },

  getDialogData: (dialogId: string) => {
    const { dialogs } = get();
    return dialogs[dialogId]?.data;
  },

  // Validation results
  validationReport: null,

  setValidationReport: (report: ValidationReport | null) => {
    set({ validationReport: report });
  },

  clearValidationReport: () => {
    set({ validationReport: null });
  },

  // Roll history
  rollHistory: [],

  addRollResult: (result: RollResult) => {
    set((state) => ({
      rollHistory: [result, ...state.rollHistory],
    }));
  },

  clearRollHistory: () => {
    set({ rollHistory: [] });
  },

  getRollHistory: (characterId?: string) => {
    const { rollHistory } = get();
    if (!characterId) {
      return rollHistory;
    }
    return rollHistory.filter((roll) => roll.characterId === characterId);
  },
}));
