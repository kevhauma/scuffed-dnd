/**
 * Point Buy
 *
 * What a point spent on a stat is actually worth (Concept 03, TICKET-ARC-02). The character's
 * archetype tags each stat `main`, `sub` or `non`; that tag names a **column** of the `point_buy`
 * curve, and the points they spent are the key:
 *
 * ```
 * gain = curve.point_buy(pointsSpentOnStat, affinityColumn)
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
 * Three rules the table does not state, and would be wrong to have to:
 *
 * 1. **A non-positive spend gains nothing.** The seed's `main` column is the generator
 *    `0.75 * (key + 1)`, which reads **0.75 at zero points** — a curve fitted over the range a
 *    Player actually spends in, not a claim that an untouched stat drifts upward. So zero is
 *    answered here rather than looked up, and a *negative* allocation is answered the same way:
 *    it is already refused as a `negative-points` violation, and letting it produce an
 *    out-of-range error as well would put a chip where that message belongs.
 * 2. **No `point_buy` curve means 1:1**, the pre-ARC-02 behaviour. A ruleset that defines no
 *    archetypes and no curve is most rulesets written before this ticket, and they keep working.
 *    One that defines archetypes *without* the curve is **reported by `validateConfiguration` and
 *    still repriced 1:1 at play time** (TICKET-ARC-01) — the report is what makes the fallback a
 *    stated compromise rather than a silent one, but it does not stop the ruleset being playable.
 * 3. **A lookup that fails is an error value, not a number.** The seed's `outOfRange` is `error`
 *    and its last row is 15 points, so a character who has spent more than the table covers is
 *    entirely reachable — and answering that with a confident 1:1 would hand them a *larger* gain
 *    than the main column ever grants. The stat chips instead (Concept 00 §7).
 *
 * **Validates: Concept 03; Concept 06; Concept 00 §7**
 */

import type { Character } from '../../types/character';
import type { Archetype, Configuration, Curve, StatAffinity } from '../../types/config';
import { DEFAULT_STAT_AFFINITY, POINT_BUY_CURVE_NAME } from '../../types/config';
import type { FormulaResult } from '../../types/formula';
import { lookupCurve } from '../formula/curves';

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
 * What the points spent on one stat are worth
 *
 * @param pointsSpent - Points the Player put into this stat
 * @param affinity - How much their archetype favours it
 * @param curve - The ruleset's `point_buy` curve, or undefined for the 1:1 fallback
 * @returns The gain, or the error explaining why the curve could not answer
 */
export function statGain(
  pointsSpent: number,
  affinity: StatAffinity,
  curve: Curve | undefined
): FormulaResult {
  // Rule 1 — see the module header
  if (pointsSpent <= 0) return 0;

  // Rule 2
  if (curve === undefined) return pointsSpent;

  // Rule 3. The stat this belongs to is attached by the composition, which is the layer that knows
  // it — `lookupCurve`'s own message already names the curve, the column and the input.
  return lookupCurve(curve, pointsSpent, affinity);
}
