/**
 * What a reconnecting client is sent (TICKET-LIVE-03)
 *
 * v3 Req 44.6's two halves: **exactly the missed Events, in order, once each**, and **an instruction
 * to read the session again** when the gap is past the window. Driven against a real migrated
 * database, because both answers are the log's rather than this module's — a fake would be asserting
 * our own arithmetic back at us.
 *
 * The **window** is exercised at its edge rather than at a comfortable distance from it: a gap of
 * exactly `REPLAY_WINDOW_EVENTS` replays and one more resynchronises. An off-by-one in either
 * direction is invisible to a test that resumes from zero against three events.
 *
 * **Validates: v3 Req 44.6**
 */

import { describe, expect, it } from 'vitest';
import type { LiveEventMessage, ResyncMessage } from '#shared/types/liveSocket';
import { SERVER_MESSAGE_TYPE, type ServerSocketMessage } from '#shared/types/liveSocket';
import { appendEvent } from '../repositories/eventRepository';
// The connection type comes from the harness rather than from `db/client`, which `ws/` may not
// import — the same reason `eventFanOut.test.ts` takes it from here
import { type Database, seedSession, withTestDatabase } from '../testing';
import { REPLAY_WINDOW_EVENTS, replayTo } from './replay';
import type { LiveConnection } from './rooms';

/** A connection that remembers what it was told */
interface FakeConnection extends LiveConnection {
  readonly sent: string[];
}

function fakeConnection(): FakeConnection {
  const sent: string[] = [];

  return {
    accountId: 'account-alice',
    sent,
    send: (payload) => {
      sent.push(payload);
    },
    close: () => undefined,
  };
}

/** Two tables, so *only this session's log* is a thing a case can actually check */
function seedTwoSessions(database: Database): void {
  seedSession(database, { id: 's1', name: 'Tuesday' });
  seedSession(database, { id: 's2', name: 'Thursday' });
}

/**
 * Write `count` events into a session
 *
 * @param database Where
 * @param sessionId Whose log
 * @param count How many
 */
function appendMany(database: Database, sessionId: string, count: number): void {
  for (let index = 1; index <= count; index += 1) {
    appendEvent(
      {
        id: `${sessionId}-event-${index}`,
        sessionId,
        actorAccountId: 'account-alice',
        type: 'dm-award-experience',
        payload: '{"characterId":"character-1","after":300}',
        now: 1_700_000_000_000 + index,
      },
      database
    );
  }
}

/** What a connection was told, parsed back */
function heard(connection: FakeConnection): ServerSocketMessage[] {
  return connection.sent.map((frame) => JSON.parse(frame) as ServerSocketMessage);
}

/** The sequence numbers of the Events a connection was sent, in the order they arrived */
function replayedSeqs(connection: FakeConnection): number[] {
  const messages = heard(connection);
  const events = messages.filter(
    (message): message is LiveEventMessage => message.type === SERVER_MESSAGE_TYPE.EVENT
  );

  return events.map((message) => message.event.seq);
}

describe('replayTo', () => {
  it('sends exactly what was missed, in order and once each', () =>
    withTestDatabase((database) => {
      seedTwoSessions(database);
      appendMany(database, 's1', 10);

      const connection = fakeConnection();

      replayTo(connection, 's1', 5);

      const sent = replayedSeqs(connection);

      // Criterion 1: no gaps (6 is there), no duplicates (each once), and the log's order rather
      // than the network's
      expect(sent).toEqual([6, 7, 8, 9, 10]);
    }));

  it('sends nothing to a client that is already up to date', () =>
    withTestDatabase((database) => {
      seedTwoSessions(database);
      appendMany(database, 's1', 3);

      const connection = fakeConnection();

      replayTo(connection, 's1', 3);

      expect(connection.sent).toEqual([]);
    }));

  it('sends nothing for a client claiming a number ahead of the log', () =>
    withTestDatabase((database) => {
      // Not an error worth a reply: they have seen everything there is, whatever they think they
      // saw. A `resync` here would send a client round a refetch loop over a table doing nothing.
      seedTwoSessions(database);
      appendMany(database, 's1', 3);

      const connection = fakeConnection();

      replayTo(connection, 's1', 99);

      expect(connection.sent).toEqual([]);
    }));

  it('sends nothing for a session nothing has happened in', () =>
    withTestDatabase((database) => {
      seedTwoSessions(database);

      const connection = fakeConnection();

      replayTo(connection, 's1', 0);

      expect(connection.sent).toEqual([]);
    }));

  it('never replays another session’s log', () =>
    withTestDatabase((database) => {
      seedTwoSessions(database);
      appendMany(database, 's1', 2);
      appendMany(database, 's2', 4);

      const connection = fakeConnection();

      replayTo(connection, 's1', 0);

      const messages = heard(connection);
      const rooms = messages.map((message) => message.sessionId);

      expect(rooms).toEqual(['s1', 's1']);
    }));

  it('replays a gap of exactly the window', () =>
    withTestDatabase((database) => {
      // The edge, from the replaying side. `>` rather than `>=` is the whole difference between this
      // case and the next one, and nothing else in the file would notice it moving.
      seedTwoSessions(database);
      appendMany(database, 's1', REPLAY_WINDOW_EVENTS);

      const connection = fakeConnection();

      replayTo(connection, 's1', 0);

      const sent = replayedSeqs(connection);

      expect(sent).toHaveLength(REPLAY_WINDOW_EVENTS);
    }));

  it('asks for a full resynchronise one Event past the window', () =>
    withTestDatabase((database) => {
      seedTwoSessions(database);

      const pastTheWindow = REPLAY_WINDOW_EVENTS + 1;
      appendMany(database, 's1', pastTheWindow);

      const connection = fakeConnection();

      replayTo(connection, 's1', 0);

      const messages = heard(connection);
      const only = messages[0] as ResyncMessage;

      // One message, and no Events at all: replaying two hundred frames to reach the state one read
      // returns is slower and more fragile, which is why exceeding the window is a normal outcome
      // rather than an error
      expect(messages).toHaveLength(1);
      expect(only.type).toBe(SERVER_MESSAGE_TYPE.RESYNC);
      expect(only.sessionId).toBe('s1');
      expect(only.seq).toBe(pastTheWindow);
    }));

  it('names the head of the log in the instruction, so the client knows where to resume', () =>
    withTestDatabase((database) => {
      // Without the number a resynchronised client would have to guess, and guessing low means
      // asking for the very gap it was just told to skip
      seedTwoSessions(database);

      const written = REPLAY_WINDOW_EVENTS + 50;
      appendMany(database, 's1', written);

      const connection = fakeConnection();

      replayTo(connection, 's1', 10);

      const messages = heard(connection);
      const only = messages[0] as ResyncMessage;

      expect(only.seq).toBe(written);
    }));

  it('measures the gap from where the client got to, not from the start of the log', () =>
    withTestDatabase((database) => {
      // A long-running table whose client dropped a moment ago: hundreds of Events in the log, five
      // of them missed. Measuring from zero would send a caught-up client off to refetch the whole
      // session every time its wifi blinked.
      seedTwoSessions(database);

      const written = REPLAY_WINDOW_EVENTS + 100;
      appendMany(database, 's1', written);

      const connection = fakeConnection();

      replayTo(connection, 's1', written - 5);

      const sent = replayedSeqs(connection);

      expect(sent).toHaveLength(5);
    }));
});
