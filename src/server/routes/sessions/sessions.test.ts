/**
 * The `/api/sessions` routes (TICKET-GAM-01)
 *
 * Four things this file is really about, and only the first is bookkeeping:
 *
 * 1. **Every route refuses anonymous, non-member and wrong-role callers**, which is the milestone's
 *    second Definition-of-Done rule and is asserted per route rather than once.
 * 2. **D7 holds**: a session's rules stop moving when it is created. Asserted by *calculating a
 *    character against the Snapshot before and after editing the source ruleset* rather than by
 *    comparing documents — a session that silently re-read the ruleset would produce a different
 *    number, and a document comparison could pass while the code that plays the game did not use it.
 * 3. **The Snapshot shares no object with the ruleset it came from**, walked structurally the way
 *    `copyConfiguration.test.ts` walks a copy. A shallow snapshot passes every spot-check anybody
 *    would write and lets a later ruleset edit reach into a running game through a shared array.
 * 4. **A refresh that would break somebody is refused, by name.**
 *
 * **Validates: v3 Req 32.1, 32.2, 32.3, 32.5, 37.1, 37.2, 37.3, 37.4, 37.5, 37.6**
 */

import { describe, expect, it } from 'vitest';
import { calculateCharacter } from '#shared/engine/calculator';
import { numberOr } from '#shared/engine/formula/errors';
import { serializeConfiguration } from '#shared/services/importExport';
import type {
  GameSessionDocument,
  GameSessionListing,
  GameSessionSummary,
  SnapshotConflict,
} from '#shared/types/api';
import { MEMBER_ROLE, SESSION_STATUS } from '#shared/types/api';
import type { Character } from '#shared/types/character';
import type { Configuration } from '#shared/types/config';
import { eventsSince } from '../../repositories/eventRepository';
import { findGameSession, type GameSessionRow } from '../../repositories/gameSessionRepository';
import { updateRulesetData } from '../../repositories/rulesetRepository';
import {
  type CallOptions,
  callRoute,
  realConfiguration,
  seedAccount,
  seedCharacter,
  seedMember,
  seedRuleset,
  seedSession,
  withTestDatabase,
} from '../../testing';
import { displayDocumentOf } from '../rulesets/rulesetPayloads';
import { archiveSession } from './archiveSession';
import { createSession } from './createSession';
import { listSessions } from './listSessions';
import { readSession } from './readSession';
import { refreshSnapshot } from './refreshSnapshot';
import { snapshotOf } from './sessionPayloads';

/** Start a table from a ruleset, as somebody */
function create(as: CallOptions['as'], body: unknown) {
  return callRoute<GameSessionSummary>(createSession, {
    as,
    method: 'POST',
    path: '/api/sessions',
    body,
  });
}

/** Read one table, as somebody */
function read(id: string, as: CallOptions['as']) {
  return callRoute<GameSessionDocument>(readSession, { as, path: `/api/sessions/${id}` });
}

/** Close one table, as somebody */
function archive(id: string, as: CallOptions['as']) {
  return callRoute<GameSessionSummary>(archiveSession, {
    as,
    method: 'POST',
    path: `/api/sessions/${id}/archive`,
    body: {},
  });
}

/** Pull the ruleset's current state into a table, as somebody */
function refresh(id: string, as: CallOptions['as']) {
  return callRoute<GameSessionDocument>(refreshSnapshot, {
    as,
    method: 'POST',
    path: `/api/sessions/${id}/snapshot`,
    body: {},
  });
}

/** The conflicts a refused refresh carried */
function conflictsOf(body: unknown): SnapshotConflict[] {
  return (body as { conflicts?: SnapshotConflict[] }).conflicts ?? [];
}

/** A character in the shape a `data` column holds one */
function playerState(overrides: Partial<Character> = {}): Character {
  return {
    id: 'character-local',
    name: 'Quackers',
    configurationId: 'session',
    raceIds: [],
    investedStatPoints: {},
    investedSkillPoints: {},
    currentResourceValues: {},
    experience: 0,
    inventory: { equippedItems: {}, miscItems: [], composedItems: [] },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Every path at which two documents hold the **same object**
 *
 * `copyConfiguration.test.ts`'s assertion, run through the session path. A spot-check of three
 * fields passes on a shallow snapshot; this cannot, because it is not a list of fields.
 */
function sharedPaths(left: unknown, right: unknown, path = '$'): string[] {
  if (left === null || right === null) return [];
  if (typeof left !== 'object' || typeof right !== 'object') return [];
  if (left === right) return [path];

  return Object.keys(left as Record<string, unknown>).flatMap((key) =>
    sharedPaths(
      (left as Record<string, unknown>)[key],
      (right as Record<string, unknown>)[key],
      `${path}.${key}`
    )
  );
}

/** The first stat anybody can invest in — the one a test can spend points on */
function firstInvestableStat(config: Configuration) {
  const stat = config.stats.find((candidate) => candidate.formula === undefined);

  if (!stat) throw new Error('the corpus has no investable stat, which cannot happen');

  return stat;
}

describe('POST /api/sessions', () => {
  it('refuses anonymous, non-owner and owner in the documented three ways', () =>
    withTestDatabase(async (database) => {
      const owner = seedAccount();
      const ruleset = seedRuleset(database, { owner });
      const body = { rulesetId: ruleset.id, name: 'Tuesday night' };

      expect((await create(null, body)).status).toBe(401);
      expect((await create(seedAccount(), body)).status).toBe(404);
      expect((await create(owner, body)).status).toBe(200);
    }));

  it('answers a ruleset that never existed exactly as it answers a stranger', () =>
    withTestDatabase(async () => {
      const response = await create(seedAccount(), { rulesetId: 'never-minted', name: 'Tuesday' });

      expect(response.status).toBe(404);
    }));

  it('needs a ruleset named and a name', () =>
    withTestDatabase(async (database) => {
      const owner = seedAccount();
      const ruleset = seedRuleset(database, { owner });

      expect((await create(owner, { name: 'Tuesday' })).status).toBe(400);
      expect((await create(owner, { rulesetId: ruleset.id })).status).toBe(400);
      expect((await create(owner, { rulesetId: ruleset.id, name: '   ' })).status).toBe(400);
    }));

  it('seats the creator as DM, in `session_member` as well as on the row', () =>
    withTestDatabase(async (database) => {
      const owner = seedAccount();
      const ruleset = seedRuleset(database, { owner });

      const created = await create(owner, { rulesetId: ruleset.id, name: 'Tuesday night' });

      expect(created.body.role).toBe(MEMBER_ROLE.DM);
      expect(created.body.status).toBe(SESSION_STATUS.ACTIVE);
      // `requireDM` reads `session_member`, so a session whose membership row was missed would be a
      // table its own DM is locked out of. Reading it back is the cheapest proof it is there.
      expect((await read(created.body.id, owner)).status).toBe(200);
    }));

  describe('the Snapshot it pins (D7)', () => {
    it('stores a document deep-equal to the ruleset it came from', () =>
      withTestDatabase(async (database) => {
        const owner = seedAccount();
        const ruleset = seedRuleset(database, { owner });

        const created = await create(owner, { rulesetId: ruleset.id, name: 'Tuesday night' });

        // **Compared in display form, which is the form the game is played in.** The stored texts
        // are deliberately *not* compared: every document the server writes goes through
        // `serializeConfiguration`, so a reference the corpus file happens to spell by name comes
        // back id-resolved — a difference in how a reference is written down, not in what it points
        // at. Asserting on the stored bytes would pin the corpus's spelling rather than the rule
        // that matters, which is that a session plays by the ruleset's rules.
        const snapshot = snapshotOf(findGameSession(created.body.id, database) as GameSessionRow);
        const source = displayDocumentOf(ruleset);

        // Everything but the two identities a copy deliberately replaces
        const { id: _sid, createdAt: _sc, updatedAt: _su, ...expected } = source;
        const { id: _id, createdAt: _c, updatedAt: _u, ...actual } = snapshot;

        expect(actual).toEqual(expected);
      }));

    it('shares no object with the source, anywhere in the document', () =>
      withTestDatabase(async (database) => {
        const owner = seedAccount();
        const ruleset = seedRuleset(database, { owner });

        const created = await create(owner, { rulesetId: ruleset.id, name: 'Tuesday night' });
        const stored = findGameSession(created.body.id, database);

        // Both parsed from text, so they cannot share by construction — which is the point being
        // made: the *copy* is what has to be independent, and this walks it rather than trusting it
        const snapshot = JSON.parse(stored?.snapshot ?? '{}') as Configuration;
        const source = JSON.parse(ruleset.data) as Configuration;

        expect(sharedPaths(snapshot, source)).toEqual([]);
      }));

    it('leaves a character’s calculated values identical after the ruleset is edited', () =>
      withTestDatabase(async (database) => {
        const owner = seedAccount();
        const ruleset = seedRuleset(database, { owner });
        const created = await create(owner, { rulesetId: ruleset.id, name: 'Tuesday night' });

        const stat = firstInvestableStat(realConfiguration());
        const character = playerState({ investedStatPoints: { [stat.id]: 3 } });

        const before = read(created.body.id, owner);
        const valueBefore = numberOr(
          calculateCharacter(character, (await before).body.snapshot).statValues[stat.id],
          Number.NaN
        );

        // The DM retunes the ruleset afterwards — the exact thing D7 exists to keep out of a
        // running game. A doubled point-buy curve changes what three points buy.
        const edited = realConfiguration();
        const pointBuy = edited.curves?.find((curve) => curve.name === 'point_buy');
        if (!pointBuy) throw new Error('the corpus has no point_buy curve, which cannot happen');
        for (const row of pointBuy.rows) row.values = row.values.map((value) => value * 2);

        updateRulesetData(
          ruleset.id,
          ruleset.revision,
          serializeConfiguration(edited),
          Date.now(),
          database
        );

        const after = await read(created.body.id, owner);
        const valueAfter = numberOr(
          calculateCharacter(character, after.body.snapshot).statValues[stat.id],
          Number.NaN
        );

        expect(Number.isNaN(valueBefore)).toBe(false);
        expect(valueAfter).toBe(valueBefore);
      }));
  });
});

describe('GET /api/sessions', () => {
  it('refuses an anonymous caller', () =>
    withTestDatabase(async () => {
      expect((await callRoute(listSessions, { as: null })).status).toBe(401);
    }));

  it('lists only the tables the Account sits at, with the role it holds', () =>
    withTestDatabase(async (database) => {
      const dm = seedAccount();
      const player = seedAccount();
      const stranger = seedAccount();

      const mine = seedSession(database, { dm });
      seedMember(database, { session: mine.session, account: player });
      seedSession(database, { dm: seedAccount() });

      const asDm = await callRoute<GameSessionListing>(listSessions, { as: dm });
      const asPlayer = await callRoute<GameSessionListing>(listSessions, { as: player });
      const asStranger = await callRoute<GameSessionListing>(listSessions, { as: stranger });

      expect(asDm.body.sessions.map((session) => session.role)).toEqual([MEMBER_ROLE.DM]);
      expect(asPlayer.body.sessions.map((session) => session.role)).toEqual([MEMBER_ROLE.PLAYER]);
      expect(asStranger.body.sessions).toEqual([]);
    }));

  it('carries no Snapshot, so nothing can play from a listing', () =>
    withTestDatabase(async (database) => {
      const dm = seedAccount();
      seedSession(database, { dm });

      const listed = await callRoute<GameSessionListing>(listSessions, { as: dm });

      expect('snapshot' in listed.body.sessions[0]).toBe(false);
    }));
});

describe('GET /api/sessions/:id', () => {
  it('refuses anonymous and non-member, and serves both Members', () =>
    withTestDatabase(async (database) => {
      const dm = seedAccount();
      const player = seedAccount();
      const { session } = seedSession(database, { dm });
      seedMember(database, { session, account: player });

      expect((await read(session.id, null)).status).toBe(401);
      expect((await read(session.id, seedAccount())).status).toBe(404);
      expect((await read(session.id, dm)).status).toBe(200);
      expect((await read(session.id, player)).status).toBe(200);
    }));

  it('answers a session that never existed exactly as it answers a stranger', () =>
    withTestDatabase(async () => {
      expect((await read('never-minted', seedAccount())).status).toBe(404);
    }));

  it('serves the Snapshot in display form, with formulas spelled out', () =>
    withTestDatabase(async (database) => {
      const dm = seedAccount();
      const { session } = seedSession(database, { dm });

      const response = await read(session.id, dm);

      expect(response.body.snapshot.stats.length).toBeGreaterThan(0);
      // Display form: a stat's formula names entities by their spelling, not by a resolved id
      const derived = response.body.snapshot.stats.find((stat) => stat.formula !== undefined);
      expect(derived?.formula).not.toMatch(/#\{/);
    }));

  it('says what the caller is at this table', () =>
    withTestDatabase(async (database) => {
      const dm = seedAccount();
      const player = seedAccount();
      const { session } = seedSession(database, { dm });
      seedMember(database, { session, account: player });

      expect((await read(session.id, dm)).body.role).toBe(MEMBER_ROLE.DM);
      expect((await read(session.id, player)).body.role).toBe(MEMBER_ROLE.PLAYER);
    }));
});

describe('POST /api/sessions/:id/archive', () => {
  it('refuses anonymous, non-member and a player, and accepts the DM', () =>
    withTestDatabase(async (database) => {
      const dm = seedAccount();
      const player = seedAccount();
      const { session } = seedSession(database, { dm });
      seedMember(database, { session, account: player });

      expect((await archive(session.id, null)).status).toBe(401);
      expect((await archive(session.id, seedAccount())).status).toBe(404);
      // A player already knows the table exists; which refusal they get should not depend on that
      expect((await archive(session.id, player)).status).toBe(404);
      expect((await archive(session.id, dm)).status).toBe(200);
    }));

  it('leaves the table readable afterwards', () =>
    withTestDatabase(async (database) => {
      const dm = seedAccount();
      const player = seedAccount();
      const { session } = seedSession(database, { dm });
      seedMember(database, { session, account: player });

      await archive(session.id, dm);

      const read1 = await read(session.id, player);
      expect(read1.status).toBe(200);
      expect(read1.body.status).toBe(SESSION_STATUS.ARCHIVED);
      expect(read1.body.snapshot.stats.length).toBeGreaterThan(0);
    }));

  it('refuses every write once archived, with a status of its own', () =>
    withTestDatabase(async (database) => {
      const dm = seedAccount();
      const { session } = seedSession(database, { dm });

      await archive(session.id, dm);

      // 409 rather than 404: the caller may read this table, and what refuses them is its state
      expect((await archive(session.id, dm)).status).toBe(409);
      expect((await refresh(session.id, dm)).status).toBe(409);
    }));
});

describe('POST /api/sessions/:id/snapshot', () => {
  it('refuses anonymous, non-member and a player, and accepts the DM', () =>
    withTestDatabase(async (database) => {
      const dm = seedAccount();
      const player = seedAccount();
      const ruleset = seedRuleset(database, { owner: dm });
      const { session } = seedSession(database, { dm, from: ruleset });
      seedMember(database, { session, account: player });

      expect((await refresh(session.id, null)).status).toBe(401);
      expect((await refresh(session.id, seedAccount())).status).toBe(404);
      expect((await refresh(session.id, player)).status).toBe(404);
      expect((await refresh(session.id, dm)).status).toBe(200);
    }));

  it('pulls the ruleset’s current state in, and stamps when', () =>
    withTestDatabase(async (database) => {
      const dm = seedAccount();
      const ruleset = seedRuleset(database, { owner: dm });
      const { session } = seedSession(database, { dm, from: ruleset });

      const renamed = realConfiguration();
      renamed.stats[0].name = 'Vigour';
      updateRulesetData(
        ruleset.id,
        ruleset.revision,
        serializeConfiguration(renamed),
        Date.now(),
        database
      );

      const response = await refresh(session.id, dm);

      expect(response.status).toBe(200);
      expect(response.body.snapshot.stats[0].name).toBe('Vigour');
      expect(response.body.snapshotTakenAt).toBeGreaterThan(session.snapshotTakenAt);
    }));

  it('writes an Event saying the rules moved', () =>
    withTestDatabase(async (database) => {
      const dm = seedAccount();
      const ruleset = seedRuleset(database, { owner: dm });
      const { session } = seedSession(database, { dm, from: ruleset });

      await refresh(session.id, dm);

      const events = eventsSince(session.id, 0, database);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('session.snapshot_refreshed');
      expect(events[0].actorAccountId).toBe(dm.id);
    }));

  it('leaves the Snapshot’s own id alone, so no character is orphaned (the GAM-01 review)', () =>
    withTestDatabase(async (database) => {
      // **The bug this pins was invisible to `snapshotConflicts` by construction.** A character says
      // which rules it was built against with `configurationId`, and `useCharacterSheet` renders
      // *configuration-mismatch* when that disagrees with the loaded document — so a refresh that
      // minted a fresh document id would blank every sheet at the table while the conflict check
      // reported everything fine. `validateStatAllocation` is about allocations; a document's id is
      // not one, so no amount of checking allocations could ever have caught it.
      const dm = seedAccount();
      const ruleset = seedRuleset(database, { owner: dm });
      const { session } = seedSession(database, { dm, from: ruleset });

      const before = (await read(session.id, dm)).body.snapshot.id;

      const renamed = realConfiguration();
      renamed.stats[0].name = 'Vigour';
      updateRulesetData(
        ruleset.id,
        ruleset.revision,
        serializeConfiguration(renamed),
        Date.now(),
        database
      );

      const refreshed = await refresh(session.id, dm);

      expect(refreshed.body.snapshot.id).toBe(before);
      // …and the rules really did move, so this is not passing by having refreshed nothing
      expect(refreshed.body.snapshot.stats[0].name).toBe('Vigour');
    }));

  describe('the refusal that is the ticket’s real content (v3 Req 37.6)', () => {
    /** A table whose one character has spent points in a stat the ruleset is about to lose */
    function tableWithAnInvestedCharacter(database: Parameters<typeof seedRuleset>[0]) {
      const dm = seedAccount();
      const ruleset = seedRuleset(database, { owner: dm });
      const { session } = seedSession(database, { dm, from: ruleset });

      const stat = firstInvestableStat(realConfiguration());
      seedCharacter(database, {
        session,
        owner: dm,
        name: 'Quackers',
        data: JSON.stringify(playerState({ investedStatPoints: { [stat.id]: 2 } })),
      });

      return { dm, ruleset, session, stat };
    }

    it('refuses a refresh that removes a stat a character invested in, naming both', () =>
      withTestDatabase(async (database) => {
        const { dm, ruleset, session, stat } = tableWithAnInvestedCharacter(database);

        const without = realConfiguration();
        without.stats = without.stats.filter((candidate) => candidate.id !== stat.id);
        updateRulesetData(
          ruleset.id,
          ruleset.revision,
          serializeConfiguration(without),
          Date.now(),
          database
        );

        const response = await refresh(session.id, dm);
        const conflicts = conflictsOf(response.body);

        expect(response.status).toBe(409);
        expect(conflicts).toHaveLength(1);
        // The character by name, and the stat by the name it had in the Snapshot being replaced —
        // it has none in the new one, which is the whole problem
        expect(conflicts[0].characterName).toBe('Quackers');
        expect(conflicts[0].reason).toContain(stat.name);
      }));

    it('changes nothing when it refuses', () =>
      withTestDatabase(async (database) => {
        const { dm, ruleset, session, stat } = tableWithAnInvestedCharacter(database);
        const pinnedBefore = findGameSession(session.id, database)?.snapshot;

        const without = realConfiguration();
        without.stats = without.stats.filter((candidate) => candidate.id !== stat.id);
        updateRulesetData(
          ruleset.id,
          ruleset.revision,
          serializeConfiguration(without),
          Date.now(),
          database
        );

        await refresh(session.id, dm);

        expect(findGameSession(session.id, database)?.snapshot).toBe(pinnedBefore);
        // …and no Event claims something happened
        expect(eventsSince(session.id, 0, database)).toEqual([]);
      }));

    it('reports every character that would break, not the first', () =>
      withTestDatabase(async (database) => {
        const { dm, ruleset, session, stat } = tableWithAnInvestedCharacter(database);
        // **Two points, not five, since TICKET-RES-05.** A conflict is now a comparison — a
        // character the *current* Snapshot already refuses cannot block a refresh it did not cause
        // — so a second character has to be affordable today for "would break" to mean anything
        // about them. Five is over the corpus's level-1 pool, which made this the wrong fixture for
        // its own claim the moment the check learned to tell the two states apart.
        seedCharacter(database, {
          session,
          owner: dm,
          name: 'Waddles',
          data: JSON.stringify(
            playerState({ id: 'character-2', investedStatPoints: { [stat.id]: 2 } })
          ),
        });

        const without = realConfiguration();
        without.stats = without.stats.filter((candidate) => candidate.id !== stat.id);
        updateRulesetData(
          ruleset.id,
          ruleset.revision,
          serializeConfiguration(without),
          Date.now(),
          database
        );

        const conflicts = conflictsOf((await refresh(session.id, dm)).body);

        expect(conflicts.map((conflict) => conflict.characterName).sort()).toEqual([
          'Quackers',
          'Waddles',
        ]);
      }));

    it('allows a refresh that leaves everybody valid', () =>
      withTestDatabase(async (database) => {
        const { dm, ruleset, session } = tableWithAnInvestedCharacter(database);

        const renamed = realConfiguration();
        renamed.stats[0].description = 'Retuned on Thursday';
        updateRulesetData(
          ruleset.id,
          ruleset.revision,
          serializeConfiguration(renamed),
          Date.now(),
          database
        );

        expect((await refresh(session.id, dm)).status).toBe(200);
      }));

    /**
     * A conflict is *broken by the refresh*, not *broken* (TICKET-RES-05)
     *
     * The two cases the widened pool made reachable. Before RES-05 an over-budget character at a
     * table was hard to arrive at; now every character carrying skill investment beyond the pool is
     * one, and so is anybody a DM's `removeExperience` drops a level.
     */
    describe('an allocation the pool cannot cover', () => {
      /** The corpus with a smaller pool per level, which is what makes a valid spend unaffordable */
      function withPointsPerLevel(value: number) {
        const retuned = realConfiguration();
        const declared = retuned.constants ?? [];

        retuned.constants = declared.map((constant) =>
          constant.name === 'points_per_level' ? { ...constant, value } : constant
        );

        return retuned;
      }

      it('names the overspend when the refresh makes an affordable spend unaffordable', () =>
        withTestDatabase(async (database) => {
          const { dm, ruleset, session } = tableWithAnInvestedCharacter(database);

          // Quackers' two points are affordable at the corpus's pool and are not at a pool of one.
          // The stat still exists, so `unknownStatIds` and both violation lists are empty and this
          // is the arm that used to render "…refuse: " with nothing after the colon.
          const tighter = withPointsPerLevel(1);
          updateRulesetData(
            ruleset.id,
            ruleset.revision,
            serializeConfiguration(tighter),
            Date.now(),
            database
          );

          const response = await refresh(session.id, dm);
          const conflicts = conflictsOf(response.body);

          expect(response.status).toBe(409);
          expect(conflicts).toHaveLength(1);
          expect(conflicts[0].characterName).toBe('Quackers');
          expect(conflicts[0].reason).toContain('1 point more than the refreshed rules grant');
          // The defect this case exists for: a reason that stops at its own punctuation
          expect(conflicts[0].reason.trim()).not.toMatch(/[:,]$/);
        }));

      it('does not block on a character the pinned rules already refuse', () =>
        withTestDatabase(async (database) => {
          const dm = seedAccount();
          const ruleset = seedRuleset(database, { owner: dm });
          const { session } = seedSession(database, { dm, from: ruleset });
          const stat = firstInvestableStat(realConfiguration());

          // Over budget against the Snapshot the table is already playing on — the state RES-05
          // makes ordinary. Refusing on their account would freeze this table against *every*
          // candidate, including one byte-identical to what is pinned, and including the refresh
          // that would fix them.
          seedCharacter(database, {
            session,
            owner: dm,
            name: 'Overspent',
            data: JSON.stringify(playerState({ investedStatPoints: { [stat.id]: 40 } })),
          });

          const retuned = realConfiguration();
          retuned.stats[0].description = 'Retuned on Thursday';
          updateRulesetData(
            ruleset.id,
            ruleset.revision,
            serializeConfiguration(retuned),
            Date.now(),
            database
          );

          expect((await refresh(session.id, dm)).status).toBe(200);
        }));
    });

    it('refuses rather than guessing when a character cannot be read at all', () =>
      withTestDatabase(async (database) => {
        const dm = seedAccount();
        const ruleset = seedRuleset(database, { owner: dm });
        const { session } = seedSession(database, { dm, from: ruleset });
        // **Said explicitly since TICKET-CHAR-04.** This used to lean on the harness's default,
        // which was `'{}'` while nothing had decided what a session character's player state is;
        // that ticket decided, so the default is now a readable character and a test about the
        // unreadable case has to write one. Refreshing while unable to tell whether somebody breaks
        // is what this route exists to prevent.
        seedCharacter(database, { session, owner: dm, name: 'Unreadable', data: '{}' });

        const response = await refresh(session.id, dm);

        expect(response.status).toBe(409);
        expect(conflictsOf(response.body)[0].reason).toContain('cannot read');
      }));

    it('answers an unparseable character row with the same conflict, not a 500', () =>
      withTestDatabase(async (database) => {
        const dm = seedAccount();
        const ruleset = seedRuleset(database, { owner: dm });
        const { session } = seedSession(database, { dm, from: ruleset });
        // `data` is a TEXT column and nothing in the database enforces that it holds JSON. A
        // `SyntaxError` out of the handler would answer a DM's refresh with a 500 that says nothing.
        seedCharacter(database, { session, owner: dm, name: 'Corrupt', data: 'not json at all' });

        const response = await refresh(session.id, dm);

        expect(response.status).toBe(409);
        expect(conflictsOf(response.body)[0].characterName).toBe('Corrupt');
      }));

    it('records nothing in the log when it refuses', () =>
      withTestDatabase(async (database) => {
        const { dm, ruleset, session, stat } = tableWithAnInvestedCharacter(database);

        const without = realConfiguration();
        without.stats = without.stats.filter((candidate) => candidate.id !== stat.id);
        updateRulesetData(
          ruleset.id,
          ruleset.revision,
          serializeConfiguration(without),
          Date.now(),
          database
        );

        await refresh(session.id, dm);

        // The pin and the Event are one transaction, so there is no half of this to be left behind
        expect(eventsSince(session.id, 0, database)).toEqual([]);
      }));
  });

  it('refuses once the ruleset it came from has been deleted', () =>
    withTestDatabase(async (database) => {
      const dm = seedAccount();
      const ruleset = seedRuleset(database, { owner: dm });
      const { session } = seedSession(database, { dm, from: ruleset });

      // `ON DELETE SET NULL` — the game keeps playing on its Snapshot, and there is nothing left to
      // refresh *from*
      database.sqlite.prepare('DELETE FROM ruleset WHERE id = ?').run(ruleset.id);

      const response = await refresh(session.id, dm);

      expect(response.status).toBe(409);
      expect((await read(session.id, dm)).status).toBe(200);
    }));

  it('refuses a DM who no longer owns the ruleset', () =>
    withTestDatabase(async (database) => {
      const owner = seedAccount();
      const dm = seedAccount();
      // GAM-04 transfers the DM role, so the two can come apart. Pulling somebody else's current
      // ruleset into your table is not something running the table earns.
      const ruleset = seedRuleset(database, { owner });
      const { session } = seedSession(database, { dm, from: ruleset });

      expect((await refresh(session.id, dm)).status).toBe(404);
    }));
});
