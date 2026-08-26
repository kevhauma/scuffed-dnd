/**
 * The wire ↔ row boundary for an addressed invitation (TICKET-GAM-03)
 *
 * `sessionPayloads.ts`'s counterpart for the one resource in the milestone that is **scoped to an
 * Account rather than to a session or a ruleset**. Four route modules sit beside this one — the
 * invitee's list, accept, decline, and the DM's revoke — and everything they share is here: how a
 * request names an invitation, and what has become of one.
 *
 * **The state is derived, never stored.** The row carries four timestamps and {@link inviteStateOf}
 * reads them; a `state` column would be a second answer to the same question, and the one that goes
 * stale is always the one somebody renders. That is the same rule the whole app rests on for a
 * character's level, applied to a much smaller thing for the same reason.
 *
 * **Validates: v3 Req 38.4**
 */

import type { AddressedInvite, InviteState } from '#shared/types/api';
import { INVITE_STATE } from '#shared/types/api';
import { type AppError, conflict } from '../../http/appError';
import type { SessionInviteRow } from '../../repositories/sessionInviteRepository';

/** The collection every invitation id sits one segment under */
const INVITATIONS_PREFIX = '/api/invitations/';

/**
 * Which invitation a path named
 *
 * `sessionIdFrom`'s twin, and a third small function rather than a shared one parameterised by
 * prefix for the reason that one gives. **Two shapes are real** — `/api/invitations/:id` and
 * `/api/invitations/:id/<action>` — and nothing deeper is.
 *
 * @param url The request URL
 * @returns The id segment, or an empty string when the path has none
 */
export function invitationIdFrom(url: URL): string {
  if (!url.pathname.startsWith(INVITATIONS_PREFIX)) return '';

  const [id, ...rest] = url.pathname.slice(INVITATIONS_PREFIX.length).split('/');

  return rest.length <= 1 ? id : '';
}

/**
 * What has become of one invitation (v3 Req 38.4)
 *
 * **Answered beats withdrawn beats ran-out**, and the order is the point rather than an accident:
 * a row can only be stamped while it is pending, so at most one of the three timestamps is ever set
 * — but a row that was accepted a week ago is *accepted*, not *expired*, and reading the clock first
 * would rewrite history every fortnight.
 *
 * @param row The stored invitation
 * @param now Epoch milliseconds
 * @returns Which of the five states it is in
 */
export function inviteStateOf(row: SessionInviteRow, now: number): InviteState {
  if (row.redeemedAt !== null) return INVITE_STATE.ACCEPTED;
  if (row.declinedAt !== null) return INVITE_STATE.DECLINED;
  if (row.revokedAt !== null) return INVITE_STATE.REVOKED;

  return row.expiresAt <= now ? INVITE_STATE.EXPIRED : INVITE_STATE.PENDING;
}

/**
 * What each spent state is called to the person who tried to answer it (v3 Req 38.4)
 *
 * **A sentence per state, which is the requirement rather than a flourish.** *Somebody took this up*,
 * *you turned it down*, *it ran out* and *the DM took it back* are four different situations with
 * four different things to do next, and a shared "that invitation is no longer valid" would leave
 * all four of them guessing — the same argument `invitePayloads.ts` makes for the code path.
 *
 * `PENDING` is here because the map is total over {@link InviteState} and a partial one would be a
 * cast. Its sentence is reachable only through a race no single process can lose.
 */
const REFUSAL: Record<InviteState, string> = {
  [INVITE_STATE.PENDING]: 'That invitation has just been answered somewhere else.',
  // **Unreachable today, and kept because the map is total.** Accepting twice yourself succeeds
  // and answers `joined: false` (v3 Req 38.8), and `requireInvitee` matches on an address that
  // `user.email` makes unique — so no second Account can hold the address and meet this. It would
  // become reachable the day an Account is deleted and its address registered again.
  [INVITE_STATE.ACCEPTED]: 'That invitation has already been taken up.',
  [INVITE_STATE.DECLINED]:
    'You turned that invitation down. Ask whoever runs the game to send another if you have ' +
    'changed your mind.',
  [INVITE_STATE.EXPIRED]: 'That invitation has expired. Ask whoever runs the game to send another.',
  [INVITE_STATE.REVOKED]: 'That invitation was taken back by whoever runs the game.',
};

/**
 * The refusal an invitation that is no longer pending earns
 *
 * A **409**, matching every other write refused by the state of a row the caller is allowed to see:
 * their request is well formed and they are the right person — what stops them is that the
 * invitation has already been settled.
 *
 * @param row The stored invitation
 * @param now Epoch milliseconds
 * @returns The error to throw
 */
export function settledRefusal(row: SessionInviteRow, now: number): AppError {
  return conflict(REFUSAL[inviteStateOf(row, now)]);
}

/**
 * A row as the DM who sent it sees it
 *
 * **The address goes back out**, which is the one thing worth checking rather than assuming: it is
 * the DM's own address book entry — they typed it — so returning it to them leaks nothing, and a
 * list of invitations that would not say who each one was for is not a list anybody can act on.
 *
 * @param row The stored invitation, which is addressed
 * @param now Epoch milliseconds
 * @returns What goes on the wire
 */
export function toAddressedInvite(row: SessionInviteRow, now: number): AddressedInvite {
  return {
    id: row.id,
    // Addressed by construction — `listAddressedInvites` selects `email IS NOT NULL` — and the
    // fallback is here so that a widened query is an empty string rather than a crash
    email: row.email ?? '',
    state: inviteStateOf(row, now),
    expiresAt: row.expiresAt,
  };
}
