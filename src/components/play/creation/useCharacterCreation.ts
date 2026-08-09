/**
 * Character Creation Hook
 *
 * Owns the wizard: step index, form state, per-step validation, the derived preview, and the
 * submit. The step components are presentational.
 *
 * **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6**
 */

import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { calculateCharacter, firstCalculationError } from '../../../engine/calculator';
import { calculateRaceStatBases } from '../../../engine/calculators/statCalculator';
import { describeFormulaError } from '../../../engine/formula/errors';
import type { StatAllocationResult } from '../../../engine/skillAllocation';
import { validateStatAllocation } from '../../../engine/skillAllocation';
import { useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';
import type {
  CalculatedCharacter,
  Character,
  CharacterCreationData,
} from '../../../types/character';
import type { Stat } from '../../../types/config';
import type { DerivedValue } from '../shared/derivedValue';
import { toDerivedValue } from '../shared/derivedValue';

/**
 * The wizard's steps, in order — exposed to callers as the hook's `steps`
 */
const CREATION_STEPS = ['Identity', 'Stats', 'Focus', 'Review'] as const;

/**
 * One derived stat as the allocation step shows it: the stat, and the value it currently computes
 * to — or the error standing in for it, so a broken ruleset chips one row rather than the step
 */
export interface DerivedStatPreview {
  stat: Stat;
  value: DerivedValue;
}

/**
 * The form's shape — `CharacterCreationData` with the optional focus code always present as a
 * string, so the select has something to bind to
 */
export interface CharacterCreationFormData {
  name: string;
  raceIds: string[];
  investedStatPoints: Record<string, number>;
  specialitySkillBaseLevels: Record<string, number>;
  focusStatCode: string;
}

/**
 * Why the allocation step cannot be left, or null when it can
 *
 * Reads the engine's verdict; it does no arithmetic of its own.
 */
function allocationStepError(allocation: StatAllocationResult | null): string | null {
  if (!allocation || allocation.isValid) {
    return null;
  }

  if (allocation.isOverBudget) {
    const over = Math.abs(allocation.pointsRemaining ?? 0);
    return `That is ${over} point(s) over the budget of ${allocation.pointBudget}.`;
  }

  const breach = allocation.violations[0];
  if (!breach) {
    return 'Adjust the allocation before continuing.';
  }

  return breach.reason === 'negative-points'
    ? `${breach.statName} cannot go below 0.`
    : `${breach.statName} is derived from a formula, so it takes no points.`;
}

export function useCharacterCreation() {
  const navigate = useNavigate();

  const config = useConfigStore((state) => state.config);
  const createCharacter = useCharacterStore((state) => state.createCharacter);

  const [stepIndex, setStepIndex] = useState(0);

  const form = useForm<CharacterCreationFormData>({
    defaultValues: {
      name: '',
      raceIds: [],
      investedStatPoints: {},
      specialitySkillBaseLevels: {},
      focusStatCode: '',
    },
  });

  // Watching keeps every step's view in sync with values entered on the others
  const values = form.watch();

  /** Every stat in the order the User arranged them in the stats panel (TICKET-STAT-03) */
  const stats = [...(config?.stats ?? [])].sort((a, b) => a.order - b.order);

  // Only invested stats take points; a derived one computes its own value (TICKET-STAT-01)
  const investableStats = stats.filter((stat) => stat.formula === undefined);
  const derivedStats = stats.filter((stat) => stat.formula !== undefined);
  const specialitySkills = config?.specialitySkills ?? [];
  const races = config?.races ?? [];

  const selectedRaces = races.filter((race) => values.raceIds.includes(race.id));

  /** What the chosen races supply, per stat id — shown separately from the invested points */
  const raceBases = calculateRaceStatBases(selectedRaces);

  /** Points spent, remaining, and any per-skill breach — from the engine, never re-summed here */
  const allocation: StatAllocationResult | null = config
    ? validateStatAllocation(values.investedStatPoints, config)
    : null;

  const toggleRace = (raceId: string) => {
    const next = values.raceIds.includes(raceId)
      ? values.raceIds.filter((id) => id !== raceId)
      : [...values.raceIds, raceId];
    form.setValue('raceIds', next);
  };

  const setInvestedStatPoints = (statId: string, points: number) => {
    form.setValue('investedStatPoints', { ...values.investedStatPoints, [statId]: points });
  };

  const setSpecialityBaseLevel = (code: string, level: number) => {
    form.setValue('specialitySkillBaseLevels', {
      ...values.specialitySkillBaseLevels,
      [code]: level,
    });
  };

  const setFocusStatCode = (code: string) => {
    form.setValue('focusStatCode', code);
  };

  /** The creation data as it stands, for preview and submit */
  const creationData: CharacterCreationData = {
    name: values.name.trim(),
    raceIds: values.raceIds,
    investedStatPoints: values.investedStatPoints,
    specialitySkillBaseLevels: values.specialitySkillBaseLevels,
    focusStatCode: values.focusStatCode || undefined,
  };

  /**
   * The review step's numbers, from the one composed calculator — the wizard does no arithmetic
   */
  const preview: CalculatedCharacter | null = (() => {
    if (!config) return null;
    const draft: Character = {
      id: 'preview',
      configurationId: config.id,
      currentResourceValues: {},
      inventory: { equippedItems: {}, miscItems: [] },
      createdAt: '',
      updatedAt: '',
      ...creationData,
    };
    try {
      return calculateCharacter(draft, config);
    } catch {
      // Only a genuine engine bug reaches here — ruleset problems come back as error values
      // inside the result and are reported through `previewError` below.
      return null;
    }
  })();

  /**
   * Why the preview cannot be trusted, or null when every derived value is a number
   *
   * Since TICKET-FORM-05 a broken formula no longer throws, so without this check the review
   * step would render a confident `0` for it. The Player can still finish the wizard — they just
   * get told the ruleset needs fixing first.
   */
  const previewError: string | null = (() => {
    if (!preview) return null;
    const broken = firstCalculationError(preview);
    return broken ? describeFormulaError(broken) : null;
  })();

  /**
   * The derived stats as the allocation step shows them — read-only, and moving as points do
   *
   * Read straight off the same composed preview the review step uses, so the number a Player
   * watches while allocating is the number they end up with (TICKET-STAT-03).
   *
   * A **null** preview means `calculateCharacter` threw, which is the one case
   * `toDerivedValue(undefined)`'s "absence reads as 0" would get wrong: nothing is absent, the
   * whole calculation failed. Each row says so instead of showing a confident zero — the same
   * reasoning `previewError` applies to the review step.
   */
  const derivedStatPreviews: DerivedStatPreview[] = derivedStats.map((stat) => ({
    stat,
    value: preview
      ? toDerivedValue(preview.statValues[stat.id])
      : { value: null, error: 'The derived values cannot be calculated for this ruleset.' },
  }));

  /** Why the current step cannot be left, or null when it can */
  const stepErrorsByStep: Record<number, string | null> = {
    0: creationData.name === '' ? 'Give your character a name before continuing.' : null,
    1: allocationStepError(allocation),
  };
  const stepError = stepErrorsByStep[stepIndex] ?? null;

  const canGoNext = stepError === null && stepIndex < CREATION_STEPS.length - 1;
  const canGoBack = stepIndex > 0;

  const handleNext = () => {
    if (stepError !== null) return;
    setStepIndex((index) => Math.min(index + 1, CREATION_STEPS.length - 1));
  };

  const handleBack = () => {
    setStepIndex((index) => Math.max(index - 1, 0));
  };

  const handleCancel = () => {
    navigate({ to: '/play' });
  };

  const handleConfirm = () => {
    if (!config || stepError !== null) return;

    // Persistence belongs to the store action
    const character = createCharacter(creationData, config);
    navigate({ to: '/play/character/$id', params: { id: character.id } });
  };

  return {
    config,
    hasConfiguration: config !== null,
    form,
    values,
    stepIndex,
    step: CREATION_STEPS[stepIndex],
    steps: CREATION_STEPS,
    stepError,
    canGoNext,
    canGoBack,
    isLastStep: stepIndex === CREATION_STEPS.length - 1,
    stats,
    investableStats,
    derivedStatPreviews,
    specialitySkills,
    races,
    raceBases,
    allocation,
    preview,
    previewError,
    toggleRace,
    setInvestedStatPoints,
    setSpecialityBaseLevel,
    setFocusStatCode,
    handleNext,
    handleBack,
    handleCancel,
    handleConfirm,
  };
}
