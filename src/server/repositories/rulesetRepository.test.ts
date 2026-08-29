/**
 * Ruleset repository tests (TICKET-DB-01, TICKET-DX-06)
 *
 * The document round-trip is the criterion that decides whether D4 works at all: a **real**
 * `Configuration` — the whole Ducklets corpus, formulas, curve override flags and all — has to come
 * back byte-identical from a `TEXT` column. Anything less and "store it as a document" quietly
 * means "store most of it".
 *
 * The revision guard is the other half: the check and the increment are one statement, so the loser
 * of a race updates zero rows rather than overwriting a save it never saw.
 *
 * TICKET-DX-06 replaced this file's own `migratedDatabase()` and its `afterEach` bookkeeping with
 * `withTestDatabase`, and its hand-read corpus with the harness's. Nothing it asserts changed.
 *
 * **Validates: v3 Req 46.3, 33.6**
 */

import { describe, expect, it } from 'vitest';
import { serializeConfiguration } from '#shared/services/importExport';
import type { Configuration } from '#shared/types/config';
import type { Database } from '../db/client';
import { corpusSchemaVersion, realRulesetJson, withTestDatabase } from '../testing';
import {
  findRuleset,
  insertRuleset,
  listRulesetsByOwner,
  removeRuleset,
  updateRulesetData,
  updateRulesetName,
  WRITE_OUTCOME,
} from './rulesetRepository';

/** The real ruleset the sheet produced — 306 KB of it */
const ducklets = realRulesetJson();

function storeDucklets(database: Database, id = 'r1', owner = 'a1') {
  return insertRuleset(
    {
      id,
      ownerAccountId: owner,
      name: 'Ducklets',
      // Read from the corpus rather than restated (TICKET-INV-05): the column and the `data`
      // document have to agree, and a literal here silently stopped agreeing at the 9 → 10 bump
      schemaVersion: corpusSchemaVersion(),
      data: ducklets,
      now: 1_700_000_000_000,
    },
    database
  );
}

describe('rulesetRepository', () => {
  describe('the document column', () => {
    it('round-trips the real corpus byte-for-byte', () =>
      withTestDatabase((database) => {
        storeDucklets(database);

        expect(findRuleset('r1', database)?.data).toBe(ducklets);
      }));

    it('brings back a Configuration that still parses, formulas and all', () =>
      withTestDatabase((database) => {
        storeDucklets(database);

        const stored = JSON.parse(findRuleset('r1', database)?.data ?? '') as Configuration;
        const original = JSON.parse(ducklets) as Configuration;

        expect(stored).toEqual(original);
        // The two things a lossy column would quietly flatten first
        expect(stored.stats.some((stat) => typeof stat.formula === 'string')).toBe(true);
        expect(stored.curves?.length).toBeGreaterThan(0);
      }));

    it('round-trips what the Kernel serialises, which is what an export writes', () =>
      withTestDatabase((database) => {
        const configuration = JSON.parse(ducklets) as Configuration;
        const serialised = serializeConfiguration(configuration);

        insertRuleset({
          id: 'r2',
          ownerAccountId: 'a1',
          name: 'Ducklets',
          schemaVersion: configuration.schemaVersion,
          data: serialised,
          now: 1,
        });

        // The server stores exactly what `serializeConfiguration` produced — one serialisation, not
        // a second one this layer invented (D5)
        expect(findRuleset('r2', database)?.data).toBe(serialised);
      }));
  });

  describe('insertRuleset', () => {
    it('starts at revision 1', () =>
      withTestDatabase((database) => {
        expect(storeDucklets(database).revision).toBe(1);
      }));

    it('keeps the schema version as a real column, because the server gates on it', () =>
      withTestDatabase((database) => {
        // The column and the document it describes, asserted against each other rather than against
        // a literal — the point of the column is that it answers for the `data` beside it
        expect(storeDucklets(database).schemaVersion).toBe(corpusSchemaVersion());
      }));
  });

  describe('findRuleset', () => {
    it('returns null for an id that does not exist rather than throwing', () =>
      withTestDatabase((database) => {
        expect(findRuleset('nope', database)).toBeNull();
      }));
  });

  describe('updateRulesetData — the revision guard', () => {
    it('writes and bumps the revision when the base revision matches', () =>
      withTestDatabase((database) => {
        storeDucklets(database);

        const result = updateRulesetData('r1', 1, '{"changed":true}', 2, database);

        expect(result.outcome).toBe(WRITE_OUTCOME.WRITTEN);
        if (result.outcome !== WRITE_OUTCOME.WRITTEN) return;
        expect(result.row.revision).toBe(2);
        expect(result.row.data).toBe('{"changed":true}');
      }));

    it('refuses a stale base revision and changes nothing', () =>
      withTestDatabase((database) => {
        storeDucklets(database);
        updateRulesetData('r1', 1, '{"first":true}', 2, database);

        // Someone else saved in between; this caller read revision 1 and is now wrong
        const loser = updateRulesetData('r1', 1, '{"second":true}', 3, database);

        expect(loser.outcome).toBe(WRITE_OUTCOME.STALE);
        expect(findRuleset('r1', database)?.data).toBe('{"first":true}');
        expect(findRuleset('r1', database)?.revision).toBe(2);
      }));

    it('hands a stale caller the current row, so the conflict is resolvable', () =>
      withTestDatabase((database) => {
        storeDucklets(database);
        updateRulesetData('r1', 1, '{"first":true}', 2, database);

        const loser = updateRulesetData('r1', 1, '{"second":true}', 3, database);

        // v3 Req 33.8: a refused write is a conflict the User can resolve, never a silent loss
        expect(loser.outcome === WRITE_OUTCOME.STALE && loser.current.revision).toBe(2);
      }));

    it('tells an unknown id apart from a stale revision', () =>
      withTestDatabase((database) => {
        // Collapsing the two into one answer would make RUL-02 read again to decide 404 or 409
        expect(updateRulesetData('nope', 1, '{}', 1, database).outcome).toBe(WRITE_OUTCOME.MISSING);
      }));

    it('lets a caller that re-read the row succeed', () =>
      withTestDatabase((database) => {
        storeDucklets(database);
        updateRulesetData('r1', 1, '{"first":true}', 2, database);

        const retried = updateRulesetData('r1', 2, '{"second":true}', 3, database);

        expect(retried.outcome === WRITE_OUTCOME.WRITTEN && retried.row.revision).toBe(3);
      }));
  });

  describe('the lifecycle a route drives (TICKET-RUL-01)', () => {
    it('lists an owner’s rulesets without their documents, on the real corpus', () =>
      withTestDatabase((database) => {
        // The rule the list endpoint rests on, asserted where it is actually enforced: the query
        // does not select `data`, so a route cannot leak 306 KB per row by forgetting to strip it
        storeDucklets(database, 'r1', 'a1');

        const [listed] = listRulesetsByOwner('a1', database);

        expect(listed.name).toBe('Ducklets');
        expect('data' in listed).toBe(false);
      }));

    it('lists nobody else’s', () =>
      withTestDatabase((database) => {
        storeDucklets(database, 'r1', 'a1');

        expect(listRulesetsByOwner('a2', database)).toEqual([]);
      }));

    it('orders by the most recent edit', () =>
      withTestDatabase((database) => {
        storeDucklets(database, 'older', 'a1');
        storeDucklets(database, 'newer', 'a1');
        updateRulesetName('newer', 1, 'Renamed', '{}', 1_700_000_100_000, database);

        expect(listRulesetsByOwner('a1', database).map((row) => row.id)).toEqual([
          'newer',
          'older',
        ]);
      }));

    it('renames the column and stores the document it was handed', () =>
      withTestDatabase((database) => {
        storeDucklets(database);

        const result = updateRulesetName('r1', 1, 'Redux', '{"name":"Redux"}', 2, database);

        expect(result.outcome).toBe(WRITE_OUTCOME.WRITTEN);
        expect(findRuleset('r1', database)?.name).toBe('Redux');
        expect(findRuleset('r1', database)?.data).toBe('{"name":"Redux"}');
        // A rename writes `data`, so it is a write and bumps the revision like any other (Req 33.6)
        expect(findRuleset('r1', database)?.revision).toBe(2);
      }));

    it('refuses a rename whose base revision is behind', () =>
      withTestDatabase((database) => {
        storeDucklets(database);
        updateRulesetData('r1', 1, '{"someone":"else"}', 2, database);

        // Not a silent overwrite: the rename would have discarded the save it never saw (Req 33.8)
        expect(updateRulesetName('r1', 1, 'Redux', '{}', 3, database).outcome).toBe(
          WRITE_OUTCOME.STALE
        );
      }));

    it('removes a ruleset, and says so when there was none to remove', () =>
      withTestDatabase((database) => {
        storeDucklets(database);

        expect(removeRuleset('r1', database)).toBe(true);
        expect(findRuleset('r1', database)).toBeNull();
        expect(removeRuleset('r1', database)).toBe(false);
      }));
  });
});
