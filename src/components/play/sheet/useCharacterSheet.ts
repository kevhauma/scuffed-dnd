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
 * **Validates: Requirements 8.5, 9.3, 13.4, 14.1, 14.2, 14.5, 21.1-21.5**
 */

import { useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { calculateCharacter } from '../../../engine/calculator';
import { indexSkillModifiers } from '../../../engine/calculators/equipmentBonusCalculator';
import { calculateRacialSkillModifiers } from '../../../engine/calculators/mainSkillCalculator';
import { calculateCharacterLevel } from '../../../engine/characterSummary';
import { formatDiceNotation } from '../../../engine/dice/diceSimulator';
import { useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';
import type { CalculatedCharacter, Character } from '../../../types/character';
import type { Configuration } from '../../../types/config';

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
  /** The ruleset has a formula that does not evaluate */
  | 'formula-error';

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
  /** The engine's total — not the sum of the fields above, which is why they are shown apart */
  total: number;
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
  total: number;
  isFocusStat: boolean;
}

/**
 * A stat's current and maximum value (Requirement 14.1)
 */
export interface StatBreakdown {
  id: string;
  name: string;
  current: number;
  max: number;
}

/**
 * A combat skill's dice and calculated bonus
 */
export interface CombatSkillBreakdown {
  code: string;
  name: string;
  diceNotation: string;
  bonus: number;
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
 * Run the calculation engine, converting a formula failure into a message rather than a crash
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
      total: calculated.totalMainSkillLevels[skill.code] ?? 0,
      isFocusStat: character.focusStatCode === skill.code,
    })),

    specialitySkills: config.specialitySkills.map((skill) => ({
      code: skill.code,
      name: skill.name,
      base: character.specialitySkillBaseLevels[skill.code] ?? 0,
      equipment: equipmentBonuses[skill.code] ?? 0,
      focus: focusFor(skill.code),
      total: calculated.specialitySkillTotalLevels[skill.code] ?? 0,
      isFocusStat: character.focusStatCode === skill.code,
    })),

    stats: config.stats.map((stat) => ({
      id: stat.id,
      name: stat.name,
      current: character.currentStatValues[stat.id] ?? 0,
      max: calculated.maxStatValues[stat.id] ?? 0,
    })),

    combatSkills: config.combatSkills.map((skill) => ({
      code: skill.code,
      name: skill.name,
      diceNotation: formatDiceNotation(skill.dice),
      bonus: calculated.combatSkillBonuses[skill.code] ?? 0,
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
