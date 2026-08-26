/**
 * Character Creation Hook
 *
 * Owns the wizard: step index, form state, per-step validation, the derived preview, and the
 * submit. The step components are presentational.
 *
 * **Validates: Concept 03; Requirements 11.1, 11.2, 11.3, 11.5, 11.6**
 *
 * (Requirement 11.4 — "select a Focus_Stat" — is dropped rather than left claiming: TICKET-ARC-03
 * retired the focus stat and the archetype step replaces it. Nothing implements 11.4 now.)
 */

import { useNavigate } from '@tanstack/react-router';
import { useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { calculateCharacter, firstCalculationError } from '#shared/engine/calculator';
import { calculateRaceStatBases, MAX_RACE_COUNT } from '#shared/engine/calculators/statCalculator';
import { describeFormulaError } from '#shared/engine/formula/errors';
import type { StatAllocationResult } from '#shared/engine/skillAllocation';
import { validateStatAllocation } from '#shared/engine/skillAllocation';
import type {
  CalculatedCharacter,
  Character,
  CharacterCreationData,
} from '#shared/types/character';
import type { Stat } from '#shared/types/config';
import { useConfigStore } from '../../../stores/configStore';
import type { DerivedValue } from '../shared/derivedValue';
import { toDerivedValue } from '../shared/derivedValue';
import type { PointBudgetView } from '../shared/pointBudgetView';
import { toPointBudgetView } from '../shared/pointBudgetView';
import { useCharacterSubmit } from './useCharacterSubmit';

/**
 * The wizard's steps, in order — exposed to callers as the hook's `steps`
 */
const CREATION_STEPS = ['Identity', 'Archetype', 'Stats', 'Review'] as const;

/**
 * The choices the engine reads — everything a Player picks that changes a number
 *
 * Deliberately **not** the character's name: nothing derived depends on it, and it is the field
 * being typed into most (CR-14).
 */
interface EngineInputs {
  raceIds: string[];
  investedStatPoints: Record<string, number>;
  investedSkillPoints: Record<string, number>;
  archetypeId?: string;
}

/**
 * Hold a value stable across renders for as long as its *content* is unchanged
 *
 * react-hook-form hands back a fresh object from every `watch()`, nested records included, so a
 * dependency array holding them compares unequal on every render and a `useMemo` keyed on them
 * never hits. Comparing content is what lets the expensive memos below actually memoise (CR-14).
 *
 * Serialising is the comparison because these are small plain records of primitives — five fields,
 * against a full evaluation of every stat formula, curve lookup and skill in the ruleset.
 *
 * @param value - The freshly built value
 * @returns The same value, or the previous one when nothing in it changed
 */
function useContentStable<T>(value: T): T {
  const held = useRef<{ key: string; value: T } | null>(null);
  const key = JSON.stringify(value);

  if (held.current === null || held.current.key !== key) {
    held.current = { key, value };
  }

  return held.current.value;
}

/**
 * One derived stat as the allocation step shows it: the stat, and the value it currently computes
 * to — or the error standing in for it, so a broken ruleset chips one row rather than the step
 */
export interface DerivedStatPreview {
  stat: Stat;
  value: DerivedValue;
}

/**
 * The form's shape — `CharacterCreationData` with the optional archetype id always present as a
 * string, so the step has something to bind to before a pick is made
 */
export interface CharacterCreationFormData {
  name: string;
  raceIds: string[];
  investedStatPoints: Record<string, number>;
  investedSkillPoints: Record<string, number>;
  /** Empty until the Player picks one — the form binds a string, the character stores an id */
  archetypeId: string;
}

/**
 * Why the allocation step cannot be left, or null when it can
 *
 * Reads the engine's verdict; it does no arithmetic of its own.
 */
function allocationStepError(
  allocation: StatAllocationResult | null,
  budget: PointBudgetView | null
): string | null {
  if (!allocation || !budget || allocation.isValid) {
    return null;
  }

  // A budget that could not be derived is the first thing to say: every other number on the step
  // is priced against it, so reporting a violation instead would be answering the wrong question
  if (budget.pointBudget.error !== null) {
    return `This ruleset cannot say how many points you have: ${budget.pointBudget.error}`;
  }

  if (allocation.isOverBudget) {
    const over = Math.abs(budget.pointsRemaining.value ?? 0);
    return `That is ${over} point(s) over the budget of ${budget.pointBudget.value}.`;
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
  // Which ruleset is open, and therefore where a character built against it goes. Read here and
  // handed on; the wizard never decides it — see `useCharacterSubmit`.
  const source = useConfigStore((state) => state.source);
  const submission = useCharacterSubmit(source);

  const [stepIndex, setStepIndex] = useState(0);

  const form = useForm<CharacterCreationFormData>({
    defaultValues: {
      name: '',
      raceIds: [],
      investedStatPoints: {},
      investedSkillPoints: {},
      archetypeId: '',
    },
  });

  // Watching keeps every step's view in sync with values entered on the others
  const values = form.watch();

  /** Every stat in the order the User arranged them in the stats panel (TICKET-STAT-03) */
  const stats = [...(config?.stats ?? [])].sort((a, b) => a.order - b.order);

  // Only invested stats take points; a derived one computes its own value (TICKET-STAT-01)
  const investableStats = stats.filter((stat) => stat.formula === undefined);
  const derivedStats = stats.filter((stat) => stat.formula !== undefined);
  const skills = config?.skills ?? [];
  const races = config?.races ?? [];
  const archetypes = config?.archetypes ?? [];

  /**
   * The choices the engine reads, stable while their content is (CR-14)
   *
   * Everything below that costs anything is keyed on this rather than on the form's values, so
   * typing the character's name on step 0 no longer re-runs the whole ruleset.
   */
  const engineInputs = useContentStable<EngineInputs>({
    raceIds: values.raceIds,
    investedStatPoints: values.investedStatPoints,
    investedSkillPoints: values.investedSkillPoints,
    archetypeId: values.archetypeId || undefined,
  });

  const selectedRaces = useMemo(
    () => (config?.races ?? []).filter((race) => engineInputs.raceIds.includes(race.id)),
    [config, engineInputs]
  );

  // Named here rather than in the wizard's JSX: the review step renders what the Player chose, and
  // "which archetype is `archetypeId`" is a lookup against the ruleset — the hook's job, not a
  // panel's (conventions: panels don't hold logic)
  const selectedRaceNames = selectedRaces.map((race) => race.name);
  const selectedArchetypeName = archetypes.find(
    (archetype) => archetype.id === values.archetypeId
  )?.name;

  /**
   * What the chosen races supply, per stat id — shown separately from the invested points
   *
   * The blend, since TICKET-RACE-02, so what the allocation step shows beside each stat is what
   * the created character will actually have.
   */
  const raceBases = useMemo(
    () => calculateRaceStatBases(selectedRaces, config?.constants),
    [config, selectedRaces]
  );

  /** The creation data as it stands, for validation, preview and submit */
  const creationData: CharacterCreationData = { name: values.name.trim(), ...engineInputs };

  /**
   * The character as it would be saved — the one draft the validator, the preview and the derived
   * stats all read, so the budget the Player allocates against is the budget their saved character
   * will have. Experience is 0, like the one the store will mint, which is what makes creation
   * validate against level-at-XP-0's budget (TICKET-RES-02).
   *
   * The name is left empty rather than carried: nothing the engine computes reads it, and putting
   * it here would key every memo below on the field a Player types into (CR-14). What gets saved
   * is `creationData`, which has it.
   */
  const draftCharacter: Character | null = useMemo(
    () =>
      config
        ? {
            id: 'preview',
            name: '',
            configurationId: config.id,
            currentResourceValues: {},
            experience: 0,
            inventory: { equippedItems: {}, miscItems: [] },
            createdAt: '',
            updatedAt: '',
            ...engineInputs,
          }
        : null,
    [config, engineInputs]
  );

  /** Points spent, remaining, and any per-stat breach — from the engine, never re-summed here */
  const allocation: StatAllocationResult | null = useMemo(
    () => (config && draftCharacter ? validateStatAllocation(draftCharacter, config) : null),
    [config, draftCharacter]
  );

  /** The same verdict, spelled for the step: a number or the chip standing in for it */
  const budget = toPointBudgetView(allocation);

  /**
   * What each stat's points bought, keyed by stat id (TICKET-ARC-02)
   *
   * Straight off the validator's `gains`, so the step renders the archetype's exchange rate rather
   * than adding points to a race base itself — which was right only while the term was 1:1.
   */
  const gains: Record<string, DerivedValue> = Object.fromEntries(
    (allocation?.gains ?? []).map((row) => [row.statId, toDerivedValue(row.gain)])
  );

  /** Whether another race can still be added — the blend is defined over at most two (RACE-02) */
  const canAddRace = values.raceIds.length < MAX_RACE_COUNT;

  const toggleRace = (raceId: string) => {
    if (values.raceIds.includes(raceId)) {
      form.setValue(
        'raceIds',
        values.raceIds.filter((id) => id !== raceId)
      );
      return;
    }

    // Refused rather than silently swapping one out: which of the two to drop is the Player's
    // decision, and the step disables the remaining boxes so this is only ever the last line
    if (!canAddRace) return;

    form.setValue('raceIds', [...values.raceIds, raceId]);
  };

  const setInvestedStatPoints = (statId: string, points: number) => {
    form.setValue('investedStatPoints', { ...values.investedStatPoints, [statId]: points });
  };

  const setInvestedSkillPoints = (skillId: string, points: number) => {
    form.setValue('investedSkillPoints', {
      ...values.investedSkillPoints,
      [skillId]: points,
    });
  };

  const setArchetypeId = (archetypeId: string) => {
    form.setValue('archetypeId', archetypeId);
  };

  /**
   * The review step's numbers, from the one composed calculator — the wizard does no arithmetic
   */
  const preview: CalculatedCharacter | null = useMemo(() => {
    if (!config || !draftCharacter) return null;
    try {
      return calculateCharacter(draftCharacter, config);
    } catch {
      // Only a genuine engine bug reaches here — ruleset problems come back as error values
      // inside the result and are reported through `previewError` below.
      return null;
    }
  }, [config, draftCharacter]);

  /**
   * Why the preview cannot be trusted, or null when every derived value is a number
   *
   * Since TICKET-FORM-05 a broken formula no longer throws, so without this check the review
   * step would render a confident `0` for it. The Player can still finish the wizard — they just
   * get told the ruleset needs fixing first.
   */
  const previewError: string | null = useMemo(() => {
    if (!preview) return null;
    const broken = firstCalculationError(preview);
    return broken ? describeFormulaError(broken) : null;
  }, [preview]);

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

  /**
   * Why the identity step cannot be left, or null when it can
   *
   * The race count is checked as well as the name, even though `toggleRace` and the step's
   * disabled boxes already make a third race unreachable. `characterStore.createCharacter` refuses
   * that data by returning `null`, and a Submit that silently does nothing is the worst way for
   * the two limits to drift apart — this is where the Player would be told, at the step that owns
   * the choice rather than three steps later.
   */
  const identityStepError = (): string | null => {
    if (creationData.name === '') return 'Give your character a name before continuing.';
    if (values.raceIds.length > MAX_RACE_COUNT)
      return `A character blends at most ${MAX_RACE_COUNT} races.`;
    return null;
  };

  /**
   * Why the archetype step cannot be left, or null when it can
   *
   * **Required only when the ruleset offers a choice.** A ruleset may define no archetypes, the
   * same way TICKET-RACE-02 kept a raceless character legal — blocking the wizard there would make
   * such a ruleset unplayable to enforce a rule about rulesets that have archetypes.
   */
  const archetypeStepError = (): string | null => {
    if (archetypes.length === 0) return null;
    if (values.archetypeId === '') return 'Pick an archetype before continuing.';
    return null;
  };

  /** Why the current step cannot be left, or null when it can */
  const stepErrorsByStep: Record<number, string | null> = {
    0: identityStepError(),
    1: archetypeStepError(),
    2: allocationStepError(allocation, budget),
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

  /**
   * Submit, to whichever home the open ruleset lives in (TICKET-CHAR-04)
   *
   * **One wizard, two destinations**, and the wizard does not know which — that whole half is
   * [`useCharacterSubmit`](./useCharacterSubmit.ts). What is left here is the guard the *steps* own:
   * a wizard with a step error or no ruleset has nothing to submit.
   */
  const handleConfirm = () => {
    if (!config || stepError !== null) return;

    submission.submit(creationData, config);
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
    skills,
    races,
    raceBases,
    canAddRace,
    maxRaceCount: MAX_RACE_COUNT,
    // `allocation` stays local: the step renders `budget`, and re-exporting the raw engine result
    // through the play barrel would offer supported API nothing consumes
    budget,
    gains,
    preview,
    previewError,
    toggleRace,
    setInvestedStatPoints,
    setInvestedSkillPoints,
    setArchetypeId,
    archetypes,
    selectedRaceNames,
    selectedArchetypeName,
    handleNext,
    handleBack,
    handleCancel,
    handleConfirm,
    /** True while a submit is on the wire — the session path is a request (TICKET-CHAR-04) */
    isSubmitting: submission.isSubmitting,
    /** Why the last submit was refused, in the server's own words where there is one */
    submitError: submission.submitError,
  };
}
