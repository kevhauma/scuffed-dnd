/**
 * Stat Calculator
 *
 * The composition calculator (Concept 01, TICKET-STAT-01). One function answers "what is this
 * stat worth on this character", for all three kinds of stat, because there is one kind of stat:
 *
 * - **invested** — `race base + invested points + racial modifiers + equipment`;
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
 * exists, so an allocation, racial modifier or equipment bonus naming a stat the configuration no
 * longer defines contributes nothing rather than answering for a deleted stat.
 *
 * **Validates: Concept 01; Concept 00 §7; Requirements 3.4, 3.6, 8.4, 16.6**
 */

import type { Character } from '../../types/character';
import type { Race, SkillModifier, Stat } from '../../types/config';
import type { FormulaContext, FormulaResult } from '../../types/formula';
import { asNumber, isFormulaError, withSource } from '../formula/errors';
import { evaluateFormulaString } from '../formula/evaluator';
import type { NamespaceSource } from '../formula/namespaces';
import { namespacesFor } from '../formula/namespaces';

/** What the composition needs beyond the stats themselves */
export interface StatCompositionOptions {
  /** The character's races, for their skill modifiers */
  races?: Race[];
  /** Aggregated bonuses from equipped items; only those naming a stat abbreviation are applied */
  equipmentBonuses?: SkillModifier[];
  /** Bonus granted when the character's focus stat is this stat — retired by TICKET-ARC-03 */
  focusStatBonusLevel?: number;
  /** The ruleset's constants and curves, backing `const.*` and `curve.*(x)` */
  source?: NamespaceSource;
}

/**
 * Sum the skill modifiers granted by a set of races
 *
 * Kept separate from the totals so the UI can show the racial contribution on its own
 * (Requirement 8.4, 13.4) without recovering it from a difference. Keyed by whatever the modifier
 * names — a stat abbreviation, since TICKET-STAT-01's bridge.
 *
 * @param races - The character's races
 * @returns Record of abbreviation to combined racial modifier
 */
export function calculateRacialSkillModifiers(races: Race[]): Record<string, number> {
  const racialModifiers: Record<string, number> = {};

  // Multiple races combine additively — TICKET-RACE-02 replaces this with a blended base
  for (const race of races) {
    for (const modifier of race.skillModifiers) {
      racialModifiers[modifier.skillCode] =
        (racialModifiers[modifier.skillCode] || 0) + modifier.modifier;
    }
  }

  return racialModifiers;
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
 * The race base term is 0: Concept 04's stat blocks arrive with TICKET-RACE-01/02, and inventing
 * a base here would mean two places to change when they do. Racial *modifiers* still apply —
 * they are a different idea, and dropping them mid-milestone would silently unbalance every
 * existing character.
 */
function investedValue(
  stat: Stat,
  character: Character,
  racialModifiers: Record<string, number>,
  equipmentBonuses: SkillModifier[],
  focusStatBonusLevel: number
): number {
  const base = 0; // TICKET-RACE-02 wires the race stat block in here
  const invested = character.investedStatPoints[stat.id] ?? 0; // 1:1 until TICKET-ARC-02 routes it through a curve
  const racial = racialModifiers[stat.abbreviation] ?? 0;

  const equipment = equipmentBonuses
    .filter((bonus) => bonus.skillCode === stat.abbreviation)
    .reduce((sum, bonus) => sum + bonus.modifier, 0);

  const focus = character.focusStatCode === stat.abbreviation ? focusStatBonusLevel : 0;

  return base + invested + racial + equipment + focus;
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
 * @param options - Races, equipment, focus bonus, and the ruleset behind `const.*` / `curve.*`
 * @returns Record of stat id to composed value, or the error explaining why there isn't one
 */
export function calculateStatValues(
  stats: Stat[],
  character: Character,
  options: StatCompositionOptions = {}
): Record<string, FormulaResult> {
  const { races = [], equipmentBonuses = [], focusStatBonusLevel = 0, source = {} } = options;

  const racialModifiers = calculateRacialSkillModifiers(races);
  const values: Record<string, FormulaResult> = {};

  // Seed the invested stats — they depend on nothing, so they are done in one pass
  const derived: Stat[] = [];
  for (const stat of stats) {
    if (stat.formula === undefined) {
      values[stat.id] = finish(
        investedValue(stat, character, racialModifiers, equipmentBonuses, focusStatBonusLevel),
        stat
      );
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
