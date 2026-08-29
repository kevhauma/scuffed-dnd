/**
 * Point Buy
 *
 * What a point spent on a stat is actually worth (Concept 03, TICKET-ARC-02), amplified by how far
 * the character stands in their dream (v4 systems/05, TICKET-ARC-04). The character's archetype
 * tags each stat `main`, `sub` or `non`; that tag names a **column** of the `point_buy` curve, the
 * points they spent are the key, and the tag then names the shape Dream level enters in:
 *
 * ```
 * priced = curve.point_buy(pointsSpentOnStat, affinityColumn)
 *
 * main → priced × dreamLevel
 * sub  → priced + dreamLevel
 * non  → priced
 * ```
 *
 * This replaces TICKET-STAT-01's provisional 1:1 term. The spread is the whole point of the
 * concept: against Concept 06's seed table, 15 points buy **5** on a non-type stat, **7** on a
 * sub-type and **12** on a main-type — the 2.4× the sheet confirms, and how the sample *Funny*
 * character reaches Char 39 while everything else sits near 10.
 *
 * **`investedStatPoints` therefore means points *spent*, not levels gained.** The curve is the
 * exchange rate between the two, which is what makes "flatten the archetype advantage" a table edit
 * rather than a code change.
 *
 * ## The dream term is hard-wired, and it is not a dial
 *
 * The new workbook's `Background Archetype calulation` writes `× dream` and `+ dream` into every
 * cell of the matrix; nothing in the sheet varies which is which, and no User has asked to. Two
 * constants standing in for two literals would be an abstraction before its first caller, let alone
 * its third — so the shape is written here, once, and the *level* is the only input.
 *
 * **The term applies to the 1:1 fallback too** (rule 2 below), because it belongs to the gain
 * formula rather than to the table: a ruleset with archetypes but no curve is already a stated
 * compromise, and having it be the one place a sub stat stops tracking Dream level would be a
 * second rule nobody could see. At the neutral level of 1 the only visible consequence is the flat
 * `+1` on a sub-tagged stat, which is exactly what the sheet grants.
 *
 * Three rules the table does not state, and would be wrong to have to:
 *
 * 1. **A negative spend gains nothing.** It is already refused as a `negative-points` violation,
 *    and letting it produce an out-of-range error as well would put a chip where that message
 *    belongs — so it is answered here, flatly, dream term included: there is no gain to amplify.
 *
 *    **Zero is no longer answered that way** (TICKET-ARC-04). ARC-02 read the seed's `main`
 *    generator `0.75 * (key + 1)` reaching **0.75 at zero points** as a curve fitted over the range
 *    a Player actually spends in, and zeroed it — *"a non-positive spend gains nothing"*, *"an
 *    untouched stat does not drift upward"*. **That note is superseded**: the new sheet's formulas
 *    read the 0 row like any other and the User's 2026-08-29 ruling is explicit that a sub stat
 *    gains `+dreamLevel` at zero points, so an archetype grants a small passive block over its two
 *    sub stats that grows with Dream level. `main(0)` is therefore a real `0.75 × dreamLevel`, and
 *    the first genuinely fractional gain the composition carries (systems/03 rounds nothing).
 * 2. **No `point_buy` curve means 1:1**, the pre-ARC-02 behaviour. A ruleset that defines no
 *    archetypes and no curve is most rulesets written before this ticket, and they keep working.
 *    One that defines archetypes *without* the curve is **reported by `validateConfiguration` and
 *    still repriced 1:1 at play time** (TICKET-ARC-01) — the report is what makes the fallback a
 *    stated compromise rather than a silent one, but it does not stop the ruleset being playable.
 * 3. **A lookup that fails is an error value, not a number.** The seed's `outOfRange` is `error`
 *    and its last row is 15 points, so a character who has spent more than the table covers is
 *    entirely reachable — and answering that with a confident 1:1 would hand them a *larger* gain
 *    than the main column ever grants. The stat chips instead (Concept 00 §7), and a chip is never
 *    amplified: multiplying an error by a dream level is not a number either.
 *
 * **Validates: Concept 03; Concept 06; Concept 00 §7; v4 systems/05**
 */

import type { Character } from '../../types/character';
import type { Archetype, Configuration, Curve, StatAffinity } from '../../types/config';
import { DEFAULT_STAT_AFFINITY, POINT_BUY_CURVE_NAME, STAT_AFFINITY } from '../../types/config';
import type { FormulaResult } from '../../types/formula';
import { lookupCurve } from '../formula/curves';
import { isFormulaError } from '../formula/errors';

/**
 * The archetype a character grows along, or undefined when they have none
 *
 * A character mid-creation has not chosen one yet, and a ruleset may define none at all — both
 * route every stat through `non`, which is defined behaviour rather than an accident.
 *
 * @param character - The character whose `archetypeId` is being resolved
 * @param config - The ruleset holding the archetypes
 * @returns The archetype, or undefined
 */
export function archetypeOf(character: Character, config: Configuration): Archetype | undefined {
  if (character.archetypeId === undefined) return undefined;
  return (config.archetypes ?? []).find((archetype) => archetype.id === character.archetypeId);
}

/**
 * How much an archetype favours one stat
 *
 * @param archetype - The character's archetype, or undefined when they have none
 * @param statId - The stat being looked up
 * @returns The tag, defaulting to `non` for an untagged stat or an archetype-less character
 */
export function affinityFor(archetype: Archetype | undefined, statId: string): StatAffinity {
  return archetype?.statAffinity[statId] ?? DEFAULT_STAT_AFFINITY;
}

/** The ruleset's point-buy curve, or undefined when it defines none */
export function pointBuyCurve(config: Configuration): Curve | undefined {
  return (config.curves ?? []).find((curve) => curve.name === POINT_BUY_CURVE_NAME);
}

/**
 * How Dream level enters a gain the table has already priced (TICKET-ARC-04)
 *
 * The shape is the affinity's, not the curve's — see the module header for why it is written here
 * rather than dialled. `non` is the identity, which is what makes a character with no archetype
 * (every stat `non`) compute exactly as they did before this ticket.
 *
 * @param priced - What the curve, or the 1:1 fallback, said the spend is worth
 * @param affinity - How much the archetype favours the stat
 * @param dreamLevel - The character's dream level, read by the caller through `dreamLevelOf`
 * @returns The amplified gain
 */
function amplifyByDream(priced: number, affinity: StatAffinity, dreamLevel: number): number {
  switch (affinity) {
    case STAT_AFFINITY.MAIN:
      return priced * dreamLevel;
    case STAT_AFFINITY.SUB:
      return priced + dreamLevel;
    case STAT_AFFINITY.NON:
      return priced;
    default: {
      // Config and engine disagree about the tag — a bug, not a ruleset problem
      const _exhaustive: never = affinity;
      throw new Error(`Unknown stat affinity: ${_exhaustive}`);
    }
  }
}

/**
 * What the points spent on one stat are worth
 *
 * **The dream level is a parameter rather than the character** because the engine prices a spend
 * and nothing else: each caller that has a `Character` in scope — the composition, the allocation
 * readout and the sheet's breakdown row — reads it with `dreamLevelOf` (RES-04's one reader, which
 * owns the absent-means-1 default) and passes the number. The parameter is **required** for that
 * reason: a default here would be a second rule competing with that reader, and the `Character`
 * shape stays out of the pricing entirely.
 *
 * @param pointsSpent - Points the Player put into this stat
 * @param affinity - How much their archetype favours it
 * @param curve - The ruleset's `point_buy` curve, or undefined for the 1:1 fallback
 * @param dreamLevel - How far the character stands in their dream, from `dreamLevelOf`
 * @returns The gain, or the error explaining why the curve could not answer
 */
export function statGain(
  pointsSpent: number,
  affinity: StatAffinity,
  curve: Curve | undefined,
  dreamLevel: number
): FormulaResult {
  // Rule 1 — see the module header
  if (pointsSpent < 0) return 0;

  // Rule 2. Rule 3's lookup names no stat: the one this belongs to is attached by the composition,
  // which is the layer that knows it — `lookupCurve`'s own message already names the curve, the
  // column and the input.
  const priced = curve === undefined ? pointsSpent : lookupCurve(curve, pointsSpent, affinity);

  // Rule 3
  if (isFormulaError(priced)) return priced;

  return amplifyByDream(priced, affinity, dreamLevel);
}
