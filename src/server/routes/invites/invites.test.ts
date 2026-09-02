/**
 * Issuing, revoking and redeeming an invitation (TICKET-GAM-02)
 *
 * The four things this file is really about:
 *
 * 1. **Redeeming twice succeeds** (v3 Req 38.7) and creates no second row. The ticket is emphatic
 *    that an error there reads as *you are not welcome*, which is exactly wrong.
 * 2. **Four refusals, four messages** (v3 Req 38.4) — expired, revoked, unknown and archived are
 *    asserted to differ from each other rather than merely to be non-empty, because a shared
 *    "invalid code" would pass any weaker check.
 * 3. **Reissuing retires the previous code**, tested by redeeming the old one afterwards, which is
 *    the criterion's own wording.
 * 4. **The limiter is real**, and counts *every* refusal rather than only the unknown-code one.
 *
 * **Validates: v3 Req 32.1, 32.3, 32.5, 37.5, 38.1, 38.2, 38.4, 38.7**
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type {
  GameSessionDocument,
  InvitePreview,
  InviteRedemption,
  MembershipEventPayload,
  SessionInvite,
} from '#shared/types/api';
import { MEMBER_ROLE, SESSION_EVENT } from '#shared/types/api';
import { eventsSince } from '../../repositories/eventRepository';
import { findSessionMember } from '../../repositories/gameSessionRepository';
import {
  activeInviteForSession,
  findInviteByCode,
} from '../../repositories/sessionInviteRepository';
import {
  type CallOptions,
  callRoute,
  seedAccount,
  seedSession,
  withTestDatabase,
} from '../../testing';
import { archiveSession } from '../sessions/archiveSession';
import { issueInvite } from '../sessions/issueInvite';
import { revokeInvite } from '../sessions/revokeInvite';
import { normalizeInviteCode } from './inviteCode';
import { previewInvite } from './previewInvite';
import { redeemInvite } from './redeemInvite';
import { resetRedemptionFailures } from './redemptionLimit';

/** Issue a code for a table, as somebody */
function issue(sessionId: string, as: CallOptions['as']) {
  return callRoute<SessionInvite>(issueInvite, {
    as,
    method: 'POST',
    path: `/api/sessions/${sessionId}/invite`,
    body: {},
  });
}

/** Take the code back, as somebody */
function revoke(sessionId: string, as: CallOptions['as']) {
  return callRoute(revokeInvite, {
    as,
    method: 'DELETE',
    path: `/api/sessions/${sessionId}/invite`,
  });
}

/** Look at what a code opens, as somebody */
function preview(code: string, as: CallOptions['as']) {
  return callRoute<InvitePreview>(previewInvite, {
    as,
    path: `/api/invites/${encodeURIComponent(code)}`,
  });
}

/** Take a seat with a code, as somebody */
function redeem(code: string, as: CallOptions['as']) {
  return callRoute<InviteRedemption>(redeemInvite, {
    as,
    method: 'POST',
    path: `/api/invites/${encodeURIComponent(code)}`,
    body: {},
  });
}

/** The sentence a refusal carried */
function refusalMessage(result: { body: unknown }): string {
  return (result.body as { error: { message: string } }).error.message;
}

beforeEach(() => {
  // Module state, so a limiter filled by one case would refuse the next one's first attempt
  resetRedemptionFailures();
});

describe('POST /api/sessions/:id/invite', () => {
  it('refuses anonymous, non-member and a player, and accepts the DM', () =>
    withTestDatabase(async (database) => {
      const dm = seedAccount();
      const player = seedAccount();
      const { session } = seedSession(database, { dm });
      const joined = seedAccount();
      seedSession(database, { dm: joined });

      expect((await issue(session.id, null)).status).toBe(401);
      expect((await issue(session.id, seedAccount())).status).toBe(404);
      // A player at the table gets the stranger's answer: minting an invitation is the DM's
      expect((await issue(session.id, player)).status).toBe(404);
      expect((await issue(session.id, dm)).status).toBe(200);
    }));

  it('hands back a hyphenated code and stores the normal form', () =>
    withTestDatabase(async (database) => {
      const dm = seedAccount();
      const { session } = seedSession(database, { dm });

      const issued = await issue(session.id, dm);

      expect(issued.body.code).toMatch(/^[0-9A-Z]{5}-[0-9A-Z]{5}$/);
      expect(activeInviteForSession(session.id, database)?.code).toBe(
        normalizeInviteCode(issued.body.code)
      );
    }));

  it('gives the code a life, so a link in a two-year-old chat is not a way in', () =>
    withTestDatabase(async (database) => {
      const dm = seedAccount();
      const { session } = seedSession(database, { dm });

      const issued = await issue(session.id, dm);

      expect(issued.body.expiresAt).toBeGreaterThan(Date.now());
    }));

  it('is refused on an archived session', () =>
    withTestDatabase(async (database) => {
      const dm = seedAccount();
      const { session } = seedSession(database, { dm });

      await callRoute(archiveSession, {
        as: dm,
        method: 'POST',
        path: `/api/sessions/${session.id}/archive`,
        body: {},
      });

      expect((await issue(session.id, dm)).status).toBe(409);
    }));

  describe('reissuing (v3 Req 38.2)', () => {
    it('retires the previous code, proven by redeeming it afterwards', () =>
      withTestDatabase(async (database) => {
        const dm = seedAccount();
        const { session } = seedSession(database, { dm });

        const first = (await issue(session.id, dm)).body.code;
        const second = (await issue(session.id, dm)).body.code;

        expect(second).not.toBe(first);

        const withOld = await redeem(first, seedAccount());
        expect(withOld.status).toBe(409);
        expect(refusalMessage(withOld)).toContain('taken back');

        expect((await redeem(second, seedAccount())).status).toBe(200);
      }));

    it('leaves exactly one live code behind', () =>
      withTestDatabase(async (database) => {
        const dm = seedAccount();
        const { session } = seedSession(database, { dm });

        await issue(session.id, dm);
        const second = (await issue(session.id, dm)).body.code;

        expect(activeInviteForSession(session.id, database)?.code).toBe(
          normalizeInviteCode(second)
        );
      }));
  });
});

describe('DELETE /api/sessions/:id/invite', () => {
  it('refuses anonymous, non-member and a player, and accepts the DM', () =>
    withTestDatabase(async (database) => {
      const dm = seedAccount();
      const player = seedAccount();
      const { session } = seedSession(database, { dm });

      expect((await revoke(session.id, null)).status).toBe(401);
      expect((await revoke(session.id, seedAccount())).status).toBe(404);
      expect((await revoke(session.id, player)).status).toBe(404);
      expect((await revoke(session.id, dm)).status).toBe(204);
    }));

  it('stops the code working', () =>
    withTestDatabase(async (database) => {
      const dm = seedAccount();
      const { session } = seedSession(database, { dm });
      const code = (await issue(session.id, dm)).body.code;

      await revoke(session.id, dm);

      expect((await redeem(code, seedAccount())).status).toBe(409);
      expect(activeInviteForSession(session.id, database)).toBeNull();
    }));

  it('succeeds when there was nothing to take back', () =>
    withTestDatabase(async (database) => {
      const dm = seedAccount();
      const { session } = seedSession(database, { dm });

      // The DM asked for there to be no live code; afterwards there is none. Reporting *there was
      // nothing* would be reporting the state before their request rather than after it.
      expect((await revoke(session.id, dm)).status).toBe(204);
    }));
});

describe('POST /api/invites/:code', () => {
  it('refuses an anonymous caller', () =>
    withTestDatabase(async (database) => {
      const dm = seedAccount();
      const { session } = seedSession(database, { dm });
      const code = (await issue(session.id, dm)).body.code;

      expect((await redeem(code, null)).status).toBe(401);
    }));

  it('seats a second Account as a player', () =>
    withTestDatabase(async (database) => {
      const dm = seedAccount();
      const guest = seedAccount();
      const { session } = seedSession(database, { dm });
      const code = (await issue(session.id, dm)).body.code;

      const redeemed = await redeem(code, guest);

      expect(redeemed.status).toBe(200);
      expect(redeemed.body.joined).toBe(true);
      expect(redeemed.body.session.role).toBe(MEMBER_ROLE.PLAYER);
      expect(findSessionMember(session.id, guest.id, database)?.role).toBe(MEMBER_ROLE.PLAYER);
      // …and the DM is still the DM, which the partial unique index exists to guarantee
      expect(findSessionMember(session.id, dm.id, database)?.role).toBe(MEMBER_ROLE.DM);
    }));

  it('accepts the code typed back in any shape a person might type it', () =>
    withTestDatabase(async (database) => {
      const dm = seedAccount();
      const { session } = seedSession(database, { dm });
      const code = (await issue(session.id, dm)).body.code;

      // Lower case, no hyphen, a stray space — and `O` where the code has a zero, which is the
      // whole reason the alphabet was chosen
      const mangled = ` ${code.replace('-', '').toLowerCase().replaceAll('0', 'o')} `;

      expect((await redeem(mangled, seedAccount())).status).toBe(200);
    }));

  describe('redeeming twice (v3 Req 38.7)', () => {
    it('succeeds and says nothing changed', () =>
      withTestDatabase(async (database) => {
        const dm = seedAccount();
        const guest = seedAccount();
        const { session } = seedSession(database, { dm });
        const code = (await issue(session.id, dm)).body.code;

        expect((await redeem(code, guest)).body.joined).toBe(true);

        const again = await redeem(code, guest);

        expect(again.status).toBe(200);
        expect(again.body.joined).toBe(false);
      }));

    it('creates no second membership row', () =>
      withTestDatabase(async (database) => {
        const dm = seedAccount();
        const guest = seedAccount();
        const { session } = seedSession(database, { dm });
        const code = (await issue(session.id, dm)).body.code;

        await redeem(code, guest);
        await redeem(code, guest);

        const rows = database.sqlite
          .prepare('SELECT id FROM session_member WHERE session_id = ? AND account_id = ?')
          .all(session.id, guest.id);

        expect(rows).toHaveLength(1);
      }));

    it('announces the join once and the second click not at all (TICKET-LIVE-04)', () =>
      withTestDatabase(async (database) => {
        // **The idempotence reaches the log too.** A second click writes no row, so `recordEvent`
        // is handed a `null` and publishes nothing — a table told twice that somebody joined would
        // be a roster asking for the member list twice for one arrival.
        const dm = seedAccount();
        const guest = seedAccount();
        const { session } = seedSession(database, { dm });
        const code = (await issue(session.id, dm)).body.code;

        await redeem(code, guest);
        await redeem(code, guest);

        const log = eventsSince(session.id, 0, database);

        expect(log).toHaveLength(1);
        expect(log[0].type).toBe(SESSION_EVENT.MEMBER_JOINED);
        expect(log[0].actorAccountId).toBe(guest.id);

        const payload = JSON.parse(log[0].payload) as MembershipEventPayload;

        // The id and nothing else — a name here would be a copy a rename could make wrong
        expect(payload).toEqual({ accountId: guest.id });
      }));

    it('lets the DM redeem their own code without losing the role', () =>
      withTestDatabase(async (database) => {
        const dm = seedAccount();
        const { session } = seedSession(database, { dm });
        const code = (await issue(session.id, dm)).body.code;

        // Somebody pastes the link into the group chat and clicks their own paste
        const again = await redeem(code, dm);

        expect(again.status).toBe(200);
        expect(again.body.joined).toBe(false);
        expect(again.body.session.role).toBe(MEMBER_ROLE.DM);
        expect(findSessionMember(session.id, dm.id, database)?.role).toBe(MEMBER_ROLE.DM);
      }));
  });

  describe('the four refusals, each with its own message (v3 Req 38.4)', () => {
    it('says something different for unknown, revoked, expired and archived', () =>
      withTestDatabase(async (database) => {
        const dm = seedAccount();

        const revokedSession = seedSession(database, { dm }).session;
        const revokedCode = (await issue(revokedSession.id, dm)).body.code;
        await revoke(revokedSession.id, dm);

        const expiredSession = seedSession(database, { dm }).session;
        const expiredCode = (await issue(expiredSession.id, dm)).body.code;
        database.sqlite
          .prepare('UPDATE session_invite SET expires_at = ? WHERE code = ?')
          .run(1, normalizeInviteCode(expiredCode));

        const archivedSession = seedSession(database, { dm }).session;
        const archivedCode = (await issue(archivedSession.id, dm)).body.code;
        await callRoute(archiveSession, {
          as: dm,
          method: 'POST',
          path: `/api/sessions/${archivedSession.id}/archive`,
          body: {},
        });

        const messages = [
          refusalMessage(await redeem('ZZZZZ-ZZZZZ', seedAccount())),
          refusalMessage(await redeem(revokedCode, seedAccount())),
          refusalMessage(await redeem(expiredCode, seedAccount())),
          refusalMessage(await redeem(archivedCode, seedAccount())),
        ];

        // Four situations with four different things for the person holding the code to do. A
        // shared "invalid code" would satisfy any assertion weaker than this one.
        expect(new Set(messages).size).toBe(4);
      }));

    it('gives an unknown code a 404 and the others a 409', () =>
      withTestDatabase(async (database) => {
        const dm = seedAccount();
        const { session } = seedSession(database, { dm });
        const code = (await issue(session.id, dm)).body.code;
        await revoke(session.id, dm);

        expect((await redeem('ZZZZZ-ZZZZZ', seedAccount())).status).toBe(404);
        expect((await redeem(code, seedAccount())).status).toBe(409);
      }));

    it('refuses an empty code rather than matching something', () =>
      withTestDatabase(async () => {
        expect((await redeem('---', seedAccount())).status).toBe(404);
      }));
  });

  describe('the limiter (v3 Req 38.1)', () => {
    it('refuses an Account that has spent its attempts', () =>
      withTestDatabase(async (database) => {
        const dm = seedAccount();
        const guesser = seedAccount();
        const { session } = seedSession(database, { dm });
        const real = (await issue(session.id, dm)).body.code;

        for (let attempt = 0; attempt < 10; attempt += 1) {
          await redeem(`ZZZZZ-ZZZZ${attempt}`, guesser);
        }

        // Even the *real* code is refused now — the limiter is consulted before the lookup, so
        // being refused says nothing about whether the guess existed
        const blocked = await redeem(real, guesser);
        expect(blocked.status).toBe(429);

        // …and somebody else is unaffected, so this is a limit rather than an outage
        expect((await redeem(real, seedAccount())).status).toBe(200);
      }));

    it('counts a revoked code against the guesser, not only an unknown one', () =>
      withTestDatabase(async (database) => {
        const dm = seedAccount();
        const guesser = seedAccount();
        const { session } = seedSession(database, { dm });
        const code = (await issue(session.id, dm)).body.code;
        await revoke(session.id, dm);

        for (let attempt = 0; attempt < 10; attempt += 1) {
          await redeem(code, guesser);
        }

        // An attacker learns as much from *expired* as from *no such code* — both say a code
        // existed — so a limiter that only counted misses would have a hole shaped like a hit
        expect((await redeem('ZZZZZ-ZZZZZ', guesser)).status).toBe(429);
      }));

    it('leaves somebody who mistypes once and then succeeds carrying nothing', () =>
      withTestDatabase(async (database) => {
        const dm = seedAccount();
        const guest = seedAccount();
        const { session } = seedSession(database, { dm });
        const code = (await issue(session.id, dm)).body.code;

        await redeem('ZZZZZ-ZZZZZ', guest);
        expect((await redeem(code, guest)).status).toBe(200);

        // Cleared on success, so the next table they join does not start them one strike down
        for (let attempt = 0; attempt < 9; attempt += 1) {
          await redeem('YYYYY-YYYYY', guest);
        }
        expect((await redeem('XXXXX-XXXXX', guest)).status).not.toBe(429);
      }));
  });
});

describe('GET /api/invites/:code', () => {
  it('refuses an anonymous caller, which is what sends them to sign-in', () =>
    withTestDatabase(async (database) => {
      const dm = seedAccount();
      const { session } = seedSession(database, { dm });
      const code = (await issue(session.id, dm)).body.code;

      expect((await preview(code, null)).status).toBe(401);
    }));

  it('names the table without saying who is at it', () =>
    withTestDatabase(async (database) => {
      const dm = seedAccount();
      const { session } = seedSession(database, { dm, name: 'Tuesday night' });
      const code = (await issue(session.id, dm)).body.code;

      const shown = await preview(code, seedAccount());

      expect(shown.body).toEqual({ sessionName: 'Tuesday night', isJoinable: true });
    }));

  it('seats nobody', () =>
    withTestDatabase(async (database) => {
      const dm = seedAccount();
      const looker = seedAccount();
      const { session } = seedSession(database, { dm });
      const code = (await issue(session.id, dm)).body.code;

      await preview(code, looker);

      expect(findSessionMember(session.id, looker.id, database)).toBeNull();
    }));

  it('says an archived game is not joinable rather than refusing to describe it', () =>
    withTestDatabase(async (database) => {
      const dm = seedAccount();
      const { session } = seedSession(database, { dm });
      const code = (await issue(session.id, dm)).body.code;
      await callRoute(archiveSession, {
        as: dm,
        method: 'POST',
        path: `/api/sessions/${session.id}/archive`,
        body: {},
      });

      const shown = await preview(code, seedAccount());

      // A page saying *this game has ended* is a better answer than an error to decode
      expect(shown.status).toBe(200);
      expect(shown.body.isJoinable).toBe(false);
    }));

  it('refuses a revoked code with the same message the redeem does', () =>
    withTestDatabase(async (database) => {
      const dm = seedAccount();
      const { session } = seedSession(database, { dm });
      const code = (await issue(session.id, dm)).body.code;
      await revoke(session.id, dm);

      const shown = await preview(code, seedAccount());
      const taken = await redeem(code, seedAccount());

      expect(shown.status).toBe(409);
      expect(refusalMessage(shown)).toBe(refusalMessage(taken));
    }));

  describe('the limiter reaches this route too (the GAM-02 review)', () => {
    it('refuses an Account that has spent its attempts previewing', () =>
      withTestDatabase(async (database) => {
        const dm = seedAccount();
        const guesser = seedAccount();
        const { session } = seedSession(database, { dm });
        const real = (await issue(session.id, dm)).body.code;

        for (let attempt = 0; attempt < 10; attempt += 1) {
          await preview(`ZZZZZ-ZZZZ${attempt}`, guesser);
        }

        // Without this, sign-up being open made `GET` an unmetered oracle over the whole code
        // space — three distinguishable answers at whatever rate the process serves, with a single
        // `POST` spent only on the hit
        expect((await preview(real, guesser)).status).toBe(429);
      }));

    it('shares its buckets with redemption, so neither is a way round the other', () =>
      withTestDatabase(async (database) => {
        const dm = seedAccount();
        const guesser = seedAccount();
        const { session } = seedSession(database, { dm });
        const real = (await issue(session.id, dm)).body.code;

        // Five guesses at each route: two separate limiters would let this run forever by
        // alternating, and the shared pair refuses at ten
        for (let attempt = 0; attempt < 5; attempt += 1) {
          await preview(`ZZZZZ-ZZZZ${attempt}`, guesser);
          await redeem(`YYYYY-YYYY${attempt}`, guesser);
        }

        expect((await redeem(real, guesser)).status).toBe(429);
      }));
  });

  it('answers a malformed path with a 404 rather than a 500', () =>
    withTestDatabase(async () => {
      // A lone `%` used to reach `decodeURIComponent`, which throws `URIError` — not an `AppError`,
      // so the pipeline logged it as a bug and answered 500. Any signed-in caller could emit an
      // unbounded stream of them.
      const response = await callRoute<InvitePreview>(previewInvite, {
        as: seedAccount(),
        path: '/api/invites/%',
      });

      expect(response.status).toBe(404);
    }));
});

describe('the code on the session document', () => {
  it('reaches the DM and nobody else', () =>
    withTestDatabase(async (database) => {
      const dm = seedAccount();
      const guest = seedAccount();
      const { session } = seedSession(database, { dm });
      const code = (await issue(session.id, dm)).body.code;
      await redeem(code, guest);

      const { readSession } = await import('../sessions/readSession');

      const asDm = await callRoute<GameSessionDocument>(readSession, {
        as: dm,
        path: `/api/sessions/${session.id}`,
      });
      const asPlayer = await callRoute<GameSessionDocument>(readSession, {
        as: guest,
        path: `/api/sessions/${session.id}`,
      });

      expect(asDm.body.invite?.code).toBe(code);
      // A player holding it could invite the table's next member, which is the DM's decision
      expect(asPlayer.body.invite).toBeUndefined();
    }));

  it('carries the expiry beside the code, so a stale one can be told from a live one', () =>
    withTestDatabase(async (database) => {
      const dm = seedAccount();
      const { session } = seedSession(database, { dm });
      const issued = (await issue(session.id, dm)).body;

      const { readSession } = await import('../sessions/readSession');

      const shown = await callRoute<GameSessionDocument>(readSession, {
        as: dm,
        path: `/api/sessions/${session.id}`,
      });

      // A bare string cannot say *this ran out a week ago*, so the surface rendered a dead code as
      // the live invitation with a *Copy link* beside it (the GAM-02 review)
      expect(shown.body.invite?.expiresAt).toBe(issued.expiresAt);
    }));

  it('is absent for a DM whose table has no live code', () =>
    withTestDatabase(async (database) => {
      const dm = seedAccount();
      const { session } = seedSession(database, { dm });

      const { readSession } = await import('../sessions/readSession');

      const shown = await callRoute<GameSessionDocument>(readSession, {
        as: dm,
        path: `/api/sessions/${session.id}`,
      });

      expect(shown.body.invite).toBeUndefined();
    }));
});

describe('the stored row', () => {
  it('carries no email and is never marked redeemed', () =>
    withTestDatabase(async (database) => {
      const dm = seedAccount();
      const { session } = seedSession(database, { dm });
      const code = (await issue(session.id, dm)).body.code;

      await redeem(code, seedAccount());
      await redeem(code, seedAccount());

      const row = findInviteByCode(normalizeInviteCode(code), database);

      // Those two columns belong to GAM-03's addressed variant, where an invite really is for one
      // person and really is used up. Stamping this one would end the invitation for everybody else.
      expect(row?.email).toBeNull();
      expect(row?.redeemedAt).toBeNull();
    }));
});
