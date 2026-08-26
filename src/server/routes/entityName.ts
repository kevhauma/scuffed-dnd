/**
 * The name a request body asked for, whatever it is naming (TICKET-GAM-01)
 *
 * **Extracted at the second caller rather than the third, and deliberately.** The conventions' rule
 * is *no abstraction before its third caller exists*, and it is aimed at speculative generality — an
 * option nothing passes, a flag for a case nobody has. This is the opposite shape: two callers that
 * exist today, fourteen identical lines apart, differing in one noun. `fallow dupes` measured it as
 * a 25-line clone the moment `sessionPayloads.ts` was written, and two copies of a validation rule
 * are two places for a bound to drift.
 *
 * **The subject is a parameter because the sentence is the content.** A DM told *"a ruleset needs a
 * name"* while starting a game has been handed somebody else's error, and that was the whole reason
 * the second copy existed. Making the noun an argument keeps both sentences exactly right with one
 * rule behind them.
 *
 * **Named `requiredName` rather than `nameFrom`**, which is what each aggregate's own wrapper is
 * called. Two exports sharing a spelling are two things an `export *` can resolve ambiguously
 * between — `fallow` reports it as a duplicate export, and the barrel rule in
 * [CLAUDE.md](../../../CLAUDE.md) is about exactly that.
 *
 * **Validates: v3 Req 33.2, 37.1**
 */

import { badRequest } from '../http/appError';

/**
 * The longest any of these may be
 *
 * A column with no bound is a column somebody fills. One number rather than one per entity: nothing
 * about a session name argues for a different length from a ruleset name, and two constants that
 * happen to be equal are two constants somebody will later make unequal by accident.
 */
const MAX_NAME_LENGTH = 120;

/**
 * The name a request body asked for
 *
 * **Uniqueness is deliberately not checked** (TICKET-RUL-01's notes): two rulesets called "Ducklets"
 * is the User's business, and the id is the identity as it is everywhere else here. What is checked
 * is that there is a name at all, because a blank row in a list is one the User cannot tell from any
 * other.
 *
 * @param body The parsed request body
 * @param subject What is being named, as it appears in the refusal — `ruleset`, `game session`
 * @returns The trimmed name
 * @throws {AppError} 400 when it is absent, blank or too long
 */
export function requiredName(body: unknown, subject: string): string {
  const value = (body as { name?: unknown } | null)?.name;

  if (typeof value !== 'string' || value.trim() === '') {
    throw badRequest(`A ${subject} needs a name.`);
  }

  const name = value.trim();

  if (name.length > MAX_NAME_LENGTH) {
    throw badRequest(`A ${subject} name is at most ${MAX_NAME_LENGTH} characters.`);
  }

  return name;
}
