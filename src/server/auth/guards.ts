/**
 * *May they?* — every authorization rule the milestone has, written once (TICKET-AUTH-03)
 *
 * AUTH-01 answered *who is this*. This answers whether they are allowed, and it is deliberately the
 * only module in `src/server/` that decides so. **No library is involved** — D3 chose Better Auth
 * for identity precisely because authorization is v3 Req 32 and is ours.
 *
 * A handler spends one line:
 *
 * ```ts
 * export const getRuleset = defineHandler((context) => {
 *   const id = context.url.searchParams.get('id') ?? '';
 *   const row = requireOwner(context, findRuleset(id));
 *   return { name: row.name };
 * });
 * ```
 *
 * **A handler never names a connection**, and that is not a stylistic detail — `getDatabase()` is
 * behind `queries-belong-to-repositories`, so a handler that reached for one would fail
 * `yarn run arch`. Every repository read takes its connection as a defaulted last parameter and
 * finds the process's own; only a test passes one.
 *
 * ## Two refusals, and the line between them is the whole design
 *
 * **`unauthenticated` (401) is thrown before any lookup happens.** It says something about the
 * caller and nothing about the resource, which is what makes it safe beside the rule below — an
 * anonymous caller gets the same answer for a ruleset that exists, one that does not, and one
 * belonging to somebody else. It also gives the client the one distinction it genuinely needs: *sign
 * in and come back here* rather than *there is nothing here*.
 *
 * **`notFound` (404) is everything else** — the wrong Account, a non-member, a player asking for the
 * DM's controls, and an id nobody ever minted. v3 Req 32.5 asks that an unauthorized read and a
 * missing record be indistinguishable, and the cheapest way to keep that true forever is for every
 * post-lookup refusal to be the *same object*. A 403 would confirm the resource exists, which is an
 * answer the caller has not earned.
 *
 * The distinction is not thrown away: {@link refuse} logs which of the two it was, server-side,
 * where it is useful for an operator and unreachable by a client.
 *
 * ## Why these are functions rather than middleware
 *
 * A middleware runs *because it is registered*, which means a route that forgets to register one
 * is silently open. A guard that returns the row makes forgetting visible at the call site: the
 * handler has no row to work with unless it asked. `routes/routeGuards.test.ts` closes the
 * remaining gap by walking the route tree — dependency-cruiser sees imports, and a handler that
 * imports a guard without calling it satisfies every import rule there is (v3 Req 51.10).
 *
 * **Validates: v3 Req 32.1, 32.2, 32.3, 32.4, 32.5**
 */

import { MEMBER_ROLE } from '../db/schema';
import { type AppError, notFound, unauthenticated } from '../http/appError';
import { findAccountById } from '../repositories/accountRepository';
import { type CharacterRow, findCharacter } from '../repositories/characterRepository';
import { findSessionMember, type SessionMemberRow } from '../repositories/gameSessionRepository';
import { findSessionInvite, type SessionInviteRow } from '../repositories/sessionInviteRepository';
import type { RequestAccount } from './account';

/**
 * As much of a {@link RequestContext} as a guard reads
 *
 * Structural rather than the whole context, so a guard can be called from anywhere that knows who
 * is asking — LIVE-01's socket upgrade in particular, which has a cookie and no `RequestContext`.
 * It is also what keeps `auth/` from importing `http/pipeline`, which imports `auth/` already.
 */
export interface Asking {
  account: RequestAccount | null;
}

/** What every owned resource has in common — the one column authorization compares */
export interface OwnedResource {
  ownerAccountId: string;
}

/**
 * The refusal a caller who got past {@link requireAccount} always gets
 *
 * **One function so there is one answer.** The reason for the refusal is logged and the caller is
 * told *not found* — the two halves of v3 Req 32.5 in the only place that can honour both.
 *
 * @param reason What actually happened, for the operator reading the logs
 * @returns The error to throw
 */
function refuse(reason: string): AppError {
  console.warn(`[authz] refused: ${reason}`);
  return notFound();
}

/**
 * The Account making this request, or a refusal (v3 Req 32.1)
 *
 * Every other guard begins here, so *signed out* is one answer produced in one place rather than
 * four subtly different ones.
 *
 * @param asking Who is asking
 * @returns The Account
 * @throws {AppError} 401 when nobody is signed in
 */
export function requireAccount(asking: Asking): RequestAccount {
  if (!asking.account) throw unauthenticated();
  return asking.account;
}

/**
 * A resource the asking Account owns (v3 Req 32.2)
 *
 * **Takes the loaded row rather than an id**, and that is the criterion about one query per
 * request: the caller has already fetched by id, so a guard that fetched again would double every
 * read to save the caller a comparison. `null` — meaning *no such id* — and *somebody else's* are
 * the same refusal, which is Req 32.5 at the one place both are visible.
 *
 * @param asking Who is asking
 * @param resource What they asked for, or `null` if there is no such id
 * @returns The resource, now known to be theirs
 * @throws {AppError} 401 for nobody, 404 for a missing row *and* for another Account's
 */
export function requireOwner<T extends OwnedResource>(asking: Asking, resource: T | null): T {
  const account = requireAccount(asking);

  if (!resource) throw refuse('no such resource');
  if (resource.ownerAccountId !== account.id) {
    throw refuse(`account ${account.id} does not own that resource`);
  }

  return resource;
}

/**
 * A seat at a table the asking Account is a Member of (v3 Req 32.3)
 *
 * Returns the **membership**, not the session, because the membership is what every caller needs
 * next: it carries the role, and a handler that has it does not ask again to find out whether this
 * Member is the DM.
 *
 * @param asking Who is asking
 * @param sessionId Which session
 * @returns Their membership row
 * @throws {AppError} 401 for nobody, 404 for a non-member *and* for a session that is not there
 */
export function requireMember(asking: Asking, sessionId: string): SessionMemberRow {
  const account = requireAccount(asking);
  const membership = findSessionMember(sessionId, account.id);

  if (!membership) throw refuse(`account ${account.id} is not a member of session ${sessionId}`);

  return membership;
}

/**
 * The DM's seat at a table (v3 Req 32.3)
 *
 * A `player` Member is refused with the same 404 a stranger gets, deliberately: they already know
 * the session exists, but *which* refusal they get should not depend on how much they know.
 *
 * **`session_member.role` is the authority here, not `game_session.dm_account_id`.** The schema
 * carries both, nothing reconciles them, and this guard is the thing that decides — so
 * TICKET-GAM-04's transfer-DM has to write *both*, and any later query that reads `dm_account_id`
 * to answer "may they?" is asking the wrong column.
 *
 * @param asking Who is asking
 * @param sessionId Which session
 * @returns Their membership row, now known to be the DM's
 * @throws {AppError} 401 for nobody, 404 for a player and for a non-member alike
 */
export function requireDM(asking: Asking, sessionId: string): SessionMemberRow {
  const membership = requireMember(asking, sessionId);

  if (membership.role !== MEMBER_ROLE.DM) {
    throw refuse(`account ${membership.accountId} is a ${membership.role} in session ${sessionId}`);
  }

  return membership;
}

/**
 * An invitation addressed to the asking Account (v3 Req 32.5, 38.3, TICKET-GAM-03)
 *
 * **The one guard whose subject is not a resource the Account owns or sits at**, and it exists for
 * exactly that reason: an invitee is by definition not a Member yet, so `requireMember` cannot speak
 * for them and `requireOwner` has no column to compare. What stands in for ownership is the address
 * — the invitation names one, the Account registered one, and they have to be the same string.
 *
 * **Every way this can fail is the same 404**, including *this invitation is real and belongs to
 * somebody else*. That is Req 32.5 applied to the shape it matters most in: an invitation id that
 * came back *no* rather than *not found* would let anybody holding one confirm that a particular
 * address had been invited to a particular table.
 *
 * **A shared code is refused here too** (`email IS NULL`). It is not addressed to anybody, so it is
 * not addressed to *them* — and redeeming one is `POST /api/invites/:code`'s job, where the code is
 * the credential and the limiter is the lock.
 *
 * @param asking Who is asking
 * @param inviteId Which invitation
 * @returns The invitation row, now known to be theirs
 * @throws {AppError} 401 for nobody, 404 for a missing id, a shared code and somebody else's letter
 */
export function requireInvitee(asking: Asking, inviteId: string): SessionInviteRow {
  const account = requireAccount(asking);

  const identity = findAccountById(account.id);
  if (!identity) throw refuse(`account ${account.id} has no identity to match an invitation to`);

  const invite = findSessionInvite(inviteId);

  if (!invite) throw refuse('no such invitation');
  if (invite.email === null) throw refuse(`invite ${inviteId} is a shared code, not a letter`);
  if (invite.email !== identity.email) {
    throw refuse(`invite ${inviteId} is not addressed to account ${account.id}`);
  }

  return invite;
}

/**
 * A character the asking Account may write to (v3 Req 32.4)
 *
 * **Two Accounts may, and the rule says so once**: the player who owns it, and the DM of the
 * session it belongs to — that second half is what makes TICKET-DM-01's controls possible without
 * every DM route restating who a DM is.
 *
 * **A character at no table has exactly one writer, and that falls out of the rule rather than being
 * a case bolted onto it** (TICKET-IO-04). An uploaded character has `session_id IS NULL`, so there is
 * no table for anybody to be the DM of — the second half of the rule simply has nothing to match,
 * and the owner is the only Account left. Written as an early refusal rather than passing `null` to
 * `findSessionMember`, because *"look up the members of no session"* is a question with no right
 * answer and a lookup that returns nothing would be the right result for the wrong reason.
 *
 * **A character whose owner has left the table has *no* writer** (TICKET-GAM-04, v3 Req 39.3, 39.5).
 * Removing a Member retains their Characters rather than deleting them — a character is part of the
 * campaign's history — and what retention means is *readable by the Members, writable by nobody,
 * including the DM's own controls*. So the owner's membership is checked **before** either branch
 * rather than only on the caller's side: the previous shape returned early for the owner, which
 * would have let a removed player keep writing to their own sheet, and it asked only about the
 * caller, which would have let the DM edit a departed player's character.
 *
 * **It costs the common path one lookup it was not paying**, and that is worth stating rather than
 * glossing: the old shape returned the owner's own sheet after zero membership queries, and this one
 * asks first. That is the price of the criterion — there is no way to know whether a seat is still
 * held without looking — and it buys the rule at the only place that can enforce it for every write
 * route at once. A rejoin then restores access with no repair, because ownership is by Account id
 * and was never moved.
 *
 * @param asking Who is asking
 * @param characterId Which character
 * @returns The character row
 * @throws {AppError} 401 for nobody, 404 for anybody else's character, for a missing id, and for
 *   one whose owner has left the table
 */
export function requireCharacterWriter(asking: Asking, characterId: string): CharacterRow {
  const account = requireAccount(asking);
  const row = findCharacter(characterId);

  if (!row) throw refuse('no such character');

  if (row.sessionId === null) {
    if (row.ownerAccountId !== account.id) {
      throw refuse(`character ${characterId} is at no table, so only its owner may write to it`);
    }
    return row;
  }

  // The retention rule: a seat that is gone takes every write with it, the owner's included
  if (!findSessionMember(row.sessionId, row.ownerAccountId)) {
    throw refuse(
      `character ${characterId} belongs to somebody who has left session ${row.sessionId}`
    );
  }

  if (row.ownerAccountId === account.id) return row;

  if (findSessionMember(row.sessionId, account.id)?.role !== MEMBER_ROLE.DM) {
    throw refuse(`account ${account.id} neither owns character ${characterId} nor runs its table`);
  }

  return row;
}
