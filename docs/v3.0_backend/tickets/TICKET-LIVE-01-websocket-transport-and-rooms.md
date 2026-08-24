# TICKET-LIVE-01 — WebSocket transport and authenticated rooms

- **Area:** Live updates (new area)
- **Type:** Feature
- **Traceability:** v3 [Req 44.1–44.3](../requirements.md#requirement-44-live-updates); overview
  [D8](../overview.md#d8--websockets-notify-http-mutates)

## User story

As a Player, I want a live connection to my table, so that the app can tell me when something
changes instead of my refreshing to find out.

## Description

The transport, and only the transport. Nothing is broadcast yet — LIVE-02 does that. This ticket
establishes the socket, its authentication, and its room model, because getting authorization right
on the upgrade request is the part that must not be retrofitted.

**D8 is the shape**: the socket is server → client. No state-changing message is ever accepted on
it. That keeps authorization to one implementation, the HTTP one, and keeps every mutation testable
without a socket.

## Current situation (as-is)

- No socket, no long-lived connection of any kind. Everything is request/response.
- AUTH-01's Auth_Session is an `HttpOnly` cookie, which the browser sends on a WebSocket upgrade —
  so the socket can reuse the same authentication with no token scheme of its own.
- AUTH-03's `requireMember` answers admission; DB-01's `event` table has `(session, seq)` and
  ROLL-07 built the index.
- One process, one SQLite file, in-memory rooms — [overview.md](../overview.md#not-in-this-milestone-deliberately)
  ruled out horizontal scaling, so no pub/sub broker is needed or wanted.

## Desired result (to-be)

- A `ws` server attached to the same HTTP listener, authenticating the upgrade from the
  Auth_Session cookie and closing — with a stated code — any connection that presents none or an
  invalid one.
- A room per Game_Session: a client subscribes to a session, `requireMember` decides admission, and
  a connection is admitted to a room only if the Account is a Member of it. Removal of membership
  closes the connection.
- The client-side connection object: connect, subscribe, receive, with the socket carrying **no**
  outbound commands beyond subscribe/unsubscribe and a keepalive. Its URL is **derived from
  `window.location`** — same host, same port, `ws:`/`wss:` chosen from the page's protocol — never
  configured. The socket attaches to the server that already serves the app (D1), so there is still
  one process to run; it also means the Auth_Session cookie rides the upgrade with nothing added.

## Acceptance criteria

- [ ] An upgrade with no cookie, an expired cookie and a signed-out cookie is each closed with a
      stated close code, and no room is joined.
- [ ] A Member is admitted to their session's room; a non-member's subscribe is refused without
      revealing whether the session exists (v3 Req 32.5's discipline on the socket).
- [ ] A message broadcast to one room reaches every connection in it and no connection in another —
      asserted with two rooms and four connections.
- [ ] A state-changing message sent on the socket is ignored and logged; a test sends one and
      asserts nothing changed in the database (D8).
- [ ] Removing a Member (GAM-04) closes their open connections for that room.
- [ ] Connections are cleaned up on close, error and process shutdown — a test asserts the room map
      is empty after all clients disconnect, so a long-running server does not leak rooms.
- [ ] The socket URL is built from `window.location` and no environment variable or constant names
      the socket host — asserted on the URL the client constructs, under both `http:` and `https:`
      (v3 Req 47.6).
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check (ask the User first).

## Notes

- **Authenticate on the upgrade, not on the first message.** An authenticated-later socket is a
  socket that exists unauthenticated, and every message handler then has to remember to check. The
  cookie is on the upgrade request; use it there.
- Keepalive is `ping`/`pong` at the protocol level with a server-side idle timeout. An
  application-level heartbeat is a second mechanism doing the same job worse.
- The in-memory room map is a deliberate single-process assumption. Write it behind a small
  interface anyway — not to enable a broker now, but so that the day someone wants two processes,
  the change is one module rather than every call site.
