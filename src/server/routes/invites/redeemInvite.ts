/**
 * `POST /api/invites/:code` — take a seat at the table (TICKET-GAM-02)
 *
 * **The one route in the milestone that cannot be guarded by membership**, because it is the act of
 * becoming a Member. What stands in for a guard is the code: fifty bits of it, plus a limiter that
 * makes guessing unaffordable, plus the four refusals `invitePayloads` distinguishes.
 *
 * **Redeeming twice succeeds** (v3 Req 38.7). It answers `joined: false` and the membership the
 * Account already had, because somebody will click the link twice, bookmark it, or paste it into the
 * group chat and click their own paste — and an error there reads as *you are not welcome*, which is
 * exactly wrong. `seatSessionMember` makes that idempotent by constraint rather than by checking
 * first, so a double-click cannot race it.
 *
 * **The limiter is consulted before the code is looked up**, so a refused caller learns nothing
 * about whether their guess existed — and counted only on failures, so the person who mistypes once
 * and then gets it right carries nothing.
 *
 * **Everyone joins as a `player`.** There is exactly one DM per session and the schema enforces it
 * with a partial unique index; a code that could seat a second one would be a code that could take
 * the table away from whoever handed it out.
 *
 * **A seating that seats somebody tells the table** (TICKET-LIVE-04, v3 Req 44.3), and one that
 * finds them already there tells nobody — `seatSessionMember` answers `null` for the second click,
 * so `recordEvent` publishes nothing and the idempotence above is idempotent on the log as well.
 *
 * **Validates: v3 Req 32.1, 37.5, 38.1, 38.4, 38.7, 44.3, 44.4**
 */

import type { InviteRedemption } from '#shared/types/api';
import { MEMBER_ROLE } from '#shared/types/api';
import { requireAccount } from '../../auth/guards';
import { recordEvent } from '../../events/recordEvent';
import { AppError } from '../../http/appError';
import { defineHandler } from '../../http/pipeline';
import { heldSeat, seatSessionMember } from '../../repositories/gameSessionRepository';
import { joinedTheTable, toSessionSummary } from '../sessions/sessionPayloads';
import { inviteCodeFrom, requireJoinable, resolveInviteFor } from './invitePayloads';
import { clearRedemptionFailures, recordRedemptionFailure } from './redemptionLimit';

export const redeemInvite = defineHandler((context): InviteRedemption => {
  const account = requireAccount(context);
  const code = inviteCodeFrom(context.url);
  const now = Date.now();

  // The limiter and the four refusals are `resolveInviteFor`'s, **shared with the preview route**
  // so that neither is an unmetered way round the other
  const resolved = resolveInviteFor(account.id, code, now);

  try {
    requireJoinable(resolved.session);
  } catch (error) {
    // An archived table is a refusal like any other and counts like one: the code existed, which is
    // the thing somebody walking the space is looking for
    if (error instanceof AppError) recordRedemptionFailure(account.id, code, now);
    throw error;
  }

  // **Built from the row, in `sessionPayloads`** — this handler names no session id at all, which
  // is the property `routeGuards.test.ts` reads as *this route had better call a resource guard*
  // and the reason this one can honestly call none
  const arrival = joinedTheTable(resolved.session, account.id, now);

  const seated = recordEvent(arrival, (append) =>
    seatSessionMember(
      {
        id: crypto.randomUUID(),
        // The resolved **row**, never an id read from the request — this route has no id to guard
        // and says so by never naming one (see `invitePayloads`)
        session: resolved.session,
        accountId: account.id,
        role: MEMBER_ROLE.PLAYER,
        now,
      },
      append
    )
  );

  // `null` is the second click (v3 Req 38.7): nothing was written and nothing was announced, and the
  // seat they already hold is the answer
  const seat = seated?.written ?? heldSeat(resolved.session.id, account.id);

  // They are at the table; there is nothing further to count them for. The **code's** bucket is
  // deliberately untouched — one success says nothing about the hundred failures around it.
  clearRedemptionFailures(account.id);

  return { session: toSessionSummary(resolved.session, seat.role), joined: seated !== null };
});
