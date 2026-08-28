/**
 * The rules behind every write the Dungeon Master makes to a character (TICKET-DM-01)
 *
 * [`playerActions.ts`](./playerActions.ts)'s counterpart for the other half of v3 Req 41/42: what a
 * Player does to their own sheet lives there, what a DM does to somebody's lives here, and both are
 * in the Kernel so the browser and the server run one implementation
 * ([D5](../../../docs/v3.0_backend/overview.md#d5--the-engine-is-the-shared-kernel-and-the-server-is-authoritative)).
 *
 * ## Why the *local* sheet calls this too
 *
 * Signed out there is no DM, and the Player awards their own experience from the sheet — the
 * spreadsheet's own `exp.gs` shape (TICKET-RES-01). That is the same act with one person playing
 * both parts, so `characterStore.awardExperience` calls {@link addExperience} here rather than
 * keeping the arithmetic it used to own. The alternative was two implementations of *a deduction
 * below zero is refused*, which is precisely what PLY-01 spent a ticket removing.
 *
 * **The names here describe the document; `DM_ACTION`'s describe the act** — `playerActions.ts`'s
 * rule, and the same reason: `addExperience` is what happens to a `Character`, `dm-award-experience`
 * is what the DM did, and one spelling for both is a duplicate export `fallow` reports and an
 * `export *` can resolve ambiguously.
 *
 * ## Three things that are deliberately **not** here
 *
 * - **A level setter.** {@link setLevelExperience} writes `experience`; the level derives from it.
 *   There is no writable level anywhere in this app and D9 is the reason.
 * - **A budget setter.** {@link setGrantedPoints} moves `grantedStatPoints`, which is an *input* to
 *   `validateStatAllocation`'s pool. A stored budget would be a derived value with a second writer.
 * - **A resource setter.** A DM setting a pool obeys exactly the Player's rule, so the route calls
 *   `setResourceValue` from `playerActions.ts` unchanged (v3 Req 42.5). Re-exporting it here would
 *   be a second name for one function.
 *
 * The result type is `playerActions.ts`'s: an accepted change carries the character plus what the
 * value was and became, because every DM adjustment writes an Event with both (v3 Req 42.6), and a
 * refusal carries the sentence the surface shows. **Nothing here reads a clock** — `updatedAt` is
 * stamped by whichever root persists the result.
 *
 * **Validates: v3 Req 42.1, 42.2, 42.3, 42.4, 45.1; Requirements 21.1-21.5**
 */

import { experienceForLevel } from '../engine/characterSummary';
import { isFormulaError } from '../engine/formula/errors';
import { validateStatAllocation } from '../engine/skillAllocation';
import type { Character } from '../types/character';
import type { Configuration } from '../types/config';
import type { PlayerActionResult } from './playerActions';

/**
 * Whether an amount is a real, positive quantity
 *
 * Award and deduct each state their own direction, so a negative amount is a caller mistake rather
 * than a way to reverse the operation — accepting one would let `awardExperience(-100)` take
 * experience away without passing the below-zero refusal below. Moved here from `characterStore`,
 * where it was `isAwardableAmount`.
 */
function amountRefusal(amount: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'An award or a deduction has to be a positive amount.';
  }

  return null;
}

/**
 * The character's experience, or the reason it cannot be read
 *
 * Belt and braces with `isReadableCharacter`: a stored total that is not a number would compute
 * `undefined + amount` and persist `NaN`, which reads as level 1 forever and cannot be undone from
 * any surface. Refused rather than repaired — inventing a total is the same mistake as inventing a
 * level.
 */
function experienceOf(character: Character): number | null {
  return Number.isFinite(character.experience) ? character.experience : null;
}

/** The character with a new experience total, and the pair an Event records */
function withExperience(character: Character, before: number, after: number): PlayerActionResult {
  return { character: { ...character, experience: after }, before, after };
}

/**
 * Add to a character's accumulated experience (v3 Req 42.1)
 *
 * The level follows on its own — nothing here touches one.
 *
 * @param character Whose sheet
 * @param amount How much to award, positive
 * @returns The character with the experience added, or the reason it was refused
 */
export function addExperience(character: Character, amount: number): PlayerActionResult {
  const shape = amountRefusal(amount);
  if (shape) return { refusal: shape };

  const before = experienceOf(character);
  if (before === null) return { refusal: 'This character has no readable experience total.' };

  return withExperience(character, before, before + amount);
}

/**
 * Take experience away (v3 Req 42.1)
 *
 * **Below zero is refused, not clamped**, which is v1.0's rule carried onto the server path: a
 * deduction that quietly stopped at 0 would leave a table believing more had been taken than was.
 *
 * @param character Whose sheet
 * @param amount How much to take, positive
 * @returns The character with the experience removed, or the reason it was refused
 */
export function removeExperience(character: Character, amount: number): PlayerActionResult {
  const shape = amountRefusal(amount);
  if (shape) return { refusal: shape };

  const before = experienceOf(character);
  if (before === null) return { refusal: 'This character has no readable experience total.' };

  if (before - amount < 0) {
    return {
      refusal: `That would take ${character.name} below zero experience — they have ${before}. Nothing was deducted.`,
    };
  }

  return withExperience(character, before, before - amount);
}

/**
 * Put a character at a given level by writing the experience it costs (v3 Req 42.2)
 *
 * **The convenience D9 explicitly allows, and the only shape it allows it in.** The DM types a
 * level; `experienceForLevel` asks the ruleset's own `xp_thresholds` curve what that costs, and the
 * *experience* is what is stored. A curve that cannot price the level — no curve, no rows, out of
 * range with `outOfRange: 'error'`, or a table too coarse to tell that level from another — refuses
 * with the curve's own sentence rather than falling back to a guess.
 *
 * A level the character is already at is accepted rather than refused: it writes the same total,
 * which is what "set them to 7" means when they are at 7 with surplus experience, and the Event
 * records the correction.
 *
 * @param character Whose sheet
 * @param config The ruleset they play by — the browser's, or a session's Snapshot
 * @param level The level to put them at
 * @returns The character at that level's experience, or the reason the curve cannot say
 */
export function setLevelExperience(
  character: Character,
  config: Configuration,
  level: number
): PlayerActionResult {
  if (!Number.isInteger(level)) return { refusal: 'A level has to be a whole number.' };
  if (level < 1) return { refusal: 'A level cannot be below 1.' };

  const before = experienceOf(character);
  if (before === null) return { refusal: 'This character has no readable experience total.' };

  const experience = experienceForLevel(character, config, level);

  if (isFormulaError(experience)) {
    return { refusal: `This ruleset cannot price level ${level}: ${experience.message}` };
  }

  return withExperience(character, before, experience);
}

/**
 * Set how many extra points the DM has handed this character (v3 Req 42.3, 42.4)
 *
 * **A total rather than a delta**, matching `investInStat`: the DM sees a number and types the
 * number it should be, so two overlapping adjustments cannot compound into a third value neither of
 * them asked for.
 *
 * **A revocation that would leave the character overspent is refused, and names the overspend.**
 * The verdict is `validateStatAllocation`'s rather than arithmetic here — points are priced through
 * the `point_buy` curve, and re-deriving that would be exactly the duplication v3 Req 45.5 forbids.
 * Refuse rather than clamp, for the reason the spend does: silently taking back fewer points than
 * asked would leave a DM believing a revocation landed.
 *
 * A grant is only ever refused for *affordability*, so raising one always works — an allocation
 * that is already invalid for some other reason (a spend into a derived stat, an unpriceable gain)
 * is not made worse by more points, and refusing it here would leave the DM unable to help.
 *
 * @param character Whose sheet
 * @param config The ruleset they play by
 * @param points The new grant total, whole and not negative
 * @returns The character with the grant, or the reason it was refused
 */
export function setGrantedPoints(
  character: Character,
  config: Configuration,
  points: number
): PlayerActionResult {
  if (!Number.isInteger(points)) return { refusal: 'A grant has to be a whole number of points.' };
  if (points < 0) return { refusal: 'A grant cannot be negative — revoke it down to 0 instead.' };

  const before = character.grantedStatPoints ?? 0;
  const proposed: Character = { ...character, grantedStatPoints: points };

  if (points < before) {
    const after = validateStatAllocation(proposed, config);

    if (after.isOverBudget) {
      const remaining = after.pointsRemaining;
      const overspend = isFormulaError(remaining) ? 0 : -remaining;

      return {
        refusal: `Revoking down to ${points} would leave ${character.name} ${overspend} point${
          overspend === 1 ? '' : 's'
        } overspent. Have them refund some first.`,
      };
    }
  }

  return { character: proposed, before, after: points };
}
