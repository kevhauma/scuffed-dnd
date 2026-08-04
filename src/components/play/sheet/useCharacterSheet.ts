/**
 * Character Sheet Manager Hook
 *
 * Resolves the character behind the route param, runs it through the calculation engine once, and
 * exposes everything the sheet renders plus the handlers that change it. The sections render; this
 * decides.
 *
 * Every derived number here comes from `calculateCharacter` / `calculateRacialSkillModifiers` /
 * `indexSkillModifiers` — the sheet does no arithmetic of its own.
 *
 * **Validates: Requirements 8.5, 9.3, 13.4, 14.1, 14.2, 14.5, 16.6, 21.1-21.5**
 */

import { useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { calculateCharacter } from '../../../engine/calculator';
import { indexSkillModifiers } from '../../../engine/calculators/equipmentBonusCalculator';
import { calculateRacialSkillModifiers } from '../../../engine/calculators/mainSkillCalculator';
import { calculateCharacterLevel } from '../../../engine/characterSummary';
import { formatDiceNotation } from '../../../engine/dice/diceSimulator';
import { describeFormulaError, isFormulaError } from '../../../engine/formula/errors';
import { useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';
import type { CalculatedCharacter, Character } from '../../../types/character';
import type { Configuration } from '../../../types/config';
import type { FormulaResult } from '../../../types/formula';

/**
 * Why the sheet cannot be drawn, or `ready` when it can
 *
 * Each state is a different thing to tell the Player, so they are distinguished rather than
 * collapsed into one "unavailable".
 */
type CharacterSheetStatus =
  | 'ready'
  /** No ruleset is loaded, so nothing about the character can be interpreted */
  | 'no-configuration'
  /** No saved character has this id — a stale link or a deleted character */
  | 'not-found'
  /** The character was built on a different ruleset than the one loaded */
  | 'configuration-mismatch'
  /**
   * The engine itself failed — a bug, not a ruleset mistake.
   *
   * Since TICKET-FORM-06 a broken *formula* no longer lands here: it renders as a chip on the one
   * value it broke, and the rest of the sheet stays usable. Only an actual throw from
   * `calculateCharacter` reaches this state now.
   */
  | 'formula-error';

/**
 * A derived number for display: the value, or the error that stands in for it
 *
 * The hook interprets `FormulaResult` once, here, so the sections stay presentational and never
 * import the engine to decide what to draw.
 */
export type DerivedValue = { value: number; error: null } | { value: null; error: string };

/**
 * A main skill's contributions, kept apart rather than pre-summed (Requirement 13.4)
 */
export interface MainSkillBreakdown {
  code: string;
  name: string;
  /** The level the Player allocated at creation */
  allocated: number;
  /** Combined modifier from every race the character has (Requirement 8.5) */
  racial: number;
  /** Combined modifier from equipped items targeting this skill */
  equipment: number;
  /** The configured focus bonus, non-zero only on the character's focus skill */
  focus: number;
  /**
   * The engine's total — not the sum of the fields above, which is why they are shown apart.
   *
   * Carried as a `DerivedValue` for uniformity with the other breakdowns, though a main skill's
   * level is allocated and modified rather than formula-derived, so its `error` is always null.
   */
  total: DerivedValue;
  isFocusStat: boolean;
}

/**
 * A speciality skill's base level and total, with its equipment contribution broken out
 */
export interface SpecialitySkillBreakdown {
  code: string;
  name: string;
  base: number;
  equipment: number;
  focus: number;
  total: DerivedValue;
  isFocusStat: boolean;
}

/**
 * A stat's current and maximum value (Requirement 14.1)
 */
export interface StatBreakdown {
  id: string;
  name: string;
  current: number;
  max: DerivedValue;
}

/**
 * A combat skill's dice and calculated bonus
 */
export interface CombatSkillBreakdown {
  code: string;
  name: string;
  diceNotation: string;
  bonus: DerivedValue;
}

/** Everything the sheet's sections render, or empty when there is no sheet to draw */
interface CharacterSheetView {
  raceNames: string[];
  racialModifiers: Record<string, number>;
  mainSkills: MainSkillBreakdown[];
  specialitySkills: SpecialitySkillBreakdown[];
  stats: StatBreakdown[];
  combatSkills: CombatSkillBreakdown[];
}

const EMPTY_VIEW: CharacterSheetView = {
  raceNames: [],
  racialModifiers: {},
  mainSkills: [],
  specialitySkills: [],
  stats: [],
  combatSkills: [],
};

/** The engine result plus the reason it could not be produced */
interface CalculationOutcome {
  calculated: CalculatedCharacter | null;
  error: string | null;
}

/**
 * Turn one engine result into something a section can render
 *
 * A missing entry (a stat the engine produced nothing for) reads as 0 rather than an error —
 * that is absence, not breakage.
 */
function derived(result: FormulaResult | undefined): DerivedValue {
  if (result === undefined) return { value: 0, error: null };
  if (isFormulaError(result)) return { value: null, error: describeFormulaError(result) };
  return { value: result, error: null };
}

/**
 * Run the calculation engine, keeping a genuine crash out of the render
 *
 * Ruleset problems do **not** come through here: since TICKET-FORM-05 they are error values
 * inside the result, and since TICKET-FORM-06 each renders as a chip on the single value it
 * broke. Only an actual throw — an engine bug — produces an `error` here.
 */
function calculate(character: Character | null, config: Configuration | null): CalculationOutcome {
  if (!character || !config) return { calculated: null, error: null };

  try {
    return { calculated: calculateCharacter(character, config), error: null };
  } catch (error) {
    return {
      calculated: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Decide which of the sheet's states applies, most fundamental first
 */
function resolveStatus(
  character: Character | null,
  config: Configuration | null,
  error: string | null
): CharacterSheetStatus {
  if (!config) return 'no-configuration';
  if (!character) return 'not-found';
  if (character.configurationId !== config.id) return 'configuration-mismatch';
  if (error) return 'formula-error';
  return 'ready';
}

/**
 * Assemble the rendered view from the engine's output
 *
 * Only called once the character, the configuration and the calculation are all known good, so
 * nothing here has to defend against a missing one.
 */
function buildView(
  character: Character,
  config: Configuration,
  calculated: CalculatedCharacter
): CharacterSheetView {
  const races = config.races.filter((race) => character.raceIds.includes(race.id));
  const racialModifiers = calculateRacialSkillModifiers(races);
  const equipmentBonuses = indexSkillModifiers(calculated.equipmentBonuses);

  /** The configured bonus, but only on the skill the character actually spent its focus on */
  const focusFor = (skillCode: string): number =>
    character.focusStatCode === skillCode ? config.focusStatBonusLevel : 0;

  return {
    raceNames: races.map((race) => race.name),
    racialModifiers,

    mainSkills: config.mainSkills.map((skill) => ({
      code: skill.code,
      name: skill.name,
      allocated: character.mainSkillLevels[skill.code] ?? 0,
      racial: racialModifiers[skill.code] ?? 0,
      equipment: equipmentBonuses[skill.code] ?? 0,
      focus: focusFor(skill.code),
      total: { value: calculated.totalMainSkillLevels[skill.code] ?? 0, error: null },
      isFocusStat: character.focusStatCode === skill.code,
    })),

    specialitySkills: config.specialitySkills.map((skill) => ({
      code: skill.code,
      name: skill.name,
      base: character.specialitySkillBaseLevels[skill.code] ?? 0,
      equipment: equipmentBonuses[skill.code] ?? 0,
      focus: focusFor(skill.code),
      total: derived(calculated.specialitySkillTotalLevels[skill.code]),
      isFocusStat: character.focusStatCode === skill.code,
    })),

    stats: config.stats.map((stat) => ({
      id: stat.id,
      name: stat.name,
      current: character.currentStatValues[stat.id] ?? 0,
      max: derived(calculated.maxStatValues[stat.id]),
    })),

    combatSkills: config.combatSkills.map((skill) => ({
      code: skill.code,
      name: skill.name,
      diceNotation: formatDiceNotation(skill.dice),
      bonus: derived(calculated.combatSkillBonuses[skill.code]),
    })),
  };
}

export function useCharacterSheet(characterId: string) {
  const navigate = useNavigate();

  const config = useConfigStore((state) => state.config);
  const characters = useCharacterStore((state) => state.characters);
  const updateCurrentStatValue = useCharacterStore((state) => state.updateCurrentStatValue);

  const character = characters.find((candidate) => candidate.id === characterId) ?? null;

  const { calculated, error } = useMemo(() => calculate(character, config), [character, config]);

  const status = resolveStatus(character, config, error);

  const view =
    status === 'ready' && character && config && calculated
      ? buildView(character, config, calculated)
      : EMPTY_VIEW;

  const handleChangeStatValue = (statId: string, value: number) => {
    if (!character || !config) return;

    // Persistence — and the max-value clamp — belong to the store action, not to this hook
    updateCurrentStatValue(character.id, statId, value, config);
  };

  const handleBack = () => {
    navigate({ to: '/play' });
  };

  return {
    status,
    character,
    /** The engine result, for callers that need more than the rendered breakdowns (the roller) */
    calculated,
    formulaError: error,
    level: character ? calculateCharacterLevel(character) : 0,
    ...view,
    handleChangeStatValue,
    handleBack,
  };
}
