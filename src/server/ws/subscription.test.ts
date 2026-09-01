/**
 * What a client may say, and what happens when it says something else (TICKET-LIVE-01)
 *
 * Two claims, both of which have to be true before a socket is safe to leave running:
 *
 * - **Admission is `requireMember`'s answer and nobody else's**, and a refusal says nothing about
 *   whether the session exists (v3 Req 32.5).
 * - **Nothing a client sends can write** (D8). The last test in this file sends the socket a real
 *   player action and asserts the `character` table is byte-identical afterwards.
 *
 * Driven against a real migrated database, because both claims are about what the database says —
 * a mocked `requireMember` would be asserting our own assumptions back at us, and a mocked
 * repository could not tell *no such session* from *not a Member* at all.
 *
 * **Validates: v3 Req 32.3, 32.5, 44.2, 44.4**
 */

import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import {
  CLIENT_MESSAGE_TYPE,
  DM_ACTION,
  MEMBER_ROLE,
  PLAYER_ACTION,
  SERVER_MESSAGE_TYPE,
  type ServerSocketMessage,
} from '#shared/types';
import { removeSessionMember } from '../repositories/gameSessionRepository';
import {
  allCharacters,
  type CharacterRow,
  type Database,
  seedAccount,
  seedCharacter,
  seedMember,
  seedSession,
  withTestDatabase,
} from '../testing';
import { createSocketRooms, type LiveConnection, type SocketRooms } from './rooms';
import { handleClientMessage } from './subscription';

/** A connection that remembers what it was told */
interface FakeConnection extends LiveConnection {
  readonly sent: string[];
}

function fakeConnection(accountId: string): FakeConnection {
  const sent: string[] = [];

  return {
    accountId,
    sent,
    send: (payload) => {
      sent.push(payload);
    },
    close: () => undefined,
  };
}

/** What a connection was told, parsed back */
function heard(connection: FakeConnection): ServerSocketMessage[] {
  return connection.sent.map((frame) => JSON.parse(frame) as ServerSocketMessage);
}

/** Stands in for the id a refusal echoes back, so two refusals about different ids can be compared */
const ECHOED = 'the id the caller supplied';

/**
 * What a connection was told, with the one field a refusal is allowed to differ in flattened
 *
 * @param connection Whose replies to read
 * @returns The replies, every `sessionId` replaced by {@link ECHOED}
 */
function withoutTheEchoedId(connection: FakeConnection): ServerSocketMessage[] {
  const replies = heard(connection);
  return replies.map((message) => ({ ...message, sessionId: ECHOED }));
}

/** Send one frame, the way the socket's `message` listener does */
function send(connection: LiveConnection, message: unknown, rooms: SocketRooms): void {
  const frame = JSON.stringify(message);
  handleClientMessage(connection, frame, rooms);
}

/**
 * `guards.ts` logs every refusal and this file provokes several
 *
 * Silenced so the run stays readable, and kept as a spy rather than a stub because *the reason is
 * logged server-side where a client cannot see it* is half of v3 Req 32.5 — the half that would
 * otherwise be untested.
 */
let warn: MockInstance<typeof console.warn>;

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  warn.mockRestore();
});

describe('subscribe', () => {
  it('should admit a Member to their own session’s room', () =>
    withTestDatabase((database) => {
      const player = seedAccount();
      const { session } = seedSession(database);
      seedMember(database, { session, account: player, role: MEMBER_ROLE.PLAYER });

      const rooms = createSocketRooms();
      const connection = fakeConnection(player.id);

      send(connection, { type: CLIENT_MESSAGE_TYPE.SUBSCRIBE, sessionId: session.id }, rooms);

      const replies = heard(connection);
      const joined = rooms.roomCount();

      expect(replies).toEqual([{ type: SERVER_MESSAGE_TYPE.SUBSCRIBED, sessionId: session.id }]);
      expect(joined).toBe(1);
    }));

  it('should admit the DM, who is a Member like any other', () =>
    withTestDatabase((database) => {
      const dm = seedAccount();
      const { session } = seedSession(database, { dm });

      const rooms = createSocketRooms();
      const connection = fakeConnection(dm.id);

      send(connection, { type: CLIENT_MESSAGE_TYPE.SUBSCRIBE, sessionId: session.id }, rooms);

      const replies = heard(connection);

      expect(replies).toEqual([{ type: SERVER_MESSAGE_TYPE.SUBSCRIBED, sessionId: session.id }]);
    }));

  it('should refuse a non-member and join no room', () =>
    withTestDatabase((database) => {
      const stranger = seedAccount();
      const { session } = seedSession(database);

      const rooms = createSocketRooms();
      const connection = fakeConnection(stranger.id);

      send(connection, { type: CLIENT_MESSAGE_TYPE.SUBSCRIBE, sessionId: session.id }, rooms);

      const replies = heard(connection);
      const joined = rooms.roomCount();

      expect(replies).toEqual([
        { type: SERVER_MESSAGE_TYPE.SUBSCRIBE_REFUSED, sessionId: session.id },
      ]);
      expect(joined).toBe(0);
    }));

  it('should refuse a non-member and a session that does not exist identically', () =>
    withTestDatabase((database) => {
      // **Asserted equal to each other rather than each against a literal**, deliberately: two
      // separate assertions can drift apart while both stay green, and the property under test is
      // that the two refusals are *indistinguishable* (v3 Req 32.5). The only field allowed to
      // differ is the `sessionId` echoed back — which the caller supplied and therefore already
      // knows — so that one is normalised away and everything else, keys included, must match. A
      // `reason` added to one branch and not the other would fail here.
      const stranger = seedAccount();
      const { session } = seedSession(database);

      const rooms = createSocketRooms();

      const toRealSession = fakeConnection(stranger.id);
      send(toRealSession, { type: CLIENT_MESSAGE_TYPE.SUBSCRIBE, sessionId: session.id }, rooms);

      const toNoSession = fakeConnection(stranger.id);
      send(
        toNoSession,
        { type: CLIENT_MESSAGE_TYPE.SUBSCRIBE, sessionId: 'no-such-session' },
        rooms
      );

      const refusedReal = withoutTheEchoedId(toRealSession);
      const refusedMissing = withoutTheEchoedId(toNoSession);

      expect(refusedReal).toEqual(refusedMissing);
      expect(refusedReal).toEqual([
        { type: SERVER_MESSAGE_TYPE.SUBSCRIBE_REFUSED, sessionId: ECHOED },
      ]);
    }));

  it('should log the reason a subscribe was refused, where only an operator can read it', () =>
    withTestDatabase((database) => {
      const stranger = seedAccount();
      const { session } = seedSession(database);

      const rooms = createSocketRooms();
      const connection = fakeConnection(stranger.id);

      send(connection, { type: CLIENT_MESSAGE_TYPE.SUBSCRIBE, sessionId: session.id }, rooms);

      const logged = warn.mock.calls.flat().join(' ');
      const toldTheClient = connection.sent.join(' ');

      expect(logged).toContain('is not a member of session');
      expect(toldTheClient).not.toContain('not a member');
    }));

  it('should refuse a Member whose seat has been taken away', () =>
    withTestDatabase((database) => {
      const player = seedAccount();
      const { session } = seedSession(database);
      seedMember(database, { session, account: player, role: MEMBER_ROLE.PLAYER });

      const rooms = createSocketRooms();
      const connection = fakeConnection(player.id);

      send(connection, { type: CLIENT_MESSAGE_TYPE.SUBSCRIBE, sessionId: session.id }, rooms);

      removeSessionMember(session.id, player.id, database);

      const second = fakeConnection(player.id);
      send(second, { type: CLIENT_MESSAGE_TYPE.SUBSCRIBE, sessionId: session.id }, rooms);

      const replies = heard(second);

      expect(replies).toEqual([
        { type: SERVER_MESSAGE_TYPE.SUBSCRIBE_REFUSED, sessionId: session.id },
      ]);
    }));
});

describe('unsubscribe', () => {
  it('should take the connection out of that room and no other', () =>
    withTestDatabase((database) => {
      const player = seedAccount();
      const first = seedSession(database);
      const second = seedSession(database);
      seedMember(database, { session: first.session, account: player });
      seedMember(database, { session: second.session, account: player });

      const rooms = createSocketRooms();
      const connection = fakeConnection(player.id);

      send(connection, { type: CLIENT_MESSAGE_TYPE.SUBSCRIBE, sessionId: first.session.id }, rooms);
      send(
        connection,
        { type: CLIENT_MESSAGE_TYPE.SUBSCRIBE, sessionId: second.session.id },
        rooms
      );
      send(
        connection,
        { type: CLIENT_MESSAGE_TYPE.UNSUBSCRIBE, sessionId: first.session.id },
        rooms
      );

      const remaining = rooms.roomCount();

      expect(remaining).toBe(1);
    }));

  it('should say nothing back, because leaving is never refused', () =>
    withTestDatabase((database) => {
      const stranger = seedAccount();
      const { session } = seedSession(database);

      const rooms = createSocketRooms();
      const connection = fakeConnection(stranger.id);

      send(connection, { type: CLIENT_MESSAGE_TYPE.UNSUBSCRIBE, sessionId: session.id }, rooms);

      const replies = heard(connection);

      expect(replies).toEqual([]);
    }));
});

describe('anything else', () => {
  /** A member, their table, and one character on it — the arrangement a write would show up in */
  function seatedAtATable(database: Database): {
    connection: FakeConnection;
    rooms: SocketRooms;
    before: CharacterRow[];
  } {
    const player = seedAccount();
    const { session } = seedSession(database);
    seedMember(database, { session, account: player, role: MEMBER_ROLE.PLAYER });
    seedCharacter(database, { session, owner: player });

    return {
      connection: fakeConnection(player.id),
      rooms: createSocketRooms(),
      before: allCharacters(database),
    };
  }

  it('should ignore a state-changing message and change nothing in the database', () =>
    withTestDatabase((database) => {
      // **Criterion 4, and D8's whole reason.** This is a real player action, spelled the way
      // `POST /api/characters/:id/adjust-resource` spells it, sent by an Account that genuinely
      // could perform it over HTTP. The socket accepts two verbs and this is not one of them, so
      // it never reaches a repository — and the proof is the table, not the reply.
      const { connection, rooms, before } = seatedAtATable(database);
      const target = before[0] as CharacterRow;

      send(
        connection,
        {
          // The **constant** the route table and the Event log use, not a copy of its value — which
          // is what makes "spelled the way the route spells it" true rather than coincidental, and
          // what keeps this test meaningful if the action is ever renamed
          type: PLAYER_ACTION.ADJUST_RESOURCE,
          sessionId: target.sessionId,
          characterId: target.id,
          resourceId: 'health',
          delta: -999,
        },
        rooms
      );

      const after = allCharacters(database);
      const replies = heard(connection);

      expect(after).toEqual(before);
      expect(replies).toEqual([]);
    }));

  it('should log the verb somebody tried, and nothing else of the frame', () =>
    withTestDatabase((database) => {
      const { connection, rooms } = seatedAtATable(database);

      send(
        connection,
        { type: DM_ACTION.AWARD_EXPERIENCE, sessionId: 'x', secret: 'do-not-log-me' },
        rooms
      );

      const logged = warn.mock.calls.flat().join(' ');

      expect(logged).toContain(DM_ACTION.AWARD_EXPERIENCE);
      expect(logged).not.toContain('do-not-log-me');
    }));

  it('should refuse an over-long session id without putting it in the log', () =>
    withTestDatabase((database) => {
      // **The log-flooding path, and why this rejects rather than truncates.** `requireMember`
      // refuses an unknown id by *logging it*, so without this an authenticated Member could write
      // as much chosen text into the operator's log as a frame will carry. Truncating would cap the
      // volume and still log attacker-chosen bytes; refusing means the id that reaches a log is
      // always one this server was willing to treat as real.
      const { connection, rooms } = seatedAtATable(database);
      const flood = 'A'.repeat(5000);

      send(connection, { type: CLIENT_MESSAGE_TYPE.SUBSCRIBE, sessionId: flood }, rooms);

      const logged = warn.mock.calls.flat().join(' ');
      const joined = rooms.roomCount();
      const replies = heard(connection);

      expect(logged).not.toContain('AAAA');
      expect(logged).toContain('5000 characters');
      expect(joined).toBe(0);
      expect(replies).toEqual([]);
    }));

  it('should accept a session id of the length the server actually mints', () =>
    withTestDatabase((database) => {
      // The cap has to admit a real id, and a real id is `crypto.randomUUID()`. Asserted by
      // subscribing with one rather than by comparing against the constant, so the test fails if
      // the id scheme and the cap ever disagree.
      const player = seedAccount();
      const realWorldId = crypto.randomUUID();
      const { session } = seedSession(database, { id: realWorldId });
      seedMember(database, { session, account: player, role: MEMBER_ROLE.PLAYER });

      const rooms = createSocketRooms();
      const connection = fakeConnection(player.id);

      send(connection, { type: CLIENT_MESSAGE_TYPE.SUBSCRIBE, sessionId: realWorldId }, rooms);

      const replies = heard(connection);

      expect(replies).toEqual([{ type: SERVER_MESSAGE_TYPE.SUBSCRIBED, sessionId: realWorldId }]);
    }));

  it('should ignore a frame that is not JSON at all', () =>
    withTestDatabase((database) => {
      const { connection, rooms, before } = seatedAtATable(database);

      handleClientMessage(connection, 'not json {{{', rooms);

      const after = allCharacters(database);
      const logged = warn.mock.calls.flat().join(' ');

      expect(after).toEqual(before);
      expect(logged).toContain('unparseable');
    }));

  it('should ignore a subscribe with no session id', () =>
    withTestDatabase((database) => {
      const { connection, rooms } = seatedAtATable(database);

      send(connection, { type: CLIENT_MESSAGE_TYPE.SUBSCRIBE }, rooms);

      const joined = rooms.roomCount();
      const replies = heard(connection);

      expect(joined).toBe(0);
      expect(replies).toEqual([]);
    }));
});
