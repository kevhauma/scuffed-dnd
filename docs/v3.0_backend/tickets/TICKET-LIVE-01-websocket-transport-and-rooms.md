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

> **Implementation note, 2026-09-01 — where "the same HTTP listener" actually is.**
> `attachLiveSocket(httpServer)` takes the listener as a parameter and is framework-agnostic, but
> only **one** caller exists today: `scripts/live-socket.mjs`, a dev-only Vite plugin that hands it
> `server.httpServer`. So under `yarn dev` the socket is on the same origin and port as the app,
> exactly as written below. **In a built artefact it is not attached at all yet**, because there is
> no start command to attach it from — `vite build` emits `dist/server/entry.js` and
> [TICKET-POL-03](./TICKET-POL-03-deployment-shape.md) owns the runner that will serve it. Minting a
> `start` script here would be reaching into that ticket's surface, so POL-03 has gained a line
> naming `attachLiveSocket` as something its runner must call. Recorded rather than glossed: until
> POL-03 lands, *the socket exists in development and in the tests and nowhere else.*

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

- [x] An upgrade with no cookie, an expired cookie and a signed-out cookie is each closed with a
      stated close code, and no room is joined. (`SOCKET_CLOSE_CODE.UNAUTHENTICATED` = 4401 in
      [liveSocket.ts](../../../src/shared/types/liveSocket.ts); four tests in
      [liveSocketServer.test.ts](../../../src/server/ws/liveSocketServer.test.ts) — *no cookie at
      all*, *a cookie that does not verify*, *a cookie that has been signed out*, *an expired
      cookie* — each drives a **real `ws` client over loopback carrying a real Better Auth cookie**
      and asserts the close code is 4401 **and** `rooms.roomCount()` is 0. The expired case signs up
      at 2026-01-01 and connects at 2026-03-01 with `vi.useFakeTimers({ toFake: ['Date'] })`, past
      the documented 30-day idle default. The refusal path in `liveSocketServer.ts`'s `refuse`
      completes the handshake, closes, and attaches **no** message listener and joins **no** room, so
      an unauthenticated connection cannot say or reach anything.
      **Review found a process-crash vector on this exact path and it is fixed and regression-tested**
      — see the closing note's item 6; *should survive a malformed frame from an unauthenticated
      client* is the test, and it was confirmed to fail without the fix.
      **Cross-site is covered by an assertion on the cookie, not by a connection**, and the second
      review pass is why: a Node `ws` client applies no cookie policy, so a cross-origin *handshake*
      test behaves identically under `Lax`, `Strict` and `None` and would have kept passing through
      the exact change it looked like it was guarding. The tripwire is *should be SameSite=Lax on
      the cookie*, and `auth.test.ts`'s cookie assertion was **tightened from `samesite` to
      `samesite=lax`** — the loose form was satisfied by `SameSite=None`, the one value that undoes
      the restriction it is named after. `Lax` is Better Auth's *default* rather than something
      `authServer.ts` sets, so a library bump is what these watch. The cross-origin connection case
      is kept, relabelled as documentation of the shape rather than as a guard.)
- [x] A Member is admitted to their session's room; a non-member's subscribe is refused without
      revealing whether the session exists (v3 Req 32.5's discipline on the socket).
      (`subscription.ts` calls **`requireMember` from `auth/guards.ts`, unmodified** — there is no
      `findSessionMember` call anywhere under `ws/`. Proven by *should admit a Member to their own
      session's room*, *should admit the DM*, *should refuse a non-member and join no room*, and
      *should refuse a non-member and a session that does not exist identically* in
      [subscription.test.ts](../../../src/server/ws/subscription.test.ts) — that last one compares
      the two refusal payloads **to each other** with only the echoed `sessionId` normalised away,
      because two separate assertions can drift apart while both stay green. *should log the reason
      a subscribe was refused* asserts the reason reaches `console.warn` and **not** the client.
      Also end to end: *should admit a Member who asks, and refuse a stranger saying nothing*.)
- [x] A message broadcast to one room reaches every connection in it and no connection in another —
      asserted with two rooms and four connections. (*should reach every connection in one room and
      no connection in another* in [rooms.test.ts](../../../src/server/ws/rooms.test.ts) — two
      rooms, four connections, exactly as asked. *should reach the rest of a room when one
      connection has already died* covers the fan-out guard in `deliver`. Over a real socket:
      *should deliver a broadcast to the room and to nobody outside it*.)
- [x] A state-changing message sent on the socket is ignored and logged; a test sends one and
      asserts nothing changed in the database (D8). (*should ignore a state-changing message and
      change nothing in the database* in `subscription.test.ts` sends a real
      `adjust-resource`-shaped frame, from an Account that genuinely could perform it over HTTP,
      against a real migrated database — and asserts `allCharacters(database)` is deep-equal before
      and after, with nothing said back. *should log the verb somebody tried, and nothing else of
      the frame* asserts the log carries the type and **not** a sibling field, since a client's
      frame is attacker-controlled text.)
- [x] Removing a Member (GAM-04) closes their open connections for that room.
      (`routes/sessions/removeMember.ts` calls `liveRooms().evictMember(...)` **after** the delete;
      three tests in
      [membership.test.ts](../../../src/server/routes/sessions/membership.test.ts) — *should close
      the removed Member's connections to that room*, *should close nothing when the removal was
      refused*, *should leave a departing Member's connections to other tables alone* — plus the
      six-test `eviction` block in `rooms.test.ts`. Close code
      `SOCKET_CLOSE_CODE.MEMBERSHIP_ENDED` = 4403.
      **The emphasis on *for that room* is load-bearing and review corrected the reading**: eviction
      now **leaves the room and closes the socket only when that was its last room**, because a
      browser holds one socket across every table it is watching and closing outright would take a
      live feed for session B away because a seat at session A was removed — the very thing
      `subscription.ts` refuses to do when it answers a bad subscribe with a message rather than a
      close. *should not close one connection that is watching two tables* and *should close that
      same connection once its last room is taken too* are the pair; the previous tests used two
      separate fakes for one Account and so could not see it.)
- [x] Connections are cleaned up on close, error and process shutdown — a test asserts the room map
      is empty after all clients disconnect, so a long-running server does not leak rooms. (An empty
      room is **deleted**, never kept at size 0 — `rooms.ts`'s `leave`. `rooms.test.ts`'s `cleanup`
      block asserts `roomCount()` goes 2 → 1 → 0 as connections are forgotten, that a room drops on
      its last leave, and that `closeAll` empties it. `liveSocketServer.ts` wires the same `release`
      to **both** `close` and `error`. Over real sockets: *should hold no rooms once every client
      has disconnected* and *should close every connection when the server shuts down*, the latter
      asserting close code 4499 and `roomCount()` 0.)
- [x] The socket URL is built from `window.location` and no environment variable or constant names
      the socket host — asserted on the URL the client constructs, under both `http:` and `https:`
      (v3 Req 47.6). (`liveSocketUrl` in
      [client/services/liveSocket.ts](../../../src/client/services/liveSocket.ts); eight tests in
      its companion — `http:` → `ws://localhost:3000/api/live`, `https:` →
      `wss://dnd.example.com/api/live`, the port preserved, an unknown scheme treated as plain. The
      second half is asserted **against the module's own source text**, the way
      `routeGuards.test.ts` asserts a call-site obligation: no `import.meta.env`, no `process.env`,
      no `https?://` origin, no `localhost`, and the path taken from `LIVE_SOCKET_PATH` rather than
      spelled twice.)
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check (ask the User first). — **Three of the four are done and the box
      stays open for the fourth.** `npx vitest run` **4015 passed across 241 files, 0 failing, 0
      skipped** (+63 tests, +4 files on the 3952/237 baseline); `npx tsc --noEmit` at its documented
      2-error baseline; `yarn run check` clean (810 modules, 4156 dependencies cruised).
      `fallow audit --base main` returns **`verdict: pass`** with `dead_code_introduced: 0`,
      `complexity_introduced: 0`, `duplication_introduced: 0` — the three unused types it charged on
      the first run were **fixed rather than suppressed** (see Notes). No file this ticket touched is
      tagged **Accelerating**, so no hotspot row is owed. The **live browser check was not done**:
      the User declined interactive browser checks for the rest of the milestone on 2026-09-01.
      **Every figure here was re-measured after the second review round**, not carried forward.

## Notes

- **Authenticate on the upgrade, not on the first message.** An authenticated-later socket is a
  socket that exists unauthenticated, and every message handler then has to remember to check. The
  cookie is on the upgrade request; use it there.
- Keepalive is `ping`/`pong` at the protocol level with a server-side idle timeout. An
  application-level heartbeat is a second mechanism doing the same job worse.
- The in-memory room map is a deliberate single-process assumption. Write it behind a small
  interface anyway — not to enable a broker now, but so that the day someone wants two processes,
  the change is one module rather than every call site.

> **Closed 2026-09-01. Five things worth carrying to LIVE-02.**
>
> 1. **The interface earned its keep immediately, for a reason the Note did not predict.**
>    `ws/rooms.ts` imports `ws` **not at all**, so isolation, eviction and the map emptying itself
>    are assertable against three-method fakes — no handshake, no port, no timing. That is what let
>    `rooms.test.ts` be 18 deterministic tests instead of 18 flaky ones, and it is a stronger
>    argument for the interface than "someday, two processes".
> 2. **How a socket is tested with `tanstackStart()` omitted from `vitest.config.ts`**: a bare
>    `node:http` server. A listener is not a framework — no route tree, no SSR handler, no Vite, no
>    build — so `liveSocketServer.test.ts` hands `attachLiveSocket` a real listener and drives real
>    `ws` clients with real Better Auth cookies over loopback. `the-server-sends-no-mail` already
>    exempts `http` for exactly this.
> 3. **`routeGuards.test.ts` grew a second corpus rather than a second detector.** A socket upgrade
>    contains no `defineHandler(`, so the marker is `CLIENT_MESSAGE_TYPE.` — scoped to the
>    *message-decoding* module, because `rooms.ts` is **handed** session ids rather than reading
>    them off a request and has nothing to guard. Proven against three literal socket sources, one
>    of which is the specific way a socket would grow its own authorization: calling
>    `findSessionMember` directly.
> 4. **`fallow` charged three unused types on the first run and all three were fixed, not
>    suppressed.** `ClientMessageType` and `ServerMessageType` were deleted — the discriminated
>    union of message *shapes* is what callers name, and a derived alias for the `type` field alone
>    had no caller. `SocketCloseCode` was kept and **put to work**: `LiveConnection.close` takes it
>    instead of `number`, so "a close code is one of exactly three things this server says" is true
>    at every call site rather than only where somebody remembered.
> 5. **Both dependencies were already resolvable transitively, and that is the trap.** `ws` and
>    `@types/ws` (D11's, by name) sat in `node_modules` as somebody else's transitive deps, so an
>    import would have *worked in development* and failed `yarn run arch` — which is exactly what
>    `no-undeclared-dependency` exists to catch, and why "it resolves" is never the test. Declared
>    `ws: ^8.18.3` / `@types/ws: ^8.18.1`, and **the range is the interesting part**: the first
>    attempt declared `^8.19.0`, which yarn satisfied by fetching a *second* top-level copy (8.21.3)
>    beside the 8.18.3 entry already in the lockfile, for no benefit. Matching the existing range
>    dedupes onto it — `ws` resolves to **8.19.0**, `@types/ws` needed no new entry either, and the
>    lockfile diff for this whole ticket is consequently **empty**. Worth writing down because the
>    tidier outcome came from declaring the *looser* range, which is the opposite of the instinct.
> 6. **Review found a remote crash on the refusal path, and it is the most useful thing this ticket
>    produced.** `handleUpgrade` completes the handshake and wires `ws`'s frame receiver **before**
>    the refusal runs, and `raw.close()` only moves the socket to `CLOSING` — so bytes an anonymous
>    client pipelined behind the handshake were still parsed. A single frame with RSV1 set made the
>    receiver emit `'error'` on a WebSocket that, *by design*, had no listeners at all; Node turns an
>    unhandled `'error'` into a **throw** out of a `socket.on('data')` callback, and nothing in
>    `src/` installs an `uncaughtException` handler. One frame, no credentials, process gone.
>    Fixed by attaching an `'error'` listener before the close — which weakens nothing, since the
>    criterion is about a *message* listener and a room join, both still absent. **The authenticated
>    path always had one**, and that asymmetry is what hid it. The regression test was confirmed to
>    fail without the fix (`WS_ERR_UNEXPECTED_RSV_1` out of `socketOnData`) before being kept.
>    Two hardening changes came with it: `maxPayload` of 4 KiB on the server (the default is 100 MiB
>    for a channel whose vocabulary is two verbs and an id), and a **rejected**-not-truncated cap on
>    `sessionId`, because `requireMember` refuses unknown ids *by logging them* and an authenticated
>    Member could otherwise write chosen text into the operator's log a frame at a time.
> 7. **The one-importer claim is now a check, not prose.**
>    `the-socket-library-has-one-importer` in `.dependency-cruiser.mjs`, proven against
>    `boundaryFixtures/importsTheSocketLibrary.ts` — which uses a **type-only** import, the weakest
>    form and the one most likely to be waved through. Without it, the day `rooms.ts` imports
>    `WebSocket` for an annotation, every property `rooms.test.ts` proves against plain objects
>    quietly stops being a property of the design and nothing fails.
> 8. **`SocketRooms.broadcast` has no production caller yet, and `fallow` does not report it** — it
>    is an interface method with an implementation and callers in two test files. LIVE-02 is what
>    puts Events through it. Nothing else is left dangling: the client half is `liveSocketUrl` and
>    nothing more, because no criterion here asks for a connection object and the server's own tests
>    drive real sockets. LIVE-02 adds it in the change that consumes it.
