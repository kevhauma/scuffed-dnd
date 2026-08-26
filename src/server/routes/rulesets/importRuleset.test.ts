/**
 * `POST /api/rulesets/import` (TICKET-IO-04)
 *
 * The gates themselves are the Kernel's and are proven in
 * `shared/services/importExport.test.ts`. What is left for the route is what is *about the server*:
 * that it creates rather than replaces, that a refusal leaves the database exactly as it was, that
 * the same file imported twice is two rulesets, and that an uploaded roster arrives owned by the
 * Account and at no table.
 *
 * **Every refusal case asserts the row count as well as the status.** A 400 that had already
 * inserted would satisfy a status assertion and would be the worst bug this route could have —
 * v3 Req 35.2 says *persists nothing when any of them fails*, and the only way to check "nothing" is
 * to look at the table.
 *
 * **Validates: v3 Req 32.1, 35.1, 35.2, 35.3, 35.5, 36.5**
 */

import { describe, expect, it } from 'vitest';
import { serializeConfiguration } from '#shared/services/importExport';
import type { RulesetImportResult } from '#shared/types/api';
import type { Character } from '#shared/types/character';
import { type Configuration, SUPPORTED_SCHEMA_VERSION } from '#shared/types/config';
import { findRuleset } from '../../repositories/rulesetRepository';
import {
  allCharacters,
  allRulesets,
  type CallOptions,
  callRoute,
  realConfiguration,
  seedAccount,
  seedRuleset,
  withTestDatabase,
} from '../../testing';
import { importRuleset } from './importRuleset';

/** Ask the server to import a document, as somebody */
function importAs(as: CallOptions['as'], body: unknown) {
  return callRoute<RulesetImportResult>(importRuleset, {
    as,
    method: 'POST',
    path: '/api/rulesets/import',
    body,
  });
}

/**
 * The sentence a refusal carried
 *
 * A cast to the shape being read, which is what the sibling route suites do — rather than to
 * `never`, which accepts any access and then needs bracket indexing to say what it wanted. The
 * result body is typed as the *success* shape, because that is what every other case in this file
 * reads; a refusal is the exception and says so here once.
 */
function refusalMessage(result: { body: unknown }): string {
  return (result.body as { error: { message: string } }).error.message;
}

/** A character in the shape LocalStorage holds one, which is what an upload sends */
function storedCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'character-local-1',
    name: 'Quackers',
    configurationId: 'some-local-ruleset',
    raceIds: [],
    investedStatPoints: {},
    investedSkillPoints: {},
    currentResourceValues: {},
    experience: 0,
    inventory: { equippedItems: {}, miscItems: [] },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** A file as v1 exported it: main skills, no `schemaVersion` (the TICKET-IO-03 fixture) */
const v1File = {
  id: 'old',
  name: 'Old Ruleset',
  version: '1.0.0',
  mainSkills: [{ id: 'id-str', code: 'STR', name: 'Strength', description: '', maxLevel: 20 }],
  stats: [{ id: 'id-hp', name: 'Health', description: '', formula: 'STR * 10' }],
  skills: [],
  materials: [],
  materialCategories: [],
  items: [],
  equipmentSlots: [],
  races: [],
  currencyTiers: [],
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

describe('POST /api/rulesets/import', () => {
  describe('who may', () => {
    it('refuses an anonymous caller before it looks at the document', () =>
      withTestDatabase(async (database) => {
        const response = await importAs(null, { configuration: realConfiguration() });

        expect(response.status).toBe(401);
        expect(allRulesets(database)).toHaveLength(0);
      }));

    it('creates for a signed-in Account', () =>
      withTestDatabase(async (database) => {
        const response = await importAs(seedAccount(), { configuration: realConfiguration() });

        expect(response.status).toBe(200);
        expect(allRulesets(database)).toHaveLength(1);
      }));

    it('gives each Account its own ruleset and shows neither to the other', () =>
      withTestDatabase(async (database) => {
        const first = seedAccount();
        const second = seedAccount();

        const mine = await importAs(first, { configuration: realConfiguration() });
        const theirs = await importAs(second, { configuration: realConfiguration() });

        expect(mine.body.id).not.toBe(theirs.body.id);
        expect(findRuleset(mine.body.id, database)?.ownerAccountId).toBe(first.id);
        expect(findRuleset(theirs.body.id, database)?.ownerAccountId).toBe(second.id);
      }));
  });

  describe('it creates rather than replaces', () => {
    it('leaves every existing ruleset exactly as it was', () =>
      withTestDatabase(async (database) => {
        const owner = seedAccount();
        const existing = seedRuleset(database, { owner, name: 'Thursday game' });

        await importAs(owner, { configuration: realConfiguration() });

        const after = findRuleset(existing.id, database);
        expect(after).toEqual(existing);
        expect(allRulesets(database)).toHaveLength(2);
      }));

    it('makes the same file twice into two independent rulesets', () =>
      withTestDatabase(async (database) => {
        const owner = seedAccount();
        const document = realConfiguration();

        const first = await importAs(owner, { configuration: document });
        const second = await importAs(owner, { configuration: document });

        expect(first.status).toBe(200);
        expect(second.status).toBe(200);
        expect(first.body.id).not.toBe(second.body.id);
        expect(allRulesets(database)).toHaveLength(2);

        // …and neither is the id the file carried, which is what stops the second one colliding
        expect([first.body.id, second.body.id]).not.toContain(document.id);
      }));

    it('names the created ruleset after the document, at revision 1', () =>
      withTestDatabase(async (database) => {
        const document = realConfiguration();

        const response = await importAs(seedAccount(), { configuration: document });

        expect(response.body.name).toBe(document.name);
        expect(response.body.revision).toBe(1);
        expect(findRuleset(response.body.id, database)?.name).toBe(document.name);
      }));
  });

  describe('the four refusals, each persisting nothing', () => {
    it('refuses a v1 file with the version message rather than a field-by-field report', () =>
      withTestDatabase(async (database) => {
        const response = await importAs(seedAccount(), { configuration: v1File });

        expect(response.status).toBe(400);
        expect(refusalMessage(response)).toMatch(/older version of the app/);
        expect(allRulesets(database)).toHaveLength(0);
      }));

    it('refuses a document at a schema version this build does not read, stating both', () =>
      withTestDatabase(async (database) => {
        const ahead = { ...realConfiguration(), schemaVersion: SUPPORTED_SCHEMA_VERSION + 1 };

        const response = await importAs(seedAccount(), { configuration: ahead });
        const message = refusalMessage(response);

        expect(response.status).toBe(400);
        expect(message).toContain(String(SUPPORTED_SCHEMA_VERSION + 1));
        expect(message).toContain(String(SUPPORTED_SCHEMA_VERSION));
        expect(allRulesets(database)).toHaveLength(0);
      }));

    it('refuses a shape failure with the validator’s own words in `fields`', () =>
      withTestDatabase(async (database) => {
        const broken = { ...realConfiguration(), stats: 'not a list' };

        const response = await importAs(seedAccount(), { configuration: broken });

        expect(response.status).toBe(400);
        expect((response.body as { fields?: string[] }).fields?.join(' ')).toContain('stats');
        expect(allRulesets(database)).toHaveLength(0);
      }));

    it('refuses a file still carrying a retired field, naming what replaced it', () =>
      withTestDatabase(async (database) => {
        const retired = { ...realConfiguration(), mainSkillPointBudget: 25 };

        const response = await importAs(seedAccount(), { configuration: retired });

        expect(response.status).toBe(400);
        expect((response.body as { fields?: string[] }).fields?.join(' ')).toContain(
          'mainSkillPointBudget'
        );
        expect(allRulesets(database)).toHaveLength(0);
      }));
  });

  describe('the referential report rides along rather than refusing', () => {
    it('reports a clean corpus as valid', () =>
      withTestDatabase(async () => {
        const response = await importAs(seedAccount(), { configuration: realConfiguration() });

        expect(response.body.report.isValid).toBe(true);
        expect(response.body.report.errors).toEqual([]);
      }));

    it('creates a referentially broken but structurally valid ruleset, and says what is wrong', () =>
      withTestDatabase(async (database) => {
        const document = realConfiguration();
        // Structurally a perfectly good roll definition; it just points at a ladder that is not there
        document.rollDefinitions = [
          {
            id: 'roll-orphan',
            name: 'Orphan',
            description: '',
            input: '1',
            ladderId: 'no-such-ladder',
            order: 0,
          },
        ];

        const response = await importAs(seedAccount(), { configuration: document });

        // The v1.0 rule: a repairable ruleset reaches the User rather than being refused
        expect(response.status).toBe(200);
        expect(allRulesets(database)).toHaveLength(1);
        expect(response.body.report.isValid).toBe(false);
        expect(response.body.report.errors.map((issue) => issue.message).join(' ')).toContain(
          'no-such-ladder'
        );
      }));
  });

  describe('the round trip through the server', () => {
    it('gives back a ruleset equivalent to the one exported, formulas included', () =>
      withTestDatabase(async (database) => {
        const source = realConfiguration();

        // Exactly what the export path writes to a file, parsed back the way a client would
        const exported = JSON.parse(serializeConfiguration(source)) as Configuration;

        const response = await importAs(seedAccount(), { configuration: exported });
        const stored = JSON.parse(findRuleset(response.body.id, database)?.data ?? '{}');

        // Everything but the two identities an import deliberately replaces
        const { id: _storedId, createdAt: _c1, updatedAt: _u1, ...rest } = stored;
        const {
          id: _sourceId,
          createdAt: _c2,
          updatedAt: _u2,
          ...expected
        } = JSON.parse(serializeConfiguration(source));

        expect(rest).toEqual(expected);
      }));
  });

  describe('the characters an upload brings with it (v3 Req 36.5)', () => {
    it('creates one row per stored character, owned by the Account and at no table', () =>
      withTestDatabase(async (database) => {
        const owner = seedAccount();

        const response = await importAs(owner, {
          configuration: realConfiguration(),
          characters: [storedCharacter(), storedCharacter({ id: 'character-local-2' })],
        });

        expect(response.body.charactersCreated).toBe(2);

        const rows = allCharacters(database);
        expect(rows).toHaveLength(2);
        expect(rows.every((row) => row.ownerAccountId === owner.id)).toBe(true);
        expect(rows.every((row) => row.sessionId === null)).toBe(true);
      }));

    it('points every uploaded character at the ruleset it just created', () =>
      withTestDatabase(async (database) => {
        const response = await importAs(seedAccount(), {
          configuration: realConfiguration(),
          characters: [storedCharacter({ configurationId: 'a-ruleset-only-a-browser-has' })],
        });

        const stored = JSON.parse(allCharacters(database)[0].data) as Character;

        expect(stored.configurationId).toBe(response.body.id);
        // …and its own id is fresh, so uploading the same roster twice is two rosters
        expect(stored.id).not.toBe('character-local-1');
      }));

    it('imports the ruleset alone when no characters are sent', () =>
      withTestDatabase(async (database) => {
        const response = await importAs(seedAccount(), { configuration: realConfiguration() });

        expect(response.body.charactersCreated).toBe(0);
        expect(allCharacters(database)).toHaveLength(0);
      }));

    it('refuses the whole upload when one character cannot be read, storing neither half', () =>
      withTestDatabase(async (database) => {
        const unreadable = {
          ...storedCharacter({ id: 'character-local-2' }),
          experience: undefined,
        };

        const response = await importAs(seedAccount(), {
          configuration: realConfiguration(),
          characters: [storedCharacter(), unreadable],
        });

        expect(response.status).toBe(400);
        expect((response.body as { fields?: string[] }).fields?.join(' ')).toContain(
          'characters[1]'
        );
        // The ruleset is the half that would have been written first — neither landed
        expect(allRulesets(database)).toHaveLength(0);
        expect(allCharacters(database)).toHaveLength(0);
      }));

    it('refuses characters that are not a list', () =>
      withTestDatabase(async (database) => {
        const response = await importAs(seedAccount(), {
          configuration: realConfiguration(),
          characters: 'Quackers',
        });

        expect(response.status).toBe(400);
        expect(allRulesets(database)).toHaveLength(0);
      }));

    it('refuses a record whose maps are the wrong kind of thing (the IO-04 review)', () =>
      withTestDatabase(async (database) => {
        // `investedStatPoints: null` passes the browser's own `!== undefined` predicate and is a
        // `TypeError` for whichever surface reads the row — the server's re-derivation included
        const response = await importAs(seedAccount(), {
          configuration: realConfiguration(),
          characters: [{ ...storedCharacter(), investedStatPoints: null }],
        });

        expect(response.status).toBe(400);
        expect((response.body as { fields?: string[] }).fields?.join(' ')).toContain(
          'investedStatPoints'
        );
        expect(allCharacters(database)).toHaveLength(0);
      }));

    it('refuses one with no inventory, which every sheet dereferences', () =>
      withTestDatabase(async () => {
        const response = await importAs(seedAccount(), {
          configuration: realConfiguration(),
          characters: [{ ...storedCharacter(), inventory: undefined }],
        });

        expect(response.status).toBe(400);
      }));
  });

  describe('the ruleset and its roster are one write (the IO-04 review)', () => {
    it('stores neither half when a character insert fails', () =>
      withTestDatabase(async (database) => {
        // Two characters that collide on a primary key is the cheapest way to make the *second*
        // insert throw after the first has already run — which is the shape of every real failure
        // here (a full disk, a busy timeout) and the one a loop with no transaction gets wrong.
        // They pass the shape gate, so the throw happens mid-write rather than before it.
        const clash = storedCharacter();
        const originalUuid = crypto.randomUUID;
        // The literal has to be UUID-shaped for the type; what matters is that it never varies
        crypto.randomUUID = () => '00000000-0000-4000-8000-000000000000';

        try {
          const response = await importAs(seedAccount(), {
            configuration: realConfiguration(),
            characters: [clash, { ...clash, name: 'Waddles' }],
          });

          expect(response.status).toBe(500);
        } finally {
          crypto.randomUUID = originalUuid;
        }

        // The ruleset is written first, so without the transaction it would be sitting here now
        // while the client was told the whole thing failed
        expect(allRulesets(database)).toHaveLength(0);
        expect(allCharacters(database)).toHaveLength(0);
      }));
  });

  describe('the name a document brings with it', () => {
    it('truncates a very long one rather than refusing the file for it', () =>
      withTestDatabase(async (database) => {
        // `validateConfigurationShape` imposes no cap, so the browser's Import accepts this and the
        // account path has to as well — refusing at the last gate would be the app rejecting
        // something it exported itself (the IO-04 review)
        const long = { ...realConfiguration(), name: 'D'.repeat(400) };

        const response = await importAs(seedAccount(), { configuration: long });

        expect(response.status).toBe(200);
        expect(response.body.name.length).toBe(120);
        expect(allRulesets(database)).toHaveLength(1);
      }));

    it('gives a blank-named document something findable rather than an empty row', () =>
      withTestDatabase(async () => {
        const unnamed = { ...realConfiguration(), name: '   ' };

        const response = await importAs(seedAccount(), { configuration: unnamed });

        expect(response.status).toBe(200);
        expect(response.body.name).toBe('Imported ruleset');
      }));
  });
});
