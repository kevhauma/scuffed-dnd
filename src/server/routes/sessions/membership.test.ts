/**
 * Who is at a table, and how a seat is given up (TICKET-GAM-04)
 *
 * The five things this file is really about, one per acceptance criterion:
 *
 * 1. **A removed Member loses every session read and write**, and their Characters stay — readable
 *    by the remaining Members, writable by **nobody**, the DM's own controls included. That last
 *    clause is the one worth testing hardest, because retention is easy to implement as *the owner
 *    keeps writing* and the criterion says the opposite.
 * 2. **Leaving is the same treatment**, and rejoining through an Invite restores write access with
 *    nothing to repair — ownership is by Account id and was never moved.
 * 3. **Transferring is one transaction over three rows**, and a failure leaves exactly one DM.
 * 4. **A DM cannot walk away from their own table** (v3 Req 39.6), and the refusal names the way out.
 * 5. **One DM per session is the *database's* rule**, asserted by attempting a direct second insert
 *    rather than by trusting the route that never tries.
 *
 * **Validates: v3 Req 32.1, 32.3, 32.4, 32.5, 37.5, 39.2, 39.3, 39.4, 39.5, 39.6, 39.7**
 */

import { describe, expect, it } from 'vitest';
import type { GameSessionSummary, SessionMemberListing } from '#shared/types/api';
import { MEMBER_ROLE } from '#shared/types/api';
import { requireCharacterWriter } from '../../auth/guards';
import { AppError } from '../../http/appError';
import { insertUnseatedCharacter } from '../../repositories/characterRepository';
import {
  findGameSession,
  findSessionMember,
  seatSessionMember,
} from '../../repositories/gameSessionRepository';
import {
  type CallOptions,
  callRoute,
  type Database,
  seedAccount,
  seedCharacter,
  seedMember,
  seedRegisteredAccount,
  seedSession,
  withTestDatabase,
} from '../../testing';
import { archiveSession } from './archiveSession';
import { listMembers } from './listMembers';
import { removeMember } from './removeMember';
import { transferDm } from './transferDm';

/** Read the roster, as somebody */
function roster(sessionId: string, as: CallOptions['as']) {
  return callRoute<SessionMemberListing>(listMembers, {
    as,
    path: `/api/sessions/${sessionId}/members`,
  });
}

/** Take a seat away, as somebody */
function remove(sessionId: string, accountId: string, as: CallOptions['as']) {
  return callRoute(removeMember, {
    as,
    method: 'DELETE',
    path: `/api/sessions/${sessionId}/members/${accountId}`,
  });
}

/** Hand the table over, as somebody */
function transfer(sessionId: string, accountId: string, as: CallOptions['as']) {
  return callRoute<GameSessionSummary>(transferDm, {
    as,
    method: 'POST',
    path: `/api/sessions/${sessionId}/dm`,
    body: { accountId },
  });
}

/** A table with a registered DM and a registered player seated at it */
function aTableWithAPlayer(database: Database) {
  const dm = seedRegisteredAccount(database, { name: 'The DM' });
  const player = seedRegisteredAccount(database, { name: 'Ada' });
  const { session } = seedSession(database, { dm });
  seedMember(database, { session, account: player });

  return { dm, player, session };
}

/** Whether this Account may write to that character, asked the way a route would */
function mayWrite(characterId: string, accountId: string): boolean {
  try {
    requireCharacterWriter({ account: { id: accountId } }, characterId);
    return true;
  } catch (error) {
    if (error instanceof AppError) return false;
    throw error;
  }
}

describe('the roster', () => {
  it('should be readable by every Member and nobody else', () =>
    withTestDatabase(async (database) => {
      const { dm, player, session } = aTableWithAPlayer(database);

      expect((await roster(session.id, null)).status).toBe(401);
      expect((await roster(session.id, seedAccount())).status).toBe(404);
      expect((await roster(session.id, player)).status).toBe(200);
      expect((await roster(session.id, dm)).status).toBe(200);
    }));

  it('should name everybody with their role, the DM first', () =>
    withTestDatabase(async (database) => {
      const { dm, player, session } = aTableWithAPlayer(database);

      const { members } = (await roster(session.id, player)).body;

      expect(members.map((one) => [one.accountId, one.role, one.name])).toEqual([
        [dm.id, MEMBER_ROLE.DM, 'The DM'],
        [player.id, MEMBER_ROLE.PLAYER, 'Ada'],
      ]);
    }));

  it('should still seat an Account whose profile has gone', () =>
    withTestDatabase(async (database) => {
      const dm = seedRegisteredAccount(database, { name: 'The DM' });
      const { session } = seedSession(database, { dm });
      // `seedAccount` writes no `user` row — the seat exists and the profile does not
      const ghost = seedAccount();
      seedMember(database, { session, account: ghost });

      const { members } = (await roster(session.id, dm)).body;

      // A roster that dropped a row for want of a name would be lying about who is at the table
      expect(members.map((one) => one.name)).toEqual(['The DM', 'Somebody']);
    }));

  it('should put each Member’s characters on their own line', () =>
    withTestDatabase(async (database) => {
      const { player, session } = aTableWithAPlayer(database);
      seedCharacter(database, { session, owner: player, name: 'Quackers' });

      const { members } = (await roster(session.id, player)).body;

      expect(members.find((one) => one.accountId === player.id)?.characters).toEqual([
        { id: expect.any(String) as unknown as string, name: 'Quackers' },
      ]);
      // …and a Member playing nothing has an empty list rather than being absent
      expect(members).toHaveLength(2);
    }));

  it('should be readable on an archived table', () =>
    withTestDatabase(async (database) => {
      const { dm, session } = aTableWithAPlayer(database);

      await callRoute(archiveSession, {
        as: dm,
        method: 'POST',
        path: `/api/sessions/${session.id}/archive`,
        body: {},
      });

      expect((await roster(session.id, dm)).status).toBe(200);
    }));
});

describe('giving up a seat', () => {
  it('should let a DM remove a player', () =>
    withTestDatabase(async (database) => {
      const { dm, player, session } = aTableWithAPlayer(database);

      expect((await remove(session.id, player.id, dm)).status).toBe(204);
      expect(findSessionMember(session.id, player.id, database)).toBeNull();
      expect((await roster(session.id, dm)).body.members).toHaveLength(1);
    }));

  it('should let a player leave', () =>
    withTestDatabase(async (database) => {
      const { player, session } = aTableWithAPlayer(database);

      expect((await remove(session.id, player.id, player)).status).toBe(204);
      expect(findSessionMember(session.id, player.id, database)).toBeNull();
    }));

  it('should refuse a player taking somebody else’s seat, before it looks them up', () =>
    withTestDatabase(async (database) => {
      const { player, session } = aTableWithAPlayer(database);
      const other = seedRegisteredAccount(database);
      seedMember(database, { session, account: other });

      expect((await remove(session.id, other.id, player)).status).toBe(404);
      // …and the same 404 for an Account that is not at the table at all, so being refused says
      // nothing about who is (v3 Req 32.5)
      expect((await remove(session.id, seedAccount().id, player)).status).toBe(404);
      expect(findSessionMember(session.id, other.id, database)).not.toBeNull();
    }));

  it('should refuse an anonymous caller and a stranger', () =>
    withTestDatabase(async (database) => {
      const { player, session } = aTableWithAPlayer(database);

      expect((await remove(session.id, player.id, null)).status).toBe(401);
      expect((await remove(session.id, player.id, seedAccount())).status).toBe(404);
    }));

  it('should refuse the DM their own seat, and say how to get out (v3 Req 39.6)', () =>
    withTestDatabase(async (database) => {
      const { dm, session } = aTableWithAPlayer(database);

      const refused = await remove(session.id, dm.id, dm);

      expect(refused.status).toBe(409);
      expect((refused.body as { error: { message: string } }).error.message).toMatch(
        /hand it to another member|archive/i
      );
      expect(findSessionMember(session.id, dm.id, database)?.role).toBe(MEMBER_ROLE.DM);
    }));

  it('should be allowed on an archived table, because tidying up is not a change to the game', () =>
    withTestDatabase(async (database) => {
      const { dm, player, session } = aTableWithAPlayer(database);

      await callRoute(archiveSession, {
        as: dm,
        method: 'POST',
        path: `/api/sessions/${session.id}/archive`,
        body: {},
      });

      expect((await remove(session.id, player.id, player)).status).toBe(204);
    }));
});

describe('what happens to the Characters', () => {
  it('should keep them at the table, writable by nobody once their owner has gone', () =>
    withTestDatabase(async (database) => {
      const { dm, player, session } = aTableWithAPlayer(database);
      const sheet = seedCharacter(database, { session, owner: player, name: 'Quackers' });

      expect(mayWrite(sheet.id, player.id)).toBe(true);
      expect(mayWrite(sheet.id, dm.id)).toBe(true);

      await remove(session.id, player.id, dm);

      // Retained rather than deleted — a character is part of the campaign's history
      expect(findSessionMember(session.id, player.id, database)).toBeNull();
      expect((await roster(session.id, dm)).body.departedCharacters).toEqual([
        { id: sheet.id, name: 'Quackers' },
      ]);

      // …and read-only for **everybody**, which is the half a naive retention gets wrong
      expect(mayWrite(sheet.id, player.id)).toBe(false);
      expect(mayWrite(sheet.id, dm.id)).toBe(false);
    }));

  it('should give write access back on a rejoin, with nothing to repair', () =>
    withTestDatabase(async (database) => {
      const { dm, player, session } = aTableWithAPlayer(database);
      const sheet = seedCharacter(database, { session, owner: player });

      await remove(session.id, player.id, player);
      expect(mayWrite(sheet.id, player.id)).toBe(false);

      // What redeeming an invitation does, called directly — the routes for it are GAM-02's and
      // GAM-03's and both end here
      seatSessionMember({
        id: 'rejoined',
        session,
        accountId: player.id,
        role: MEMBER_ROLE.PLAYER,
        now: Date.now(),
      });

      // Ownership was never moved, so there is nothing to restore
      expect(mayWrite(sheet.id, player.id)).toBe(true);
      expect(mayWrite(sheet.id, dm.id)).toBe(true);
      expect((await roster(session.id, dm)).body.departedCharacters).toEqual([]);
    }));

  it('should leave a character at no table alone, which is a different rule', () =>
    withTestDatabase(async (database) => {
      const { player, session } = aTableWithAPlayer(database);

      // TICKET-IO-04's uploaded character: `session_id IS NULL`, so there is no table for anybody to
      // have left and the owner is the only writer there has ever been. Leaving a *different* table
      // must not touch it.
      const uploaded = insertUnseatedCharacter(
        {
          id: 'uploaded-1',
          ownerAccountId: player.id,
          name: 'Quackers at home',
          data: '{}',
          now: Date.now(),
        },
        database
      );

      await remove(session.id, player.id, player);

      expect(mayWrite(uploaded.id, player.id)).toBe(true);
    }));
});

describe('handing the table over', () => {
  it('should move the role and leave both Accounts at the table', () =>
    withTestDatabase(async (database) => {
      const { dm, player, session } = aTableWithAPlayer(database);

      const handed = await transfer(session.id, player.id, dm);

      expect(handed.status).toBe(200);
      // What the caller now holds, which is the point of the answer
      expect(handed.body.role).toBe(MEMBER_ROLE.PLAYER);
      expect(findSessionMember(session.id, player.id, database)?.role).toBe(MEMBER_ROLE.DM);
      expect(findSessionMember(session.id, dm.id, database)?.role).toBe(MEMBER_ROLE.PLAYER);
    }));

  it('should write the session’s own column too, not only the memberships', () =>
    withTestDatabase(async (database) => {
      const { dm, player, session } = aTableWithAPlayer(database);

      await transfer(session.id, player.id, dm);

      // `session_member` is the authority and `dm_account_id` is the mirror — but a listing that
      // read the stale mirror would show the wrong person running the game
      expect(findGameSession(session.id, database)?.dmAccountId).toBe(player.id);
    }));

  it('should answer with the session as it is now, not as it was read', () =>
    withTestDatabase(async (database) => {
      const { dm, player, session } = aTableWithAPlayer(database);

      const handed = await transfer(session.id, player.id, dm);

      // The route loads the row before it writes, so answering with *that* one would put a summary
      // on the wire carrying the moment before the transfer
      expect(handed.body.updatedAt).toBeGreaterThan(session.updatedAt);
      expect(findGameSession(session.id, database)?.updatedAt).toBe(handed.body.updatedAt);
    }));

  it('should let the new DM act and the old one no longer', () =>
    withTestDatabase(async (database) => {
      const { dm, player, session } = aTableWithAPlayer(database);
      const third = seedRegisteredAccount(database);
      seedMember(database, { session, account: third });

      await transfer(session.id, player.id, dm);

      // The old DM is a player now, so somebody else's seat is not theirs to take
      expect((await remove(session.id, third.id, dm)).status).toBe(404);
      expect((await remove(session.id, third.id, player)).status).toBe(204);
    }));

  it('should be the DM’s alone', () =>
    withTestDatabase(async (database) => {
      const { player, session } = aTableWithAPlayer(database);

      expect((await transfer(session.id, player.id, null)).status).toBe(401);
      expect((await transfer(session.id, player.id, player)).status).toBe(404);
      expect((await transfer(session.id, player.id, seedAccount())).status).toBe(404);
    }));

  it('should refuse somebody who is not at the table, and say to invite them', () =>
    withTestDatabase(async (database) => {
      const { dm, session } = aTableWithAPlayer(database);

      const refused = await transfer(session.id, seedRegisteredAccount(database).id, dm);

      expect(refused.status).toBe(409);
      expect((refused.body as unknown as { error: { message: string } }).error.message).toMatch(
        /invite them first/i
      );
    }));

  it('should refuse handing it to yourself, and an empty request', () =>
    withTestDatabase(async (database) => {
      const { dm, session } = aTableWithAPlayer(database);

      expect((await transfer(session.id, dm.id, dm)).status).toBe(409);
      expect(
        (
          await callRoute(transferDm, {
            as: dm,
            method: 'POST',
            path: `/api/sessions/${session.id}/dm`,
            body: {},
          })
        ).status
      ).toBe(400);
    }));

  it('should refuse an archived table', () =>
    withTestDatabase(async (database) => {
      const { dm, player, session } = aTableWithAPlayer(database);

      await callRoute(archiveSession, {
        as: dm,
        method: 'POST',
        path: `/api/sessions/${session.id}/archive`,
        body: {},
      });

      expect((await transfer(session.id, player.id, dm)).status).toBe(409);
      expect(findSessionMember(session.id, dm.id, database)?.role).toBe(MEMBER_ROLE.DM);
    }));
});

describe('one DM per session', () => {
  it('is the database’s rule, not the route’s', () =>
    withTestDatabase((database) => {
      const { session } = aTableWithAPlayer(database);
      const interloper = seedAccount();

      // Straight past every route and every guard, which is the only way to prove the constraint is
      // load-bearing rather than decorative: `session_member_one_dm` is a partial unique index over
      // the `dm` rows of one session (v3 Req 39.2)
      expect(() =>
        seedMember(database, {
          session,
          account: interloper,
          role: MEMBER_ROLE.DM,
        })
      ).toThrow();
    }));

  it('survives a transfer, which is when there would be two', () =>
    withTestDatabase(async (database) => {
      const { dm, player, session } = aTableWithAPlayer(database);

      await transfer(session.id, player.id, dm);

      const dms = (await roster(session.id, dm)).body.members.filter(
        (one) => one.role === MEMBER_ROLE.DM
      );

      expect(dms).toHaveLength(1);
      expect(dms[0].accountId).toBe(player.id);
    }));
});
