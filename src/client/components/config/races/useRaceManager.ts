/**
 * Race Manager Hook
 *
 * Manages race CRUD operations and form state, plus the two creature reference lists a race's
 * identity is picked from (v4 systems/14, TICKET-RACE-03).
 *
 * **The one reader of `Race.challengeRate` in the app.** The field is stored because the workbook
 * has it and is built on nothing — no engine term, no sheet, not even the race card — so it travels
 * from the ruleset into this form and back, and `challengeRate.test.ts` beside this file fails if a
 * second module ever names it. That is the guard the ticket's "built on nothing" is made of.
 *
 * **Validates: Requirements 8.1, 8.2**
 */

import { useForm } from 'react-hook-form';
import type { Race } from '#shared/types';
import { useConfigStore } from '../../../stores/configStore';
import { useEntityDialog } from '../shared/useEntityDialog';
import { useGuardedDelete } from '../shared/useGuardedDelete';

export interface RaceFormData {
  name: string;
  description: string;
  /** Absolute value per stat id (TICKET-RACE-01) */
  statValues: Record<string, number>;
  /** A word from the ruleset's `creatureTypes`, or `''` for "says nothing" */
  type: string;
  /** A word from the ruleset's `creatureSizes`, or `''` for "says nothing" */
  size: string;
  /**
   * The sheet's challenge rate, as the text the number box holds
   *
   * A string rather than a `valueAsNumber` field because "" has to survive the round trip as
   * *absent*, and a cleared numeric input arrives as `NaN` — which is a number as far as `??` is
   * concerned, and would store one.
   */
  challengeRate: string;
}

/** The form value standing for "this race says nothing about that" */
const UNSTATED = '';

/**
 * A stored optional string as the form holds it, and back again
 *
 * Two one-liners rather than a shared helper: absence is spelled `''` in a `<select>` and
 * `undefined` in the document, and the translation happens at exactly these two points.
 */
function toFormValue(stored: string | undefined): string {
  return stored ?? UNSTATED;
}

function toStoredValue(entered: string): string | undefined {
  const trimmed = entered.trim();
  return trimmed === UNSTATED ? undefined : trimmed;
}

/**
 * The challenge rate as the document stores it
 *
 * Blank is absent; anything that is not a finite number is treated as blank rather than written,
 * because a `NaN` in a persisted numeric field is a value nothing downstream can read back.
 */
function toStoredChallengeRate(entered: string): number | undefined {
  const trimmed = entered.trim();
  if (trimmed === UNSTATED) return undefined;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function useRaceManager() {
  const config = useConfigStore((state) => state.config);
  const addRace = useConfigStore((state) => state.addRace);
  const updateRace = useConfigStore((state) => state.updateRace);
  const deleteRace = useConfigStore((state) => state.deleteRace);
  const setCreatureSizes = useConfigStore((state) => state.setCreatureSizes);
  const setCreatureTypes = useConfigStore((state) => state.setCreatureTypes);

  const { blocked, attemptDelete, dismissBlocked } = useGuardedDelete();

  const form = useForm<RaceFormData>({
    defaultValues: {
      name: '',
      description: '',
      statValues: {},
      type: UNSTATED,
      size: UNSTATED,
      challengeRate: UNSTATED,
    },
  });
  const dialog = useEntityDialog(form);

  const currentRaces = config?.races || [];
  // A race's stat block has one row per configured stat, in the User's display order — so a stat
  // added to the ruleset grows every block rather than leaving a race half-defined (TICKET-RACE-01)
  const availableStats = [...(config?.stats ?? [])].sort((a, b) => a.order - b.order);

  // Absent means none, so a ruleset that never named a vocabulary reads as an empty one here
  const creatureSizes = config?.creatureSizes ?? [];
  const creatureTypes = config?.creatureTypes ?? [];

  /** A block covering every configured stat, defaulting a stat the race says nothing about to 0 */
  const blockFor = (race?: Race): Record<string, number> =>
    Object.fromEntries(availableStats.map((stat) => [stat.id, race?.statValues[stat.id] ?? 0]));

  const handleAdd = () => {
    dialog.openForAdd({
      name: '',
      description: '',
      statValues: blockFor(),
      type: UNSTATED,
      size: UNSTATED,
      challengeRate: UNSTATED,
    });
  };

  const handleEdit = (id: string) => {
    const race = currentRaces.find((r) => r.id === id);
    if (!race) return;

    const storedRate = race.challengeRate;

    dialog.openForEdit(id, {
      name: race.name,
      description: race.description,
      statValues: blockFor(race),
      type: toFormValue(race.type),
      size: toFormValue(race.size),
      challengeRate: storedRate === undefined ? UNSTATED : String(storedRate),
    });
  };

  const handleDelete = (id: string) => {
    const race = config?.races.find((candidate) => candidate.id === id);
    attemptDelete(`Race ${race?.name ?? id}`, (options) => deleteRace(id, options));
  };

  const handleSave = form.handleSubmit((data) => {
    const race: Race = {
      id: dialog.editingId || crypto.randomUUID(),
      name: data.name,
      description: data.description,
      // Read against the ruleset as it stands at *save* time, not as it stood when the dialog
      // opened, so a stat added while the editor was open is picked up rather than dropped.
      //
      // Zeros are pruned: absent reads 0, so a dense block says nothing extra — and a stored zero
      // is not harmless, because it would read as a reference and make `deleteStat` refuse for
      // every stat every race has ever been saved over. Sparse is also the form the sheet
      // fragment writes, so the two agree.
      // A cleared `valueAsNumber` field arrives as NaN, which is a number as far as `??` is
      // concerned — so the guard is `isFinite`, not nullishness
      statValues: Object.fromEntries(
        availableStats
          .map((stat) => {
            const value = data.statValues[stat.id];
            return [stat.id, Number.isFinite(value) ? value : 0] as const;
          })
          .filter(([, value]) => value !== 0)
      ),
      // The three identity fields, each cleared by being left blank. `updateRace` merges through
      // `mergeClearingAbsent`, so an explicit `undefined` here **removes** the key rather than
      // storing it empty — which is what keeps a race that says nothing about its kind identical
      // to one written before the fields existed (TICKET-RACE-03).
      type: toStoredValue(data.type),
      size: toStoredValue(data.size),
      challengeRate: toStoredChallengeRate(data.challengeRate),
    };

    if (dialog.editingId) {
      updateRace(dialog.editingId, race);
    } else {
      addRace(race);
    }

    dialog.close();
  });

  return {
    blocked,
    dismissBlocked,
    config,
    currentRaces,
    availableStats,
    creatureSizes,
    creatureTypes,
    setCreatureSizes,
    setCreatureTypes,
    isDialogOpen: dialog.isOpen,
    closeDialog: dialog.close,
    editingRaceId: dialog.editingId,
    form,
    handleAdd,
    handleEdit,
    handleDelete,
    handleSave,
  };
}
