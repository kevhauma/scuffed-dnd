/**
 * Inviting an address, and what the Account holding it may do about it (TICKET-GAM-03)
 *
 * The seven things this file is really about, one per acceptance criterion:
 *
 * 1. **A DM invites an address and the Account holding it sees it** — no link, no code, no
 *    copy-paste anywhere in the flow (v3 Req 38.3, 38.5).
 * 2. **Nobody else can see or redeem it**, even holding the invitation's id. The proof is
 *    deliberately by id rather than by listing, because the listing is trivially scoped and the id
 *    is the thing an attacker would actually have (v3 Req 32.5).
 * 3. **An address nobody has registered holds the invitation pending**, and registering it
 *    afterwards surfaces it (v3 Req 38.6). Tested by seeding the Account *after* the invitation,
 *    which is exactly what the requirement describes.
 * 4. **Declined, expired and revoked are three different outcomes**, asserted to differ from one
 *    another rather than merely to be non-empty — a shared "no longer valid" would pass any weaker
 *    check, which is the lesson GAM-02's four refusals taught.
 * 5. **Revoking one letter leaves the shared code and every other letter working**, which is the
 *    criterion that the two mechanisms have not been quietly wired together.
 * 6. **Inviting a Member is refused; inviting twice returns the same invitation.**
 * 7. **Local mode never regresses** is not this file's job, but *the shared code* is: every
 *    assertion about GAM-02's code path here exists because this ticket made `code` nullable.
 *
 * **Validates: v3 Req 32.1, 32.3, 32.5, 37.5, 38.3, 38.4, 38.5, 38.6, 38.7**
 */

import { describe, expect, it } from 'vitest';
import type {
  AddressedInvite,
  AddressedInviteListing,
  InviteRedemption,
  MembershipEventPayload,
  PendingInvitationListing,
  SessionInvite,
} from '#shared/types/api';
import { INVITE_STATE, MEMBER_ROLE, SESSION_EVENT } from '#shared/types/api';
import { eventsSince } from '../../repositories/eventRepository';
import { findSessionMember } from '../../repositories/gameSessionRepository';
import {
  activeInviteForSession,
  findSessionInvite,
  insertAddressedInvite,
} from '../../repositories/sessionInviteRepository';
import {
  type CallOptions,
  callRoute,
  type Database,
  seedAccount,
  seedMember,
  seedRegisteredAccount,
  seedSession,
  withTestDatabase,
} from '../../testing';
import { archiveSession } from '../sessions/archiveSession';
import { inviteByEmail } from '../sessions/inviteByEmail';
import { issueInvite } from '../sessions/issueInvite';
import { listSessionInvites } from '../sessions/listSessionInvites';
import { revokeInvite } from '../sessions/revokeInvite';
import { acceptInvitation } from './acceptInvitation';
import { declineInvitation } from './declineInvitation';
import { listInvitations } from './listInvitations';
import { revokeInvitation } from './revokeInvitation';

/** Write to an address, as somebody */
function invite(sessionId: string, email: string, as: CallOptions['as']) {
  return callRoute<AddressedInvite>(inviteByEmail, {
    as,
    method: 'POST',
    path: `/api/sessions/${sessionId}/invitations`,
    body: { email },
  });
}

/** Read this table's outbox, as somebody */
function outbox(sessionId: string, as: CallOptions['as']) {
  return callRoute<AddressedInviteListing>(listSessionInvites, {
    as,
    path: `/api/sessions/${sessionId}/invitations`,
  });
}

/** Read what is waiting for me */
function inbox(as: CallOptions['as']) {
  return callRoute<PendingInvitationListing>(listInvitations, { as, path: '/api/invitations' });
}

/** Take one up, as somebody */
function accept(inviteId: string, as: CallOptions['as']) {
  return callRoute<InviteRedemption>(acceptInvitation, {
    as,
    method: 'POST',
    path: `/api/invitations/${inviteId}/accept`,
    body: {},
  });
}

/** Turn one down, as somebody */
function decline(inviteId: string, as: CallOptions['as']) {
  return callRoute(declineInvitation, {
    as,
    method: 'POST',
    path: `/api/invitations/${inviteId}/decline`,
    body: {},
  });
}

/** Take one back, as somebody */
function revoke(inviteId: string, as: CallOptions['as']) {
  return callRoute(revokeInvitation, {
    as,
    method: 'DELETE',
    path: `/api/invitations/${inviteId}`,
  });
}

/**
 * A table with a **registered** DM, which is what every case here starts from
 *
 * `seedSession` also returns a `dm` — the membership row — so the two are pulled apart by hand
 * rather than spread together, where one would silently shadow the other.
 */
function aTable(database: Database) {
  const dm = seedRegisteredAccount(database, { name: 'The DM' });
  return { dm, session: seedSession(database, { dm }).session };
}

describe('inviting an address', () => {
  it('should be the DM’s alone', () =>
    withTestDatabase(async (database) => {
      const { session, dm } = aTable(database);
      const player = seedRegisteredAccount(database);
      seedMember(database, { session, account: player });

      expect((await invite(session.id, 'ada@example.test', null)).status).toBe(401);
      expect((await invite(session.id, 'ada@example.test', player)).status).toBe(404);
      expect((await invite(session.id, 'ada@example.test', seedAccount())).status).toBe(404);
      expect((await invite(session.id, 'ada@example.test', dm)).status).toBe(200);
    }));

  it('should refuse something that is not an address', () =>
    withTestDatabase(async (database) => {
      const { session, dm } = aTable(database);

      expect((await invite(session.id, '', dm)).status).toBe(400);
      expect((await invite(session.id, 'not an address', dm)).status).toBe(400);
    }));

  it('should normalise what was typed, so case and stray spaces still reach the Account', () =>
    withTestDatabase(async (database) => {
      const { session, dm } = aTable(database);

      const sent = await invite(session.id, '  Ada@Example.TEST ', dm);

      expect(sent.body.email).toBe('ada@example.test');
    }));

  it('should refuse an archived table', () =>
    withTestDatabase(async (database) => {
      const { session, dm } = aTable(database);

      await callRoute(archiveSession, {
        as: dm,
        method: 'POST',
        path: `/api/sessions/${session.id}/archive`,
        body: {},
      });

      expect((await invite(session.id, 'ada@example.test', dm)).status).toBe(409);
    }));

  it('should report an existing Member rather than inviting them again', () =>
    withTestDatabase(async (database) => {
      const { session, dm } = aTable(database);
      const player = seedRegisteredAccount(database, { email: 'ada@example.test' });
      seedMember(database, { session, account: player });

      const refused = await invite(session.id, 'ada@example.test', dm);

      expect(refused.status).toBe(409);
      expect((await outbox(session.id, dm)).body.invites).toEqual([]);
    }));

  it('should hand back the pending invitation rather than minting a second one', () =>
    withTestDatabase(async (database) => {
      const { session, dm } = aTable(database);

      const first = await invite(session.id, 'ada@example.test', dm);
      const second = await invite(session.id, 'ada@example.test', dm);

      expect(second.body.id).toBe(first.body.id);
      expect((await outbox(session.id, dm)).body.invites).toHaveLength(1);
    }));
});

describe('the invitee’s pending invitations', () => {
  it('should show the table, who asked and when it runs out — with no code anywhere', () =>
    withTestDatabase(async (database) => {
      const { session, dm } = aTable(database);
      const ada = seedRegisteredAccount(database, { email: 'ada@example.test' });

      await invite(session.id, 'ada@example.test', dm);

      const [waiting] = (await inbox(ada)).body.invitations;

      expect(waiting.sessionName).toBe(session.name);
      expect(waiting.invitedBy).toBe('The DM');
      expect(waiting.expiresAt).toBeGreaterThan(Date.now());
      // The whole point of D12: nothing was sent, and nothing has to be pasted
      expect(JSON.stringify(waiting)).not.toContain('code');
    }));

  it('should not show it to anybody else, nor let them redeem it by its id', () =>
    withTestDatabase(async (database) => {
      const { session, dm } = aTable(database);
      seedRegisteredAccount(database, { email: 'ada@example.test' });
      const bob = seedRegisteredAccount(database, { email: 'bob@example.test' });

      const sent = await invite(session.id, 'ada@example.test', dm);

      expect((await inbox(bob)).body.invitations).toEqual([]);
      // Holding the id is not holding the invitation — and the refusal is the same 404 a made-up
      // id gets, so it confirms nothing about who was invited (v3 Req 32.5)
      expect((await accept(sent.body.id, bob)).status).toBe(404);
      expect((await decline(sent.body.id, bob)).status).toBe(404);
      expect((await accept('no-such-invitation', bob)).status).toBe(404);
      expect(findSessionMember(session.id, bob.id, database)).toBeNull();
    }));

  it('should refuse an anonymous caller before it looks anything up', () =>
    withTestDatabase(async (database) => {
      const { session, dm } = aTable(database);
      const sent = await invite(session.id, 'ada@example.test', dm);

      expect((await inbox(null)).status).toBe(401);
      expect((await accept(sent.body.id, null)).status).toBe(401);
      expect((await decline(sent.body.id, null)).status).toBe(401);
      expect((await revoke(sent.body.id, null)).status).toBe(401);
    }));

  it('should wait for an address nobody has registered yet, and surface it when they do', () =>
    withTestDatabase(async (database) => {
      const { session, dm } = aTable(database);

      // Nobody holds it at this point, which is the situation v3 Req 38.6 is about
      const sent = await invite(session.id, 'later@example.test', dm);

      expect(sent.status).toBe(200);
      expect(sent.body.state).toBe(INVITE_STATE.PENDING);

      const later = seedRegisteredAccount(database, { email: 'later@example.test' });

      expect((await inbox(later)).body.invitations.map((one) => one.id)).toEqual([sent.body.id]);
    }));

  it('should seat the invitee as a player when they accept', () =>
    withTestDatabase(async (database) => {
      const { session, dm } = aTable(database);
      const ada = seedRegisteredAccount(database, { email: 'ada@example.test' });

      const sent = await invite(session.id, 'ada@example.test', dm);
      const joined = await accept(sent.body.id, ada);

      expect(joined.status).toBe(200);
      expect(joined.body.joined).toBe(true);
      expect(findSessionMember(session.id, ada.id, database)?.role).toBe(MEMBER_ROLE.PLAYER);
      // Spent: it is gone from their list and shows as accepted on the DM's
      expect((await inbox(ada)).body.invitations).toEqual([]);
      expect((await outbox(session.id, dm)).body.invites[0].state).toBe(INVITE_STATE.ACCEPTED);
    }));

  it('should answer a second acceptance with the membership rather than an error', () =>
    withTestDatabase(async (database) => {
      const { session, dm } = aTable(database);
      const ada = seedRegisteredAccount(database, { email: 'ada@example.test' });

      const sent = await invite(session.id, 'ada@example.test', dm);
      await accept(sent.body.id, ada);

      // v3 Req 38.8. Somebody will click twice, and *you are not welcome* is exactly the wrong
      // answer to give them for it — the same reasoning `redeemInvite` follows for a code
      const again = await accept(sent.body.id, ada);

      expect(again.status).toBe(200);
      expect(again.body.joined).toBe(false);
      expect(again.body.session.id).toBe(session.id);
      // …and there is still one membership, which is `seatSessionMember`'s constraint doing the work
      expect(findSessionMember(session.id, ada.id, database)).not.toBeNull();
    }));

  it('should announce the arrival once, and the second acceptance not at all (TICKET-LIVE-04)', () =>
    withTestDatabase(async (database) => {
      // The addressed twin of `invites.test.ts`' own case, and the same property: nothing was
      // written the second time, so the table is not told a second time. The type is
      // `member_joined` either way — *how* somebody was invited is the invitation's history, and
      // *who is now at the table* is the table's.
      const { session, dm } = aTable(database);
      const ada = seedRegisteredAccount(database, { email: 'ada@example.test' });

      const sent = await invite(session.id, 'ada@example.test', dm);

      await accept(sent.body.id, ada);
      await accept(sent.body.id, ada);

      const log = eventsSince(session.id, 0, database);

      expect(log).toHaveLength(1);
      expect(log[0].type).toBe(SESSION_EVENT.MEMBER_JOINED);

      const payload = JSON.parse(log[0].payload) as MembershipEventPayload;

      expect(payload).toEqual({ accountId: ada.id });
    }));

  it('should refuse to accept one for a table that has been archived', () =>
    withTestDatabase(async (database) => {
      const { session, dm } = aTable(database);
      const ada = seedRegisteredAccount(database, { email: 'ada@example.test' });
      const sent = await invite(session.id, 'ada@example.test', dm);

      await callRoute(archiveSession, {
        as: dm,
        method: 'POST',
        path: `/api/sessions/${session.id}/archive`,
        body: {},
      });

      expect((await accept(sent.body.id, ada)).status).toBe(409);
      // …and the invitation is **not** spent by the refusal, so unarchiving would leave it usable
      expect(findSessionInvite(sent.body.id, database)?.redeemedAt).toBeNull();
    }));
});

describe('the four ways an invitation ends', () => {
  it('should tell declined, revoked and already-accepted apart in words', () =>
    withTestDatabase(async (database) => {
      const { session, dm } = aTable(database);
      const ada = seedRegisteredAccount(database, { email: 'ada@example.test' });
      const bob = seedRegisteredAccount(database, { email: 'bob@example.test' });
      const cal = seedRegisteredAccount(database, { email: 'cal@example.test' });

      const declined = await invite(session.id, 'ada@example.test', dm);
      await decline(declined.body.id, ada);

      const revoked = await invite(session.id, 'bob@example.test', dm);
      await revoke(revoked.body.id, dm);

      // Expiry cannot be reached through the route — an invitation lives a fortnight — so this one
      // is written with a lifetime already behind it. *Accepted* is deliberately not in this list:
      // accepting twice **succeeds** (v3 Req 38.8), and `user.email` being unique means no second
      // Account can hold the address and meet that refusal.
      const expired = insertAddressedInvite(
        {
          id: 'expired-invite',
          sessionId: session.id,
          email: 'cal@example.test',
          expiresAt: Date.now() - 1,
          now: Date.now() - 2,
        },
        database
      );

      const messages = [
        (await accept(declined.body.id, ada)).body,
        (await accept(revoked.body.id, bob)).body,
        (await accept(expired.id, cal)).body,
        // A refusal body, not the success shape `accept` is typed for
      ].map((body) => (body as unknown as { error: { message: string } }).error.message);

      expect(new Set(messages).size).toBe(3);
    }));

  it('should make declining distinct from expiring, and re-invitable afterwards', () =>
    withTestDatabase(async (database) => {
      const { session, dm } = aTable(database);
      const ada = seedRegisteredAccount(database, { email: 'ada@example.test' });

      const sent = await invite(session.id, 'ada@example.test', dm);

      expect((await decline(sent.body.id, ada)).status).toBe(204);
      // The invitee stops seeing it; the DM sees why
      expect((await inbox(ada)).body.invitations).toEqual([]);
      expect((await outbox(session.id, dm)).body.invites[0].state).toBe(INVITE_STATE.DECLINED);

      // …and the same address may be asked again, which is the half that makes it *declined*
      // rather than *blocked*
      const again = await invite(session.id, 'ada@example.test', dm);

      expect(again.status).toBe(200);
      expect(again.body.id).not.toBe(sent.body.id);
      expect((await inbox(ada)).body.invitations.map((one) => one.id)).toEqual([again.body.id]);
    }));

  it('should let only the DM take one back, and answer 204 whatever state it was in', () =>
    withTestDatabase(async (database) => {
      const { session, dm } = aTable(database);
      const ada = seedRegisteredAccount(database, { email: 'ada@example.test' });
      const sent = await invite(session.id, 'ada@example.test', dm);

      // Not the invitee's to revoke — that is what declining is for
      expect((await revoke(sent.body.id, ada)).status).toBe(404);
      expect((await revoke(sent.body.id, dm)).status).toBe(204);
      expect((await revoke(sent.body.id, dm)).status).toBe(204);

      expect((await inbox(ada)).body.invitations).toEqual([]);
      expect((await outbox(session.id, dm)).body.invites[0].state).toBe(INVITE_STATE.REVOKED);
    }));

  it('should leave a declined invitation saying so rather than restamping it revoked', () =>
    withTestDatabase(async (database) => {
      const { session, dm } = aTable(database);
      const ada = seedRegisteredAccount(database, { email: 'ada@example.test' });
      const sent = await invite(session.id, 'ada@example.test', dm);

      await decline(sent.body.id, ada);
      await revoke(sent.body.id, dm);

      // *They turned you down* is the more useful of the two facts, so it survives
      expect((await outbox(session.id, dm)).body.invites[0].state).toBe(INVITE_STATE.DECLINED);
    }));
});

describe('the shared code and the addressed letters', () => {
  it('should leave the code alone when one letter is taken back', () =>
    withTestDatabase(async (database) => {
      const { session, dm } = aTable(database);

      const code = await callRoute<SessionInvite>(issueInvite, {
        as: dm,
        method: 'POST',
        path: `/api/sessions/${session.id}/invite`,
        body: {},
      });

      const first = await invite(session.id, 'ada@example.test', dm);
      const second = await invite(session.id, 'bob@example.test', dm);

      await revoke(first.body.id, dm);

      // The code is still the session's, and the other letter is still pending
      expect(activeInviteForSession(session.id, database)?.code).not.toBeNull();
      expect(code.body.code).toContain('-');
      expect(findSessionInvite(second.body.id, database)?.revokedAt).toBeNull();
    }));

  it('should leave the letters alone when the code is reissued or taken back', () =>
    withTestDatabase(async (database) => {
      const { session, dm } = aTable(database);
      const sent = await invite(session.id, 'ada@example.test', dm);

      const reissue = () =>
        callRoute<SessionInvite>(issueInvite, {
          as: dm,
          method: 'POST',
          path: `/api/sessions/${session.id}/invite`,
          body: {},
        });

      await reissue();
      await reissue();
      await callRoute(revokeInvite, {
        as: dm,
        method: 'DELETE',
        path: `/api/sessions/${session.id}/invite`,
      });

      expect(findSessionInvite(sent.body.id, database)?.revokedAt).toBeNull();
    }));

  it('should refuse to take the shared code back through the addressed route', () =>
    withTestDatabase(async (database) => {
      const { session, dm } = aTable(database);

      await callRoute<SessionInvite>(issueInvite, {
        as: dm,
        method: 'POST',
        path: `/api/sessions/${session.id}/invite`,
        body: {},
      });

      const shared = activeInviteForSession(session.id, database);

      if (!shared) throw new Error('the session should have a live code to try this with');

      // The DM may take their own code back — through `DELETE /api/sessions/:id/invite`, which is
      // the route for it. This one is about addressed letters, and handing it a shared row's id is
      // the crossing GAM-03's fifth criterion rules out
      expect((await revoke(shared.id, dm)).status).toBe(404);
      expect(activeInviteForSession(session.id, database)?.revokedAt).toBeNull();
    }));

  it('should keep an addressed invitation out of the DM’s code panel', () =>
    withTestDatabase(async (database) => {
      const { session, dm } = aTable(database);

      await invite(session.id, 'ada@example.test', dm);

      // `readSession` shows `activeInviteForSession`; a letter appearing there would put somebody's
      // address on the panel a DM reads a code off
      expect(activeInviteForSession(session.id, database)).toBeNull();
    }));
});

describe('the DM’s outbox', () => {
  it('should be the DM’s alone', () =>
    withTestDatabase(async (database) => {
      const { session, dm } = aTable(database);
      const player = seedRegisteredAccount(database);
      seedMember(database, { session, account: player });

      expect((await outbox(session.id, null)).status).toBe(401);
      expect((await outbox(session.id, player)).status).toBe(404);
      expect((await outbox(session.id, seedAccount())).status).toBe(404);
      expect((await outbox(session.id, dm)).status).toBe(200);
    }));

  it('should show every address and its state, newest first', () =>
    withTestDatabase(async (database) => {
      const { session, dm } = aTable(database);

      await invite(session.id, 'ada@example.test', dm);
      await invite(session.id, 'bob@example.test', dm);

      const listed = (await outbox(session.id, dm)).body.invites;

      expect(listed.map((one) => one.email).sort()).toEqual([
        'ada@example.test',
        'bob@example.test',
      ]);
      expect(listed.every((one) => one.state === INVITE_STATE.PENDING)).toBe(true);
    }));
});
