/**
 * Ruleset repository tests (TICKET-DB-01)
 *
 * The document round-trip is the criterion that decides whether D4 works at all: a **real**
 * `Configuration` — the whole Ducklets corpus, formulas, curve override flags and all — has to come
 * back byte-identical from a `TEXT` column. Anything less and "store it as a document" quietly
 * means "store most of it".
 *
 * The revision guard is the other half: the check and the increment are one statement, so the loser
 * of a race updates zero rows rather than overwriting a save it never saw.
 *
 * **Validates: v3 Req 46.3, 33.6**
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { serializeConfiguration } from '#shared/services/importExport';
import type { Configuration } from '#shared/types/config';
import { createDatabase, type Database } from '../db/client';
import { runMigrations } from '../db/migrate';
import { findRuleset, insertRuleset, updateRulesetData, WRITE_OUTCOME } from './rulesetRepository';

const CORPUS = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'docs',
  'imports',
  'ducklets.json'
);

/** The real ruleset the sheet produced — 306 KB of it */
const ducklets = readFileSync(CORPUS, 'utf8');

const open: Database[] = [];

/** A migrated in-memory database. TICKET-DX-06 replaces this with the shared harness. */
function migratedDatabase(): Database {
  const database = createDatabase(':memory:');
  open.push(database);
  runMigrations(database);
  return database;
}

function storeDucklets(database: Database, id = 'r1', owner = 'a1') {
  return insertRuleset(database, {
    id,
    ownerAccountId: owner,
    name: 'Ducklets',
    schemaVersion: 9,
    data: ducklets,
    now: 1_700_000_000_000,
  });
}

afterEach(() => {
  for (const database of open.splice(0)) database.close();
});

describe('rulesetRepository', () => {
  describe('the document column', () => {
    it('round-trips the real corpus byte-for-byte', () => {
      const database = migratedDatabase();
      storeDucklets(database);

      expect(findRuleset(database, 'r1')?.data).toBe(ducklets);
    });

    it('brings back a Configuration that still parses, formulas and all', () => {
      const database = migratedDatabase();
      storeDucklets(database);

      const stored = JSON.parse(findRuleset(database, 'r1')?.data ?? '') as Configuration;
      const original = JSON.parse(ducklets) as Configuration;

      expect(stored).toEqual(original);
      // The two things a lossy column would quietly flatten first
      expect(stored.stats.some((stat) => typeof stat.formula === 'string')).toBe(true);
      expect(stored.curves?.length).toBeGreaterThan(0);
    });

    it('round-trips what the Kernel serialises, which is what an export writes', () => {
      const database = migratedDatabase();
      const configuration = JSON.parse(ducklets) as Configuration;
      const serialised = serializeConfiguration(configuration);

      insertRuleset(database, {
        id: 'r2',
        ownerAccountId: 'a1',
        name: 'Ducklets',
        schemaVersion: configuration.schemaVersion,
        data: serialised,
        now: 1,
      });

      // The server stores exactly what `serializeConfiguration` produced — one serialisation, not
      // a second one this layer invented (D5)
      expect(findRuleset(database, 'r2')?.data).toBe(serialised);
    });
  });

  describe('insertRuleset', () => {
    it('starts at revision 1', () => {
      const database = migratedDatabase();

      expect(storeDucklets(database).revision).toBe(1);
    });

    it('keeps the schema version as a real column, because the server gates on it', () => {
      const database = migratedDatabase();

      expect(storeDucklets(database).schemaVersion).toBe(9);
    });
  });

  describe('findRuleset', () => {
    it('returns null for an id that does not exist rather than throwing', () => {
      expect(findRuleset(migratedDatabase(), 'nope')).toBeNull();
    });
  });

  describe('updateRulesetData — the revision guard', () => {
    it('writes and bumps the revision when the base revision matches', () => {
      const database = migratedDatabase();
      storeDucklets(database);

      const result = updateRulesetData(database, 'r1', 1, '{"changed":true}', 2);

      expect(result.outcome).toBe(WRITE_OUTCOME.WRITTEN);
      if (result.outcome !== WRITE_OUTCOME.WRITTEN) return;
      expect(result.row.revision).toBe(2);
      expect(result.row.data).toBe('{"changed":true}');
    });

    it('refuses a stale base revision and changes nothing', () => {
      const database = migratedDatabase();
      storeDucklets(database);
      updateRulesetData(database, 'r1', 1, '{"first":true}', 2);

      // Someone else saved in between; this caller read revision 1 and is now wrong
      const loser = updateRulesetData(database, 'r1', 1, '{"second":true}', 3);

      expect(loser.outcome).toBe(WRITE_OUTCOME.STALE);
      expect(findRuleset(database, 'r1')?.data).toBe('{"first":true}');
      expect(findRuleset(database, 'r1')?.revision).toBe(2);
    });

    it('hands a stale caller the current row, so the conflict is resolvable', () => {
      const database = migratedDatabase();
      storeDucklets(database);
      updateRulesetData(database, 'r1', 1, '{"first":true}', 2);

      const loser = updateRulesetData(database, 'r1', 1, '{"second":true}', 3);

      // v3 Req 33.8: a refused write is a conflict the User can resolve, never a silent loss
      expect(loser.outcome === WRITE_OUTCOME.STALE && loser.current.revision).toBe(2);
    });

    it('tells an unknown id apart from a stale revision', () => {
      // Collapsing the two into one answer would make RUL-02 read again to decide 404 or 409
      expect(updateRulesetData(migratedDatabase(), 'nope', 1, '{}', 1).outcome).toBe(
        WRITE_OUTCOME.MISSING
      );
    });

    it('lets a caller that re-read the row succeed', () => {
      const database = migratedDatabase();
      storeDucklets(database);
      updateRulesetData(database, 'r1', 1, '{"first":true}', 2);

      const retried = updateRulesetData(database, 'r1', 2, '{"second":true}', 3);

      expect(retried.outcome === WRITE_OUTCOME.WRITTEN && retried.row.revision).toBe(3);
    });
  });
});
