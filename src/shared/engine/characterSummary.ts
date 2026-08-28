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
 * TICKET-DM-01 adds the **forward** read of the same table — *what does level 7 cost?* — which is
 * what a DM's "set level to N" writes. It is still one curve and one lookup; nothing stores a level.
 *
 * **Validates: Concept 20; Concept 06; Requirement 11.5; v3 Req 42.2**
 */

import type { Character, CharacterSummary } from '../types/character';
import type { Configuration, Curve } from '../types/config';
import type { FormulaError, FormulaResult } from '../types/formula';
import { lookupCurve } from './formula/curves';
import { formulaError, isFormulaError } from './formula/errors';

/** The curve a level is read out of, seeded by TICKET-CRV-03 */
const XP_CURVE_NAME = 'xp_thresholds';

/**
 * The ruleset's XP curve, or the error that stands in for it
 *
 * Both directions of the same table go through here, so *this ruleset has no such curve* is one
 * sentence rather than two that can drift.
 */
function experienceCurve(config: Configuration): Curve | FormulaError {
  const curve = (config.curves ?? []).find((candidate) => candidate.name === XP_CURVE_NAME);

  if (curve === undefined) {
    return formulaError(
      'undefined-variable',
      `This ruleset has no "${XP_CURVE_NAME}" curve, so there is nothing to read a level out of`
    );
  }

  return curve;
}

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
  const curve = experienceCurve(config);
  if (isFormulaError(curve)) return curve;

  return lookupCurve(curve, character.experience);
}

/**
 * The experience a character needs to stand at a given level (TICKET-DM-01, v3 Req 42.2)
 *
 * **The same table, read the other way.** `xp_thresholds` is authored as *level → XP required* and
 * read `reverse` — XP in, level out — which is what {@link calculateCharacterLevel} does. A DM
 * saying *"set them to level 7"* is asking the forward question, so the curve is flipped rather
 * than a second table being consulted or the thresholds being re-derived by hand. Every mode the
 * User set — `step` or `linear`, clamped or extrapolated or refused — applies unchanged, because it
 * is the same `lookupCurve`.
 *
 * **It is a convenience over experience, never a stored level** (D9). What this returns is written
 * to `Character.experience`; the level is derived from it a moment later, by the function above.
 *
 * **The round trip is checked, and a mismatch is refused rather than guessed.** A curve with one
 * row happily answers *level 7 costs 0 XP* by extrapolating from nothing, and writing that would
 * leave the character at level 1 with the DM told it worked. So the answer is fed back through
 * {@link calculateCharacterLevel}, and unless it comes back as the level that was asked for, this
 * reports that the curve cannot price it — Concept 00 §7's rule that a value which cannot be
 * computed is an error rather than a plausible number.
 *
 * @param character The character whose experience would be replaced
 * @param config The ruleset holding the `xp_thresholds` curve
 * @param level The level the DM asked for
 * @returns The total experience that level costs, or why the curve cannot say
 */
export function experienceForLevel(
  character: Character,
  config: Configuration,
  level: number
): FormulaResult {
  const curve = experienceCurve(config);
  if (isFormulaError(curve)) return curve;

  const experience = lookupCurve({ ...curve, lookupDirection: 'forward' }, level);
  if (isFormulaError(experience)) return experience;

  const reached = calculateCharacterLevel({ ...character, experience }, config);

  if (isFormulaError(reached)) return reached;
  if (reached !== level) {
    return formulaError(
      'out-of-range',
      `curve.${XP_CURVE_NAME} cannot price level ${level} — ${experience} experience reads back as level ${reached}`
    );
  }

  return experience;
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
