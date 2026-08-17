/**
 * Stat Calculator
 *
 * The composition calculator (Concept 01, TICKET-STAT-01). One function answers "what is this
 * stat worth on this character", for all three kinds of stat, because there is one kind of stat:
 *
 * - **invested** — `race stat block + what the invested points bought + equipment`, where the
 *   points are converted through the archetype's `point_buy` column (Concept 03, TICKET-ARC-02);
 * - **resource** — the same sum, read as a *maximum* the character spends against;
 * - **derived** — its `formula`, evaluated over `stats.*` / `const.*` / `curve.*`.
 *
 * Either way the result is then clamped to `min`/`max` and rounded per `rounding`, so the two
 * paths differ only in where the raw number comes from.
 *
 * **Every configured stat has a value; absence is not a state** — TICKET-CALC-02's invariant,
 * carried across from main skills. Every stat in `config.stats` is seeded before anything is
 * applied, so a stat nobody has invested in reads 0 rather than reaching a formula as an
 * undefined variable. The converse holds too (TICKET-REF-02): the ruleset alone decides what
 * exists, so an allocation, race stat block entry or equipment bonus naming a stat the
 * configuration no longer defines contributes nothing rather than answering for a deleted stat.
 *
 * **Validates: Concepts 01, 03, 04; Concept 00 §7; Requirements 3.4, 3.6, 16.6**
 *
 * (Requirement 8.4 — "combine racial bonuses additively" — is deliberately *not* validated here
 * any more: Concept 04's blend supersedes it, TICKET-RACE-02.)
 */

import type { Character } from '../../types/character';
import type { Archetype, Constant, Curve, Race, Stat, StatModifier } from '../../types/config';
import type { FormulaContext, FormulaResult } from '../../types/formula';
import { constantsNamespace } from '../formula/constants';
import { asNumber, isFormulaError, withSource } from '../formula/errors';
import { evaluateFormulaString } from '../formula/evaluator';
import { roundAwayFromZero } from '../formula/functions';
import type { NamespaceSource } from '../formula/namespaces';
import { namespacesFor } from '../formula/namespaces';
import { affinityFor, statGain } from './pointBuy';

/** What the composition needs beyond the stats themselves */
export interface StatCompositionOptions {
  /** The character's races, for their stat blocks */
  races?: Race[];
  /** Aggregated bonuses from equipped items, keyed by stat id (TICKET-MAT-02) */
  equipmentBonuses?: StatModifier[];
  /** The ruleset's constants and curves, backing `const.*` and `curve.*(x)` */
  source?: NamespaceSource;
  /** The character's archetype, whose affinities pick a `point_buy` column (TICKET-ARC-02) */
  archetype?: Archetype;
  /** The `point_buy` curve; absent falls the invested term back to 1:1 — see `pointBuy.ts` */
  pointBuy?: Curve;
}

/**
 * How many races a character's base can be blended from (Concept 04, TICKET-RACE-02)
 *
 * The sheet's hybrid is a two-creature blend, so two is what the arithmetic is defined over. The
 * rule is enforced where a character is written — `characterStore`'s create and update — and in
 * the wizard's race step; this constant is the one place the number is stated.
 */
export const MAX_RACE_COUNT = 2;

/** The constant the blend divides by, and what it is worth when the ruleset does not define it */
const RACE_BLEND_DIVISOR_NAME = 'race_blend_divisor';
const DEFAULT_RACE_BLEND_DIVISOR = 2;

/**
 * The ruleset's blend divisor, or the seeded 2
 *
 * The **first** engine code to read a constant by name rather than through `const.*` in a User
 * formula: the blend is system arithmetic (Concept 04), not something the User writes, so there is
 * no formula for `references.ts` to re-spell. The consequence is that renaming the constant makes
 * the engine stop finding it — the fallback is what keeps that a retuning rather than a breakage,
 * and the constants panel shows the name that matters.
 *
 * Resolved through `constantsNamespace` rather than a second `find`, so a duplicate name imported
 * into a ruleset means the same constant here as it does in every formula.
 *
 * A zero, negative or non-finite divisor would turn every base into `Infinity` or `NaN`, which is
 * a worse answer than the seed (TICKET-FORM-07's rule, applied outside the evaluator).
 */
function raceBlendDivisor(constants: Constant[] = []): number {
  const value = constantsNamespace(constants).resolve(RACE_BLEND_DIVISOR_NAME);

  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_RACE_BLEND_DIVISOR;
}

/**
 * Blend the stat blocks of a character's races into one base per stat (Concept 04)
 *
 * Kept separate from the totals so the UI can show the racial contribution on its own
 * (Requirement 8.4, 13.4) without recovering it from a difference. Keyed by **stat id** since
 * TICKET-RACE-01 made a race a stat block.
 *
 * Not a sum — TICKET-RACE-02 replaced v1's additive stacking with the sheet's hybrid:
 *
 * - **no races** — nothing, so every base is 0;
 * - **one race** — its block, unchanged. The sheet writes a single-race character as a blend of the
 *   same race twice, which for the seeded divisor of 2 is the race itself; taking it as identity
 *   keeps that true for *any* divisor rather than only for 2;
 * - **two races** — `roundup((a + b) / const.race_blend_divisor)` per stat, rounding away from zero
 *   exactly as a User formula spelling `roundup` would. A stat absent from one block counts as 0 in
 *   the blend, which is the whole point of picking a race that lacks it.
 *
 * Picking the same race twice therefore changes nothing, and beyond {@link MAX_RACE_COUNT} the
 * blend has no meaning: a third race is refused where characters are written, and is ignored here
 * rather than distorting the divisor if it reaches the engine through hand-edited data.
 *
 * @param races - The character's races
 * @param constants - The ruleset's constants, for the blend divisor; absent uses the seeded 2
 * @returns Record of stat id to the base value the races supply
 */
export function calculateRaceStatBases(
  races: Race[],
  constants: Constant[] = []
): Record<string, number> {
  const blended = races.slice(0, MAX_RACE_COUNT);

  const [only] = blended;
  if (only === undefined) return {};
  if (blended.length === 1) return { ...only.statValues };

  const divisor = raceBlendDivisor(constants);
  const bases: Record<string, number> = {};

  for (const statId of new Set(blended.flatMap((race) => Object.keys(race.statValues)))) {
    const sum = blended.reduce((total, race) => total + (race.statValues[statId] ?? 0), 0);
    bases[statId] = roundAwayFromZero(sum / divisor);
  }

  return bases;
}

/** Clamp to the stat's bounds, then round the way it asks to be rounded */
function finish(value: number, stat: Stat): number {
  let bounded = value;
  if (stat.min !== undefined) bounded = Math.max(stat.min, bounded);
  if (stat.max !== undefined) bounded = Math.min(stat.max, bounded);

  switch (stat.rounding) {
    case 'nearest':
      return Math.round(bounded);
    case 'up':
      return Math.ceil(bounded);
    case 'down':
      return Math.floor(bounded);
    default:
      return bounded;
  }
}

/**
 * The invested side of the composition, before clamping
 *
 * `base` is what the character's races make them (TICKET-RACE-02) — the blend, not a sum of
 * modifiers — and everything else is added to it: what the points they spent *bought*, and what
 * they carry. **Three terms, not four** since TICKET-ARC-03 deleted the focus bonus: a flat adder
 * on one stat is not something the spec recognises, and the archetype it was standing in for now
 * shapes the whole sheet through the invested term.
 *
 * **The invested term is curve-routed since TICKET-ARC-02.** It is no longer the points themselves
 * but what the archetype's affinity converts them into, which is why this returns a `FormulaResult`:
 * the `point_buy` table is User data and can refuse an input (the seed's `outOfRange` is `error`
 * past 15 points), so a stat whose spend cannot be priced chips rather than answering with a number
 * nobody derived.
 */
function investedValue(
  stat: Stat,
  character: Character,
  raceBases: Record<string, number>,
  equipmentBonuses: StatModifier[],
  archetype: Archetype | undefined,
  pointBuy: Curve | undefined
): FormulaResult {
  const base = raceBases[stat.id] ?? 0;

  const gain = statGain(
    character.investedStatPoints[stat.id] ?? 0,
    affinityFor(archetype, stat.id),
    pointBuy
  );
  if (isFormulaError(gain)) {
    return withSource(gain, { kind: 'stat', id: stat.id, name: stat.name });
  }

  // Matched by **id** since TICKET-MAT-02, which is what deleted STAT-01's abbreviation bridge:
  // a bonus follows the stat it was attached to, not the spelling it had at the time
  const equipment = equipmentBonuses
    .filter((bonus) => bonus.statId === stat.id)
    .reduce((sum, bonus) => sum + bonus.modifier, 0);

  return base + gain + equipment;
}

/**
 * Compose every stat's value for a character
 *
 * Invested stats resolve immediately; derived stats are resolved in **passes**, because one may
 * read another (`stats.apt` over `stats.speed`). Each pass evaluates whatever is still
 * outstanding against the values found so far and keeps what succeeded. When a pass resolves
 * nothing new, what remains cannot be resolved at all — a cycle, or a chain hanging off one — and
 * each gets its own error value naming itself rather than a thrown exception (Concept 00 §7).
 * `engine/validator.ts` is what reports the cycle properly; this only has to not hang.
 *
 * @param stats - The configuration's stats — the complete set of what exists
 * @param character - The character whose investment and equipment are being applied
 * @param options - Races, equipment, the archetype's point-buy routing, and the ruleset behind
 *   `const.*` / `curve.*`
 * @returns Record of stat id to composed value, or the error explaining why there isn't one
 */
export function calculateStatValues(
  stats: Stat[],
  character: Character,
  options: StatCompositionOptions = {}
): Record<string, FormulaResult> {
  const { races = [], equipmentBonuses = [], source = {}, archetype, pointBuy } = options;

  const raceBases = calculateRaceStatBases(races, source.constants);
  const values: Record<string, FormulaResult> = {};

  // Seed the invested stats — they depend on nothing, so they are done in one pass
  const derived: Stat[] = [];
  for (const stat of stats) {
    if (stat.formula === undefined) {
      const composed = investedValue(
        stat,
        character,
        raceBases,
        equipmentBonuses,
        archetype,
        pointBuy
      );
      // A spend the point-buy table could not price is the stat's value now — clamping and
      // rounding an error would be answering a question that has no answer
      values[stat.id] = isFormulaError(composed) ? composed : finish(composed, stat);
    } else {
      derived.push(stat);
    }
  }

  /**
   * Evaluate the outstanding derived stats once, keeping whatever succeeded
   *
   * @param keepErrors - On the final pass, write each failure's own error value rather than
   *   leaving it outstanding, so a stat in a cycle reports its own reason
   * @returns The ones still without a value
   */
  const pass = (outstanding: Stat[], keepErrors: boolean): Stat[] => {
    const context: FormulaContext = {
      // The flat space is stat abbreviations now that stats are the invested atom. It is still
      // deprecated: TICKET-SKL-02 and TICKET-ROLL-05 move the last callers onto `stats.*`.
      variables: statVariables(stats, values),
      namespaces: namespacesFor({ ...source, stats, statValues: values }, 'stat'),
    };

    const remaining: Stat[] = [];
    for (const stat of outstanding) {
      const value = evaluateFormulaString(stat.formula as string, context);

      if (!isFormulaError(value)) {
        values[stat.id] = finish(value, stat);
      } else if (keepErrors) {
        values[stat.id] = withSource(value, { kind: 'stat', id: stat.id, name: stat.name });
      } else {
        remaining.push(stat);
      }
    }

    return remaining;
  };

  // …then the derived ones, in as many passes as it takes to stop making progress
  let outstanding = derived;
  while (outstanding.length > 0) {
    const remaining = pass(outstanding, false);

    // No progress means everything left is genuinely unresolvable — a cycle, or a chain hanging
    // off one. One more pass writes each stat's own reason and ends it.
    if (remaining.length === outstanding.length) {
      pass(remaining, true);
      break;
    }

    outstanding = remaining;
  }

  return values;
}

/**
 * The composed values as the flat variable map, keyed by abbreviation
 *
 * Uppercased because the parser normalises bare identifiers that way, so `str` and `STR` are the
 * same reference. A stat with no value yet is left out, which is what makes an unresolved
 * dependency report as undefined during a pass rather than reading as 0.
 */
export function statVariables(
  stats: Stat[],
  values: Record<string, FormulaResult>
): Record<string, FormulaResult> {
  const variables: Record<string, FormulaResult> = {};

  for (const stat of stats) {
    const value = values[stat.id];
    if (value === undefined) continue;
    const spelling = stat.abbreviation.toUpperCase();
    if (!(spelling in variables)) variables[spelling] = value;
  }

  return variables;
}

/**
 * Sum the stats flagged as counting toward the character's total (Concept 01)
 *
 * A stat whose value could not be computed contributes nothing rather than poisoning the total:
 * one broken formula should cost the reader that one number, not the whole figure (Concept 00 §7).
 *
 * @param stats - The configuration's stats
 * @param values - Composed values from {@link calculateStatValues}
 * @returns The total
 */
export function calculateStatTotal(stats: Stat[], values: Record<string, FormulaResult>): number {
  return stats
    .filter((stat) => stat.countsTowardTotal)
    .reduce((total, stat) => total + (asNumber(values[stat.id]) ?? 0), 0);
}
