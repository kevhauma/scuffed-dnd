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
import { calculateRacialSkillModifiers } from '../../../engine/calculators/mainSkillCalculator';
import { describeFormulaError } from '../../../engine/formula/errors';
import type { MainSkillAllocationResult } from '../../../engine/skillAllocation';
import { validateMainSkillAllocation } from '../../../engine/skillAllocation';
import { useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';
import type {
  CalculatedCharacter,
  Character,
  CharacterCreationData,
} from '../../../types/character';

/**
 * The wizard's steps, in order — exposed to callers as the hook's `steps`
 */
const CREATION_STEPS = ['Identity', 'Skills', 'Focus', 'Review'] as const;

/**
 * The form's shape — `CharacterCreationData` with the optional focus code always present as a
 * string, so the select has something to bind to
 */
export interface CharacterCreationFormData {
  name: string;
  raceIds: string[];
  mainSkillLevels: Record<string, number>;
  specialitySkillBaseLevels: Record<string, number>;
  focusStatCode: string;
}

/**
 * Why the allocation step cannot be left, or null when it can
 *
 * Reads the engine's verdict; it does no arithmetic of its own.
 */
function allocationStepError(allocation: MainSkillAllocationResult | null): string | null {
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

  const bound = breach.reason === 'negative-level' ? 'below 0' : `above ${breach.maxLevel}`;
  return `${breach.skillName} cannot go ${bound}.`;
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
      mainSkillLevels: {},
      specialitySkillBaseLevels: {},
      focusStatCode: '',
    },
  });

  // Watching keeps every step's view in sync with values entered on the others
  const values = form.watch();

  const mainSkills = config?.mainSkills ?? [];
  const specialitySkills = config?.specialitySkills ?? [];
  const races = config?.races ?? [];

  const selectedRaces = races.filter((race) => values.raceIds.includes(race.id));

  /** Racial contribution per skill code, shown separately from the allocated base level */
  const racialModifiers = calculateRacialSkillModifiers(selectedRaces);

  /** Points spent, remaining, and any per-skill breach — from the engine, never re-summed here */
  const allocation: MainSkillAllocationResult | null = config
    ? validateMainSkillAllocation(values.mainSkillLevels, config)
    : null;

  const toggleRace = (raceId: string) => {
    const next = values.raceIds.includes(raceId)
      ? values.raceIds.filter((id) => id !== raceId)
      : [...values.raceIds, raceId];
    form.setValue('raceIds', next);
  };

  const setMainSkillLevel = (code: string, level: number) => {
    form.setValue('mainSkillLevels', { ...values.mainSkillLevels, [code]: level });
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
    mainSkillLevels: values.mainSkillLevels,
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
      currentStatValues: {},
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
    mainSkills,
    specialitySkills,
    races,
    racialModifiers,
    allocation,
    preview,
    previewError,
    toggleRace,
    setMainSkillLevel,
    setSpecialityBaseLevel,
    setFocusStatCode,
    handleNext,
    handleBack,
    handleCancel,
    handleConfirm,
  };
}
