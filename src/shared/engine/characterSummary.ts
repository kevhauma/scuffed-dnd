/**
 * Character Summary
 *
 * The one definition of a character's "level", and the lightweight summary the character list
 * renders. Pure — no React, no storage.
 *
 * **Level is read backwards out of the `xp_thresholds` curve** (Concept 20, TICKET-RES-01):
 * accumulated XP goes in, the level whose threshold it has reached comes out. This inverts v1.0,
 * where level was the *sum of points spent* — which made the chain run backwards, since the spec
 * has `XP → level → budget → spend` and TICKET-RES-02 closes the budget half. A level therefore no
 * longer moves when the Player allocates points; it moves when they are awarded experience.
 *
 * The curve is found **by name**, the third thing to be after `const.bonus_divider` and
 * `const.race_blend_divisor`, and with the same consequence: this is system arithmetic rather than
 * a User formula, so there is nothing for `references.ts` to re-spell and renaming the curve breaks
 * the link rather than following it. That is reported rather than papered over — see below.
 *
 * **Validates: Concept 20; Concept 06; Requirement 11.5**
 */

import type { Character, CharacterSummary } from '../types/character';
import type { Configuration } from '../types/config';
import type { FormulaResult } from '../types/formula';
import { lookupCurve } from './formula/curves';
import { formulaError } from './formula/errors';

/** The curve a level is read out of, seeded by TICKET-CRV-03 */
const XP_CURVE_NAME = 'xp_thresholds';

/**
 * The level a character's experience has reached
 *
 * Returns a `FormulaResult` rather than a number because the curve is the User's data like any
 * other: they can delete it, empty it, or set `outOfRange: 'error'` and leave a character's XP
 * outside the table. Each of those is reported as an error value the sheet and the list chip,
 * rather than as a confident level 1 — a wrong level would silently misprice every budget
 * TICKET-RES-02 derives from it (Concept 00 §7).
 *
 * @param character - The character whose experience is being read
 * @param config - The ruleset holding the `xp_thresholds` curve
 * @returns The level, or an error explaining why there isn't one
 */
export function calculateCharacterLevel(
  character: Character,
  config: Configuration
): FormulaResult {
  const curve = (config.curves ?? []).find((candidate) => candidate.name === XP_CURVE_NAME);

  if (curve === undefined) {
    return formulaError(
      'undefined-variable',
      `This ruleset has no "${XP_CURVE_NAME}" curve, so there is nothing to read a level out of`
    );
  }

  return lookupCurve(curve, character.experience);
}

/**
 * Reduce a character to the fields a list needs
 *
 * @param character - The character to summarise
 * @param config - The ruleset the level is derived against
 * @returns Identity, races, derived level, and creation date
 */
export function toCharacterSummary(character: Character, config: Configuration): CharacterSummary {
  return {
    id: character.id,
    name: character.name,
    raceIds: character.raceIds,
    level: calculateCharacterLevel(character, config),
    createdAt: character.createdAt,
  };
}
