/**
 * Roll Definition Aggregator
 *
 * Runs one roll definition end to end for a character: evaluate its input, decompose that number
 * down its ladder, roll the pool, and report the whole chain (Concepts 07 and 08).
 *
 * Replaces `combatRoll.ts`, which combined a **hand-typed** dice pool with a formula bolted on as a
 * flat bonus. The difference is the ticket: a stronger character now rolls *bigger dice*, not the
 * same dice plus a bigger number.
 *
 * Randomness is a parameter, as everywhere else — the formula layer stays deterministic and every
 * die is rolled in one auditable place (spec §5).
 *
 * **Validates: Concepts 07, 08; Requirements 15.1, 15.2**
 */

import type { CalculatedCharacter } from '../../types/character';
import type { Configuration, RollDefinition } from '../../types/config';
import type { FormulaError, RollOutcome } from '../../types/formula';
import { formulaError, isFormulaError, withSource } from '../formula/errors';
import type { LadderDecomposition } from './diceLadder';
import { decomposeValue, formatLadderNotation, rollDecomposition } from './diceLadder';
import type { RandomSource } from './diceSimulator';

/**
 * A roll's pool: the decomposition and the string that names it
 *
 * Both halves together because they are one answer to one question — "what does this roll throw?"
 * — and separating them is how the label and the dice would come to disagree.
 */
export interface RollPoolResult {
  decomposition: LadderDecomposition;
  notation: string;
}

/**
 * What a roll throws for a given input (Concept 07, Concept 08)
 *
 * **The one place a pool is derived**, called by `rollRollDefinition` below and by the sheet's
 * `useCharacterSheet` to label the button. The ticket's claim is that the label and the dice are
 * the same computation rather than two that agree by inspection — this function is what makes that
 * literally true rather than a property of two call sites happening to match.
 *
 * @param roll - The definition being read
 * @param input - Its already-calculated input value
 * @param config - The configuration, for the ladder lookup
 * @returns The pool, or a `FormulaError` naming the roll when its ladder is gone
 */
export function rollPool(
  roll: RollDefinition,
  input: number,
  config: Configuration
): RollPoolResult | FormulaError {
  const ladder = (config.diceLadders ?? []).find((candidate) => candidate.id === roll.ladderId);

  if (!ladder) {
    // A ruleset problem the validator also reports, and the guarded delete normally prevents — but
    // an imported file can arrive already broken, and a roll with no ladder cannot produce dice
    return withSource(formulaError('not-evaluable', 'This roll has no dice ladder'), {
      kind: 'roll',
      id: roll.id,
      name: roll.name,
    });
  }

  const decomposition = decomposeValue(input, ladder);
  return { decomposition, notation: formatLadderNotation(decomposition, ladder) };
}

/**
 * Roll a definition for a character
 *
 * **The input is read from `character.rollInputs`, never re-evaluated here.** That is what makes
 * the ticket's single-source guarantee structural rather than a promise: the sheet labels the
 * button from the same map, so a roll cannot disagree with the number the Player was looking at
 * when they pressed it. It is the rule `rollCombatSkill` followed for its bonus, kept.
 *
 * @param roll - The definition being rolled
 * @param character - The character rolling it, with derived values already calculated
 * @param config - The configuration the character was built on
 * @param rng - Source of randomness; defaults to `Math.random`
 * @param timestamp - ISO timestamp for the result; defaults to now
 * @returns The whole chain — input, pool, per-die results, flat and total — or a `FormulaError`
 *   naming the roll when its input cannot be evaluated or its ladder is gone. Returning the error
 *   rather than rolling zero keeps a broken roll visibly broken (Concept 00 §7).
 */
export function rollRollDefinition(
  roll: RollDefinition,
  character: CalculatedCharacter,
  config: Configuration,
  rng: RandomSource = Math.random,
  timestamp: string = new Date().toISOString()
): RollOutcome | FormulaError {
  const input = character.rollInputs[roll.id];
  if (isFormulaError(input)) {
    return input;
  }

  if (input === undefined) {
    // A roll the calculation never saw — the definition was added to the ruleset after this
    // character was calculated. Not a number, so not rollable
    return withSource(formulaError('not-evaluable', 'This roll has no calculated input'), {
      kind: 'roll',
      id: roll.id,
      name: roll.name,
    });
  }

  // The same call the sheet makes to label the button — one derivation, two readers
  const pool = rollPool(roll, input, config);
  if (isFormulaError(pool)) {
    return pool;
  }

  const { dice, flat, total } = rollDecomposition(pool.decomposition, rng);

  return {
    rollId: roll.id,
    rollName: roll.name,
    input,
    dice,
    diceTotal: total - flat,
    flat,
    total,
    // The string the button showed, carried rather than re-derived
    notation: pool.notation,
    timestamp,
  };
}
