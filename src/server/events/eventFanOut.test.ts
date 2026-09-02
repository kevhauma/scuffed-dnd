/**
 * Every Event goes to its table, and nothing can write one without doing so (TICKET-LIVE-02)
 *
 * The ticket's first two criteria, and they are two halves of one property: *an Event that is
 * written is an Event the table is told about*. Review catches a route that forgets on the day it is
 * written and never again — and this milestone has **thirty** modules that write one, so the thing
 * worth proving is structural rather than per-route.
 *
 * ## The tree-walk, and why it is exact rather than an allow-list
 *
 * `recordEvent` **injects** the appender instead of importing one at each writer, so after
 * TICKET-LIVE-02 the two append functions have precisely one call site in `src/server/`. That makes
 * the first check an equality — *these files, no others* — where an allow-list of modules permitted
 * to append would have been a list a future ticket adds a line to without anybody noticing what the
 * line costs.
 *
 * **Test files are out of the corpus, deliberately.** A test that appends is arranging a fixture,
 * not performing an action nobody was told about, and `eventRepository.test.ts` has to call the
 * thing it is testing.
 *
 * ## The counts, so this cannot go green by finding nothing
 *
 * `dmRules.test.ts`'s rule, applied one directory up: the number of route modules that reach the
 * log is asserted against the number of named actions plus the two writers that are not sheet
 * actions. A ticket that adds an action changes that number and **fails this file**, which is the
 * point — it is a question asked of the author, not a wall.
 *
 * ## …and then the real thing, over real rooms
 *
 * The scans say every writer *reaches* the fan-out; the behavioural half says the fan-out works,
 * against the **real** `createSocketRooms()` with two sessions, two rooms and two connections. That
 * is criterion 6 (*an Event for session A never reaches a client subscribed only to session B*) with
 * nothing faked between the route and the socket but the socket itself.
 *
 * **Validates: v3 Req 44.3, 44.4, 44.5**
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { buildCharacter } from '#shared/services/characterCreation';
import type { CharacterDocument, GameSessionDocument, SessionRoll } from '#shared/types/api';
import { DM_ACTION, PLAYER_ACTION, ROLL_EVENT, SESSION_EVENT } from '#shared/types/api';
import type { Configuration } from '#shared/types/config';
import type { LiveEventMessage } from '#shared/types/liveSocket';
import { SERVER_MESSAGE_TYPE } from '#shared/types/liveSocket';
import { dmAwardExperience } from '../routes/dm/dmAwardExperience';
import { setFocusSkills } from '../routes/play/setFocusSkills';
import { rollDiceHandler } from '../routes/rolls/rollDice';
import { refreshSnapshot } from '../routes/sessions/refreshSnapshot';
import { removeMember } from '../routes/sessions/removeMember';
import { snapshotOf } from '../routes/sessions/sessionPayloads';
import {
  type CallOptions,
  callRoute,
  type Database,
  seedAccount,
  seedCharacter,
  seedMember,
  seedRuleset,
  seedSession,
  withTestDatabase,
} from '../testing';
import { createSocketRooms, type LiveConnection, setLiveRooms } from '../ws/rooms';

const SERVER_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Where the routes live */
const ROUTES_ROOT = join(SERVER_ROOT, 'routes');

/** How a module answers requests */
const HANDLER_MARKER = 'defineHandler(';

/**
 * How a row actually gets into `event` — the **write**, not the name of a function that performs it
 *
 * Drizzle spells an insert `.insert(<table>)`, so this catches any statement against the `event`
 * table wherever it is written. That matters more than the call-site spelling: the two append
 * functions could be renamed, aliased at an import, or *joined by a third* — and a third is the
 * live risk rather than a hypothetical, because TICKET-DM-04's membership Events want exactly an
 * `appendMembershipEvent` beside them. A name-based scan would miss that: it would live in
 * `eventRepository.ts` (excluded below, since that is where the writes are *defined*) and its
 * callers would match no marker.
 */
const EVENT_INSERT_MARKER = '.insert(event)';

/** The call-site spellings, checked *as well*, so an import that never inserts is still caught */
const APPEND_MARKERS = ['appendEvent(', 'appendEventWithin('];

/** …and where the writes are *defined*, which is not a call site anybody is being asked about */
const EVENT_REPOSITORY = '/repositories/eventRepository.ts';

/**
 * Everything `eventRepository.ts` lets another module use to write the log
 *
 * The other half of the guard, and the half that survives the `eventRepository.ts` exclusion above:
 * whatever is *inside* that file, only these two can be reached from outside it, and only
 * `recordEvent.ts` may reach them. A third append exported from there fails this assertion by
 * name — which is the point, since that is the shape the next ticket wants.
 */
const APPEND_EXPORTS = ['appendEvent', 'appendEventWithin'];

/** How a route reaches the fan-out — directly, or through the pipeline every sheet action shares */
const FAN_OUT_MARKERS = ['recordEvent(', 'applyPlayerAction('];

/**
 * Every writer that is **not** one of the named sheet actions, each said out loud (TICKET-LIVE-04)
 *
 * The count below used to read `sheetActions + 2` with two `toContain`s under it, which was fine
 * while the two were the roll and the Snapshot refresh and stopped being fine the moment four
 * membership routes arrived: *bump the number by four* is a change a reviewer cannot check, because
 * the number says nothing about where it came from.
 *
 * **So the arithmetic is re-derived from this list rather than adjusted.** A fifth non-sheet writer
 * fails the length assertion *and* is absent from the list, and the only way to make it pass is to
 * name it here — which is the question this file exists to ask its author: *does everything that
 * changes a table tell the table?*
 *
 * The membership four are TICKET-LIVE-04's, and they are four routes rather than four Event types:
 * seating has two paths (a shared code and an addressed invitation) that write the same
 * `member_joined`, and `removeMember` writes `member_removed` or `member_left` depending on who
 * asked.
 */
const NON_SHEET_WRITERS = [
  '/routes/invitations/acceptInvitation.ts',
  '/routes/invites/redeemInvite.ts',
  '/routes/rolls/rollDice.ts',
  '/routes/sessions/refreshSnapshot.ts',
  '/routes/sessions/removeMember.ts',
  '/routes/sessions/transferDm.ts',
];

/**
 * How an Event frame is built — naming the message type, which is the only way to build one
 *
 * Not `liveEventFrame(`, which is the *call*: a second module spelling the object out by hand would
 * call nothing and match no name, which is precisely the shape this has to catch.
 */
const EVENT_FRAME_MARKER = 'SERVER_MESSAGE_TYPE.EVENT';

/** …and the one module allowed to do it */
const EVENT_FRAME = '/events/liveEventFrame.ts';

/** One module of the server, as text */
interface ServerModule {
  /** Path relative to `src/server`, with forward slashes, so an assertion reads the same anywhere */
  path: string;
  source: string;
}

/**
 * Every production module under a directory
 *
 * Recursive, because `routes/` is eight folders deep in places and a scan that stopped at the top
 * would be the quietly-green kind `routeGuards.test.ts` warns about.
 *
 * @param root Where to start
 * @returns Each module's path and text
 */
function modulesUnder(root: string): ServerModule[] {
  const found: ServerModule[] = [];
  const entries = readdirSync(root);

  for (const entry of entries) {
    const full = join(root, entry);
    const stats = statSync(full);

    if (stats.isDirectory()) {
      const nested = modulesUnder(full);
      found.push(...nested);
      continue;
    }

    if (!entry.endsWith('.ts') || entry.endsWith('.test.ts')) continue;

    const source = readFileSync(full, 'utf8');
    const relative = full.slice(SERVER_ROOT.length).replaceAll('\\', '/');

    found.push({ path: relative, source });
  }

  return found;
}

/** Modules containing any of these spellings */
function containing(modules: ServerModule[], markers: string[]): string[] {
  const matched = modules.filter(({ source }) => markers.some((marker) => source.includes(marker)));

  return matched.map(({ path }) => path).sort();
}

describe('the Event log has one writer', () => {
  it('writes to the event table from exactly one place in the whole server', () => {
    const modules = modulesUnder(SERVER_ROOT);
    const writes = containing(modules, [EVENT_INSERT_MARKER]);

    // The **statement**, not a function name: this is every module in `src/server/` that can put a
    // row in `event` at all, and there is one. A rename, an aliased import or a *third* append
    // function all still have to write the row, and they would show up here.
    expect(writes).toEqual([EVENT_REPOSITORY]);
  });

  it('appends from exactly one place outside the repository that defines the writes', () => {
    const modules = modulesUnder(SERVER_ROOT);
    const definitions = modules.filter(({ path }) => path !== EVENT_REPOSITORY);
    const callers = containing(definitions, APPEND_MARKERS);

    // Not an allow-list: this is *every* module that calls one, and there is one. A writer added
    // anywhere else fails here rather than shipping a change nobody is told about.
    expect(callers).toEqual(['/events/recordEvent.ts']);
  });

  it('offers exactly two ways in, both of which the recorder takes', () => {
    // The assertion the exclusion above cannot make. Whatever `eventRepository.ts` holds
    // internally, this is what another module can reach — so a third append **exported** from it,
    // which is the shape TICKET-DM-04's membership Events want, fails here by name rather than
    // slipping through a scan aimed at call sites.
    const modules = modulesUnder(SERVER_ROOT);
    const repository = modules.find(({ path }) => path === EVENT_REPOSITORY);
    const recorder = modules.find(({ path }) => path === '/events/recordEvent.ts');

    const exported = [...(repository?.source ?? '').matchAll(/export function (\w+)/g)];
    const appends = exported
      .map((match) => match[1])
      .filter((name) => name.toLowerCase().includes('append'))
      .sort();

    expect(appends).toEqual(APPEND_EXPORTS);

    for (const append of APPEND_EXPORTS) {
      expect(recorder?.source).toContain(`${append}(`);
    }
  });

  it('publishes from the same module that appends', () => {
    const modules = modulesUnder(SERVER_ROOT);
    const recorder = modules.find(({ path }) => path === '/events/recordEvent.ts');

    expect(recorder?.source).toContain('rooms.broadcast(');
  });

  it('composes an Event frame in exactly one module (TICKET-LIVE-03)', () => {
    // **The claim `rooms.ts` used to make in prose, made checkable.** LIVE-02's docblock said that
    // nothing but `recordEvent` may send a frame, which was the right instinct stated too widely and
    // never enforced — and LIVE-03 needed a second *sender*, because a reconnecting client is
    // replayed rows out of the log. What is actually load-bearing is narrower: an `event` frame is a
    // claim about the table, so there must be exactly one place that can build one. Both the
    // broadcast and the replay go through it.
    //
    // Verified by mutation while it was written: spelling the frame a second time in `ws/replay.ts`
    // fails this, and so does moving the projection back into `recordEvent.ts`.
    const modules = modulesUnder(SERVER_ROOT);
    const composers = containing(modules, [EVENT_FRAME_MARKER]);

    expect(composers).toEqual([EVENT_FRAME]);
  });

  it('sends that one projection from both the broadcast and the replay', () => {
    // The other half: one composer is only worth having if everybody uses it. A module that sent
    // Events some other way would pass the assertion above by not naming the type at all.
    const modules = modulesUnder(SERVER_ROOT);
    const senders = containing(modules, ['liveEventFrame(']);

    expect(senders).toEqual([EVENT_FRAME, '/events/recordEvent.ts', '/ws/replay.ts']);
  });
});

describe('the routes that write an Event', () => {
  it('all reach the fan-out, and there are as many as there are actions', () => {
    const routes = modulesUnder(ROUTES_ROOT);
    const handlers = routes.filter(({ source }) => source.includes(HANDLER_MARKER));
    const writers = containing(handlers, FAN_OUT_MARKERS);

    // Every `PLAYER_ACTION` and every `DM_ACTION` is one module, plus the writers that are not sheet
    // actions — each named in {@link NON_SHEET_WRITERS}. A ticket that adds an action makes this
    // number wrong, which is the question being asked.
    const playerActions = Object.values(PLAYER_ACTION);
    const dmActions = Object.values(DM_ACTION);
    const sheetActions = playerActions.length + dmActions.length;

    expect(writers).toHaveLength(sheetActions + NON_SHEET_WRITERS.length);

    for (const writer of NON_SHEET_WRITERS) {
      expect(writers).toContain(writer);
    }
  });

  it('shares one pipeline for the sheet actions, and that pipeline records', () => {
    const routes = modulesUnder(ROUTES_ROOT);
    const pipeline = routes.find(({ path }) => path === '/routes/play/playPayloads.ts');

    expect(pipeline?.source).toContain('recordEvent(');
  });
});

/** One frame, as a fake connection received it */
interface FakeConnection extends LiveConnection {
  readonly frames: LiveEventMessage[];
}

/**
 * A connection that keeps the **Events** it was sent
 *
 * Only the Events: since TICKET-LIVE-03 a room also tells its members who is in it, and joining one
 * of these fakes to a room produces such a frame before any action has been performed. Keeping them
 * here would make every *sends exactly one frame* case below count the arrangement.
 */
function fakeConnection(accountId: string): FakeConnection {
  const frames: LiveEventMessage[] = [];

  return {
    accountId,
    frames,
    send: (payload) => {
      const message = JSON.parse(payload) as LiveEventMessage;

      if (message.type !== SERVER_MESSAGE_TYPE.EVENT) return;

      frames.push(message);
    },
    close: () => undefined,
  };
}

/** A table, its DM, a player, and a character the player owns */
function aTable(database: Database, name: string) {
  const dm = seedAccount();
  const player = seedAccount();
  const ruleset = seedRuleset(database, { owner: dm });
  const session = seedSession(database, { dm, from: ruleset }).session;
  seedMember(database, { session, account: player });

  const rules = snapshotOf(session);
  const character = characterFor(rules, `${name}-character`);

  const row = seedCharacter(database, {
    id: character.id,
    session,
    owner: player,
    name: character.name,
    data: JSON.stringify(character),
  });

  return { dm, player, ruleset, session, rules, row };
}

/** A character built by the Kernel against a table's own Snapshot */
function characterFor(rules: Configuration, id: string) {
  const raceIds = rules.races[0] ? [rules.races[0].id] : [];

  return buildCharacter(
    { name: 'Quackers', raceIds, investedStatPoints: {}, investedSkillPoints: {} },
    rules,
    { id, now: new Date(0).toISOString() }
  );
}

/** Perform one named action on a character */
function act(
  route: Parameters<typeof callRoute>[0],
  path: string,
  body: unknown,
  as: CallOptions['as']
) {
  return callRoute<CharacterDocument>(route, { as, method: 'POST', path, body });
}

describe('one accepted action, one broadcast', () => {
  afterEach(() => {
    setLiveRooms(null);
  });

  /**
   * Two tables, two rooms, one connection listening to each
   *
   * The **real** registry, so what keeps a frame out of the other room is `rooms.ts`'s own map
   * rather than an assertion about an argument.
   */
  function twoTables(database: Database) {
    const rooms = createSocketRooms();
    setLiveRooms(rooms);

    const first = aTable(database, 'first');
    const second = aTable(database, 'second');

    const listeningToFirst = fakeConnection(first.player.id);
    const listeningToSecond = fakeConnection(second.player.id);

    rooms.join(first.session.id, listeningToFirst);
    rooms.join(second.session.id, listeningToSecond);

    return { rooms, first, second, listeningToFirst, listeningToSecond };
  }

  it('sends a Player’s action to that Player’s table and to no other', () =>
    withTestDatabase(async (database) => {
      const { first, listeningToFirst, listeningToSecond } = twoTables(database);
      const path = `/api/characters/${first.row.id}/${PLAYER_ACTION.SET_FOCUS_SKILLS}`;

      const answer = await act(setFocusSkills, path, { focusSkillIds: [] }, first.player);

      expect(answer.status).toBe(200);
      expect(listeningToFirst.frames).toHaveLength(1);
      expect(listeningToFirst.frames[0].event.type).toBe(PLAYER_ACTION.SET_FOCUS_SKILLS);
      expect(listeningToFirst.frames[0].sessionId).toBe(first.session.id);

      // Criterion 6: the other table is a different room, and a room is the whole of what a
      // broadcast can reach
      expect(listeningToSecond.frames).toEqual([]);
    }));

  it('sends a DM’s adjustment, carrying what the value became', () =>
    withTestDatabase(async (database) => {
      const { first, listeningToFirst, listeningToSecond } = twoTables(database);
      const path = `/api/characters/${first.row.id}/${DM_ACTION.AWARD_EXPERIENCE}`;

      const answer = await act(dmAwardExperience, path, { amount: 300 }, first.dm);

      expect(answer.status).toBe(200);
      expect(listeningToFirst.frames).toHaveLength(1);

      const { event } = listeningToFirst.frames[0];
      const payload = event.payload as { after: number; before: number };

      expect(event.type).toBe(DM_ACTION.AWARD_EXPERIENCE);
      expect(event.actorAccountId).toBe(first.dm.id);
      expect(payload.after).toBe(300);
      expect(listeningToSecond.frames).toEqual([]);
    }));

  it('sends a roll, which writes no character at all', () =>
    withTestDatabase(async (database) => {
      const { first, listeningToFirst } = twoTables(database);
      const roll = first.rules.rollDefinitions?.[0];
      expect(roll, 'the corpus should define at least one roll').toBeDefined();

      const handler = rollDiceHandler(() => 0.5);
      const path = `/api/characters/${first.row.id}/roll`;
      const answer = await callRoute<SessionRoll>(handler, {
        as: first.player,
        method: 'POST',
        path,
        body: { rollId: (roll as { id: string }).id },
      });

      expect(answer.status).toBe(200);
      expect(listeningToFirst.frames).toHaveLength(1);
      expect(listeningToFirst.frames[0].event.type).toBe(ROLL_EVENT);
    }));

  it('sends a Snapshot refresh, which is about the table rather than a sheet', () =>
    withTestDatabase(async (database) => {
      const { first, listeningToFirst } = twoTables(database);
      const path = `/api/sessions/${first.session.id}/snapshot`;

      const answer = await callRoute<GameSessionDocument>(refreshSnapshot, {
        as: first.dm,
        method: 'POST',
        path,
        body: {},
      });

      expect(answer.status).toBe(200);
      expect(listeningToFirst.frames).toHaveLength(1);
      expect(listeningToFirst.frames[0].event.type).toBe(SESSION_EVENT.SNAPSHOT_REFRESHED);
    }));

  it('sends a membership change to everybody left at the table (TICKET-LIVE-04)', () =>
    withTestDatabase(async (database) => {
      const { rooms, first, listeningToFirst, listeningToSecond } = twoTables(database);

      // The DM is the one who stays, and their roster is the one this ticket exists for — the
      // removed Member's own connection is evicted a line later and would prove nothing about
      // whether *anybody else* was told
      const listeningAsDm = fakeConnection(first.dm.id);
      rooms.join(first.session.id, listeningAsDm);

      const path = `/api/sessions/${first.session.id}/members/${first.player.id}`;
      const answer = await callRoute(removeMember, { as: first.dm, method: 'DELETE', path });

      expect(answer.status).toBe(204);
      expect(listeningAsDm.frames).toHaveLength(1);
      expect(listeningAsDm.frames[0].event.type).toBe(SESSION_EVENT.MEMBER_REMOVED);
      expect(listeningAsDm.frames[0].sessionId).toBe(first.session.id);

      // The removed Member is told **before** their room is closed, which is the ordering
      // `removeMember` records: they learn why rather than merely that
      expect(listeningToFirst.frames).toHaveLength(1);
      expect(listeningToSecond.frames).toEqual([]);
    }));

  it('sends nothing at all when the action was refused', () =>
    withTestDatabase(async (database) => {
      const { first, listeningToFirst } = twoTables(database);
      const path = `/api/characters/${first.row.id}/${PLAYER_ACTION.SET_FOCUS_SKILLS}`;

      // Four picks where three is the ceiling — refused by the Kernel, so nothing is written and
      // therefore nothing is announced
      const tooMany = { focusSkillIds: ['a', 'b', 'c', 'd'] };
      const answer = await act(setFocusSkills, path, tooMany, first.player);

      expect(answer.status).toBe(400);
      expect(listeningToFirst.frames).toEqual([]);
    }));

  it('numbers the frames by the log’s own seq', () =>
    withTestDatabase(async (database) => {
      const { first, listeningToFirst } = twoTables(database);
      const path = `/api/characters/${first.row.id}/${DM_ACTION.AWARD_EXPERIENCE}`;

      await act(dmAwardExperience, path, { amount: 100 }, first.dm);
      await act(dmAwardExperience, path, { amount: 100 }, first.dm);

      const sequence = listeningToFirst.frames.map((frame) => frame.event.seq);

      expect(sequence).toEqual([1, 2]);
    }));
});
