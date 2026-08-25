/**
 * `POST /api/rulesets/:id/copy` (TICKET-RUL-03)
 *
 * The copying itself is the Kernel's and is proven structurally in
 * `shared/services/copyConfiguration.test.ts`. What is left for the route is the part that is
 * *about the server*: who may copy, that the source is untouched afterwards, and that the copy
 * arrives as a ruleset in its own right — its own row, its own id, `revision` back at 1.
 *
 * **Validates: v3 Req 32.2, 32.5, 34.1, 34.3, 34.4, 34.5**
 */

import { describe, expect, it } from 'vitest';
import type { RulesetSummary } from '#shared/types/api';
import type { Configuration } from '#shared/types/config';
import { findRuleset } from '../../repositories/rulesetRepository';
import {
  allRulesets,
  type CallOptions,
  callRoute,
  realConfiguration,
  seedAccount,
  seedRuleset,
  withTestDatabase,
} from '../../testing';
import { copyRuleset } from './copyRuleset';

/** The path the route reads its `:id` out of */
function pathFor(id: string): string {
  return `/api/rulesets/${id}/copy`;
}

/** Ask for a copy, optionally naming it */
function copy(id: string, as: CallOptions['as'], name?: string) {
  return callRoute<RulesetSummary>(copyRuleset, {
    as,
    method: 'POST',
    path: pathFor(id),
    body: name === undefined ? {} : { name },
  });
}

describe('POST /api/rulesets/:id/copy', () => {
  it('refuses anonymous, non-owner and owner in the documented three ways', () =>
    withTestDatabase(async (database) => {
      const owner = seedAccount();
      const row = seedRuleset(database, { owner });

      expect((await copy(row.id, null)).status).toBe(401);
      expect((await copy(row.id, seedAccount())).status).toBe(404);
      // Neither refusal left a copy behind — a status check alone would not have noticed
      expect(allRulesets(database)).toHaveLength(1);

      expect((await copy(row.id, owner)).status).toBe(200);
      expect(allRulesets(database)).toHaveLength(2);
    }));

  it('answers a ruleset that never existed exactly as it answers a stranger', () =>
    withTestDatabase(async () => {
      expect((await copy('never-minted', seedAccount())).status).toBe(404);
    }));

  it('gives the copy a new id, its own row and revision 1', () =>
    withTestDatabase(async (database) => {
      const owner = seedAccount();
      const row = seedRuleset(database, { owner, name: 'Ducklets' });

      const response = await copy(row.id, owner);

      expect(response.body.id).not.toBe(row.id);
      expect(response.body.revision).toBe(1);
      expect(findRuleset(response.body.id, database)?.ownerAccountId).toBe(row.ownerAccountId);
    }));

  it('leaves the source ruleset exactly as it was (v3 Req 34.3)', () =>
    withTestDatabase(async (database) => {
      // The reason a User reaches for this: try a rebalance without risking the ruleset the table
      // is playing on Thursday
      const owner = seedAccount();
      const row = seedRuleset(database, { owner });
      const before = findRuleset(row.id, database);

      await copy(row.id, owner);

      expect(findRuleset(row.id, database)).toEqual(before);
    }));

  it('defaults the name to a visible derivative, and takes one when given', () =>
    withTestDatabase(async (database) => {
      const owner = seedAccount();
      const row = seedRuleset(database, { owner, name: 'Ducklets' });

      // From the **row's** name, which is what the list showed the User, rather than from the
      // document's — the corpus's own name is "Ducklets (sheet import)", and the two can differ
      expect((await copy(row.id, owner)).body.name).toBe('Ducklets (copy)');
      expect((await copy(row.id, owner, 'Rebalance attempt')).body.name).toBe('Rebalance attempt');
    }));

  it('writes the copy’s name into its document too, not just its row', () =>
    withTestDatabase(async (database) => {
      // RUL-01's rename keeps the column and the document in step; a copy that set only the column
      // would be born out of step, and its export would carry the source's name
      const owner = seedAccount();
      const row = seedRuleset(database, { owner, name: 'Ducklets' });

      const response = await copy(row.id, owner);
      const stored = JSON.parse(
        findRuleset(response.body.id, database)?.data ?? ''
      ) as Configuration;

      expect(stored.name).toBe('Ducklets (copy)');
    }));

  it('refuses a blank name rather than storing one', () =>
    withTestDatabase(async (database) => {
      const owner = seedAccount();
      const row = seedRuleset(database, { owner });

      expect((await copy(row.id, owner, '   ')).status).toBe(400);
      expect(allRulesets(database)).toHaveLength(1);
    }));

  it('stores a copy that still parses as the same ruleset', () =>
    withTestDatabase(async (database) => {
      const owner = seedAccount();
      const row = seedRuleset(database, { owner });

      const response = await copy(row.id, owner);
      const stored = JSON.parse(
        findRuleset(response.body.id, database)?.data ?? ''
      ) as Configuration;

      // Entity ids are kept, so every id-resolved reference inside the copy still lands
      expect(stored.stats.map((stat) => stat.id)).toEqual(
        realConfiguration().stats.map((stat) => stat.id)
      );
      expect(stored.id).toBe(response.body.id);
    }));
});
