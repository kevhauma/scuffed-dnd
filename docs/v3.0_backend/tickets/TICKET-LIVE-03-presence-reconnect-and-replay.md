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

## Acceptance criteria

- [ ] A client that misses Events while disconnected receives exactly the missed ones on reconnect,
      in `seq` order, with no duplicates and no gaps.
- [ ] A gap beyond the configured replay window returns a resynchronise instruction, and the client
      refetches once and is correct afterwards.
- [ ] Reconnection backs off — a server restart with fifty clients does not produce a reconnect
      storm — and the backoff is tested with a fake timer rather than by wall-clock.
- [ ] The lobby shows connected Members accurately: opening a second browser adds them, closing it
      removes them within the idle timeout, and GAM-04's "unknown" is gone.
- [ ] With the socket forcibly closed, every player and DM action still succeeds over HTTP and the
      acting client shows the result; only liveness for *other* people is lost.
- [ ] The surface makes a disconnected state obvious — a Player never reads a stale number believing
      it is live.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check that kills and restores the connection (ask the User first).

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
