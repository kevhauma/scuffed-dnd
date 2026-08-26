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
 * longer price, and a budget the new `xp_thresholds` curve cannot derive. Writing a second
 * definition here would be writing a rule the sheet does not apply.
 *
 * **The names come from the *old* Snapshot.** A stat the refresh removes has no name in the new one,
 * and *"Quackers has 7 points in stat-4f2a"* is a refusal a DM cannot act on.
 *
 * **Validates: v3 Req 37.6**
 */

import { validateStatAllocation } from '#shared/engine/skillAllocation';
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

/** The sentence for everything else `validateStatAllocation` reports */
function violationReason(reasons: string[]): string {
  return `has an allocation the refreshed rules refuse: ${[...new Set(reasons)].join(', ')}`;
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
 * @param candidate The Snapshot that would be pinned
 * @param names What each stat is called in the Snapshot being replaced
 * @returns The conflict, or `null` when the character is fine against the new rules
 */
function conflictFor(
  row: CharacterRow,
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

  const allocation = validateStatAllocation(character, candidate);
  if (allocation.isValid) return null;

  return {
    characterId: row.id,
    characterName: row.name,
    reason:
      allocation.unknownStatIds.length > 0
        ? removedStatReason(allocation.unknownStatIds, names)
        : violationReason(allocation.violations.map((violation) => violation.reason)),
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
 * @param current The Snapshot being replaced, for the names
 * @param candidate The Snapshot that would be pinned
 * @returns One entry per character that would break; empty when the refresh is safe
 */
export function snapshotConflicts(
  characters: CharacterRow[],
  current: Configuration,
  candidate: Configuration
): SnapshotConflict[] {
  const names = statNames(current);

  return characters
    .map((row) => conflictFor(row, candidate, names))
    .filter((conflict): conflict is SnapshotConflict => conflict !== null);
}
