/**
 * The session roster, derived (TICKET-DM-04, v3 Req 49.8)
 *
 * *Who is at this table, what are they playing, and where do their numbers stand* — answered once,
 * from the table's Snapshot, as one list. The pure half of the roster: no React, no requests, no
 * decision about who may press what.
 *
 * ## Everything on a row is derived, and the ruleset decides what the columns are
 *
 * A level comes from `calculateCharacterLevel`, the points from `validateStatAllocation`, and the
 * pools from **whatever the Snapshot flags `isResource`** — so a ruleset that adds a fourth resource
 * grows a fourth pair of cells and two more quick actions with nothing recompiled (v1.0 Req 20, v3
 * Req 49.2). No stat is named here, and the only English in the file is the two group captions.
 *
 * **Nothing is stored and nothing is recomputed by hand.** Each row is a read of the engine's answer,
 * which is why a DM's adjustment landing on the cached character moves the level, the budget and the
 * pool in one render without anything being written.
 *
 * ## One list, not three (v3 Req 49.8's *replaces*)
 *
 * TICKET-GAM-04's lobby answered *who is here* and TICKET-CHAR-04's panel answered *what is on the
 * table*, and both were the same question asked at different depths. Grouping the characters **under
 * their owner** answers both at once, which is what lets DM-04 retire both surfaces rather than add a
 * third beside them. A Member playing nothing still gets a group, because Req 39.7 asks for every
 * Member with their role and connection — presence is a fact about a *person*, so it belongs on the
 * group header rather than on a row that may not exist.
 *
 * **The departed group is derived rather than fetched.** A character whose `ownerAccountId` is not
 * among the Members is one whose player has gone (v3 Req 39.3), and `GET /api/sessions/:id/characters`
 * deliberately still lists them. Deriving it means those rows get **numbers** — the lobby could only
 * name them — and means the two answers cannot disagree about who has left.
 *
 * ## Order is stable and nobody chooses it
 *
 * Members in the order the server sent (the DM first, then by when they joined), characters by name
 * within a Member, and the departed last. **Sorting, grouping and filtering controls are deliberately
 * not in this ticket** — a table of six wants them and the User has not asked yet.
 *
 * **Validates: v3 Req 39.3, 39.7, 49.1, 49.2, 49.8**
 */

import { calculateCharacter } from '#shared/engine/calculator';
import { calculateCharacterLevel } from '#shared/engine/characterSummary';
import { validateStatAllocation } from '#shared/engine/skillAllocation';
import type { CharacterDocument, SessionMemberSummary } from '#shared/types/api';
import type { Character } from '#shared/types/character';
import type { Configuration } from '#shared/types/config';
import { quickActionsForCharacter } from '../../play/shared/characterQuickActions';
import type { DerivedValue } from '../../play/shared/derivedValue';
import { toDerivedValue } from '../../play/shared/derivedValue';
import type { PointBudgetView } from '../../play/shared/pointBudgetView';
import { toPointBudgetView } from '../../play/shared/pointBudgetView';
import type { QuickAction } from '../../play/shared/quickActions';

/** One resource pool as a roster cell reads it — where it stands against what it can hold */
export interface RosterPool {
  id: string;
  /** The ruleset's own word for it, which is the only place a resource is named */
  name: string;
  /** Where the pool stands, straight off the stored value */
  current: number;
  /** What it can hold, or the reason the ruleset could not say */
  max: DerivedValue;
  /**
   * A stored current above a calculated maximum (TICKET-RES-03)
   *
   * Compared, never corrected — the sheet's rule, and it matters more in a grid, where a DM scanning
   * twenty numbers has no room to work out that one of them is stale.
   */
  isOverMax: boolean;
}

/** One character's line on the roster */
export interface RosterCharacter {
  /** The **document's** id, which is what every write is addressed to */
  id: string;
  name: string;
  ownerAccountId: string;
  /** Curve-derived, so it chips rather than claiming 1 when the ruleset cannot price it */
  level: DerivedValue;
  /** Spent, available and remaining at that level — `null` only when the row failed to calculate */
  budget: PointBudgetView | null;
  /** What the DM has granted on top of the derived pool, which a give or take is a total upon */
  grantedPoints: number;
  pools: RosterPool[];
  /** The set `quickActionsForCharacter` derived — identical to the sheet sidebar's (v3 Req 49.7) */
  quickActions: QuickAction[];
  /**
   * Why this row has no numbers, when it has none
   *
   * An actual throw from the engine — a bug rather than a ruleset mistake, since a broken formula is
   * an error *value* and chips its own cell. One character that cannot be calculated must not empty
   * the roster, so the row is drawn saying so and the rest of the table is unaffected.
   */
  failure: string | null;
}

/** One Member and what they are playing, or the characters nobody at the table owns any more */
export interface RosterGroup {
  /** Stable across renders and unique across the list — the key the roster renders by */
  key: string;
  /** The Member, or `null` for the group whose players have gone (v3 Req 39.3) */
  member: SessionMemberSummary | null;
  /** Whether this is the reader's own group, so their row can be told apart */
  isYou: boolean;
  characters: RosterCharacter[];
}

/** The key the departed group renders under — not an account id, and cannot collide with one */
const DEPARTED_KEY = 'departed';

/**
 * One character's numbers, or the reason there are none
 *
 * Every value is the engine's. The `try` is the sheet's own `calculate`, one row at a time: since
 * TICKET-FORM-05 a ruleset problem is an error *value* that chips the cell it broke, so reaching the
 * `catch` means the engine itself threw.
 *
 * @param document The character as the table's listing carries it
 * @param config The session's Snapshot — never a live Ruleset (D7)
 * @returns The row
 */
function toRosterCharacter(document: CharacterDocument, config: Configuration): RosterCharacter {
  const character: Character = document.character;

  const base = {
    id: document.id,
    name: character.name,
    ownerAccountId: document.ownerAccountId,
    grantedPoints: character.grantedStatPoints ?? 0,
  };

  try {
    const calculated = calculateCharacter(character, config);
    const levelResult = calculateCharacterLevel(character, config);
    const allocation = validateStatAllocation(character, config);
    const budget = toPointBudgetView(allocation);
    const quickActions = quickActionsForCharacter(character, config, calculated);

    // The ruleset's own order, so the roster reads down the same columns the sheet does
    const ordered = [...config.stats].sort((first, second) => first.order - second.order);
    const resources = ordered.filter((stat) => stat.isResource);

    const pools = resources.map((stat) => {
      const max = toDerivedValue(calculated.statValues[stat.id]);
      const current = character.currentResourceValues[stat.id] ?? 0;
      const isOverMax = max.value !== null && current > max.value;

      return { id: stat.id, name: stat.name, current, max, isOverMax };
    });

    return {
      ...base,
      level: toDerivedValue(levelResult),
      budget,
      pools,
      quickActions,
      failure: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      ...base,
      level: { value: null, error: message },
      budget: null,
      pools: [],
      quickActions: [],
      failure: message,
    };
  }
}

/** Their owner has gone and their sheet stayed at the table (v3 Req 39.3) */
function isDeparted(row: RosterCharacter, seated: Set<string>): boolean {
  return !seated.has(row.ownerAccountId);
}

/**
 * Build the whole roster
 *
 * @param members Everybody at the table, in the order the server listed them
 * @param characters Every character at the table, departed owners' included
 * @param config The session's Snapshot, or `null` before it has been read
 * @param accountId Which Account is reading, so its own group can be marked
 * @returns One group per Member, plus a departed group when there is anything in it
 */
export function toRosterView(
  members: SessionMemberSummary[],
  characters: CharacterDocument[],
  config: Configuration | null,
  accountId: string | null
): RosterGroup[] {
  // Without the Snapshot there is nothing to derive against, and a roster of names with blank
  // columns would read as *these characters have no points* rather than as *still loading*
  if (config === null) return [];

  const byName = [...characters].sort((first, second) =>
    first.character.name.localeCompare(second.character.name)
  );
  const rows = byName.map((document) => toRosterCharacter(document, config));

  const seated = new Set(members.map((member) => member.accountId));

  const groups = members.map((member) => {
    const theirs = rows.filter((row) => row.ownerAccountId === member.accountId);

    return {
      key: member.accountId,
      member,
      isYou: member.accountId === accountId,
      characters: theirs,
    };
  });

  const departed = rows.filter((row) => isDeparted(row, seated));

  if (departed.length === 0) return groups;

  const orphans: RosterGroup = {
    key: DEPARTED_KEY,
    member: null,
    isYou: false,
    characters: departed,
  };

  return [...groups, orphans];
}
