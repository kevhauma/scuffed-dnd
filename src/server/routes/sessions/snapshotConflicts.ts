/**
 * What a new Snapshot would break at a table already playing (TICKET-GAM-01)
 *
 * **This is the ticket's real content**, and the reason is worth stating rather than assuming:
 * without it, D7 only *defers* the problem. The pinned Snapshot protects Friday's game from
 * Thursday's tinkering — and then the DM eventually refreshes, and breaks the table anyway, later
 * and with less warning. Refusing a refresh that would invalidate somebody is what turns "your
 * changes cannot reach a running game by accident" into "…or on purpose without being told".
 *
 * **The notion of validity is the Kernel's, not a new one.** A character is invalid against a
 * Snapshot exactly when `validateStatAllocation` rejects it — which already reports a stat that has
 * gone (`unknownStatIds`), points in a stat that became derived, a spend the point-buy curve can no
 * longer price, a skill box below zero (TICKET-RES-05), an overspent pool, and a budget the new
 * `xp_thresholds` curve cannot derive. Writing a second definition here would be writing a rule the
 * sheet does not apply. Every arm of that verdict gets a sentence here — see
 * {@link allocationReason} for why a missing arm is worse than a wrong one.
 *
 * **A conflict is a *comparison*, not an absolute** (TICKET-RES-05). The check asks whether the
 * refresh **breaks** somebody, so a character the *current* Snapshot already rejects cannot block
 * it: they are broken now and would be broken either way, and refusing on their account freezes the
 * table forever — including against the very refresh that would fix them. That is the same
 * judgement the Kernel's refund rule makes one layer up (a change that does not make things worse is
 * not refused), and RES-05 is what made it urgent rather than theoretical: widening the pool over
 * skill investment means an ordinary table now holds such characters, and so does a DM's
 * `removeExperience` on a fresh install, which lowers the level and with it the pool. Their
 * overspend is still reported — on their own sheet, in crimson, which is where it can be acted on.
 *
 * **The names come from the *old* Snapshot.** A stat the refresh removes has no name in the new one,
 * and *"Quackers has 7 points in stat-4f2a"* is a refusal a DM cannot act on.
 *
 * **Validates: v3 Req 37.6**
 */

import { isFormulaError } from '#shared/engine/formula/errors';
import { type StatAllocationResult, validateStatAllocation } from '#shared/engine/skillAllocation';
import { isReadableCharacter } from '#shared/services/characterShape';
import type { SnapshotConflict } from '#shared/types/api';
import type { Character } from '#shared/types/character';
import type { Configuration } from '#shared/types/config';
import type { CharacterRow } from '../../repositories/characterRepository';

/** What each stat is called in the Snapshot being replaced, so a removal can be named */
function statNames(config: Configuration): Map<string, string> {
  return new Map(config.stats.map((stat) => [stat.id, stat.name]));
}

/**
 * The sentence for stats the new Snapshot no longer defines
 *
 * The common case by a distance, and the one criterion three names: a DM deletes a stat, and every
 * character who spent points in it is holding an allocation that buys nothing.
 */
function removedStatReason(statIds: string[], names: Map<string, string>): string {
  const spelled = statIds.map((id) => names.get(id) ?? id).join(', ');

  return (
    `has points invested in ${spelled}, which the refreshed rules no longer define — ` +
    'those points would buy nothing'
  );
}

/** The sentence for a per-stat violation `validateStatAllocation` reports */
function violationReason(reasons: string[]): string {
  return `has an allocation the refreshed rules refuse: ${[...new Set(reasons)].join(', ')}`;
}

/**
 * Why the refreshed rules refuse this allocation, in one sentence a DM can act on
 *
 * **One arm per way the verdict can be invalid, and the order is the DM's priorities**: what the
 * refresh *removed* first, then what it made impossible, then what it made unaffordable.
 *
 * The last arm is the reason this is a function rather than a ternary. Over budget is deliberately
 * **not** a per-entry violation — the engine's own tests assert `violations: []` and
 * `skillViolations: []` for an overspend — so a reader that consults only those two lists renders
 * *"has an allocation the refreshed rules refuse: "*, a refusal with nothing after the colon. An
 * unnamed arm here is not a wrong sentence, it is an empty one.
 *
 * @param allocation The Kernel's verdict against the candidate Snapshot
 * @param names What each stat is called in the Snapshot being replaced
 * @returns The sentence, which always has something after the verb
 */
function allocationReason(allocation: StatAllocationResult, names: Map<string, string>): string {
  if (allocation.unknownStatIds.length > 0) {
    return removedStatReason(allocation.unknownStatIds, names);
  }

  if (allocation.violations.length > 0) {
    const reasons = allocation.violations.map((violation) => violation.reason);

    return violationReason(reasons);
  }

  // The skill half of the same verdict (TICKET-RES-05) — `allocationRefusal` in
  // `characterCreation.ts` names it the same way, and one verdict must not have two readers that
  // disagree about which of its arms are worth saying out loud
  const [skillViolation] = allocation.skillViolations;

  if (skillViolation) {
    return `has ${skillViolation.points} points in ${skillViolation.skillName}, which is not a number of points a skill can hold`;
  }

  const remaining = allocation.pointsRemaining;

  if (allocation.isOverBudget && !isFormulaError(remaining)) {
    const overspend = -remaining;
    const plural = overspend === 1 ? '' : 's';

    return (
      `has spent ${allocation.pointsSpent} points across their stats and skills, which is ` +
      `${overspend} point${plural} more than the refreshed rules grant them`
    );
  }

  // What is left is a pool that could not be derived at all — no `xp_thresholds` curve in the
  // candidate, most likely. `isValid` is false and nothing above can name it, which is exactly the
  // empty-sentence case this arm exists to close.
  return (
    'has an allocation the refreshed rules cannot price at all, because those rules cannot say ' +
    'how many points this character has to spend'
  );
}

/**
 * A character row's stored player state, or nothing readable
 *
 * **The parse is guarded**, because `data` is a `TEXT` column and nothing in the database enforces
 * that it holds JSON. An unparseable row is the same situation as an unreadable one — the check
 * cannot see past it — and answering with the conflict below is what the whole module is for;
 * letting a `SyntaxError` out would answer a DM's refresh with a 500 that says nothing.
 *
 * @param row The stored character
 * @returns The parsed player state, or `null` when the column does not hold JSON
 */
function storedCharacter(row: CharacterRow): Character | null {
  try {
    return JSON.parse(row.data) as Character;
  } catch {
    return null;
  }
}

/**
 * Why one character could not survive the refresh, or nothing
 *
 * @param row The stored character
 * @param current The Snapshot being replaced — what the character is measured *from*
 * @param candidate The Snapshot that would be pinned
 * @param names What each stat is called in the Snapshot being replaced
 * @returns The conflict, or `null` when the refresh does not break this character
 */
function conflictFor(
  row: CharacterRow,
  current: Configuration,
  candidate: Configuration,
  names: Map<string, string>
): SnapshotConflict | null {
  const character = storedCharacter(row);

  // **Refused rather than skipped.** A character this build cannot read is a pre-existing problem
  // and not one the refresh causes — but it is also one the check cannot see past, and refreshing
  // while unable to tell whether somebody breaks is exactly what this route exists to prevent.
  if (character === null || !isReadableCharacter(character)) {
    return {
      characterId: row.id,
      characterName: row.name,
      reason:
        'is stored in a shape this version of the app cannot read, so the refreshed rules ' +
        'cannot be checked against it',
    };
  }

  const after = validateStatAllocation(character, candidate);
  if (after.isValid) return null;

  // **Broken *by* the refresh, not merely broken** (TICKET-RES-05) — see the module header. Asked
  // second, so the common case costs one verdict: a character the refresh does not break is
  // answered by the line above without this ever running.
  const before = validateStatAllocation(character, current);
  if (!before.isValid) return null;

  return {
    characterId: row.id,
    characterName: row.name,
    reason: allocationReason(after, names),
  };
}

/**
 * Every character a refresh would invalidate (v3 Req 37.6)
 *
 * **All of them, not the first.** A DM told about one broken character, who fixes it and meets the
 * next, learns the size of the problem one refusal at a time. The refusal is cheap — it is a walk
 * over one table's characters against a document already in memory.
 *
 * @param characters The characters at the table
 * @param current The Snapshot being replaced — the names, and the verdict each character is
 *   measured against, so an already-invalid character does not block a refresh it did not cause
 * @param candidate The Snapshot that would be pinned
 * @returns One entry per character the refresh would break; empty when the refresh is safe
 */
export function snapshotConflicts(
  characters: CharacterRow[],
  current: Configuration,
  candidate: Configuration
): SnapshotConflict[] {
  const names = statNames(current);

  return characters
    .map((row) => conflictFor(row, current, candidate, names))
    .filter((conflict): conflict is SnapshotConflict => conflict !== null);
}
