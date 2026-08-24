/**
 * UI Store
 *
 * Zustand store for managing application UI state.
 * Handles mode switching, dialog states, validation results, and roll history.
 *
 * **Validates: Requirements 19.3, 15.5**
 */

import { create } from 'zustand';
import type { ValidationReport } from '#shared/engine/validator';
import type { RollOutcome } from '#shared/types/formula';

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
 * A write to LocalStorage that did not land (CR-11)
 *
 * `services/storage.ts` has thrown `StorageQuotaError`/`StorageError` since Requirement 17.x, and
 * nothing anywhere caught either — so on a full LocalStorage every edit simply failed to persist,
 * with the exception escaping the store action into a React event handler and the User told
 * nothing. Session state about the app rather than about the ruleset, which is what this store is
 * for.
 *
 * Module-local: the banner reads it off the store and TypeScript infers, so exporting it would be
 * supported API nothing consumes (the CR-39 rule).
 */
interface StorageFailure {
  /** What the User is told, phrased for the banner */
  message: string;
  /** Whether the cause was the quota — the one case a User can actually act on */
  isQuota: boolean;
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

  /**
   * Storage failures (CR-11)
   *
   * The stores' `autoSave` helpers are the one place a write can fail, and they report here rather
   * than letting the throw escape. One failure at a time: a full LocalStorage fails every write
   * the same way, and a stack of identical banners would say nothing extra.
   */
  storageFailure: StorageFailure | null;
  /** Read the thrown error and put its meaning on screen */
  reportStorageFailure: (error: unknown) => void;
  /** The User acknowledging the banner; the next failed write brings it straight back */
  dismissStorageFailure: () => void;

  // Roll history
  rollHistory: RollResult[];
  addRollResult: (result: RollResult) => void;
  /**
   * Forget rolls — one character's, or every character's when no id is given
   *
   * Scoped since CR-06: the sheet's "Clear History" button sits beside a list filtered to one
   * character, and clearing more than the panel shows is a lie about what the button does. The
   * unscoped call is kept for a genuine "clear everything" and for `resetUI`.
   */
  clearRollHistory: (characterId?: string) => void;
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

  // Storage failures
  storageFailure: null,

  reportStorageFailure: (error: unknown) => {
    // Read by `name` rather than by `instanceof StorageQuotaError`, which would make this store
    // import the storage service to tell two messages apart — `storage.ts` recognises the
    // browser's own `QuotaExceededError` the same way
    const isQuota = error instanceof Error && error.name === 'StorageQuotaError';

    set({
      storageFailure: {
        isQuota,
        // Two different situations for the User: a full store they can free up, and a browser
        // that will not write at all. Both end the same way — the edit was refused rather than
        // half-applied, so what is on screen still matches what is stored.
        message: isQuota
          ? 'Your browser storage is full, so this change could not be saved and was not applied. Export your ruleset, free up some space, and try again.'
          : 'Your browser refused to save this change, so it was not applied. What you see still matches what is stored.',
      },
    });
  },

  dismissStorageFailure: () => {
    set({ storageFailure: null });
  },

  // Roll history
  rollHistory: [],

  addRollResult: (result: RollResult) => {
    set((state) => ({
      rollHistory: [result, ...state.rollHistory],
    }));
  },

  clearRollHistory: (characterId?: string) => {
    set((state) =>
      characterId === undefined
        ? { rollHistory: [] }
        : { rollHistory: state.rollHistory.filter((roll) => roll.characterId !== characterId) }
    );
  },

  getRollHistory: (characterId?: string) => {
    const { rollHistory } = get();
    if (!characterId) {
      return rollHistory;
    }
    return rollHistory.filter((roll) => roll.characterId === characterId);
  },
}));
