/**
 * Who is listening to which table (TICKET-LIVE-01)
 *
 * One room per Game_Session, held in memory. That is a deliberate single-process assumption —
 * [overview.md](../../../docs/v3.0_backend/overview.md#not-in-this-milestone-deliberately) ruled
 * horizontal scaling out, so there is no broker to configure and none wanted.
 *
 * **It is written behind {@link SocketRooms} anyway, and the reason is not "in case we scale".**
 * It is that this module imports `ws` *not at all*. Nothing here knows what a socket is beyond
 * {@link LiveConnection}'s three members, so every property this file has — broadcast isolation,
 * eviction, the map emptying itself — is testable against plain objects, and the day somebody does
 * want two processes the change is this one module rather than every call site. A registry that
 * imported the socket library would make the interface decorative.
 *
 * **{@link SocketRooms.broadcast} has exactly one production caller**, and that is deliberate:
 * `events/recordEvent.ts`, which is also the only module that writes a row to `event`
 * (TICKET-LIVE-02). Nothing else may send a frame, because a frame sent from anywhere else would be
 * a claim about the table that the log does not carry.
 *
 * **Validates: v3 Req 44.2, 44.3, 39.3**
 */

import { SOCKET_CLOSE_CODE, type SocketCloseCode } from '#shared/types/liveSocket';

/**
 * As much of a socket as a room needs
 *
 * Three members, none of them `ws`-shaped. `accountId` is here because
 * {@link SocketRooms.evictMember} is the one operation that asks *whose* connection this is —
 * everything else treats a connection as an opaque destination.
 *
 * It is resolved **once, on the upgrade**, and is not a claim the connection can restate: nothing
 * a client sends can change it, which is what makes a room's membership answerable without asking
 * the socket who it is.
 */
export interface LiveConnection {
  readonly accountId: string;
  /** Deliver one frame. May throw if the underlying socket has already gone. */
  send(payload: string): void;
  /** Close, stating why. The code is one of exactly three, by its type. */
  close(code: SocketCloseCode, reason: string): void;
}

/**
 * The rooms, as an interface rather than as a class everybody imports
 *
 * Deliberately small: five verbs and one number. A registry with a query surface is a registry
 * somebody reads state out of instead of broadcasting to, and every such read is a place the room
 * model can be second-guessed.
 */
export interface SocketRooms {
  /** Put a connection in a room. Already being in it is not an error. */
  join(sessionId: string, connection: LiveConnection): void;
  /** Take it out of one room, leaving its others alone. Never refused. */
  leave(sessionId: string, connection: LiveConnection): void;
  /** Take it out of every room — what a close or an error means (criterion 6). */
  forget(connection: LiveConnection): void;
  /** Send one frame to every connection in one room, and to no other room. */
  broadcast(sessionId: string, payload: string): void;
  /**
   * Take one Account out of one room, closing the socket only if that was its last room
   * (TICKET-GAM-04, v3 Req 39.3)
   *
   * Not *close their connections* flatly: one socket may be listening to several tables, and losing
   * a seat at one is not a reason to go dark on the others.
   */
  evictMember(sessionId: string, accountId: string): void;
  /** Close everything and empty the map — process shutdown (criterion 6). */
  closeAll(): void;
  /** How many rooms are held. Zero is what "the server is not leaking rooms" looks like. */
  roomCount(): number;
}

/** What a Member who has been removed is told as their connection goes */
const MEMBERSHIP_ENDED_REASON = 'You are no longer a member of that game.';

/** What everybody is told when the process is going away */
const SERVER_STOPPING_REASON = 'The server is shutting down.';

/**
 * Send one frame, surviving a socket that died since we last looked
 *
 * A `send` on a socket the peer closed a millisecond ago throws, and an unguarded fan-out would let
 * that one dead connection swallow the rest of the room — which is the precise failure criterion 3
 * exists to rule out. The dead connection is not removed here: its own `close` event is what does
 * that, and racing it from the write path would be two owners for one removal.
 *
 * @param connection Where to send
 * @param payload What to send
 */
function deliver(connection: LiveConnection, payload: string): void {
  try {
    connection.send(payload);
  } catch (error) {
    console.warn('[live] send failed; the close handler will clear it', error);
  }
}

/**
 * Close one connection, surviving one that cannot be closed
 *
 * {@link deliver}'s reasoning applied to the other verb, and the two paths that reach it are the
 * ones where partial completion is worst: **shutdown** and **eviction**. A `close` that threw
 * halfway through {@link InMemorySocketRooms.closeAll} would leave the rest of the process's sockets
 * open with the map already cleared — connections nothing can reach and nothing will ever close.
 *
 * @param connection What to close
 * @param code Why
 * @param reason The sentence a client sees
 */
function shut(connection: LiveConnection, code: SocketCloseCode, reason: string): void {
  try {
    connection.close(code, reason);
  } catch (error) {
    console.warn('[live] close failed', error);
  }
}

/** The in-memory rooms — the only implementation this milestone has */
class InMemorySocketRooms implements SocketRooms {
  /** Session id → the connections listening to it. An empty room is deleted, never kept at size 0. */
  private readonly rooms = new Map<string, Set<LiveConnection>>();

  join(sessionId: string, connection: LiveConnection): void {
    const room = this.rooms.get(sessionId);

    if (room) {
      room.add(connection);
      return;
    }

    const opened = new Set([connection]);
    this.rooms.set(sessionId, opened);
  }

  leave(sessionId: string, connection: LiveConnection): void {
    const room = this.rooms.get(sessionId);
    if (!room) return;

    room.delete(connection);

    // **Empty rooms are deleted rather than left behind.** A long-running server that kept a
    // zero-size Set per session ever played would leak one entry per table forever, which is the
    // leak criterion 6 asks to be shown the absence of.
    if (room.size === 0) this.rooms.delete(sessionId);
  }

  forget(connection: LiveConnection): void {
    // Every room rather than a reverse index. A process serves a handful of tables, so this is a
    // walk of single digits on a disconnect; a second map would be a second thing to keep in step.
    const sessionIds = [...this.rooms.keys()];

    for (const sessionId of sessionIds) this.leave(sessionId, connection);
  }

  broadcast(sessionId: string, payload: string): void {
    const room = this.rooms.get(sessionId);
    if (!room) return;

    for (const connection of room) deliver(connection, payload);
  }

  /** Whether this connection is still listening to anything at all */
  private stillListening(connection: LiveConnection): boolean {
    for (const room of this.rooms.values()) {
      if (room.has(connection)) return true;
    }

    return false;
  }

  evictMember(sessionId: string, accountId: string): void {
    const room = this.rooms.get(sessionId);
    if (!room) return;

    // Snapshotted before the loop, because leaving mutates the Set this walks
    const held = [...room].filter((connection) => connection.accountId === accountId);

    for (const connection of held) {
      this.leave(sessionId, connection);

      // **Leave the room; close the socket only when that was its last one.** The criterion is
      // *closes their open connections **for that room***, and a browser holds **one** socket across
      // every table it is watching — so closing outright would take a live feed for session B away
      // because a seat at session A was removed. That is precisely the thing `subscription.ts`
      // refuses to do when it answers a bad subscribe with a message rather than a close, and a
      // module that reasons one way about a refusal and the other way about an eviction is a module
      // with two ideas about what a connection is.
      //
      // The client is not *told* which room it lost. TICKET-LIVE-02 gave the socket a server → client
      // message type and a client that can hear one, and **left this alone anyway**: what such a
      // message would serve is *what is on screen is stale*, which is v3 Req 44.8 and LIVE-03's by
      // name. Cheapness is not ownership.
      if (this.stillListening(connection)) continue;

      shut(connection, SOCKET_CLOSE_CODE.MEMBERSHIP_ENDED, MEMBERSHIP_ENDED_REASON);
    }
  }

  closeAll(): void {
    // **Deduplicated, for `evictMember`'s reason.** One socket may be in several rooms, so a flat
    // walk of the rooms would close it once per room. Harmless — a second close is a no-op — but it
    // is the same blind spot the eviction rule was corrected for, and a `Set` is the whole fix.
    const everyRoom = [...this.rooms.values()];
    const everyConnection = new Set(everyRoom.flatMap((room) => [...room]));

    this.rooms.clear();

    // Cleared first, then closed: a close handler that calls `forget` finds nothing to do rather
    // than mutating a map this is still walking
    for (const connection of everyConnection) {
      shut(connection, SOCKET_CLOSE_CODE.SERVER_STOPPING, SERVER_STOPPING_REASON);
    }
  }

  roomCount(): number {
    return this.rooms.size;
  }
}

/** A fresh, empty registry */
export function createSocketRooms(): SocketRooms {
  return new InMemorySocketRooms();
}

/** Read once, then reused — one process, one set of rooms */
let rooms: SocketRooms | null = null;

/**
 * This process's rooms
 *
 * Two production callers: `routes/sessions/removeMember.ts`, where taking a seat away closes the
 * connections that seat was holding, and `events/recordEvent.ts`, which broadcasts every Event it
 * writes (TICKET-LIVE-02).
 *
 * @returns The registry
 */
export function liveRooms(): SocketRooms {
  rooms ??= createSocketRooms();
  return rooms;
}

/**
 * Install a registry, handing back the one it displaced
 *
 * The shape `db/client.ts`'s `setProcessDatabase` established, and for its reason: a test needs the
 * module-level singleton to be *this* test's, and returning the previous value is what lets it put
 * the old one back rather than clear it.
 *
 * **`null` is a value it both returns and accepts**, and that symmetry is the point rather than an
 * oversight. The state a test most often finds is *no registry yet* — nothing has called
 * {@link liveRooms} — so a restore that only ran for a non-null previous would leave the test's own
 * registry installed for the rest of the worker. Putting `null` back means the next caller mints a
 * fresh one exactly as it would have.
 *
 * @param next What to install, or `null` to leave the slot empty
 * @returns What was there before
 */
export function setLiveRooms(next: SocketRooms | null): SocketRooms | null {
  const previous = rooms;
  rooms = next;
  return previous;
}
