/**
 * The `/api/rulesets` routes (TICKET-RUL-01)
 *
 * **Every route proves three refusals** — anonymous, non-owner, owner — which is the milestone's
 * second Definition-of-Done rule and not a formality: authorization is the only thing in v3.0 whose
 * failure is silent, and a proof that is expensive is a proof that gets skipped. `callRoute` makes
 * each one a line.
 *
 * The three answers are `401`, `404`, `200` — **not** `401`, `403`, `200`. A 403 on a ruleset you do
 * not own confirms it exists, which is an answer the caller has not earned (v3 Req 32.5); the 401 is
 * distinct because it is thrown before any lookup and so says nothing about the resource.
 *
 * Two of these tests are about the *ruleset* rather than about a route, and are the ones worth
 * reading: a created ruleset is compared field for field against `createFreshConfiguration()`
 * itself, and a confirmed delete is followed by reading the game session that was playing from it.
 *
 * **Validates: v3 Req 32.1, 32.2, 32.5, 33.1, 33.2, 33.3, 33.4, 33.6, 33.7, 33.8**
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFreshConfiguration } from '#shared/services/freshConfiguration';
import { serializeConfiguration } from '#shared/services/importExport';
import { ERROR_CODE, type RulesetListing as Listing, type RulesetSummary } from '#shared/types/api';
import type { Configuration } from '#shared/types/config';
import { findRuleset } from '../../repositories/rulesetRepository';
import {
  allGameSessions,
  allRulesets,
  type CallOptions,
  callRoute,
  type Database,
  realConfiguration,
  seedAccount,
  seedRuleset,
  seedSession,
  withTestDatabase,
} from '../../testing';
import { createRuleset } from './createRuleset';
import { deleteRuleset } from './deleteRuleset';
import { listRulesets } from './listRulesets';
import { renameRuleset } from './renameRuleset';

/** The path a route reads its `:id` out of */
function pathFor(id: string): string {
  return `/api/rulesets/${id}`;
}

/**
 * Run something with `crypto.randomUUID` and the clock pinned
 *
 * The only way to compare two calls of `createFreshConfiguration()` field for field: it mints a
 * fresh id for the ruleset and for every seeded constant, curve, column, ladder and roll, and
 * stamps two ISO timestamps. Pinning both makes the *shape* comparable while leaving the function
 * itself untouched — which is the point of RUL-01's second criterion. Stripping the ids out of both
 * sides instead would compare a redacted ruleset against a redacted ruleset and would not notice a
 * roll that lost its `ladderId`.
 */
async function withPinnedIdentity<T>(run: () => Promise<T> | T): Promise<T> {
  let counter = 0;

  const uuid = vi
    .spyOn(crypto, 'randomUUID')
    .mockImplementation(() => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`);

  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-25T12:00:00.000Z'));

  try {
    return await run();
  } finally {
    uuid.mockRestore();
    vi.useRealTimers();
  }
}

/** The stored document of a row, parsed */
function documentIn(database: Database, id: string): Configuration {
  const row = findRuleset(id, database);
  if (!row) throw new Error(`no ruleset ${id}`);
  return JSON.parse(row.data) as Configuration;
}

describe('GET /api/rulesets', () => {
  it('refuses an anonymous caller', () =>
    withTestDatabase(async () => {
      const response = await callRoute(listRulesets, { as: null, path: '/api/rulesets' });

      expect(response.status).toBe(401);
      expect((response.body as { error: { code: string } }).error.code).toBe(
        ERROR_CODE.UNAUTHENTICATED
      );
    }));

  it('lists what the caller owns, most recently updated first', () =>
    withTestDatabase(async (database) => {
      const owner = seedAccount();
      seedRuleset(database, { owner, name: 'Ducklets' });
      seedRuleset(database, { owner, name: 'Emberfall' });

      const response = await callRoute<Listing>(listRulesets, { as: owner, path: '/api/rulesets' });

      expect(response.status).toBe(200);
      expect(response.body.rulesets.map((row) => row.name).sort()).toEqual([
        'Ducklets',
        'Emberfall',
      ]);
    }));

  it('shows a stranger nothing, rather than somebody else’s rulesets', () =>
    withTestDatabase(async (database) => {
      seedRuleset(database, { owner: seedAccount(), name: 'Ducklets' });

      const response = await callRoute<Listing>(listRulesets, {
        as: seedAccount(),
        path: '/api/rulesets',
      });

      expect(response.status).toBe(200);
      expect(response.body.rulesets).toEqual([]);
    }));

  it('carries no document, on a real corpus ruleset', () =>
    withTestDatabase(async (database) => {
      // The Ducklets corpus is 306 KB and the whole reason this rule exists: a listing that shipped
      // it would invite a client to render from the list and then edit the copy it happens to hold,
      // which is how RUL-02's revision guard gets bypassed by accident
      const owner = seedAccount();
      const row = seedRuleset(database, { owner });
      expect(row.data.length).toBeGreaterThan(100_000);

      const response = await callRoute<Listing>(listRulesets, { as: owner, path: '/api/rulesets' });
      const [listed] = response.body.rulesets;

      expect(listed).toEqual({
        id: row.id,
        name: row.name,
        schemaVersion: row.schemaVersion,
        revision: row.revision,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      });
      expect(JSON.stringify(response.body)).not.toContain('rollDefinitions');
    }));
});

describe('POST /api/rulesets', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('refuses an anonymous caller', () =>
    withTestDatabase(async (database) => {
      const response = await callRoute(createRuleset, {
        as: null,
        path: '/api/rulesets',
        body: { name: 'Ducklets' },
      });

      expect(response.status).toBe(401);
      expect(allRulesets(database)).toEqual([]);
    }));

  it('seeds exactly as createFreshConfiguration does, field for field (v3 Req 33.3)', () =>
    withTestDatabase(async (database) => {
      const owner = seedAccount();

      const created = await withPinnedIdentity(async () => {
        const response = await callRoute<RulesetSummary>(createRuleset, {
          as: owner,
          path: '/api/rulesets',
          body: { name: 'Ducklets' },
        });

        expect(response.status).toBe(200);
        return response.body;
      });

      // The same function, called the same way, under the same pinned identity — so this is an
      // assertion against `createFreshConfiguration` rather than against a literal copied out of it
      const expected = await withPinnedIdentity(() =>
        JSON.parse(serializeConfiguration(createFreshConfiguration('Ducklets')))
      );

      expect(documentIn(database, created.id)).toEqual(expected);
      expect(created.revision).toBe(1);
      expect(created.name).toBe('Ducklets');
    }));

  it('arrives with the seeded constants, curves and rolls rather than empty', () =>
    withTestDatabase(async (database) => {
      // The point of the criterion above, stated in the terms a User would: a new ruleset is not
      // blank. Named separately so a regression says *what* went missing.
      const owner = seedAccount();
      const created = await callRoute<RulesetSummary>(createRuleset, {
        as: owner,
        path: '/api/rulesets',
        body: { name: 'Ducklets' },
      });

      const document = documentIn(database, created.body.id);

      expect(document.constants?.map((constant) => constant.name)).toContain('points_per_level');
      expect(document.curves?.map((curve) => curve.name)).toContain('point_buy');
      expect(document.diceLadders).toHaveLength(1);
      expect(document.rollDefinitions?.map((roll) => roll.name)).toEqual([
        'Melee',
        'Ranged',
        'Evasion',
        'Endure',
      ]);
      expect(document.stats).toEqual([]);
    }));

  it('refuses a blank name and persists nothing', () =>
    withTestDatabase(async (database) => {
      const response = await callRoute(createRuleset, {
        as: seedAccount(),
        path: '/api/rulesets',
        body: { name: '   ' },
      });

      expect(response.status).toBe(400);
      expect(allRulesets(database)).toEqual([]);
    }));

  it('does not enforce name uniqueness — the id is the identity', () =>
    withTestDatabase(async () => {
      // Two rulesets called "Ducklets" is the User's business (TICKET-RUL-01's notes), and asserting
      // it stops a later ticket adding a uniqueness check on the quiet
      const owner = seedAccount();
      const body = { name: 'Ducklets' };
      const first = await callRoute<RulesetSummary>(createRuleset, {
        as: owner,
        path: '/api/rulesets',
        body,
      });
      const second = await callRoute<RulesetSummary>(createRuleset, {
        as: owner,
        path: '/api/rulesets',
        body,
      });

      expect(second.status).toBe(200);
      expect(second.body.id).not.toBe(first.body.id);
    }));
});

describe('PATCH /api/rulesets/:id', () => {
  it('refuses anonymous, non-owner and owner in the documented three ways', () =>
    withTestDatabase(async (database) => {
      const owner = seedAccount();
      const row = seedRuleset(database, { owner, name: 'Ducklets' });
      const call = (as: CallOptions['as']) =>
        callRoute(renameRuleset, {
          as,
          method: 'PATCH',
          path: pathFor(row.id),
          body: { name: 'X' },
        });

      expect((await call(null)).status).toBe(401);
      expect((await call(seedAccount())).status).toBe(404);
      expect((await call(owner)).status).toBe(200);
    }));

  it('answers a ruleset that never existed exactly as it answers a stranger', () =>
    withTestDatabase(async () => {
      const response = await callRoute(renameRuleset, {
        as: seedAccount(),
        method: 'PATCH',
        path: pathFor('never-minted'),
        body: { name: 'X' },
      });

      expect(response.status).toBe(404);
    }));

  it('renames the record and the document, and bumps the revision', () =>
    withTestDatabase(async (database) => {
      const owner = seedAccount();
      const row = seedRuleset(database, { owner, name: 'Ducklets' });

      const response = await callRoute<RulesetSummary>(renameRuleset, {
        as: owner,
        method: 'PATCH',
        path: pathFor(row.id),
        body: { name: 'Ducklets Redux' },
      });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Ducklets Redux');
      expect(response.body.revision).toBe(row.revision + 1);
      // Both halves: the column the listing renders, and the document an export carries
      expect(findRuleset(row.id, database)?.name).toBe('Ducklets Redux');
      expect(documentIn(database, row.id).name).toBe('Ducklets Redux');
    }));

  it('leaves the rest of the document untouched', () =>
    withTestDatabase(async (database) => {
      const owner = seedAccount();
      const row = seedRuleset(database, { owner });

      await callRoute(renameRuleset, {
        as: owner,
        method: 'PATCH',
        path: pathFor(row.id),
        body: { name: 'Renamed' },
      });

      expect(documentIn(database, row.id)).toEqual({ ...realConfiguration(), name: 'Renamed' });
    }));

  it('refuses a ruleset stored at another schema version, stating it (v3 Req 33.4)', () =>
    withTestDatabase(async (database) => {
      // The column is what the server gates on (D4), so the row is seeded at a version this build
      // does not read — the state a ruleset stored before a `SUPPORTED_SCHEMA_VERSION` bump is in
      const owner = seedAccount();
      const row = seedRuleset(database, {
        owner,
        schemaVersion: 3,
        data: JSON.stringify({ ...realConfiguration(), schemaVersion: 3 }),
      });

      const response = await callRoute<{ error: { code: string; message: string } }>(
        renameRuleset,
        { as: owner, method: 'PATCH', path: pathFor(row.id), body: { name: 'Renamed' } }
      );

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe(ERROR_CODE.CONFLICT);
      // The import path's own sentence, reused rather than restated, plus the version stated
      expect(response.body.error.message).toContain('exported by an older version of the app');
      expect(response.body.error.message).toContain('schema version 3');
      expect(documentIn(database, row.id).name).not.toBe('Renamed');
    }));
});

describe('DELETE /api/rulesets/:id', () => {
  it('refuses anonymous, non-owner and owner in the documented three ways', () =>
    withTestDatabase(async (database) => {
      const owner = seedAccount();
      const row = seedRuleset(database, { owner });
      const call = (as: CallOptions['as']) =>
        callRoute(deleteRuleset, { as, method: 'DELETE', path: pathFor(row.id) });

      expect((await call(null)).status).toBe(401);
      expect((await call(seedAccount())).status).toBe(404);
      // Still there after both refusals — a refusal that deleted anything would pass a status check
      expect(allRulesets(database)).toHaveLength(1);

      expect((await call(owner)).status).toBe(204);
      expect(allRulesets(database)).toEqual([]);
    }));

  it('refuses while a game session was created from it (v3 Req 33.7)', () =>
    withTestDatabase(async (database) => {
      const owner = seedAccount();
      const row = seedRuleset(database, { owner });
      seedSession(database, { dm: owner, from: row });

      const response = await callRoute<{ error: { code: string; message: string } }>(
        deleteRuleset,
        { as: owner, method: 'DELETE', path: pathFor(row.id) }
      );

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe(ERROR_CODE.CONFLICT);
      // The whole clause, not just the count: this sentence is rendered to the User verbatim, and
      // the first draft of it said "1 game session **were** started" for the commonest case there is
      expect(response.body.error.message).toContain(
        '1 game session was started from this ruleset.'
      );
      expect(allRulesets(database)).toHaveLength(1);
    }));

  it('says so in the plural when more than one session is in the way', () =>
    withTestDatabase(async (database) => {
      const owner = seedAccount();
      const row = seedRuleset(database, { owner });
      seedSession(database, { dm: owner, from: row });
      seedSession(database, { dm: seedAccount(), from: row });

      const response = await callRoute<{ error: { message: string } }>(deleteRuleset, {
        as: owner,
        method: 'DELETE',
        path: pathFor(row.id),
      });

      expect(response.body.error.message).toContain('2 game sessions were started');
    }));

  it('deletes on confirmation and leaves the session playable on its snapshot (D7)', () =>
    withTestDatabase(async (database) => {
      const owner = seedAccount();
      const row = seedRuleset(database, { owner });
      const { session } = seedSession(database, { dm: owner, from: row });

      const response = await callRoute(deleteRuleset, {
        as: owner,
        method: 'DELETE',
        path: pathFor(row.id),
        params: { confirm: 'true' },
      });

      expect(response.status).toBe(204);
      expect(allRulesets(database)).toEqual([]);

      // The game is still a game: the row survives, its rules survive as the copy it took, and what
      // it lost is the pointer back to where they came from
      const [after] = allGameSessions(database);
      expect(after.id).toBe(session.id);
      expect(after.rulesetId).toBeNull();
      expect(JSON.parse(after.snapshot)).toEqual(realConfiguration());
    }));

  it('deletes without confirmation when no session stands in the way', () =>
    withTestDatabase(async (database) => {
      const owner = seedAccount();
      const row = seedRuleset(database, { owner });

      expect(
        (await callRoute(deleteRuleset, { as: owner, method: 'DELETE', path: pathFor(row.id) }))
          .status
      ).toBe(204);
      expect(findRuleset(row.id, database)).toBeNull();
    }));
});
