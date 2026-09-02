/**
 * What a membership Event does to the member list a browser is holding (TICKET-LIVE-04, v3 Req 44.7)
 *
 * [`liveEvents.ts`](../../../services/liveEvents.ts)'s counterpart for the other half of the roster:
 * *given this list and this Event, who is at the table now?* — or *ask the server again*. Pure, so
 * the rule is testable without a socket, a hook or a component, and separate from the character
 * applier because they answer about different things. A character applier that also knew about
 * seats would be one module answering two questions, and only one of them would have a compile-time
 * exhaustiveness check to keep it honest.
 *
 * ## Two of the four are patched and one is not, and the payload is why
 *
 * A **removal** and a **leaving** name the Member by id, and dropping a row needs nothing else. A
 * **handover** carries both ids, so the badge moves without this module inferring which row used to
 * hold it. A **join** carries an id and *no name* — deliberately, since a name in the log is a copy
 * a rename can make wrong (v3 Req 44.3) — and a member list is a list of names. So it is the one
 * membership Event that answers *ask again*, and the read it provokes is the **member list alone**:
 * not the characters, whose contents a join does not touch, and not the Snapshot.
 *
 * That is the narrowing the ticket's third criterion is really about. *No re-read at all* holds for
 * the three that can be patched; a join costs one read of one list, which is what carrying no name
 * costs and is worth it.
 *
 * ## The departed group needs nothing from this module
 *
 * A character whose owner holds no seat is *departed* — [`rosterView`](./rosterView.ts) derives that
 * from the two lists rather than being told it (v3 Req 39.3). So dropping the member row is the
 * whole of moving their characters, and there is no second rule here that could disagree with the
 * one over there.
 *
 * **Validates: v3 Req 39.3, 39.4, 44.7**
 */

import type { DmTransferEventPayload, SessionMemberSummary } from '#shared/types/api';
import { MEMBER_ROLE, SESSION_EVENT } from '#shared/types/api';
import type { LiveEvent } from '#shared/types/liveSocket';
import { EVENT_EFFECT } from '../../../services/liveEvents';

/**
 * What an Event did to the member list, and the list it produced when it produced one
 *
 * The character applier's three answers, reused rather than restated: *this list now holds what the
 * Event says*, *this was not about the membership*, and *only the server can say who is here now*.
 * One vocabulary for *what an Event did to the thing I am holding* is worth more than a second set
 * of three words that mean the same.
 */
export type MemberListOutcome =
  | { effect: typeof EVENT_EFFECT.APPLIED; members: SessionMemberSummary[] }
  | { effect: typeof EVENT_EFFECT.ELSEWHERE }
  | { effect: typeof EVENT_EFFECT.STALE };

/** Not about who is at the table */
const elsewhere: MemberListOutcome = { effect: EVENT_EFFECT.ELSEWHERE };

/** About who is at the table, and only the server can say what it is now */
const stale: MemberListOutcome = { effect: EVENT_EFFECT.STALE };

/** The Events that change who is at a table, so anything else can leave a list alone at one glance */
const MEMBERSHIP_EVENTS: ReadonlySet<string> = new Set([
  SESSION_EVENT.MEMBER_JOINED,
  SESSION_EVENT.MEMBER_REMOVED,
  SESSION_EVENT.MEMBER_LEFT,
  SESSION_EVENT.DM_TRANSFERRED,
]);

/** An Account id out of a payload, or `null` for one this build cannot read */
function accountIdOf(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') return null;

  return value;
}

/**
 * The list without one Member (v3 Req 39.3, 39.5)
 *
 * **Their characters are not mentioned and that is the point**: `rosterView` reads *departed* as
 * *owns a character here and holds no seat here*, so taking the seat away is the whole change and
 * the group they move to is derived from it.
 *
 * @param members The list as it stands
 * @param accountId Whose seat has gone
 * @returns The shorter list, or `elsewhere` when this browser never had them
 */
function withoutMember(members: SessionMemberSummary[], accountId: string): MemberListOutcome {
  const remaining = members.filter((member) => member.accountId !== accountId);

  // Already gone — a replayed Event, or a list read after the removal it describes. Nothing to do
  // and nothing to ask about, which is the whole difference between `elsewhere` and `stale`.
  if (remaining.length === members.length) return elsewhere;

  return { effect: EVENT_EFFECT.APPLIED, members: remaining };
}

/**
 * The list with the table in somebody else's hands (v3 Req 39.4)
 *
 * **Both rows move, and the new DM moves to the front.** The listing arrives DM-first from the
 * server, so a patch that left the row where it was would draw a correct badge in an order no
 * re-read would ever produce — and the list would silently reorder itself later, on some unrelated
 * refresh, with nothing to explain the jump. Lifting the promoted row is the whole of that: the rest
 * keep the order they arrived in, which is the order they joined.
 *
 * @param members The list as it stands
 * @param payload Who took the table and who handed it over
 * @returns The patched list, or `stale` when this browser does not hold both of them
 */
function withTableHandedOver(
  members: SessionMemberSummary[],
  payload: DmTransferEventPayload
): MemberListOutcome {
  const incoming = members.find((member) => member.accountId === payload.accountId);
  const outgoing = members.find((member) => member.accountId === payload.previousAccountId);

  // A list that does not hold both is a list that cannot be patched into the right one — which is
  // exactly what *ask again* is for
  if (!incoming || !outgoing) return stale;

  const patched = members.map((member) => {
    if (member.accountId === payload.accountId) return { ...member, role: MEMBER_ROLE.DM };
    if (member.accountId === payload.previousAccountId) {
      return { ...member, role: MEMBER_ROLE.PLAYER };
    }

    return member;
  });

  const promoted = patched.filter((member) => member.accountId === payload.accountId);
  const rest = patched.filter((member) => member.accountId !== payload.accountId);

  return { effect: EVENT_EFFECT.APPLIED, members: [...promoted, ...rest] };
}

/**
 * Apply one Event to the member list a browser is holding open
 *
 * @param members Who this browser believes is at the table
 * @param event What happened at the table
 * @returns What to do about it, and the patched list when there is one
 */
export function applyEventToMembers(
  members: SessionMemberSummary[],
  event: LiveEvent
): MemberListOutcome {
  // Everything a Player or a DM does to a sheet, and every roll — none of it changes who is here.
  // Answered first and cheaply, because it is almost every Event a busy table produces.
  if (!MEMBERSHIP_EVENTS.has(event.type)) return elsewhere;

  const payload = event.payload as Partial<DmTransferEventPayload> | null;
  const accountId = accountIdOf(payload?.accountId);

  // A membership Event this build cannot read is still a membership Event: something changed about
  // who is here, and the server is the one that can say what
  if (accountId === null) return stale;

  if (event.type === SESSION_EVENT.DM_TRANSFERRED) {
    const previousAccountId = accountIdOf(payload?.previousAccountId);

    if (previousAccountId === null) return stale;

    return withTableHandedOver(members, { accountId, previousAccountId });
  }

  // **The join, and the one read this applier asks for.** The payload carries an id and no name, and
  // a member list is a list of names — so there is nothing to build a row out of. See the module
  // note: the read that follows is this list and nothing else.
  if (event.type === SESSION_EVENT.MEMBER_JOINED) return stale;

  // Removed or left — one write with two stories, and a member list is told the same thing by both
  return withoutMember(members, accountId);
}
