# TICKET-LIVE-03 — Presence, reconnect and replay

- **Area:** Live updates
- **Type:** Feature
- **Traceability:** v3 [Req 44.6, 44.8, 44.9](../requirements.md#requirement-44-live-updates)

## User story

As a Player on a hotel wifi, I want the app to recover when my connection drops, so that a flaky
network costs me a moment rather than a session.

## Description

The ticket that turns a demo into something usable at a real table. A socket that works until it
doesn't, and then silently shows stale numbers, is worse than no socket — the Player trusts what
they see. This closes that: replay what was missed, say when the connection is down, and keep every
action working over HTTP regardless.

It also fills in GAM-04's "unknown" connection column with something the app can actually observe.

## Current situation (as-is)

- LIVE-01 authenticates and rooms connections; LIVE-02 broadcasts Events with a per-session `seq`.
- GAM-04's lobby shows a connection column reading "unknown", deliberately, because the app could
  not distinguish offline from unobserved.
- `event` is queryable by `(session, seq)` — the index ROLL-07 built and LIVE-02 reused.
- Nothing reconnects, nothing detects staleness, and a dropped socket is currently indistinguishable
  from a quiet table.

## Desired result (to-be)

- Reconnect with replay: the client reconnects with its last-seen `seq`, the server replays what it
  missed, or instructs a full resynchronisation when the gap is too large to be worth replaying.
- Presence: the room's live membership is broadcast on join and leave, and the lobby shows who is
  actually connected — replacing GAM-04's "unknown".
- Connection state on screen, and a stated staleness rule: when the socket is down, the surface says
  so, and every action still works over HTTP with the result applied locally (v3 Req 44.9).

## Implementation notes (2026-09-01) — where the build diverged from the wording above

Six things. Five were decided during the build and approved before it started; the sixth is the
review's, and it is the one that changed behaviour rather than wording.

**A room's resume point comes from the acknowledgement, not from the first Event it sees** (added at
review). The client tracked *the last `seq` I saw* and sent it only when it was greater than zero —
whose stated justification, *the surface read its state over HTTP a moment ago*, is true of a first
subscribe and false of a reconnect. A Player at a **quiet** table therefore had no resume point:
their reconnect asked for nothing, was told only *you are in that room*, and an adjustment made while
they were away was neither replayed nor refetched, since `useTableCharacterFeed` re-reads only on a
resync or an Event. The sheet stayed wrong with nothing pending — the failure the Notes below
describe. `SubscribedMessage` now carries `seq`, the log's head, read once in the same synchronous
turn as the replay; `RoomBook.resumeFrom` adopts it on the first acknowledgement only (adopting it on
a reconnect would set the point past the very Events about to arrive); and `null` there means *first
subscribe* rather than *seen nothing*, so the `> 0` special case is gone rather than narrowed.
**Also at review**: a replay is now bounded to **one per room per connection** — validating the value
said nothing about how often it may be asked for, and a replay is not idempotent the way a join is —
and the client no longer re-asks for a room the server took away, which was re-provoking a refusal
once per backoff on an evicted browser left open.

**"GAM-04's *unknown* is gone" is true of the *column* and deliberately false of the *state*.**
Criterion 4 reads as though the word should disappear; what disappeared is the column that said it on
every row unconditionally. *Unknown* survives as the answer whenever there is no live feed to ask —
no socket, a socket that is down, a room this reader was refused — because *Away* is a claim about
another person and a dead connection cannot support one. That is the same discipline as chipping a
formula that cannot be evaluated rather than showing a confident zero, applied to a person, and it is
what GAM-04 wrote the state for in the first place. `presenceStateOf` is where it is decided and
`presenceState.test.ts` is where it is held.

**The replay window is a documented module constant, not an environment variable.** The Notes below
call it *a configuration value with a documented default*, which reads as a deployment knob;
`REPLAY_WINDOW_EVENTS = 200` in [`server/ws/replay.ts`](../../../src/server/ws/replay.ts) is a named
constant carrying its own rationale instead. `env.ts`'s contract is that every variable it reads is
a thing an **operator** decides and is justified in `.env.example`, and nobody deploying this has a
reason to tune the number — TICKET-POL-03 owns deployment knobs, and promoting it is a line of code
the day somebody asks.

**Resuming is a *parameter* on `subscribe`, not a third client verb.** `CLIENT_MESSAGE_TYPE` still
has two members. `afterSeq` says *where I got to*, so the frame a client already sends now also asks
to be caught up — which keeps the guard call site exactly where it was, since the replay is reached
only after `requireMember` has approved that session for that Account. It is nonetheless a
client-supplied value steering a server-side query, and
[D8](../overview.md#d8--websockets-notify-http-mutates) carries a note saying so plainly rather than
leaving a later reader to wonder why there is a read on the notify channel.

**The eviction message TICKET-GAM-04 could not send and TICKET-LIVE-02 declined to invent was
built.** `SERVER_MESSAGE_TYPE.ROOM_CLOSED`, sent by `evictMember` before it removes the connection.
`evictMember` closes a socket only when the room it lost was its **last**, so a connection watching
two tables used to keep drawing the one it had lost as though it were live — the single case where
the server *knows* a surface is stale, which was the single case it said nothing about. That is v3
Req 44.8 by name, which is why it belongs here rather than to the ticket that noticed it.

**`useTableCharacterFeed` gained a behaviour this ticket's to-be does not mention, and criterion 2
needs it.** An Event that **applies** while a re-read is in flight now schedules the trailing pass,
where before only a `stale` did. Without it a resynchronise read — composed on the server before that
Event, arriving after it — overwrites the value the Event just wrote, leaving the sheet a step behind
with nothing left to correct it, and *the client refetches once and is correct afterwards* is false.
Verified by mutation: disabling the one line turns exactly one case red.

## Acceptance criteria

- [x] A client that misses Events while disconnected receives exactly the missed ones on reconnect,
      in `seq` order, with no duplicates and no gaps.
      (`server/ws/replay.ts`'s `replayTo`, driven by `replay.test.ts` — *sends exactly what was
      missed, in order and once each* replays `[6…10]` of a ten-Event log for a client resuming at 5,
      *never replays another session's log*, and *sends nothing to a client that is already up to
      date*. The **gaplessness** is a property of the whole subscribe running in one synchronous
      turn, asserted as such in `subscription.test.ts`'s *should admit and catch up in one
      synchronous turn*: nothing is awaited, and the room holds the connection **and** the replay has
      arrived by the time `handleClientMessage` returns, so no Event can be written into a window
      between the two. The client's half is `liveSocket.test.ts`'s *should ignore an Event it has
      already applied* — a `seq` not greater than the room's resume point is dropped, which is
      duplicate suppression and never a gap because frames arrive in `seq` order.
      **The review found the case none of that covered**, and it is recorded as a divergence below:
      a client keyed on *the last `seq` I saw* has no resume point at a **quiet** table, so its
      reconnect asked for nothing at all and the server had nothing to be gapless about.
      `SubscribedMessage.seq` fixes it and `liveSocket.test.ts`'s *should resume a quiet table from
      zero rather than asking for nothing* holds it, mutation-verified against the old rule.)
- [x] A gap beyond the configured replay window returns a resynchronise instruction, and the client
      refetches once and is correct afterwards.
      (`REPLAY_WINDOW_EVENTS = 200` in `server/ws/replay.ts`, a documented constant with its
      rationale — see the divergence note above. `replay.test.ts` exercises the **edge**: *replays a
      gap of exactly the window* sends 200 Events, *asks for a full resynchronise one Event past the
      window* sends one `resync` and **no** Events, and *names the head of the log in the
      instruction* is why the client resumes from the right place rather than re-asking for the gap.
      On the client, `liveSocket.test.ts`'s *should take the resynchronise instruction as a place to
      resume from* proves the next subscribe carries `afterSeq: 900`, and
      `useTableCharacterFeed.test.ts`'s *reads the sheet again when the server says to
      resynchronise* / *reads once per instruction, however often the surface re-renders* prove the
      **once**. *Correct afterwards* needed a second fix, recorded as a divergence below.)
- [x] Reconnection backs off — a server restart with fifty clients does not produce a reconnect
      storm — and the backoff is tested with a fake timer rather than by wall-clock.
      (`client/services/liveBackoff.ts`, pure, with the delay in `[ceiling / 2, ceiling]` and the
      ceiling doubling to a 30s cap. `liveBackoff.test.ts`'s *gives fifty clients fifty different
      delays, all inside the band* asserts the spread on the function; `liveSocket.test.ts`'s
      *should spread fifty clients rather than bringing them all back at once* asserts it through the
      connection under `vi.useFakeTimers` — one client back at 500ms, 26 by 750ms, all fifty by
      1000ms. `random` is an injected option for exactly this reason. Also proven: *should not come
      back after the page closed it*, *…after the server refused an anonymous caller* (`4401`),
      *should grow the wait for a server that keeps refusing*, and *should start over only after a
      connection that lasted* — the defence against a shutting-down server accepting and immediately
      closing.)
- [x] The lobby shows connected Members accurately: opening a second browser adds them, closing it
      removes them within the idle timeout, and GAM-04's "unknown" is gone.
      (`ws/rooms.ts` announces its room's membership from every mutator, so a membership change and
      its announcement are one path. `rooms.test.ts` proves *should tell a room who is in it when
      somebody joins* — a second Account arriving is exactly *opening a second browser* at the layer
      where it is observable without one — *should tell each room a dropped connection was in, and
      only those* (the close handler's `forget`, which is *closing it*), and, crucially, *should say
      nothing at all about a second tab of the same Account* together with *should say nothing when
      that second tab closes either*: presence is by **Account**, not by socket.
      The **idle timeout** is LIVE-01's existing heartbeat, unchanged: a clean close announces
      immediately and a half-open connection within two 30s intervals. On the surface,
      `SessionLobby.test.tsx`'s *names who is connected and who is away, once there is a live feed*
      shows *Connected* / *Away* with no *Connection unknown* left on the row. **Not observed in two
      real browsers** — that is the live check the User declined on 2026-09-01, and it is carried on
      criterion 7 rather than silently claimed here.)
- [x] With the socket forcibly closed, every player and DM action still succeeds over HTTP and the
      acting client shows the result; only liveness for *other* people is lost.
      (`characterStore.table.test.ts`'s *with the socket unusable* describe: `services/liveSocket` is
      mocked to **throw**, and a Player's `adjust-resource` and a DM's `dm-award-experience` both
      land and both show the returned character. The structural half — the one that survives a future
      refactor — is `liveSocket.test.ts`'s *should be reachable from no store and no persistence
      service*, which walks `stores/` and `services/` and asserts the only module naming the
      connection is the connection itself.)
- [x] The surface makes a disconnected state obvious — a Player never reads a stale number believing
      it is live.
      (`components/live/LiveStatusNotice.tsx`, rendered by `CharacterSheet` and `SessionLobby` with
      **no conditional at either caller**. `LiveStatusNotice.test.tsx` proves the three sentences and
      the two silences — nothing while live, and nothing while *connecting*, because on a first load
      nothing is stale yet — plus *promises that actions still work, wherever it speaks* (v3 Req
      44.9) and *says a lost room will not come back, rather than that it is retrying*. The
      per-person half is `presenceState.test.ts`'s *says unknown for every state that is not live,
      even about somebody on the list*: the list is non-empty in all four of those cases, so a
      function that checked membership before status would fail it.)
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check that kills and restores the connection (ask the User first).
      **Left open deliberately, and here is exactly what was and was not done.** The four
      verification commands were run **directly** rather than through the `verifier` subagent, this
      ticket having been built by an agent that is itself the leaf: `npx vitest run` 4183 passed /
      0 failed / 0 skipped (baseline 4092), `npx tsc --noEmit` at the documented 2-error baseline,
      `yarn run lint` and `yarn run check` clean, `yarn run arch` clean (834 modules, 4298
      dependencies). `fallow audit --base main`, `fallow dead-code` and `fallow health --hotspots
      --since 6m` were all run and their findings acted on — see TEST_STATUS.md. The
      **`conventions-reviewer` was not run**: the caller reserved it. The **live browser check was
      not attempted** — the User declined interactive browser checks for the rest of the milestone
      on 2026-09-01.

## Notes

- **TICKET-DM-04 is the reason the staleness rule has to be reusable rather than local to the
  lobby.** The DM's roster is built directly on top of this ticket and is the surface where a stale
  number does the most damage — a DM acts on that list without checking. Whatever presence and
  staleness treatment lands here is what the roster inherits, so build it as something a second
  surface can render, not as lobby markup.
- **The staleness rule is the whole ticket.** Everything else here is mechanism. The failure this
  prevents is a Player reading 12 HP off a screen whose socket died four minutes ago, and acting on
  it. Chipping an unavailable value rather than showing a confident wrong one is the same instinct
  the engine's error values encode — apply it to the connection.
- The replay window is a configuration value with a documented default, and exceeding it is a normal
  outcome rather than an error. A client gone for an hour should refetch; replaying two thousand
  Events to reach the same state is slower and more fragile.
- Presence is derived from open connections and is **not** persisted. It is the one piece of state
  in the milestone that legitimately ends with the process, like `useUIStore`'s roll history did
  before ROLL-07.
