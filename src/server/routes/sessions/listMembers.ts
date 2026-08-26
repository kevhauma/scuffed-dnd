/**
 * `GET /api/sessions/:id/members` — who is at this table (TICKET-GAM-04)
 *
 * **The first surface in the app that shows other people**, and the first read here that is not the
 * DM's alone: every Member sees the roster, because a table is a group and a player who could not
 * see who else was at it would be playing alone with extra steps.
 *
 * **Characters outlive memberships**, which is why the answer has two lists rather than one.
 * Removing somebody retains their Characters as read-only (v3 Req 39.3) — a character is part of
 * the campaign's history, and deleting one to tidy a list rewrites the campaign. So a session can
 * hold a character whose owner is nobody at the table, and those are listed separately rather than
 * under a ghost Member: *who is here* and *what is still on the table* are two questions, and one
 * list answering both makes neither clear.
 *
 * **An Account with no `user` row is still shown**, named *Somebody*. The seat is the fact; the
 * profile is Better Auth's, and a roster that dropped a row because a name was missing would be
 * lying about who is at the table.
 *
 * **Readable on an archived session**, like every other read (v3 Req 37.5) — a finished campaign's
 * roster is exactly the sort of thing worth still having.
 *
 * **Validates: v3 Req 32.1, 32.3, 32.5, 37.5, 39.7**
 */

import type {
  SessionCharacterSummary,
  SessionMemberListing,
  SessionMemberSummary,
} from '#shared/types/api';
import { MEMBER_ROLE } from '#shared/types/api';
import { requireMember } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import type { CharacterRow } from '../../repositories/characterRepository';
import { charactersInSession, listSessionMembers } from '../../repositories/gameSessionRepository';
import { sessionIdFrom } from './sessionPayloads';

/** What an Account with no `user` row is called, so a seat is never dropped for want of a name */
const ANONYMOUS = 'Somebody';

/** A character row as a name on somebody's line — never the document (v3 Req 39.7) */
function toCharacterSummary(row: CharacterRow): SessionCharacterSummary {
  return { id: row.id, name: row.name };
}

/**
 * Where a Member sits in the list — the DM first, then in the order they joined
 *
 * **A decision about how a roster is read, so it lives with the surface that renders one** rather
 * than in the repository, which orders by `joined_at` and stops there. A first draft did it in SQL
 * with `ORDER BY role`, which works only because `'dm'` happens to sort before `'player'`; renaming
 * a role would have reordered the page and nothing would have said why.
 */
function readingOrder(role: SessionMemberSummary['role']): number {
  return role === MEMBER_ROLE.DM ? 0 : 1;
}

/**
 * The handler is `listMembers` and the query it calls is `listSessionMembers`
 *
 * Two exports sharing one spelling is what `sessionPayloads.ts` records as a duplicate `fallow`
 * reports and an `export *` can resolve ambiguously — so the route takes the shorter name, which it
 * can afford: it already sits in a folder called `sessions/`.
 */
export const listMembers = defineHandler((context): SessionMemberListing => {
  const sessionId = sessionIdFrom(context.url);
  requireMember(context, sessionId);

  // Grouped in memory rather than joined, deliberately: a member-to-character join returns one row
  // per character and none at all for a member playing nothing, so the shape would have to be
  // rebuilt here anyway — from a result that had already lost the empty-handed Members
  const owned = new Map<string, SessionCharacterSummary[]>();

  for (const row of charactersInSession(sessionId)) {
    const theirs = owned.get(row.ownerAccountId) ?? [];
    theirs.push(toCharacterSummary(row));
    owned.set(row.ownerAccountId, theirs);
  }

  const members: SessionMemberSummary[] = listSessionMembers(sessionId)
    .map((row) => ({
      accountId: row.accountId,
      name: row.name ?? ANONYMOUS,
      role: row.role,
      joinedAt: row.joinedAt,
      characters: owned.get(row.accountId) ?? [],
    }))
    .sort((one, other) => readingOrder(one.role) - readingOrder(other.role));

  // **Computed from what is already in hand, not asked for again.** *Departed* is exactly *owns a
  // character here and holds no seat here*, and both halves are above — a third query would be a
  // second definition of the same word for `guards.ts`'s to drift away from.
  const seated = new Set(members.map((one) => one.accountId));

  return {
    members,
    departedCharacters: [...owned]
      .filter(([accountId]) => !seated.has(accountId))
      .flatMap(([, characters]) => characters),
  };
});
