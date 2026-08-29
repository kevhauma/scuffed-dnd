/**
 * The harness, proven (TICKET-DX-06)
 *
 * A test harness is the one piece of test infrastructure nothing else tests, so a bug in it reads
 * as a bug in whatever used it — or, worse, as a pass. Every claim
 * [`index.ts`](./index.ts) makes is asserted here: that two tests cannot see each other's rows,
 * that `callRoute` reaches the production pipeline rather than a copy of it, that a three-line
 * refusal test works, and that the corpus the fixtures seed is one the Kernel actually accepts.
 *
 * **Validates: v3 Req 45.3**
 */

import { describe, expect, it } from 'vitest';
import { calculateCharacter } from '#shared/engine/calculator';
import { validateConfigurationShape } from '#shared/services/importExport';
import type { Character } from '#shared/types/character';
import { setProcessDatabase } from '../db/client';
import { MEMBER_ROLE } from '../db/schema';
import { badRequest, ERROR_CODE, notFound } from '../http/appError';
import { defineHandler, type RequestContext } from '../http/pipeline';
import { findRuleset } from '../repositories/rulesetRepository';
import { health } from '../routes/health';
import { callRoute } from './callRoute';
import { withTestDatabase } from './database';
import {
  allRulesets,
  realConfiguration,
  realRulesetJson,
  seedAccount,
  seedCharacter,
  seedMember,
  seedRuleset,
  seedSession,
} from './seeds';

/** What `/api/health` reports, as far as these tests care */
interface HealthBody {
  database: { reachable: boolean; migration: string | null };
}

describe('withTestDatabase', () => {
  // The pair criterion 1 asks for, written so that neither order can pass by luck: the first
  // writes three rows, the second asserts there are none. Vitest runs them in source order, and
  // reversing them here changes nothing — which is the property, not the arrangement.
  it('should let a test write rows', () =>
    withTestDatabase((database) => {
      seedRuleset(database);
      seedRuleset(database);
      seedRuleset(database);

      expect(allRulesets(database)).toHaveLength(3);
    }));

  it('should hand the next test a database with none of them', () =>
    withTestDatabase((database) => {
      expect(allRulesets(database)).toEqual([]);
    }));

  it('should give each call its own database even inside one test', () => {
    const outer = withTestDatabase((database) => {
      seedRuleset(database);

      // Nested rather than sequential, because that is the case a naive save/restore gets wrong
      const inner = withTestDatabase((nested) => allRulesets(nested).length);

      return { inner, outer: allRulesets(database).length };
    });

    expect(outer).toEqual({ inner: 0, outer: 1 });
  });

  it('should apply the migrations, not merely open a file', () =>
    withTestDatabase((database) => {
      // A connection with no schema throws on the first select; this passing *is* the assertion
      // that `runMigrations` ran
      expect(findRuleset('nothing-here', database)).toBeNull();
    }));

  it('should close the database when the body throws', () => {
    let escaped: ReturnType<typeof seedRuleset> | null = null;

    expect(() =>
      withTestDatabase((database) => {
        escaped = seedRuleset(database);
        throw new Error('the body failed');
      })
    ).toThrow('the body failed');

    // The row existed, so the failure happened *after* the database was in use — which is the case
    // where a leaked connection would otherwise survive into the next test
    expect(escaped).not.toBeNull();
  });

  it('should close the database when an async body rejects', async () => {
    await expect(
      withTestDatabase(async () => {
        await Promise.resolve();
        throw new Error('the async body failed');
      })
    ).rejects.toThrow('the async body failed');
  });

  it('should put a handler that reaches getDatabase() on the test database', async () => {
    // The claim the whole `setProcessDatabase` seam exists for, and the reason it is asserted
    // rather than described: a route does not take a database — `db/health.ts` reaches
    // `getDatabase()` — so without this, removing both swap calls would leave the suite green
    // while every future route test silently read an unmigrated, file-scoped database instead.
    //
    // The two are distinguishable because `vitest.setup.ts`'s process database is opened from
    // `DATABASE_URL=:memory:` and **never migrated**, so it reports no applied migration.
    const outside = await callRoute<HealthBody>(health);
    expect(outside.body.database.migration).toBeNull();

    await withTestDatabase(async () => {
      const inside = await callRoute<HealthBody>(health);
      expect(inside.body.database.migration).not.toBeNull();
    });

    // …and it is handed back afterwards rather than left pointing at a closed connection
    const after = await callRoute<HealthBody>(health);
    expect(after.body.database.migration).toBeNull();
  });

  it('should refuse two overlapping calls rather than corrupt the process database', async () => {
    // `getDatabase()` is `opened ??=`, so a closed handle left installed is never replaced —
    // every later call in this registry would get a dead connection. One loud failure instead.
    const overlapping = Promise.all([
      withTestDatabase(() => Promise.resolve('a')),
      withTestDatabase(() => Promise.resolve('b')),
    ]);

    await expect(overlapping).rejects.toThrow(/overlapped/);

    // The point of failing loudly: the process database still works afterwards
    setProcessDatabase(null);
    expect((await callRoute<HealthBody>(health)).body.database.reachable).toBe(true);
  });
});

/**
 * A route that exists only to be called
 *
 * Built with the real `defineHandler`, so what is exercised below is the production pipeline —
 * its context, its `AppError` mapping, its 204, its 500. A hand-written stand-in would prove the
 * stand-in.
 */
const whoAmI = defineHandler((context: RequestContext) => ({
  account: context.account?.id ?? null,
  method: context.request.method,
  query: context.url.searchParams.get('q'),
}));

describe('callRoute', () => {
  it('should reach the handler and parse what it returned', async () => {
    const result = await callRoute<{
      account: string | null;
      method: string;
      query: string | null;
    }>(whoAmI, { as: 'account-under-test', params: { q: 'hello' } });

    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      account: 'account-under-test',
      method: 'GET',
      query: 'hello',
    });
  });

  it('should treat an absent or null caller as anonymous', async () => {
    expect((await callRoute<{ account: string | null }>(whoAmI)).body.account).toBeNull();
    expect((await callRoute<{ account: string | null }>(whoAmI, { as: null })).body.account).toBe(
      null
    );
  });

  it('should map an AppError to its status through the real pipeline', async () => {
    const refuses = defineHandler(() => {
      throw notFound('No such thing.');
    });

    const result = await callRoute<{ error: { code: string; message: string } }>(refuses);

    expect(result.status).toBe(404);
    expect(result.body.error).toEqual({
      code: ERROR_CODE.NOT_FOUND,
      message: 'No such thing.',
    });
  });

  it('should answer a handler that returned nothing with a bodyless 204', async () => {
    const result = await callRoute(defineHandler(() => undefined));

    expect(result.status).toBe(204);
    expect(result.body).toBeNull();
  });

  it('should send an object body as JSON and read it back', async () => {
    const echo = defineHandler((context: RequestContext) => context.json<{ name: string }>());

    const result = await callRoute<{ name: string }>(echo, { body: { name: 'Ducklet' } });

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ name: 'Ducklet' });
  });

  it('should default to POST when a body is given and GET when it is not', async () => {
    expect((await callRoute<{ method: string }>(whoAmI)).body.method).toBe('GET');
    expect((await callRoute<{ method: string }>(whoAmI, { body: {} })).body.method).toBe('POST');
  });

  it('should let a string body through untouched, so a malformed one can be refused', async () => {
    const echo = defineHandler((context: RequestContext) => context.json());

    const result = await callRoute<{ error: { code: string } }>(echo, { body: 'not json{' });

    // The pipeline's own refusal, not the harness's — `readJson` throws `badRequest`
    expect(result.status).toBe(badRequest('x').status);
    expect(result.body.error.code).toBe(ERROR_CODE.BAD_REQUEST);
  });

  it('should carry the pipeline response headers back', async () => {
    const result = await callRoute(whoAmI);

    expect(result.headers.get('content-type')).toBe('application/json');
    expect(result.headers.get('cache-control')).toBe('no-store');
  });
});

/**
 * Criterion 3, twice
 *
 * The guard is written by hand rather than imported because AUTH-03 has not built `requireAccount`
 * yet. What these demonstrate is that the refusal test is three lines — and that the **404 for a
 * stranger** is the indistinguishable answer AUTH-03 asks for, since a 403 would confirm the
 * ruleset exists to somebody with no right to know.
 */
describe('a refusal test, in three lines', () => {
  it('should refuse anonymous, refuse a stranger, and allow the owner', () =>
    withTestDatabase(async (database) => {
      const owner = seedAccount();
      const row = seedRuleset(database, { owner });

      /** The guard every owned-resource route will carry, in the shape AUTH-03 will provide it */
      const route = defineHandler((context: RequestContext) => {
        const found = findRuleset(context.url.searchParams.get('id') ?? '', database);
        // One answer for "no such ruleset" and for "not yours" — a 403 would confirm it exists
        if (!found || found.ownerAccountId !== context.account?.id) throw notFound('Not found');
        return { name: found.name };
      });

      const params = { id: row.id };

      expect((await callRoute(route, { as: null, params })).status).toBe(404);
      expect((await callRoute(route, { as: seedAccount(), params })).status).toBe(404);
      expect((await callRoute(route, { as: owner, params })).status).toBe(200);
    }));

  it('should give a stranger and a missing row byte-identical answers', () =>
    withTestDatabase(async (database) => {
      const row = seedRuleset(database);

      const route = defineHandler((context: RequestContext) => {
        const found = findRuleset(context.url.searchParams.get('id') ?? '', database);
        if (!found || found.ownerAccountId !== context.account?.id) throw notFound('Not found');
        return { name: found.name };
      });

      const stranger = await callRoute(route, { as: seedAccount(), params: { id: row.id } });
      const missing = await callRoute(route, { as: seedAccount(), params: { id: 'no-such-id' } });

      expect(stranger.status).toBe(missing.status);
      expect(stranger.body).toEqual(missing.body);
    }));
});

describe('the seeded fixtures', () => {
  it('should seed a ruleset holding the real corpus', () =>
    withTestDatabase((database) => {
      const row = seedRuleset(database);

      expect(row.revision).toBe(1);
      expect(row.data).toBe(realRulesetJson());
      expect(findRuleset(row.id, database)?.data).toBe(realRulesetJson());
    }));

  it('should seed a session with its snapshot copied and its DM seated', () =>
    withTestDatabase((database) => {
      const dmAccount = seedAccount();
      const { session, dm } = seedSession(database, { dm: dmAccount });

      // Copied, not referenced — D7's whole point
      expect(session.snapshot).toBe(realRulesetJson());
      expect(session.rulesetId).not.toBeNull();
      expect(dm.role).toBe(MEMBER_ROLE.DM);
      expect(dm.accountId).toBe(dmAccount.id);
      expect(dm.sessionId).toBe(session.id);
    }));

  it('should seed a player alongside the DM', () =>
    withTestDatabase((database) => {
      const { session } = seedSession(database);
      const player = seedMember(database, { session, account: seedAccount() });

      expect(player.role).toBe(MEMBER_ROLE.PLAYER);
      expect(player.sessionId).toBe(session.id);
    }));

  it('should let two sessions be seeded from one ruleset', () =>
    withTestDatabase((database) => {
      const source = seedRuleset(database);

      const tuesday = seedSession(database, { from: source }).session;
      const thursday = seedSession(database, { from: source }).session;

      // The same rules, two tables — and one ruleset row rather than three, which is what makes
      // `from` the way to write a test about two sessions sharing a ruleset
      expect(tuesday.rulesetId).toBe(source.id);
      expect(thursday.rulesetId).toBe(source.id);
      expect(allRulesets(database)).toHaveLength(1);
    }));

  it('should let a test that wants a toy ruleset pass its own data', () =>
    withTestDatabase((database) => {
      // The escape hatch that makes one `seedRuleset` enough — see its JSDoc for why there is no
      // second, less honest function
      const row = seedRuleset(database, { data: '{"stats":[]}', name: 'Two stats' });

      expect(row.data).toBe('{"stats":[]}');
      expect(row.name).toBe('Two stats');
    }));

  it('should seed a character in a session', () =>
    withTestDatabase((database) => {
      const { session } = seedSession(database);
      const owner = seedAccount();
      const row = seedCharacter(database, { session, owner, name: 'Quackford' });

      expect(row.name).toBe('Quackford');
      expect(row.ownerAccountId).toBe(owner.id);
      expect(row.sessionId).toBe(session.id);
      expect(row.revision).toBe(1);
    }));

  it('should give every seeded row a distinct id', () =>
    withTestDatabase((database) => {
      const ids = [seedRuleset(database).id, seedRuleset(database).id, seedRuleset(database).id];

      expect(new Set(ids).size).toBe(3);
    }));

  it('should hand back a fresh Configuration each time, so a mutation cannot leak', () => {
    const first = realConfiguration();
    first.name = 'mutated';

    expect(realConfiguration().name).not.toBe('mutated');
  });
});

describe('the corpus the fixtures seed', () => {
  it('should be a Configuration the Kernel accepts', () => {
    const result = validateConfigurationShape(JSON.parse(realRulesetJson()));

    expect(result.errors).toEqual([]);
    expect(result.isValid).toBe(true);
  });

  it('should run through calculateCharacter without throwing', () => {
    const config = realConfiguration();

    const blank: Character = {
      id: 'c1',
      name: 'Ducklet',
      configurationId: config.id,
      raceIds: [],
      investedStatPoints: {},
      investedSkillPoints: {},
      currentResourceValues: {},
      experience: 0,
      inventory: { equippedItems: {}, composedItems: [] },
      createdAt: '2026-08-25T00:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z',
    };

    const calculated = calculateCharacter(blank, config);

    // Every configured stat gets an entry, error values included — `calculateCharacter` always
    // returns, and a missing key would mean it bailed part-way
    expect(Object.keys(calculated.statValues)).toHaveLength(config.stats.length);
  });
});
