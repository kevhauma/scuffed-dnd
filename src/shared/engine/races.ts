/**
 * A character's races — how many the ruleset gives them, and which ones those are (TICKET-RACE-04)
 *
 * The count used to be `MAX_RACE_COUNT`, a `2` written into `statCalculator.ts` and spelled again as
 * *at most 2* in three more places. The sheet's Setup form has two race slots, so two is the
 * **sheet's** answer — and the User's ruling of 2026-08-29 is that a number the workbook happens to
 * have is a default, not a rule
 * ([overview](../../../docs/v4.0_sheet_parity/overview.md#rulings-user-2026-08-29--ticket-review)).
 * So the count moves into the ruleset, where `points_per_level`, `bonus_divider` and
 * `race_blend_divisor` already live: `const.race_count`, absent meaning {@link DEFAULT_RACE_COUNT}.
 *
 * **A `Constant` rather than a new `Configuration` field**, which the ticket left open. Constants are
 * the established home for a per-ruleset number the engine reads by name (TICKET-CST-01), the User
 * already tunes the blend's other half — `race_blend_divisor` — from the constants panel, and a new
 * top-level field would be a persisted-shape change for a number that has a panel already. Nothing is
 * backfilled: the reader owns the default, the way `dreamLevelOf` owns *absent means 1*, so a ruleset
 * written before this ticket round-trips without growing a constant and behaves exactly as it did.
 *
 * **Validates: v4 systems/04 gap 2**
 */

import type { Constant, Race } from '../types/config';
import { namedConstant } from './formula/constants';

/** The constant a ruleset states its race count in, as a formula would spell it after `const.` */
export const RACE_COUNT_NAME = 'race_count';

/**
 * How many races a character has when the ruleset does not say
 *
 * **The sheet's two**, which is the whole of why it is two: `Setup` A7:B9 has a Mothers row and a
 * Fathers row, and the blend chain reads exactly those.
 *
 * Exported for its test and for nothing else, which is the honest reason: a default that only
 * exists as a literal in {@link raceCount}'s argument list is a default no test can name, and
 * *absent means two* is the load-bearing half of this ticket's backwards compatibility. The
 * surfaces that show the number to a User do **not** import it — the wizard renders how many slots
 * it drew and the refusal renders what `racesRequired` answered, because both are talking about
 * *this ruleset's* count rather than about the seed.
 */
export const DEFAULT_RACE_COUNT = 2;

/**
 * Whether a number can be a count of races
 *
 * Integer and not negative. A fractional or negative count has no reading at all — half a parent is
 * not a thing the blend can divide by — so such a constant is unusable rather than clamped, and the
 * seeded default takes over the way an unusable divisor's does.
 *
 * **Zero is usable and means what it says**: a ruleset whose characters have no lineage at all. It
 * is the one value that makes the wizard's race step render nothing while the ruleset still defines
 * races, so it reads as *deliberately raceless* rather than as a mistake — which is why it is not
 * folded in with the unusable values above.
 */
function isCountOfRaces(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

/**
 * How many races this ruleset gives a character
 *
 * The dial itself, read from the constants alone so the blend — which is handed a ruleset's
 * constants and never its whole `Configuration` — can read the same number the creation rules do.
 *
 * @param constants The ruleset's constants; absent is the same as none
 * @returns The ruleset's count, or {@link DEFAULT_RACE_COUNT} when it states none it can use
 */
export function raceCount(constants: Constant[] = []): number {
  return namedConstant(constants, RACE_COUNT_NAME, DEFAULT_RACE_COUNT, isCountOfRaces);
}

/**
 * What {@link racesRequired} needs of a ruleset — the races it offers and the dial
 *
 * Module-local: callers hand it a whole `Configuration` and TypeScript structurally accepts it, so
 * exporting the name would be supported API nothing consumes (the CR-39 rule).
 */
interface RaceCountRuleset {
  races: Race[];
  constants?: Constant[];
}

/**
 * How many races a character in this ruleset must have — **exactly**, not at most
 *
 * The creation rule's number, and the one the wizard renders a picker for. It is {@link raceCount}
 * with a single stated exception: **a ruleset that offers no races requires none.** That is not a
 * softening of the count, it is the count read honestly — `createFreshConfiguration` starts a ruleset
 * with an empty race list, and a rule that demanded two picks from an empty list would make a brand
 * new ruleset impossible to play (v1.0 Req 11.2, the reason TICKET-RACE-02 left the lower bound
 * open). A ruleset with *one* race is not the exception: the same race picked twice is what a
 * pure-blood is, which is the ruling that deleted `Empty`.
 *
 * **A missing race list reads as an empty one** rather than throwing, and that is load-bearing
 * rather than defensive habit: this is asked during *render* — the wizard draws one picker per slot
 * — so a malformed ruleset that threw here would cost the Player the whole step instead of the
 * preview. The calculation is still free to fail on it, and does.
 *
 * @param config The ruleset the character is being created against
 * @returns The number of race ids the character must carry
 */
export function racesRequired(config: RaceCountRuleset): number {
  const offered = config.races ?? [];

  return offered.length === 0 ? 0 : raceCount(config.constants);
}

/**
 * The races a character's picks name — in pick order, duplicates kept, capped at the count
 *
 * **A lookup rather than a filter, and that is the point of the function.** Every caller used to
 * write `config.races.filter((race) => character.raceIds.includes(race.id))`, which silently
 * *de-duplicates*: a pure-blood picked as `['ducklets', 'ducklets']` resolved to one race. With
 * duplicates now the way a pure-blood is expressed (`Empty` retired, TICKET-RACE-04), that answer
 * would be wrong the moment a ruleset asks for three — `['a', 'a', 'b']` would blend two blocks over
 * a divisor of three. It also restores the pick *order*, which a filter over the ruleset's list threw
 * away.
 *
 * A pick naming a race the ruleset no longer defines drops out, exactly as the filter dropped it: the
 * ruleset alone decides what exists (TICKET-REF-02). Dropping happens **before** the cap, so a
 * deleted race does not eat a slot a real one could have had.
 *
 * ## Why the cap is here rather than only in the blend
 *
 * `race_count` is a User-editable dial now, so *a stored character holding more picks than the
 * ruleset asks for* stopped being hand-edited data and became a Tuesday: lower a live ruleset from 3
 * to 2 and every seated 3-pick character is one. `calculateRaceStatBases` has always truncated, but
 * it answers only the **derivation** — the sheet's `raceNames` reads this list, so with the cap
 * anywhere else a sheet would name three lineages and blend two with nothing to say it. One list,
 * capped once, and display and derivation cannot disagree by construction. The blend's own slice
 * stays as a defence for callers that hand it a bare array.
 *
 * @param config The ruleset the character is played on — its races, and the count dial
 * @param raceIds What the character picked, duplicates and all
 * @returns One `Race` per resolvable pick, in pick order, no more than the ruleset's count
 */
export function resolveRaces(config: RaceCountRuleset, raceIds: string[]): Race[] {
  const entries = (config.races ?? []).map((race) => [race.id, race] as const);
  const byId = new Map(entries);

  const resolved = raceIds.flatMap((raceId) => {
    const race = byId.get(raceId);
    return race ? [race] : [];
  });

  return resolved.slice(0, racesRequired(config));
}
