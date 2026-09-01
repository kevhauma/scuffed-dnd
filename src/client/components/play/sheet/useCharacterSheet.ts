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

import { useMemo } from 'react';
import { calculateCharacter } from '#shared/engine/calculator';
import { indexStatModifiers } from '#shared/engine/calculators/equipmentBonusCalculator';
import {
  affinityFor,
  archetypeOf,
  pointBuyCurve,
  statGain,
} from '#shared/engine/calculators/pointBuy';
import { calculateRaceStatBases } from '#shared/engine/calculators/statCalculator';
import { calculateCharacterLevel, experienceForLevel } from '#shared/engine/characterSummary';
import { rollPool } from '#shared/engine/dice/rollDefinition';
import { DEFAULT_DREAM_LEVEL, dreamLevelOf } from '#shared/engine/dreamLevel';
import { focusDials, focusPicksOf, toFocusSlots } from '#shared/engine/focusSkills';
import { describeFormulaError, isFormulaError } from '#shared/engine/formula/errors';
import { resolveRaces } from '#shared/engine/races';
import { validateStatAllocation } from '#shared/engine/skillAllocation';
import type { CalculatedCharacter, Character } from '#shared/types/character';
import type { Configuration } from '#shared/types/config';
import { selectCharacter, useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';
import { adjustmentVocabularyFrom } from '../dm/adjustmentVocabulary';
import type { DerivedValue } from '../shared/derivedValue';
import { toDerivedValue } from '../shared/derivedValue';
import type { PointBudgetView } from '../shared/pointBudgetView';
import { toPointBudgetView } from '../shared/pointBudgetView';
import type { QuickAction } from '../shared/quickActions';
import { quickActionsFor } from '../shared/quickActions';
import { readable } from '../shared/readableNumber';
import { usePlayerControls } from './usePlayerControls';
import { useSheetActions } from './useSheetActions';

/**
 * Why the sheet cannot be drawn, or `ready` when it can
 *
 * Each state is a different thing to tell the Player, so they are distinguished rather than
 * collapsed into one "unavailable".
 *
 * **A const object since TICKET-DM-01**, which is when this stopped being module-local: exporting
 * it so `SheetStatusNotice` could take one put the same six literals in three modules, and the
 * house rule is that a closed set of strings named by a second module is a frozen object with the
 * type derived from it. It was a bare union while nothing outside this file could spell one.
 */
export const CHARACTER_SHEET_STATUS = {
  READY: 'ready',
  /** No ruleset is loaded, so nothing about the character can be interpreted */
  NO_CONFIGURATION: 'no-configuration',
  /** No saved character has this id — a stale link or a deleted character */
  NOT_FOUND: 'not-found',
  /** The character was built on a different ruleset than the one loaded */
  CONFIGURATION_MISMATCH: 'configuration-mismatch',
  /**
   * The engine itself failed — a bug, not a ruleset mistake.
   *
   * Since TICKET-FORM-06 a broken *formula* no longer lands here: it renders as a chip on the one
   * value it broke, and the rest of the sheet stays usable. Only an actual throw from
   * `calculateCharacter` reaches this state now.
   */
  FORMULA_ERROR: 'formula-error',
} as const;

export type CharacterSheetStatus =
  (typeof CHARACTER_SHEET_STATUS)[keyof typeof CHARACTER_SHEET_STATUS];

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

/**
 * One of the three focus slots, as the picker draws it (TICKET-SKL-05)
 *
 * The multiplier travels with the slot rather than being looked up beside it, because that is what
 * makes a **duplicate pick visibly stack**: two slots naming Arcane both read `×3.3`, which is the
 * whole of what the sheet's Setup form is saying.
 */
export interface FocusSlotView {
  /** The skill this slot names, or `''` when it is empty */
  skillId: string;
  /** What that skill's multiplier comes to once every slot is counted — null for an empty slot */
  multiplier: number | null;
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
  /**
   * Which column of the sheet this stat is listed under, or undefined when the ruleset grouped it
   * nowhere (TICKET-STAT-04). Presentation only — the two sections read it through
   * `shared/labelledGroups.ts`, and nothing else reads it at all.
   */
  group?: string;
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
   * What the invested points bought, through the archetype's affinity column (TICKET-ARC-02),
   * amplified by the character's Dream level (TICKET-ARC-04)
   *
   * The actual term of the composed value, and **not a function of `invested` alone**: a main-tagged
   * stat multiplies by the dream level and a sub-tagged one adds it, so a stat with nothing spent in
   * it can still show a gain, and it can be fractional. Equal to `invested` on a ruleset with no
   * `point_buy` curve and no archetype, which is the 1:1 fallback showing through.
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
 * A roll's derived pool, ready for its button (Concept 08, TICKET-ROLL-06)
 *
 * `input` is the number the definition's expression produced; `notation` is the pool that number
 * decomposes into, carrying the same `text`/`error` pair every other derived display value uses so
 * a broken input chips rather than rendering a confident empty pool.
 */
export interface RollPool {
  id: string;
  name: string;
  /** What the definition's input evaluated to */
  input: DerivedValue;
  /** The pool as `1D20 + 1D12 + 1D6 + 1`, or the reason there isn't one */
  notation: DerivedNotation;
}

/** A rendered pool string, or the error that stopped it being one */
export interface DerivedNotation {
  text: string | null;
  error: string | null;
}

/** Rolls sharing a `category`, in the order the ruleset lists them */
export interface RollGroup {
  /** The category, or `other` for rolls the ruleset did not sort */
  label: string;
  rolls: RollPool[];
}

/** Everything the sheet's sections render, or empty when there is no sheet to draw */
interface CharacterSheetView {
  raceNames: string[];
  /** The character's archetype, by name — undefined when they have none (TICKET-ARC-03) */
  archetypeName?: string;
  raceContributions: RaceContribution[];
  skills: SkillBreakdown[];
  /** One entry per focus slot, filled or not (TICKET-SKL-05) */
  focusSlots: FocusSlotView[];
  /**
   * Whether this ruleset states either focus dial
   *
   * What the picker says out loud: with neither `focus_chosen` nor `focus_other` set every
   * multiplier is exactly 1, so a pick is stored and changes no number — which a Player choosing one
   * deserves to be told rather than left to infer from a sheet that did not move.
   */
  isFocusDialled: boolean;
  stats: StatBreakdown[];
  /** Sum of the stats flagged as counting toward the character's total */
  statTotal: number;
  rollGroups: RollGroup[];
}

const EMPTY_VIEW: CharacterSheetView = {
  raceNames: [],
  raceContributions: [],
  skills: [],
  focusSlots: [],
  isFocusDialled: false,
  stats: [],
  statTotal: 0,
  rollGroups: [],
};

/** What a roll with no category is listed under (Concept 08 makes the field optional) */
const UNCATEGORISED_ROLLS = 'other';

/**
 * Every roll's pool, grouped by category and ordered by `order`
 *
 * The notation comes from the **engine** — `decomposeValue` then `formatLadderNotation`, the same
 * pair `rollRollDefinition` uses — so the label on the button and the dice that actually get rolled
 * are the same computation, not two that agree by inspection.
 *
 * A group is built in first-appearance order rather than against a fixed category list, so a
 * ruleset that uses only `utility` does not render two empty headings.
 */
function buildRollGroups(config: Configuration, calculated: CalculatedCharacter): RollGroup[] {
  const groups = new Map<string, RollPool[]>();

  const ordered = [...(config.rollDefinitions ?? [])].sort((a, b) => a.order - b.order);

  for (const roll of ordered) {
    const input = toDerivedValue(calculated.rollInputs[roll.id]);

    // `rollPool` is the same call `rollRollDefinition` makes, so the label on the button and the
    // dice that get thrown are one derivation rather than two that agree by inspection
    const pool = input.error !== null ? null : rollPool(roll, input.value as number, config);

    const notation: DerivedNotation =
      pool === null
        ? { text: null, error: input.error }
        : isFormulaError(pool)
          ? { text: null, error: describeFormulaError(pool) }
          : { text: pool.notation, error: null };

    const label = roll.category ?? UNCATEGORISED_ROLLS;
    const group = groups.get(label);
    const entry: RollPool = { id: roll.id, name: roll.name, input, notation };

    if (group) {
      group.push(entry);
    } else {
      groups.set(label, [entry]);
    }
  }

  return [...groups.entries()].map(([label, rolls]) => ({ label, rolls }));
}

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
  if (!config) return CHARACTER_SHEET_STATUS.NO_CONFIGURATION;
  if (!character) return CHARACTER_SHEET_STATUS.NOT_FOUND;
  if (character.configurationId !== config.id) return CHARACTER_SHEET_STATUS.CONFIGURATION_MISMATCH;
  if (error) return CHARACTER_SHEET_STATUS.FORMULA_ERROR;
  return CHARACTER_SHEET_STATUS.READY;
}

/**
 * The focus multiplier as a breakdown row, or nothing when focus is not in play (TICKET-SKL-05)
 *
 * `focus ×2.1  +5.7` — the multiplier in the label and **what it added** as the value, which is the
 * only form that keeps a breakdown adding up: the rows above it are `weight × stat` terms, and a
 * bare `×2.1` in a column of addends would be read as one.
 *
 * **Nothing at all for a ruleset that states neither dial**, rather than a row worth zero. There the
 * multiplier is exactly 1 by construction and focus is a mechanic the ruleset does not play — a
 * `focus ×1 +0` on all forty-eight rows is noise that says only that a feature exists.
 *
 * @param calculated The engine's result, which did the multiplication
 * @param skillId Which skill's row
 * @param isDialled Whether the ruleset states either focus factor
 * @returns The one row, or none
 */
function focusRows(
  calculated: CalculatedCharacter,
  skillId: string,
  isDialled: boolean
): SkillStatContributionView[] {
  const focus = calculated.skillFocus[skillId];

  if (!isDialled || focus === undefined) return [];

  return [{ label: `focus × ${readable(focus.multiplier)}`, value: focus.contribution }];
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
  // The same resolution the composition makes, duplicates and order kept (TICKET-RACE-04): a
  // pure-blood picked twice must show two blocks here and blend as two there. It is also **capped
  // at `const.race_count` inside `resolveRaces`**, which is what keeps `raceNames` below honest now
  // that the count is a dial a User can lower under a character that was created at the old one
  const races = resolveRaces(config, character.raceIds);

  // The blend, not a sum (TICKET-RACE-02) — and the same call the composition makes, over the same
  // capped list, so the racial section and each stat's `race` term can never disagree
  const raceBases = calculateRaceStatBases(races, config.constants);
  // Keyed by stat id since TICKET-MAT-02, so only a stat has an equipment contribution
  const equipmentBonuses = indexStatModifiers(calculated.equipmentBonuses);

  // What the invested points bought (TICKET-ARC-02) — the same call the composition makes, so a
  // stat's breakdown terms cannot disagree with the total they are terms of
  const archetype = archetypeOf(character, config);
  const pointBuy = pointBuyCurve(config);
  // The third term of the gain since TICKET-ARC-04, read through RES-04's one reader so the
  // breakdown row and the composed value cannot disagree about an untouched character
  const dreamLevel = dreamLevelOf(character);

  const orderedStats = [...config.stats].sort((a, b) => a.order - b.order);
  const abbreviationById = new Map(config.stats.map((stat) => [stat.id, stat.abbreviation]));

  // The picks as stored, read through the engine's one reader so an untouched character means the
  // same *none* here as it does in the calculator (TICKET-SKL-05)
  const focusPicks = focusPicksOf(character);
  const focusSlots = toFocusSlots(focusPicks);
  const isFocusDialled = focusDials(config.constants).stated;

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
      statContributions: [
        ...(calculated.skillContributions[skill.id] ?? []).map((row) => ({
          label: `${abbreviationById.get(row.statId) ?? row.statId} × ${row.weight}`,
          value: row.contribution,
        })),
        // The focus multiplier, spelled as what it *added* so the terms still sum to the number the
        // level rounds up from (TICKET-SKL-05). Both halves come from the calculator; a row worth
        // nothing — no dials, or no stat weights to multiply — is dropped by `CountRow`'s own filter
        ...focusRows(calculated, skill.id, isFocusDialled),
      ],
    })),

    focusSlots: focusSlots.map((skillId) => {
      const focus = calculated.skillFocus[skillId];

      return { skillId, multiplier: focus?.multiplier ?? null };
    }),

    isFocusDialled,

    // One row per stat, invested or derived (TICKET-STAT-01), in the order the User arranged them
    // in the stats panel (TICKET-STAT-03). `current` is meaningful only for a resource.
    stats: orderedStats.map((stat) => {
      const current = character.currentResourceValues[stat.id] ?? 0;
      const max = toDerivedValue(calculated.statValues[stat.id]);
      const invested = character.investedStatPoints[stat.id] ?? 0;
      const affinity = affinityFor(archetype, stat.id);
      const gain = statGain(invested, affinity, pointBuy, dreamLevel);

      return {
        id: stat.id,
        name: stat.name,
        abbreviation: stat.abbreviation,
        // Carried straight through — a group is the ruleset's own string and nothing interprets it
        group: stat.group,
        isResource: stat.isResource,
        isDerived: stat.formula !== undefined,
        invested,
        gain: toDerivedValue(gain),
        race: raceBases[stat.id] ?? 0,
        equipment: equipmentBonuses[stat.id] ?? 0,
        current,
        max,
        // Compared, never corrected — see `StatBreakdown.isOverMax`
        isOverMax: stat.isResource && max.value !== null && current > max.value,
      };
    }),

    statTotal: calculated.statTotal,

    rollGroups: buildRollGroups(config, calculated),
  };
}

/**
 * What the ruleset prices this character's *next* level at, from where they stand (TICKET-DM-03)
 *
 * The one preset the experience quick actions offer, and it is the ruleset's own number rather than a
 * round one somebody liked: `experienceForLevel` reads the `xp_thresholds` curve forwards and
 * **refuses** anything that does not read back as the level asked for, so a single-row placeholder
 * curve answers `null` here instead of a confident 0 (TICKET-DM-01's ruling, D9). A `null` costs the
 * DM a preset and not the action — the amount box is offered either way.
 *
 * @param character Whose sheet, or null when there is none
 * @param config The ruleset holding the curve
 * @param level The level they are at, or the error that stood in for it
 * @returns The experience still owed for the next level, or null when the curve cannot say
 */
function experienceStepFor(
  character: Character | null,
  config: Configuration | null,
  level: DerivedValue
): number | null {
  if (!character || !config || level.value === null) return null;

  const next = experienceForLevel(character, config, level.value + 1);
  if (isFormulaError(next)) return null;

  const owed = next - character.experience;

  return owed > 0 ? owed : null;
}

/**
 * What the DM has already granted this character, or 0 when there is no budget to read (TICKET-DM-03)
 *
 * **The fallback is real here and was not in the sidebar**, which is the distinction the DM-03 review
 * drew. `toPointBudgetView` answers `null` only for a null allocation — which happens in *this* hook,
 * on every render before there is a character and a ruleset to validate. By the time
 * `QuickActionsSidebar` is drawn `CharacterSheet` has already returned `SheetStatusNotice` for that
 * state, so the panel takes a plain `number` and the `?? 0` lives at the one place it can fire.
 *
 * A module-level function rather than an expression in the return object, `experienceStepFor`'s
 * shape: the hook itself is over the complexity threshold on inherited grounds and this ticket is not
 * adding two branches to it.
 *
 * @param budget The allocation verdict as the sheet renders it, or null when there is none
 * @returns The DM's grant, 0 for a sheet that cannot be validated yet
 */
function grantedPointsFrom(budget: PointBudgetView | null): number {
  return budget?.grantedPoints ?? 0;
}

/**
 * The Dungeon Master's quick actions for this sheet (TICKET-DM-03, v3 Req 49.1)
 *
 * Derived here rather than in the sidebar because the parts are already in hand — the pools are the
 * rows the sheet is about to render, and their maxima are the engine's. The sidebar renders the list;
 * it does not compose it, and TICKET-DM-04's roster will compose its own from the same function.
 *
 * @param character Whose sheet, or null when there is none
 * @param config The ruleset it is read against
 * @param stats Every stat row, resource and otherwise
 * @param level Where the character stands, for the experience preset
 * @returns Two actions per pool plus the four that move the character
 */
function toQuickActions(
  character: Character | null,
  config: Configuration | null,
  stats: StatBreakdown[],
  level: DerivedValue
): QuickAction[] {
  const pools = stats
    .filter((stat) => stat.isResource)
    .map((stat) => ({ id: stat.id, name: stat.name, max: stat.max.value }));

  const experienceStep = experienceStepFor(character, config, level);

  return quickActionsFor({ pools, experienceStep });
}

export function useCharacterSheet(characterId: string) {
  const config = useConfigStore((state) => state.config);
  // Wherever it lives (TICKET-PLY-01) — the browser's list, or the one character open at a table
  const character = useCharacterStore((state) => selectCharacter(state, characterId));
  const atTable = useCharacterStore((state) => state.tableCharacter?.id === characterId);
  const openTableSessionId = useCharacterStore((state) => state.tableSessionId);
  const actionError = useCharacterStore((state) => state.actionError);
  const isActing = useCharacterStore((state) => state.isActing);
  const dismissActionError = useCharacterStore((state) => state.dismissActionError);

  // What the Player can *do* to this sheet is its own hook (TICKET-PLY-01) — see `useSheetActions`
  const actions = useSheetActions(character, atTable);

  // …and the half of it whose actor depends on who is reading (TICKET-DM-05). Every field is absent
  // for the table's DM, whom `requireCharacterPlayer` refuses, so the six handlers below reach the
  // sections as `undefined` and each draws a display instead — see `usePlayerControls` for why this
  // one answers with absent fields where the four hooks before it answer `null`.
  const player = usePlayerControls(characterId, character, config);

  const { calculated, error } = useMemo(() => calculate(character, config), [character, config]);

  const status = resolveStatus(character, config, error);

  const view =
    status === CHARACTER_SHEET_STATUS.READY && character && config && calculated
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

  // Curve-derived since TICKET-RES-01, and bound here rather than inline in the return because the
  // quick actions' experience preset is priced against it (TICKET-DM-03). The engine's answer is
  // named before it is wrapped — converted-when-touched, the no-nested-calls rule
  const levelResult = character && config ? calculateCharacterLevel(character, config) : undefined;
  const level = toDerivedValue(levelResult);

  return {
    status,
    character,
    /**
     * Whether this sheet is a character at a table (TICKET-PLY-01)
     *
     * What the sheet does with it is hide the controls whose writes have no route yet — experience
     * is TICKET-DM-01's and the purse is DM-02's, and at a table both are the DM's to change (D9).
     * A control that quietly lost what it changed would be worse than an absent one.
     */
    atTable,
    /**
     * Which table, when this sheet is at one (TICKET-LIVE-03)
     *
     * `null` for a local character, which is the answer `LiveStatusNotice` reads as *there is no
     * feed here* rather than as *the feed is down*. Held beside `atTable` rather than derived from
     * it at the caller: the store already knows both, and a component working one out from the other
     * would be a second rule about what *at a table* means.
     */
    tableSessionId: atTable ? openTableSessionId : null,
    /** Why the last action at a table was refused, in the server's own words — null after a success */
    actionError,
    /** True while an action is on the wire */
    isActing,
    dismissActionError,
    /** The engine result, for callers that need more than the rendered breakdowns (the roller) */
    calculated,
    formulaError: error,
    // Curve-derived since TICKET-RES-01, so it carries an error the header chips like any other
    level,
    experience: character?.experience ?? 0,
    /**
     * How far this character stands in their dream (TICKET-RES-04)
     *
     * Read through the engine rather than with a `?? 1` here: absent-means-1 is one rule, and the
     * gain formula that multiplies by it has to read the same number the header shows.
     */
    dreamLevel: character ? dreamLevelOf(character) : DEFAULT_DREAM_LEVEL,
    /** Spent, available and remaining at this level — null when there is no sheet to draw */
    budget,
    /**
     * What the DM has granted on top of the derived pool, 0 when there is no budget yet
     *
     * Beside `budget` rather than read off it at the call site: a give or take quick action sends a
     * **total**, so the sidebar needs the number and not the verdict — see {@link grantedPointsFrom}
     * for why the fallback belongs here and not there.
     */
    grantedPoints: grantedPointsFrom(budget),
    ...view,
    // The ruleset's tiers and what this character holds in them — the sheet's purse
    // (`Charactersheet!Q18:S23`), which the app had no field for until now
    currencyTiers: config?.currencyTiers ?? [],
    // Absent means none, so the sheet renders 0 without the character growing a field it never had
    purse: character?.purse ?? 0,
    /** The words the adjustment log reads an Event in — see `dm/adjustmentVocabulary.ts` */
    adjustmentWords: adjustmentVocabularyFrom(config, view.stats),
    /**
     * The DM's quick actions, derived from this ruleset's own pools (TICKET-DM-03)
     *
     * Built for every reader and rendered for one: `useQuickActions` answers `null` to anybody who is
     * not the table's DM, so the sidebar is absent rather than disabled (v3 Req 49.10). A list is
     * cheap; deciding who may act is not the sheet's question to answer twice.
     */
    quickActions: toQuickActions(character, config, view.stats, level),
    ...actions,
    ...player,
  };
}
