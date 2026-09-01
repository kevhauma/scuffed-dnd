/**
 * The write and the broadcast are one path (TICKET-LIVE-02)
 *
 * **No database and no socket in this file**, which is the same split `rooms.test.ts` makes one
 * module over: `recordEvent` is handed the write and the rooms, so what it *does* with them —
 * publish after the write, publish to one room, publish nothing when nothing was written, survive a
 * fan-out that throws — is assertable against plain objects. That the real repositories hand back
 * the shape these fakes hand back is [`eventFanOut.test.ts`](./eventFanOut.test.ts)'s job, against
 * the real routes and a real database.
 *
 * **Validates: v3 Req 44.3, 44.4, 44.5**
 */

import { describe, expect, it } from 'vitest';
import { SERVER_MESSAGE_TYPE } from '#shared/types/liveSocket';
import type { EventRow } from '../repositories/eventRepository';
import type { SocketRooms } from '../ws/rooms';
import { eventAlone, recordEvent } from './recordEvent';

/** One broadcast, as the fake registry recorded it */
interface RecordedBroadcast {
  sessionId: string;
  payload: string;
}

/** A registry that remembers what it was asked to send instead of sending it */
interface RecordingRooms extends SocketRooms {
  readonly broadcasts: RecordedBroadcast[];
}

/**
 * Rooms that record
 *
 * Only `broadcast` does anything: `recordEvent` calls one method of this interface and a fake that
 * implemented the other six would be describing a collaboration that does not happen.
 *
 * @param onBroadcast What to do besides recording — throwing, for the case that needs it
 * @returns The registry, with what it was told
 */
function recordingRooms(onBroadcast?: () => void): RecordingRooms {
  const broadcasts: RecordedBroadcast[] = [];

  return {
    broadcasts,
    broadcast: (sessionId, payload) => {
      broadcasts.push({ sessionId, payload });
      onBroadcast?.();
    },
    join: () => undefined,
    leave: () => undefined,
    forget: () => undefined,
    evictMember: () => undefined,
    closeAll: () => undefined,
    roomCount: () => 0,
  };
}

/** An event row as the log would have handed it back */
function storedRow(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: 'event-1',
    sessionId: 'session-a',
    seq: 7,
    actorAccountId: 'account-1',
    type: 'dm-award-experience',
    payload:
      '{"characterId":"c1","action":"dm-award-experience","target":"","before":0,"after":300}',
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

/** What a caller with something else to write hands back */
function wroteBoth(row: EventRow, written = 'the character') {
  return { event: row, written };
}

/** The frame a broadcast carried, parsed */
function frameOf(broadcast: RecordedBroadcast) {
  return JSON.parse(broadcast.payload) as {
    type: string;
    sessionId: string;
    event: { id: string; seq: number; type: string; actorAccountId: string | null; at: number };
  };
}

/** The Event to append, as a route states it */
const INPUT = {
  id: 'event-1',
  sessionId: 'session-a',
  actorAccountId: 'account-1',
  type: 'dm-award-experience',
  payload: '{}',
  now: 1_700_000_000_000,
};

describe('recordEvent', () => {
  it('publishes the row the write appended, to that row’s own room', () => {
    const rooms = recordingRooms();
    const row = storedRow();

    const recorded = recordEvent(INPUT, () => wroteBoth(row), rooms);

    expect(recorded.written).toBe('the character');
    expect(rooms.broadcasts).toHaveLength(1);
    expect(rooms.broadcasts[0].sessionId).toBe('session-a');
  });

  it('carries the seq, the type, the actor and the moment on the frame', () => {
    const rooms = recordingRooms();
    const row = storedRow();

    recordEvent(INPUT, () => wroteBoth(row), rooms);

    const frame = frameOf(rooms.broadcasts[0]);

    expect(frame.type).toBe(SERVER_MESSAGE_TYPE.EVENT);
    expect(frame.event.id).toBe('event-1');
    expect(frame.event.seq).toBe(7);
    expect(frame.event.type).toBe('dm-award-experience');
    expect(frame.event.actorAccountId).toBe('account-1');
    expect(frame.event.at).toBe(1_700_000_000_000);
  });

  it('parses the payload once here rather than shipping a string inside a string', () => {
    const rooms = recordingRooms();
    const row = storedRow();

    recordEvent(INPUT, () => wroteBoth(row), rooms);

    const parsed = JSON.parse(rooms.broadcasts[0].payload) as { event: { payload: unknown } };

    expect(parsed.event.payload).toEqual({
      characterId: 'c1',
      action: 'dm-award-experience',
      target: '',
      before: 0,
      after: 300,
    });
  });

  it('publishes after the write, never before it', () => {
    const order: string[] = [];
    const rooms = recordingRooms(() => order.push('broadcast'));
    const row = storedRow();

    recordEvent(
      INPUT,
      () => {
        order.push('write');
        return wroteBoth(row);
      },
      rooms
    );

    expect(order).toEqual(['write', 'broadcast']);
  });

  it('publishes nothing when the write threw', () => {
    const rooms = recordingRooms();

    const attempt = () =>
      recordEvent(
        INPUT,
        () => {
          throw new Error('the append was refused');
        },
        rooms
      );

    expect(attempt).toThrow('the append was refused');
    expect(rooms.broadcasts).toHaveLength(0);
  });

  it('publishes nothing when the write found nothing to write', () => {
    const rooms = recordingRooms();

    const recorded = recordEvent(INPUT, () => null, rooms);

    expect(recorded).toBeNull();
    expect(rooms.broadcasts).toHaveLength(0);
  });

  it('does not fail a committed write when the fan-out throws', () => {
    const rooms = recordingRooms(() => {
      throw new Error('every socket in the room is gone');
    });
    const row = storedRow();

    // The row is already in the log by the time anything is sent. Throwing here would tell the
    // caller their action was refused when it happened, and they would do it again.
    const recorded = recordEvent(INPUT, () => wroteBoth(row), rooms);

    expect(recorded.written).toBe('the character');
  });

  it('hands the appender to the write rather than appending on its own', () => {
    const rooms = recordingRooms();
    const row = storedRow();
    let handed: unknown = null;

    recordEvent(
      INPUT,
      (append) => {
        handed = append;
        return wroteBoth(row);
      },
      rooms
    );

    expect(typeof handed).toBe('function');
  });
});

describe('eventAlone', () => {
  it('answers the row as both halves, for a caller with nothing else to write', () => {
    const row = storedRow();
    const append = () => row;

    const recorded = eventAlone(append);

    expect(recorded.event).toBe(row);
    expect(recorded.written).toBe(row);
  });

  it('calls the appender bare, so it takes its own transaction', () => {
    const row = storedRow();
    const seen: (unknown | undefined)[] = [];
    const append = (tx?: unknown) => {
      seen.push(tx);
      return row;
    };

    eventAlone(append as Parameters<typeof eventAlone>[0]);

    expect(seen).toEqual([undefined]);
  });
});
