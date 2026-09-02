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
import type {
  DmTransferEventPayload,
  GameSessionSummary,
  MembershipEventPayload,
  SessionMemberListing,
} from '#shared/types/api';
import { MEMBER_ROLE, SESSION_EVENT } from '#shared/types/api';
import { SOCKET_CLOSE_CODE } from '#shared/types/liveSocket';
import { requireCharacterWriter } from '../../auth/guards';
import { AppError } from '../../http/appError';
import { insertUnseatedCharacter } from '../../repositories/characterRepository';
import type { AppendEvent, EventRow } from '../../repositories/eventRepository';
import { eventsSince } from '../../repositories/eventRepository';
import {
  findGameSession,
  findSessionMember,
  removeSessionMember,
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
  seedRuleset,
  seedSession,
  withTestDatabase,
} from '../../testing';
import {
  createSocketRooms,
  type LiveConnection,
  type SocketRooms,
  setLiveRooms,
} from '../../ws/rooms';
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

      // What redeeming an invitation leaves behind — arranged with the fixture rather than the
      // repository since TICKET-LIVE-04, which made seating a composing writer that appends an
      // Event. This case is about write access surviving a rejoin, not about the table being told.
      seedMember(database, { session, account: player });

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
          rulesetId: seedRuleset(database, { owner: player }).id,
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

describe('the live connections a seat was holding', () => {
  /** A connection that remembers being closed, standing in for a real socket (TICKET-LIVE-01) */
  function fakeConnection(accountId: string): LiveConnection & { closes: number[] } {
    const closes: number[] = [];

    return {
      accountId,
      closes,
      send: () => undefined,
      close: (code) => {
        closes.push(code);
      },
    };
  }

  /**
   * Install a registry this test can watch, and put the process's own back afterwards
   *
   * @param run What to do with it
   * @returns Whatever `run` returned
   */
  async function withWatchedRooms<T>(run: (rooms: SocketRooms) => Promise<T>): Promise<T> {
    const rooms = createSocketRooms();
    const previous = setLiveRooms(rooms);

    try {
      return await run(rooms);
    } finally {
      // **Restored faithfully, `null` included.** `setLiveRooms` returns `SocketRooms | null`
      // precisely so the slot can be put back as it was found, and *as it was found* is usually
      // **empty** — nothing has asked for `liveRooms()` yet. An `if (previous)` therefore skipped
      // the restore on the first call and left this test's registry installed as the process
      // singleton for the rest of the worker, which is the leak the harness shape exists to avoid.
      setLiveRooms(previous);
    }
  }

  it('should close the removed Member’s connections to that room', () =>
    withTestDatabase(async (database) => {
      // **Criterion 5 at the route.** A subscribe is checked once, so a connection admitted while
      // the seat existed would otherwise outlive the authorization that admitted it — nothing
      // re-asks. The removal is what has to close it, in the same act.
      const { dm, player, session } = aTableWithAPlayer(database);

      await withWatchedRooms(async (rooms) => {
        const departing = fakeConnection(player.id);
        const staying = fakeConnection(dm.id);

        rooms.join(session.id, departing);
        rooms.join(session.id, staying);

        const response = await remove(session.id, player.id, dm);

        const status = response.status;
        const departingClosed = departing.closes;
        const stayingClosed = staying.closes;

        expect(status).toBe(204);
        expect(departingClosed).toEqual([SOCKET_CLOSE_CODE.MEMBERSHIP_ENDED]);
        expect(stayingClosed).toEqual([]);
      });
    }));

  it('should close nothing when the removal was refused', () =>
    withTestDatabase(async (database) => {
      // The eviction is after the delete, not before — a refused request has taken nothing away,
      // so the connections are still entitled to be where they are
      const { player, session } = aTableWithAPlayer(database);
      const stranger = seedAccount();

      await withWatchedRooms(async (rooms) => {
        const held = fakeConnection(player.id);
        rooms.join(session.id, held);

        const response = await remove(session.id, player.id, stranger);

        const status = response.status;
        const closed = held.closes;

        expect(status).toBe(404);
        expect(closed).toEqual([]);
      });
    }));

  it('should leave a departing Member’s connections to other tables alone', () =>
    withTestDatabase(async (database) => {
      const { dm, player, session } = aTableWithAPlayer(database);
      const elsewhere = seedSession(database);
      seedMember(database, { session: elsewhere.session, account: player });

      await withWatchedRooms(async (rooms) => {
        const atThisTable = fakeConnection(player.id);
        const atTheOther = fakeConnection(player.id);

        rooms.join(session.id, atThisTable);
        rooms.join(elsewhere.session.id, atTheOther);

        await remove(session.id, player.id, dm);

        const thisTableClosed = atThisTable.closes;
        const otherTableClosed = atTheOther.closes;

        expect(thisTableClosed).toEqual([SOCKET_CLOSE_CODE.MEMBERSHIP_ENDED]);
        expect(otherTableClosed).toEqual([]);
      });
    }));
});

/**
 * What the table is told when its membership changes (TICKET-LIVE-04, v3 Req 44.3, 44.4)
 *
 * GAM-04 built these two writes before there was any fan-out to reach, so until now a removal or a
 * handover was a change every other Member learned about by reloading. The Event is what closes
 * that, and the two things worth asserting are the ones a reader cannot check by looking: that there
 * is **exactly one** of them per act, and that the payload carries **no name**.
 */
describe('the Event a membership change writes', () => {
  /** Every Event this table has ever recorded, oldest first */
  function logOf(database: Database, sessionId: string): EventRow[] {
    return eventsSince(sessionId, 0, database);
  }

  /** An appender that refuses, standing in for a log that could not take the row */
  const refusingAppend: AppendEvent = () => {
    throw new Error('the log refused this Event');
  };

  it('should record the DM taking a seat away, naming the Member by id alone', () =>
    withTestDatabase(async (database) => {
      const { dm, player, session } = aTableWithAPlayer(database);

      const response = await remove(session.id, player.id, dm);
      const log = logOf(database, session.id);

      expect(response.status).toBe(204);
      expect(log).toHaveLength(1);
      expect(log[0].type).toBe(SESSION_EVENT.MEMBER_REMOVED);

      // The actor is the column, as it is for every other Event on this log
      expect(log[0].actorAccountId).toBe(dm.id);

      const payload = JSON.parse(log[0].payload) as MembershipEventPayload;

      expect(payload).toEqual({ accountId: player.id });
    }));

  it('should tell a leaving apart from a removal, which is the same write', () =>
    withTestDatabase(async (database) => {
      // One route, two actors, two stories — and `actor_account_id` alone would make a reader
      // compare two ids to work out which of them happened
      const { player, session } = aTableWithAPlayer(database);

      const response = await remove(session.id, player.id, player);
      const log = logOf(database, session.id);

      expect(response.status).toBe(204);
      expect(log).toHaveLength(1);
      expect(log[0].type).toBe(SESSION_EVENT.MEMBER_LEFT);
      expect(log[0].actorAccountId).toBe(player.id);
    }));

  it('should record a handover with both ids, so a reader moves two rows rather than guessing one', () =>
    withTestDatabase(async (database) => {
      const { dm, player, session } = aTableWithAPlayer(database);

      const response = await transfer(session.id, player.id, dm);
      const log = logOf(database, session.id);

      expect(response.status).toBe(200);
      expect(log).toHaveLength(1);
      expect(log[0].type).toBe(SESSION_EVENT.DM_TRANSFERRED);

      const payload = JSON.parse(log[0].payload) as DmTransferEventPayload;

      expect(payload).toEqual({ accountId: player.id, previousAccountId: dm.id });
    }));

  it('should carry no name at all, so a rename cannot make the log wrong (v3 Req 44.3)', () =>
    withTestDatabase(async (database) => {
      // Both Accounts are registered ones with real names on their profiles, which is what makes
      // this assertion able to fail — an anonymous fixture would pass it by having nothing to leak
      const { dm, player, session } = aTableWithAPlayer(database);

      await transfer(session.id, player.id, dm);
      await remove(session.id, dm.id, player);

      const log = logOf(database, session.id);
      const payloads = log.map((row) => row.payload).join(' ');

      expect(log).toHaveLength(2);
      expect(payloads).not.toContain('Ada');
      expect(payloads).not.toContain('The DM');
    }));

  it('should write nothing when the act was refused', () =>
    withTestDatabase(async (database) => {
      const { player, session } = aTableWithAPlayer(database);
      const stranger = seedAccount();

      const refused = await remove(session.id, player.id, stranger);
      const log = logOf(database, session.id);

      expect(refused.status).toBe(404);
      expect(log).toEqual([]);
    }));

  it('should write the seat and its Event together, or neither (criterion 2)', () =>
    withTestDatabase(async (database) => {
      // **The transaction, proven by breaking the half that is not the seat.** A seating whose
      // Event failed is somebody at a table nobody was told about, and the roster of every other
      // Member would be wrong until they reloaded — so the seat must not survive alone.
      const { session } = aTableWithAPlayer(database);
      const newcomer = seedAccount();

      const seat = () =>
        seatSessionMember(
          {
            id: 'seat-that-should-not-land',
            session,
            accountId: newcomer.id,
            role: MEMBER_ROLE.PLAYER,
            now: Date.now(),
          },
          refusingAppend,
          database
        );

      expect(seat).toThrow('the log refused this Event');

      const seated = findSessionMember(session.id, newcomer.id, database);

      expect(seated).toBeNull();
    }));

  it('should keep a seat whose removal Event could not be written', () =>
    withTestDatabase(async (database) => {
      // The same property from the other side: a Member removed from the table with nothing in the
      // log would be a departure the fan-out could never announce
      const { player, session } = aTableWithAPlayer(database);

      const unseat = () => removeSessionMember(session.id, player.id, refusingAppend, database);

      expect(unseat).toThrow('the log refused this Event');

      const stillSeated = findSessionMember(session.id, player.id, database);

      expect(stillSeated).not.toBeNull();
    }));
});
