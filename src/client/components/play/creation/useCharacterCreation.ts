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
import { calculateRaceStatBases } from '#shared/engine/calculators/statCalculator';
import { focusDials, toFocusSlots } from '#shared/engine/focusSkills';
import { describeFormulaError } from '#shared/engine/formula/errors';
import { racesRequired, resolveRaces } from '#shared/engine/races';
import type { StatAllocationResult } from '#shared/engine/skillAllocation';
import { validateStatAllocation } from '#shared/engine/skillAllocation';
import type {
  CalculatedCharacter,
  Character,
  CharacterCreationData,
} from '#shared/types/character';
import type { Configuration, Stat } from '#shared/types/config';
import { useConfigStore } from '../../../stores/configStore';
import type { DerivedValue } from '../shared/derivedValue';
import { toDerivedValue } from '../shared/derivedValue';
import type { PointBudgetView } from '../shared/pointBudgetView';
import { toPointBudgetView } from '../shared/pointBudgetView';
import { useCharacterSubmit } from './useCharacterSubmit';

/**
 * The wizard's steps, in order — exposed to callers as the hook's `steps`
 */
const CREATION_STEPS = ['Identity', 'Archetype', 'Stats', 'Focus', 'Review'] as const;

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
  /** The three Setup picks, empties left out — they multiply every skill (TICKET-SKL-05) */
  focusSkillIds: string[];
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
  /** One entry per focus slot, `''` for an unfilled one — the *form's* shape (TICKET-SKL-05) */
  focusSkillIds: string[];
}

/**
 * Which box is wrong and why, or null when the verdict names no single one
 *
 * The **per-entry** half of the step's refusal, split off from {@link allocationStepError} at
 * TICKET-RES-05 — which is when there stopped being one violation list to read. The two halves ask
 * different questions: this one is *whose box*, the caller is *is the pool the problem*, and keeping
 * them in one body took that function over `fallow`'s complexity threshold the moment the skills
 * arm landed.
 *
 * Stats before skills only because the stat boxes are where a Player spends most of a budget. The
 * wording mirrors `characterCreation.ts`'s `allocationRefusal`, deliberately: the server refusing
 * the identical character has to say the identical thing, and a generic *"adjust the allocation"*
 * here against *"Stealth cannot take those points"* there is two surfaces of one verdict
 * disagreeing.
 *
 * @param allocation The engine's verdict
 * @returns The sentence, or null when nothing in either list is at fault
 */
function entryBreachError(allocation: StatAllocationResult): string | null {
  const breach = allocation.violations[0];

  if (breach) {
    return breach.reason === 'negative-points'
      ? `${breach.statName} cannot go below 0.`
      : `${breach.statName} is derived from a formula, so it takes no points.`;
  }

  const skillBreach = allocation.skillViolations[0];

  if (skillBreach) {
    return `${skillBreach.skillName} cannot go below 0.`;
  }

  return null;
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

  const breach = entryBreachError(allocation);

  return breach ?? 'Adjust the allocation before continuing.';
}

/**
 * One entry per race slot the ruleset asks for — a race id, or `''` for an unfilled one
 *
 * **The slots themselves rather than only the picks** (TICKET-RACE-04): the form field holds the
 * empty ones too, so a Player who fills the second slot first does not have their choice slide into
 * the first, and a slot may legitimately repeat what another holds — which is how a pure-blood is
 * written now that `Empty` is retired.
 *
 * Outside the hook because it is a pure function of the ruleset and the picks, and because the
 * hook's body is the tree `fallow` measures.
 *
 * @param config The open ruleset, or null before one is loaded
 * @param picked What the form holds, which may be shorter than the ruleset asks for
 * @returns One entry per slot
 */
function raceSlotsFor(config: Configuration | null, picked: string[]): string[] {
  const required = config === null ? 0 : racesRequired(config);

  return Array.from({ length: required }, (_, index) => picked[index] ?? '');
}

/**
 * Everything the focus step needs, read off the ruleset and the picks (TICKET-SKL-05)
 *
 * One value rather than four bindings in the hook body, for `raceSlotsFor`'s reason: the hook's body
 * is the tree `fallow` measures, and every one of these is a pure function of two things it already
 * has. The whole focus half of the wizard's state is one call and one destructure.
 */
interface FocusStepState {
  /** One entry per slot, `''` where nothing is picked — what the step renders */
  slots: string[];
  /** The filled slots, duplicates kept — what the character is created with */
  chosen: string[];
  /** Whether the ruleset states either dial — the step's caption reads it */
  isDialled: boolean;
  /** Whether this ruleset asks for picks at all: it states a dial *and* it has skills to pick */
  isAsked: boolean;
}

/**
 * Read the focus half of the wizard's state
 *
 * @param config The open ruleset, or null before one is loaded
 * @param picked What the form holds, which may be shorter than the slot count
 * @returns The slots, the picks, and whether this ruleset asks for any
 */
function focusStateFor(config: Configuration | null, picked: string[]): FocusStepState {
  const slots = toFocusSlots(picked);
  const chosen = slots.filter((skillId) => skillId !== '');
  const dials = focusDials(config?.constants);
  const skills = config?.skills ?? [];

  return { slots, chosen, isDialled: dials.stated, isAsked: dials.stated && skills.length > 0 };
}

/**
 * Why the focus step cannot be left, or null when it can (TICKET-SKL-05)
 *
 * **All three slots, and only when the ruleset asks for them** — the archetype step's rule, and
 * `characterCreation.ts`'s `focusErrors` is where it actually lives, so the step and the server
 * **refuse the same character**. Not in the same words, deliberately: this one counts the slots the
 * Player is looking at (*"3 focus skills — 1 chosen"*) where the Kernel, which has no step in front
 * of it, states the rule (*"A character in this ruleset names 3 focus skills."*). Whether a character
 * is legal is one answer; how it is worded belongs to the surface saying it. A ruleset that states
 * neither focus dial multiplies
 * everything by 1, so demanding three picks that change nothing would be a rule a Player cannot act
 * on; a ruleset with no skills has nothing to pick either. Both of those are `isAsked`.
 *
 * Outside the hook for `raceSlotsFor`'s reason — the hook's body is the tree `fallow` measures, and
 * this is a pure function of three values it already has.
 *
 * @param slots The pickers the step is rendering
 * @param chosen The filled ones, duplicates kept
 * @param isAsked Whether this ruleset asks for focus picks at all
 * @returns The sentence, or null when the step may be left
 */
function focusStepError(slots: string[], chosen: string[], isAsked: boolean): string | null {
  if (!isAsked || chosen.length === slots.length) return null;

  return `This ruleset asks a character to name ${slots.length} focus skills — ${chosen.length} chosen.`;
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
      focusSkillIds: [],
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

  /** One slot per race the ruleset asks for, holding what has been picked into it so far */
  const raceSlots = raceSlotsFor(config, values.raceIds);

  /** The filled slots, in slot order and duplicates kept — what the character is created with */
  const chosenRaceIds = raceSlots.filter((raceId) => raceId !== '');

  /** The slots, the picks in them, and whether this ruleset asks for any (TICKET-SKL-05) */
  const focus = focusStateFor(config, values.focusSkillIds);

  /**
   * The choices the engine reads, stable while their content is (CR-14)
   *
   * Everything below that costs anything is keyed on this rather than on the form's values, so
   * typing the character's name on step 0 no longer re-runs the whole ruleset.
   */
  const engineInputs = useContentStable<EngineInputs>({
    raceIds: chosenRaceIds,
    investedStatPoints: values.investedStatPoints,
    investedSkillPoints: values.investedSkillPoints,
    archetypeId: values.archetypeId || undefined,
    focusSkillIds: focus.chosen,
  });

  // Resolved through the Kernel's own lookup so a race picked in two slots is two blocks here as
  // well as in the composition (TICKET-RACE-04) — a filter would have collapsed a pure-blood to one
  const selectedRaces = useMemo(
    () => (config === null ? [] : resolveRaces(config, engineInputs.raceIds)),
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

  /**
   * Put a race in one slot
   *
   * Slot-addressed rather than toggled (TICKET-RACE-04): the same race may legitimately fill every
   * slot, so *is it already picked* stopped being a question with an answer. Which is also why
   * nothing here refuses a pick — a slot holds exactly one race and replacing it is the only edit
   * there is, where the old checkbox list had to decide which of two to drop.
   */
  const setRaceAt = (index: number, raceId: string) => {
    const filled = [...raceSlots];
    filled[index] = raceId;
    form.setValue('raceIds', filled);
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
   * Put a skill in one focus slot (TICKET-SKL-05)
   *
   * `setRaceAt`'s shape, for its reason: the same skill may fill every slot, so *is it already
   * picked* stopped being a question with an answer, and a slot holds exactly one skill so replacing
   * it is the only edit there is. The form keeps the empties — a Player who fills the third slot
   * first should watch their choice stay in the third box.
   */
  const setFocusSkillAt = (index: number, skillId: string) => {
    const filled = [...focus.slots];
    filled[index] = skillId;
    form.setValue('focusSkillIds', filled);
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
   * The race count is checked as well as the name. The step renders exactly the ruleset's number of
   * slots, so *too many* is unreachable and what this catches is an **empty slot** — the rule
   * TICKET-RACE-04 made exact. `characterStore.createCharacter` and the Kernel both refuse a short
   * pick by returning nothing much, and a Submit that silently does nothing is the worst way for
   * two spellings of one limit to drift apart — this is where the Player is told, at the step that
   * owns the choice rather than three steps later.
   */
  const identityStepError = (): string | null => {
    if (creationData.name === '') return 'Give your character a name before continuing.';
    if (chosenRaceIds.length !== raceSlots.length) {
      return `This ruleset gives a character ${raceSlots.length} races — ${chosenRaceIds.length} chosen.`;
    }
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
    3: focusStepError(focus.slots, focus.chosen, focus.isAsked),
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
    raceSlots,
    focusSlots: focus.slots,
    isFocusDialled: focus.isDialled,
    // `allocation` stays local: the step renders `budget`, and re-exporting the raw engine result
    // through the play barrel would offer supported API nothing consumes
    budget,
    gains,
    preview,
    previewError,
    setRaceAt,
    setInvestedStatPoints,
    setInvestedSkillPoints,
    setArchetypeId,
    setFocusSkillAt,
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
