/**
 * Character Sheet Manager Hook
 *
 * Resolves the character behind the route param, runs it through the calculation engine once, and
 * exposes everything the sheet renders plus the handlers that change it. The sections render; this
 * decides.
 *
 * Every derived number here comes from `calculateCharacter` / `calculateRaceStatBases` /
 * `indexStatModifiers` — the sheet does no arithmetic of its own.
 *
 * **Validates: Requirements 8.5, 13.4, 14.1, 14.2, 14.5, 16.6, 21.1-21.5**
 */

import { useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { calculateCharacter } from '../../../engine/calculator';
import { indexStatModifiers } from '../../../engine/calculators/equipmentBonusCalculator';
import {
  affinityFor,
  archetypeOf,
  pointBuyCurve,
  statGain,
} from '../../../engine/calculators/pointBuy';
import { calculateRaceStatBases } from '../../../engine/calculators/statCalculator';
import { calculateCharacterLevel } from '../../../engine/characterSummary';
import { formatDiceNotation } from '../../../engine/dice/diceSimulator';
import { validateStatAllocation } from '../../../engine/skillAllocation';
import { useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';
import type { CalculatedCharacter, Character } from '../../../types/character';
import type { Configuration } from '../../../types/config';
import type { DerivedValue } from '../shared/derivedValue';
import { toDerivedValue } from '../shared/derivedValue';
import { toPointBudgetView } from '../shared/pointBudgetView';

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
 * A speciality skill's contributions, kept apart rather than pre-summed (Requirement 13.4)
 */
export interface SkillBreakdown {
  id: string;
  name: string;
  /** Points the Player invested at creation */
  invested: number;
  /** The integer a Player adds to a roll — `round(level / bonus_divider)` (Concept 02) */
  bonus: DerivedValue;
  /** The engine's level — the weighted stats plus the invested points, either of which can fail */
  total: DerivedValue;
  /**
   * One entry per weight row that fed the level, already multiplied out by the calculator and
   * paired here with the stat's abbreviation to render (TICKET-SKL-03). Empty when the level
   * failed — see `CalculatedSkills.contributions`.
   */
  statContributions: SkillStatContributionView[];
}

/** A weight row's share of a skill's level, spelled for display */
export interface SkillStatContributionView {
  /** `STR × 0.2` — the stat's short spelling and the weight applied to it */
  label: string;
  /** `weight × statValue`, straight from the calculator */
  value: number;
}

/**
 * A stat's contributions, kept apart rather than pre-summed (Requirement 13.4)
 *
 * One shape for all three kinds of stat (TICKET-STAT-01). A derived stat has no invested points
 * and `current` is only meaningful when `isResource`. **Either kind's `max` can carry an error**:
 * a derived stat's formula can fail, and since TICKET-ARC-02 an invested stat's spend can be one
 * the `point_buy` table refuses to price.
 */
export interface StatBreakdown {
  id: string;
  name: string;
  abbreviation: string;
  isResource: boolean;
  /** Whether the value comes from a formula rather than from points the Player spent */
  isDerived: boolean;
  /**
   * Points the Player put into it — always 0 for a derived stat.
   *
   * **This is the price, not the contribution** (TICKET-ARC-02): what those points are worth is
   * `gain`, and it is `gain` that is a term of `max`. The two are shown together — `invested 15 →
   * +12` — because a Player deciding where to spend needs the exchange rate, not just its result.
   */
  invested: number;
  /**
   * What the invested points bought, through the archetype's affinity column (TICKET-ARC-02)
   *
   * The actual term of the composed value. Equal to `invested` on a ruleset with no `point_buy`
   * curve, which is the 1:1 fallback showing through.
   */
  gain: DerivedValue;
  /** What the character's races supply for this stat, blended (Requirement 8.5, Concept 04) */
  race: number;
  /** Combined modifier from equipped items targeting this stat */
  equipment: number;
  /** Where a resource currently stands; 0 for anything else */
  current: number;
  /** The engine's composed value — the maximum, for a resource */
  max: DerivedValue;
  /**
   * A resource whose stored current is above its calculated maximum (TICKET-RES-03)
   *
   * Reachable whenever the maximum *falls* — an item unequipped, a formula edited, a race removed.
   * The current is **kept**: a derived maximum must never silently overwrite what the Player is
   * tracking, so the sheet flags the mismatch and leaves the number alone. Writes still clamp, so
   * the state resolves the moment the Player touches the pool.
   */
  isOverMax: boolean;
}

/**
 * What one stat gets from the character's races, ready to render
 *
 * The engine keys a race's stat block by stat **id** (TICKET-RACE-01), which is not something to
 * show a Player, so the hook pairs each entry with its abbreviation here rather than making the
 * section look it up.
 */
export interface RaceContribution {
  statId: string;
  abbreviation: string;
  value: number;
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
  /** The character's archetype, by name — undefined when they have none (TICKET-ARC-03) */
  archetypeName?: string;
  raceContributions: RaceContribution[];
  skills: SkillBreakdown[];
  stats: StatBreakdown[];
  /** Sum of the stats flagged as counting toward the character's total */
  statTotal: number;
  combatSkills: CombatSkillBreakdown[];
}

const EMPTY_VIEW: CharacterSheetView = {
  raceNames: [],
  raceContributions: [],
  skills: [],
  stats: [],
  statTotal: 0,
  combatSkills: [],
};

/** The engine result plus the reason it could not be produced */
interface CalculationOutcome {
  calculated: CalculatedCharacter | null;
  error: string | null;
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

  // The blend, not a sum (TICKET-RACE-02) — and the same call the composition makes, so the
  // racial section and each stat's `race` term can never disagree
  const raceBases = calculateRaceStatBases(races, config.constants);
  // Keyed by stat id since TICKET-MAT-02, so only a stat has an equipment contribution
  const equipmentBonuses = indexStatModifiers(calculated.equipmentBonuses);

  // What the invested points bought (TICKET-ARC-02) — the same call the composition makes, so a
  // stat's breakdown terms cannot disagree with the total they are terms of
  const archetype = archetypeOf(character, config);
  const pointBuy = pointBuyCurve(config);

  const orderedStats = [...config.stats].sort((a, b) => a.order - b.order);
  const abbreviationById = new Map(config.stats.map((stat) => [stat.id, stat.abbreviation]));

  return {
    raceNames: races.map((race) => race.name),
    archetypeName: archetype?.name,

    // A stat the races say nothing about is left out rather than shown as 0 — the section is
    // "what your lineage gives you", and a zero is not something it gave you
    raceContributions: orderedStats
      .filter((stat) => (raceBases[stat.id] ?? 0) !== 0)
      .map((stat) => ({
        statId: stat.id,
        abbreviation: stat.abbreviation,
        value: raceBases[stat.id] as number,
      })),

    // A skill has both numbers now (Concept 02): the level it derives to, and the bonus a Player
    // actually rolls with
    skills: config.skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      invested: character.investedSkillPoints[skill.id] ?? 0,
      bonus: toDerivedValue(calculated.skillBonuses[skill.id]),
      total: toDerivedValue(calculated.skillLevels[skill.id]),
      // The calculator did the multiplication; all that happens here is spelling the stat, the
      // same reason `raceContributions` pairs an id with its abbreviation
      statContributions: (calculated.skillContributions[skill.id] ?? []).map((row) => ({
        label: `${abbreviationById.get(row.statId) ?? row.statId} × ${row.weight}`,
        value: row.contribution,
      })),
    })),

    // One row per stat, invested or derived (TICKET-STAT-01), in the order the User arranged them
    // in the stats panel (TICKET-STAT-03). `current` is meaningful only for a resource.
    stats: orderedStats.map((stat) => {
      const current = character.currentResourceValues[stat.id] ?? 0;
      const max = toDerivedValue(calculated.statValues[stat.id]);
      const invested = character.investedStatPoints[stat.id] ?? 0;

      return {
        id: stat.id,
        name: stat.name,
        abbreviation: stat.abbreviation,
        isResource: stat.isResource,
        isDerived: stat.formula !== undefined,
        invested,
        gain: toDerivedValue(statGain(invested, affinityFor(archetype, stat.id), pointBuy)),
        race: raceBases[stat.id] ?? 0,
        equipment: equipmentBonuses[stat.id] ?? 0,
        current,
        max,
        // Compared, never corrected — see `StatBreakdown.isOverMax`
        isOverMax: stat.isResource && max.value !== null && current > max.value,
      };
    }),

    statTotal: calculated.statTotal,

    combatSkills: config.combatSkills.map((skill) => ({
      code: skill.code,
      name: skill.name,
      diceNotation: formatDiceNotation(skill.dice),
      bonus: toDerivedValue(calculated.combatSkillBonuses[skill.code]),
    })),
  };
}

export function useCharacterSheet(characterId: string) {
  const navigate = useNavigate();

  const config = useConfigStore((state) => state.config);
  const characters = useCharacterStore((state) => state.characters);
  const updateCurrentStatValue = useCharacterStore((state) => state.updateCurrentStatValue);
  const adjustCurrentStatValue = useCharacterStore((state) => state.adjustCurrentStatValue);
  const resetCurrentStatValueToMax = useCharacterStore((state) => state.resetCurrentStatValueToMax);
  const setInvestedStatPoints = useCharacterStore((state) => state.setInvestedStatPoints);
  const awardExperience = useCharacterStore((state) => state.awardExperience);
  const deductExperience = useCharacterStore((state) => state.deductExperience);

  const character = characters.find((candidate) => candidate.id === characterId) ?? null;

  const { calculated, error } = useMemo(() => calculate(character, config), [character, config]);

  const status = resolveStatus(character, config, error);

  const view =
    status === 'ready' && character && config && calculated
      ? buildView(character, config, calculated)
      : EMPTY_VIEW;

  /**
   * The point pool as it stands at this character's current level (TICKET-RES-02)
   *
   * Recomputed from the character on every render, which is what makes the budget follow the
   * level: awarding XP moves the level, the level moves the budget, and the unspent points appear
   * without anything being written to the character.
   */
  const budget = toPointBudgetView(
    character && config ? validateStatAllocation(character, config) : null
  );

  const handleChangeStatValue = (statId: string, value: number) => {
    if (!character || !config) return;

    // Persistence — and the max-value clamp — belong to the store action, not to this hook
    updateCurrentStatValue(character.id, statId, value, config);
  };

  // Concept 20's quick entry and "regain to full" (TICKET-RES-03). The delta is applied and the
  // maximum is read inside the store, so nothing here does arithmetic on a pool.
  const handleAdjustStatValue = (statId: string, delta: number) => {
    if (!character || !config) return;

    adjustCurrentStatValue(character.id, statId, delta, config);
  };

  const handleResetStatValueToMax = (statId: string) => {
    if (!character || !config) return;

    resetCurrentStatValueToMax(character.id, statId, config);
  };

  // Spending is the level-up mechanic (TICKET-RES-02). The store refuses anything the derived
  // budget cannot pay for, so the sheet asks and renders whatever came back.
  const handleChangeInvestedPoints = (statId: string, points: number) => {
    if (!character || !config) return;

    setInvestedStatPoints(character.id, statId, points, config);
  };

  // One action per click, mirroring the sheet's `exp.gs` — the store decides what is allowed
  const handleAwardExperience = (amount: number) => {
    if (!character) return;
    awardExperience(character.id, amount);
  };

  const handleDeductExperience = (amount: number) => {
    if (!character) return;
    deductExperience(character.id, amount);
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
    // Curve-derived since TICKET-RES-01, so it carries an error the header chips like any other
    level: toDerivedValue(
      character && config ? calculateCharacterLevel(character, config) : undefined
    ),
    experience: character?.experience ?? 0,
    /** Spent, available and remaining at this level — null when there is no sheet to draw */
    budget,
    ...view,
    handleChangeStatValue,
    handleAdjustStatValue,
    handleResetStatValueToMax,
    handleChangeInvestedPoints,
    handleAwardExperience,
    handleDeductExperience,
    handleBack,
  };
}
