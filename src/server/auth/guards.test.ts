/**
 * The authorization guards (TICKET-AUTH-03)
 *
 * **Against real rows, never mocks.** v3 Req 32's content is *what the database says about who owns
 * what*, and a mocked membership would be asserting the test's own opinion of a join. `requireDM`
 * refusing a player in particular is only meaningful against a real `session_member` row carrying a
 * real role — DX-06's `seedMember` exists so that costs one line.
 *
 * The criterion that most needs a test rather than a review is the **indistinguishability** one:
 * a resource that exists but is not yours must be byte-identical to an id that never existed. That
 * is asserted on the serialised response rather than on the thrown error, because the response is
 * what an attacker sees.
 *
 * **Validates: v3 Req 32.1-32.5**
 */

import { describe, expect, it } from 'vitest';
import { MEMBER_ROLE } from '../db/schema';
import { ERROR_CODE } from '../http/appError';
import { defineHandler } from '../http/pipeline';
import {
  callRoute,
  seedAccount,
  seedCharacter,
  seedMember,
  seedRuleset,
  seedSession,
  withTestDatabase,
} from '../testing';
import type { RequestAccount } from './account';
import {
  type Asking,
  requireAccount,
  requireCharacterWriter,
  requireDM,
  requireMember,
  requireOwner,
} from './guards';

/** Who is asking, in the shape a guard reads */
function asking(account: RequestAccount | null): Asking {
  return { account };
}

/** What a guard threw, as the status and code a client would have seen */
function refusalOf(run: () => unknown): { status: number; code: string } {
  try {
    run();
  } catch (error) {
    const thrown = error as { status?: number; code?: string };
    return { status: thrown.status ?? 0, code: thrown.code ?? '' };
  }

  throw new Error('that call was expected to refuse, and did not');
}

describe('requireAccount', () => {
  it('hands back the Account that is asking', () => {
    const ada = seedAccount();

    expect(requireAccount(asking(ada))).toBe(ada);
  });

  it('refuses nobody with 401 rather than 404 (v3 Req 32.1)', () => {
    // Thrown *before any lookup*, so it says nothing about whether a resource exists — which is
    // what keeps it compatible with Req 32.5's blurring, and what lets the client offer sign-in
    expect(refusalOf(() => requireAccount(asking(null)))).toEqual({
      status: 401,
      code: ERROR_CODE.UNAUTHENTICATED,
    });
  });
});

describe('requireOwner', () => {
  it('hands back the resource when it is the asking Account’s', () =>
    withTestDatabase((database) => {
      const ada = seedAccount();
      const row = seedRuleset(database, { owner: ada });

      expect(requireOwner(asking(ada), row)).toBe(row);
    }));

  it('refuses another Account’s resource with 404 (v3 Req 32.2, 32.5)', () =>
    withTestDatabase((database) => {
      const row = seedRuleset(database, { owner: seedAccount() });

      expect(refusalOf(() => requireOwner(asking(seedAccount()), row))).toEqual({
        status: 404,
        code: ERROR_CODE.NOT_FOUND,
      });
    }));

  it('refuses a missing resource with the same 404', () => {
    expect(refusalOf(() => requireOwner(asking(seedAccount()), null))).toEqual({
      status: 404,
      code: ERROR_CODE.NOT_FOUND,
    });
  });

  it('refuses nobody with 401', () =>
    withTestDatabase((database) => {
      const row = seedRuleset(database);

      expect(refusalOf(() => requireOwner(asking(null), row)).status).toBe(401);
    }));
});

describe('requireMember', () => {
  it('hands back the membership of a Member (v3 Req 32.3)', () =>
    withTestDatabase((database) => {
      const player = seedAccount();
      const { session } = seedSession(database);
      const seat = seedMember(database, { session, account: player });

      expect(requireMember(asking(player), session.id)).toMatchObject({ id: seat.id });
    }));

  it('refuses a non-member with 404, against a real membership table', () =>
    withTestDatabase((database) => {
      const { session } = seedSession(database);

      expect(refusalOf(() => requireMember(asking(seedAccount()), session.id))).toEqual({
        status: 404,
        code: ERROR_CODE.NOT_FOUND,
      });
    }));

  it('refuses a session that does not exist with the same 404', () =>
    // Inside `withTestDatabase` even though nothing is seeded: the guard reaches a real connection,
    // and without one it would fail on a missing table rather than on the rule under test
    withTestDatabase(() => {
      expect(refusalOf(() => requireMember(asking(seedAccount()), 'no-such-session')).status).toBe(
        404
      );
    }));

  it('refuses nobody with 401', () =>
    withTestDatabase((database) => {
      const { session } = seedSession(database);

      expect(refusalOf(() => requireMember(asking(null), session.id)).status).toBe(401);
    }));
});

describe('requireDM', () => {
  it('hands back the DM’s membership', () =>
    withTestDatabase((database) => {
      const dm = seedAccount();
      const { session } = seedSession(database, { dm });

      expect(requireDM(asking(dm), session.id)).toMatchObject({ role: MEMBER_ROLE.DM });
    }));

  it('refuses a player Member with 404, not a 403 (v3 Req 32.3)', () =>
    withTestDatabase((database) => {
      const player = seedAccount();
      const { session } = seedSession(database);
      seedMember(database, { session, account: player, role: MEMBER_ROLE.PLAYER });

      // They already know the session exists — but *which* refusal they get should not depend on
      // how much they happen to know
      expect(refusalOf(() => requireDM(asking(player), session.id))).toEqual({
        status: 404,
        code: ERROR_CODE.NOT_FOUND,
      });
    }));

  it('refuses a non-member with the same 404 a player gets', () =>
    withTestDatabase((database) => {
      const { session } = seedSession(database);

      expect(refusalOf(() => requireDM(asking(seedAccount()), session.id)).status).toBe(404);
    }));

  it('refuses nobody with 401', () =>
    withTestDatabase((database) => {
      const { session } = seedSession(database);

      expect(refusalOf(() => requireDM(asking(null), session.id)).status).toBe(401);
    }));
});

describe('requireCharacterWriter', () => {
  it('lets the owning player write (v3 Req 32.4)', () =>
    withTestDatabase((database) => {
      const player = seedAccount();
      const { session } = seedSession(database);
      const row = seedCharacter(database, { session, owner: player });

      expect(requireCharacterWriter(asking(player), row.id)).toMatchObject({ id: row.id });
    }));

  it('lets the session’s DM write to somebody else’s character (v3 Req 32.4)', () =>
    withTestDatabase((database) => {
      const dm = seedAccount();
      const { session } = seedSession(database, { dm });
      const row = seedCharacter(database, { session, owner: seedAccount() });

      // The half that makes TICKET-DM-01 possible without every DM route restating who a DM is
      expect(requireCharacterWriter(asking(dm), row.id)).toMatchObject({ id: row.id });
    }));

  it('refuses another table’s DM', () =>
    withTestDatabase((database) => {
      const otherDm = seedAccount();
      seedSession(database, { dm: otherDm });
      const { session } = seedSession(database);
      const row = seedCharacter(database, { session, owner: seedAccount() });

      // Being *a* DM is not being *this table's* DM
      expect(refusalOf(() => requireCharacterWriter(asking(otherDm), row.id)).status).toBe(404);
    }));

  it('refuses a player at the same table who does not own it', () =>
    withTestDatabase((database) => {
      const other = seedAccount();
      const { session } = seedSession(database);
      seedMember(database, { session, account: other, role: MEMBER_ROLE.PLAYER });
      const row = seedCharacter(database, { session, owner: seedAccount() });

      expect(refusalOf(() => requireCharacterWriter(asking(other), row.id)).status).toBe(404);
    }));

  it('refuses a character that does not exist with the same 404', () =>
    withTestDatabase(() => {
      expect(
        refusalOf(() => requireCharacterWriter(asking(seedAccount()), 'no-such-character')).status
      ).toBe(404);
    }));

  it('refuses nobody with 401', () =>
    withTestDatabase((database) => {
      const { session } = seedSession(database);
      const row = seedCharacter(database, { session });

      expect(refusalOf(() => requireCharacterWriter(asking(null), row.id)).status).toBe(401);
    }));
});

describe('a guarded route, as a client sees it', () => {
  /** The shape every RUL-01-onwards route copies: fetch once, guard, answer */
  const route = defineHandler((context) => {
    const id = context.url.searchParams.get('id') ?? '';
    return { name: requireMember(context, id).role };
  });

  it('answers a read of somebody else’s resource exactly as it answers a missing id (v3 Req 32.5)', () =>
    withTestDatabase(async (database) => {
      const { session } = seedSession(database);
      const stranger = seedAccount();

      const somebodyElses = await callRoute(route, { as: stranger, params: { id: session.id } });
      const neverExisted = await callRoute(route, { as: stranger, params: { id: 'made-up' } });

      // Byte-identical, asserted on what actually crosses the wire rather than on the error object
      expect(somebodyElses.status).toBe(neverExisted.status);
      expect(JSON.stringify(somebodyElses.body)).toBe(JSON.stringify(neverExisted.body));
    }));

  it('tells the anonymous caller to sign in, and tells them nothing else', () =>
    withTestDatabase(async (database) => {
      const { session } = seedSession(database);

      const real = await callRoute(route, { as: null, params: { id: session.id } });
      const invented = await callRoute(route, { as: null, params: { id: 'made-up' } });

      expect(real.status).toBe(401);
      // Identical for a session that exists and one that does not — the 401 is thrown before the
      // lookup, so it cannot leak what the 404 is careful not to
      expect(JSON.stringify(real.body)).toBe(JSON.stringify(invented.body));
    }));

  it('issues one query for the resource rather than two', () =>
    withTestDatabase(async (database) => {
      const player = seedAccount();
      const { session } = seedSession(database);
      seedMember(database, { session, account: player });

      // **Counted on the real connection**, because the claim is about SQL rather than about how
      // many functions were called. The seeds have already run, so what is measured is only what
      // the request itself does — and `prepare` is where every Drizzle read passes through.
      const reads: string[] = [];
      const prepare = database.sqlite.prepare.bind(database.sqlite);
      database.sqlite.prepare = ((sql: string) => {
        if (sql.includes('session_member')) reads.push(sql);
        return prepare(sql);
      }) as typeof database.sqlite.prepare;

      try {
        expect((await callRoute(route, { as: player, params: { id: session.id } })).status).toBe(
          200
        );
      } finally {
        database.sqlite.prepare = prepare;
      }

      // Two would mean the guard checked and the handler fetched again, which is the shape the
      // guards return their row to prevent
      expect(reads).toHaveLength(1);
    }));
});
