/**
 * Reading and saving a ruleset's contents (TICKET-RUL-02)
 *
 * The two routes RUL-02 adds, and the three things they are really about.
 *
 * **The revision guard**, which is the whole of "an edit in one browser does not clobber an edit in
 * another": the check and the increment are one statement, so the loser of a race writes nothing
 * and is *told*, with the revision it is behind attached so a client can offer a reload. Two Owners
 * editing one ruleset is out of scope for the milestone — this is the refusal that makes that
 * scope decision something a User meets rather than something they discover.
 *
 * **The form boundary.** The column holds id-resolved references and the wire carries the ruleset's
 * current spellings, so a rename made through this route re-spells every formula naming the renamed
 * entity — exactly as the LocalStorage path has since TICKET-REF-01. That is asserted on the real
 * corpus rather than on a toy ruleset, because a two-stat ruleset cannot show it.
 *
 * **Nothing persists when validation fails**, and the refusal names the fields.
 *
 * **Validates: v3 Req 32.2, 32.5, 33.4, 33.5, 33.6, 33.8**
 */

import { describe, expect, it } from 'vitest';
import { toDisplayConfiguration, toStoredConfiguration } from '#shared/engine/formula/references';
import { ERROR_CODE, type RulesetDocument } from '#shared/types/api';
import type { Configuration, Stat } from '#shared/types/config';
import { findRuleset } from '../../repositories/rulesetRepository';
import {
  type CallOptions,
  callRoute,
  type Database,
  realConfiguration,
  seedAccount,
  seedRuleset,
  withTestDatabase,
} from '../../testing';
import { getRuleset } from './getRuleset';
import { saveRuleset } from './saveRuleset';

/** The path both routes read their `:id` out of */
function pathFor(id: string): string {
  return `/api/rulesets/${id}`;
}

/** Save a document as an account, stating the revision it is based on */
function save(id: string, as: CallOptions['as'], revision: number, configuration: unknown) {
  return callRoute<RulesetDocument & { error?: { code: string; message: string } }>(saveRuleset, {
    as,
    method: 'PUT',
    path: pathFor(id),
    body: { revision, configuration },
  });
}

/** The stored document of a row, parsed */
function storedIn(database: Database, id: string): Configuration {
  const row = findRuleset(id, database);
  if (!row) throw new Error(`no ruleset ${id}`);
  return JSON.parse(row.data) as Configuration;
}

describe('GET /api/rulesets/:id', () => {
  it('refuses anonymous, non-owner and owner in the documented three ways', () =>
    withTestDatabase(async (database) => {
      const owner = seedAccount();
      const row = seedRuleset(database, { owner });
      const call = (as: CallOptions['as']) => callRoute(getRuleset, { as, path: pathFor(row.id) });

      expect((await call(null)).status).toBe(401);
      expect((await call(seedAccount())).status).toBe(404);
      expect((await call(owner)).status).toBe(200);
    }));

  it('hands back the whole document, in display form', () =>
    withTestDatabase(async (database) => {
      // The listing carries no document at all; this is the one route that does, which is what
      // makes "render from the list and edit that copy" impossible rather than merely discouraged
      const owner = seedAccount();
      const row = seedRuleset(database, { owner });

      const response = await callRoute<RulesetDocument>(getRuleset, {
        as: owner,
        path: pathFor(row.id),
      });

      expect(response.body.revision).toBe(1);
      expect(response.body.configuration).toEqual(toDisplayConfiguration(realConfiguration()));
    }));
});

describe('PUT /api/rulesets/:id', () => {
  it('refuses anonymous, non-owner and owner in the documented three ways', () =>
    withTestDatabase(async (database) => {
      const owner = seedAccount();
      const row = seedRuleset(database, { owner });
      const configuration = realConfiguration();

      expect((await save(row.id, null, 1, configuration)).status).toBe(401);
      expect((await save(row.id, seedAccount(), 1, configuration)).status).toBe(404);
      expect((await save(row.id, owner, 1, configuration)).status).toBe(200);
    }));

  it('does not tell a stranger their document was malformed', () =>
    withTestDatabase(async (database) => {
      // The guard runs before the body is validated. A 404 that arrived *after* a field-by-field
      // critique would say plenty about a resource the caller was not allowed to know exists.
      const row = seedRuleset(database, { owner: seedAccount() });

      const response = await save(row.id, seedAccount(), 1, { nonsense: true });

      expect(response.status).toBe(404);
      expect(response.body.error?.code).toBe(ERROR_CODE.NOT_FOUND);
    }));

  it('increments the revision on an accepted write', () =>
    withTestDatabase(async (database) => {
      const owner = seedAccount();
      const row = seedRuleset(database, { owner });

      const response = await save(row.id, owner, 1, realConfiguration());

      expect(response.status).toBe(200);
      expect(response.body.revision).toBe(2);
      expect(findRuleset(row.id, database)?.revision).toBe(2);
    }));

  it('refuses a write whose base revision is behind, and says what it is now', () =>
    withTestDatabase(async (database) => {
      // The second browser's save. It is refused rather than merged — and rather than winning,
      // which is what "last write wins" would have done to the first browser's edit (v3 Req 33.8)
      const owner = seedAccount();
      const row = seedRuleset(database, { owner });
      await save(row.id, owner, 1, realConfiguration());

      const stale = await callRoute<{ error: { code: string }; currentRevision: number }>(
        saveRuleset,
        {
          as: owner,
          method: 'PUT',
          path: pathFor(row.id),
          body: { revision: 1, configuration: realConfiguration() },
        }
      );

      expect(stale.status).toBe(409);
      expect(stale.body.error.code).toBe(ERROR_CODE.CONFLICT);
      // The client cannot work this out and needs it to offer the one thing that resolves this
      expect(stale.body.currentRevision).toBe(2);
    }));

  it('lets the loser succeed once it has re-read the ruleset', () =>
    withTestDatabase(async (database) => {
      const owner = seedAccount();
      const row = seedRuleset(database, { owner });
      await save(row.id, owner, 1, realConfiguration());

      expect((await save(row.id, owner, 2, realConfiguration())).status).toBe(200);
    }));

  it('stores id-resolved references and gives back spelled-out ones', () =>
    withTestDatabase(async (database) => {
      // The form boundary, on the real corpus. What goes in is display form — a formula naming a
      // stat by its abbreviation — and what the column holds names it by id, so a later rename
      // cannot orphan it (TICKET-REF-01). The server is a third boundary of that kind.
      const owner = seedAccount();
      const row = seedRuleset(database, { owner });
      const display = toDisplayConfiguration(realConfiguration());

      const response = await callRoute<RulesetDocument>(saveRuleset, {
        as: owner,
        method: 'PUT',
        path: pathFor(row.id),
        body: { revision: 1, configuration: display },
      });

      expect(response.body.configuration).toEqual(display);
      // The column holds the id-resolved form, which is a *different document* from the one on the
      // wire — `[stat-speed]` where the wire says `SPEED`. That difference is the whole boundary.
      expect(storedIn(database, row.id)).toEqual(toStoredConfiguration(display));
      expect(JSON.stringify(storedIn(database, row.id))).not.toContain(
        'round(SPEED / const.apt_value)'
      );
    }));

  it('survives a round-trip well enough for a rename to still re-spell every reader', () =>
    withTestDatabase(async (database) => {
      // v3 Req 33.5's real content, and the thing that would break quietly if the server stored the
      // *display* form: a rename is only harmless because references are resolved to ids first,
      // renamed in that form, and spelled back out — which is `applyRenameSafely` in `configStore`
      // and is done here with the same Kernel pair. The corpus has exactly one stat formula, `APT`
      // reading `max(1, round(SPEED / const.apt_value))`, so it is the one that has to move.
      //
      // The rename happens **after** a full save-and-read cycle, so anything the server lost on the
      // way through shows up as a formula that no longer follows its stat.
      const owner = seedAccount();
      const row = seedRuleset(database, { owner });
      const display = toDisplayConfiguration(realConfiguration());

      await save(row.id, owner, 1, display);
      const opened = await callRoute<RulesetDocument>(getRuleset, {
        as: owner,
        path: pathFor(row.id),
      });

      const stored = toStoredConfiguration(opened.body.configuration as Configuration);
      const speed = stored.stats.find((stat: Stat) => stat.abbreviation === 'SPEED');
      if (!speed) throw new Error('the corpus no longer has a SPEED stat to rename');

      const renamed = toDisplayConfiguration({
        ...stored,
        stats: stored.stats.map((stat) =>
          stat.id === speed.id ? { ...stat, abbreviation: 'ZIP' } : stat
        ),
      });

      const response = await callRoute<RulesetDocument>(saveRuleset, {
        as: owner,
        method: 'PUT',
        path: pathFor(row.id),
        body: { revision: 2, configuration: renamed },
      });

      const back = response.body.configuration as Configuration;

      expect(back.stats.find((stat) => stat.abbreviation === 'APT')?.formula).toBe(
        'max(1, round(ZIP / const.apt_value))'
      );
      expect(back.stats.find((stat) => stat.id === speed.id)?.abbreviation).toBe('ZIP');
    }));

  it('persists nothing when the document is not a shape the server can read', () =>
    withTestDatabase(async (database) => {
      const owner = seedAccount();
      const row = seedRuleset(database, { owner });
      const before = findRuleset(row.id, database)?.data;

      const response = await callRoute<{ error: { code: string }; fields: string[] }>(saveRuleset, {
        as: owner,
        method: 'PUT',
        path: pathFor(row.id),
        body: { revision: 1, configuration: { ...realConfiguration(), stats: 'not an array' } },
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe(ERROR_CODE.BAD_REQUEST);
      // The validator's own words — a bare "validation failed" is a refusal nobody can act on
      expect(response.body.fields.join(' ')).toContain('stats');
      expect(findRuleset(row.id, database)?.data).toBe(before);
      expect(findRuleset(row.id, database)?.revision).toBe(1);
    }));

  it('refuses a document written at another schema version, stating it', () =>
    withTestDatabase(async (database) => {
      const owner = seedAccount();
      const row = seedRuleset(database, { owner });

      const response = await callRoute<{ error: { code: string; message: string } }>(saveRuleset, {
        as: owner,
        method: 'PUT',
        path: pathFor(row.id),
        body: { revision: 1, configuration: { ...realConfiguration(), schemaVersion: 3 } },
      });

      // A **400**, not the 409 a *stored* row at the wrong version gets. The difference is which
      // document is stale: there the resource refuses the caller and a reload is the remedy; here
      // the caller sent a file this build cannot read, and reloading would change nothing.
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe(ERROR_CODE.BAD_REQUEST);
      // The import path's own sentence, reused rather than restated (TICKET-RUL-01's gate)
      expect(response.body.error.message).toContain('exported by an older version of the app');
      expect(response.body.error.message).toContain('schema version 3');
      expect(findRuleset(row.id, database)?.revision).toBe(1);
    }));

  it('refuses a save that states no base revision', () =>
    withTestDatabase(async (database) => {
      const owner = seedAccount();
      const row = seedRuleset(database, { owner });

      const response = await callRoute<{ error: { code: string } }>(saveRuleset, {
        as: owner,
        method: 'PUT',
        path: pathFor(row.id),
        body: { configuration: realConfiguration() },
      });

      expect(response.status).toBe(400);
      expect(findRuleset(row.id, database)?.revision).toBe(1);
    }));
});
