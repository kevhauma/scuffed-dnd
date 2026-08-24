# Custom DnD Builder — v3.0 Backend & Multiplayer (Overview)

The third milestone: give the app a **server**. Accounts, server-owned rulesets, multi-player game
sessions with a Dungeon Master, and live updates over WebSockets, on SQLite.

v1.0 built the app browser-only. v2.0 replaced its remembered core with the source spreadsheet's
real one and closed clean. Both were single-browser by design. v3.0 is the first milestone whose
subject is not the ruleset but the *people* using it — and it is the first that has to answer
"who is allowed to do this?" at all.

**Requirement source for this version:** [`requirements.md`](./requirements.md) — Requirements
**30–49**, numbered from 30 so they never collide with v1.0's 1–22. Tickets cite them as
`v3 Req 37.2`. v1.0 requirement numbers appear only where a v1.0 behaviour is deliberately kept,
and Concept page citations carry over from v2.0 where a rule is the spreadsheet's.

## Decisions (2026-08-23)

Made when this milestone was scoped. Settled — don't re-open without a new decision here.

### D0 — "No backend" is reversed, deliberately

v2.0's overview records: *"The product concept is unchanged: browser-only, no backend, one
configuration… probably forever."* That is now wrong, and this line is why rather than drift. The
milestone exists because the product grew a requirement the browser cannot hold: **several people
around one table, seeing each other's state**. Everything v2.0 put out of scope on that basis —
multi-user roles in particular — comes back in.

What does *not* come back is the spec's draft/publish versioning and audit trails as such. A
`revision` integer and an append-only Event log are what this milestone needs and all it builds.

### D1 — The backend lives in this repo, on TanStack Start

`@tanstack/react-start` is already a dependency and `vite.config.ts` already runs `tanstackStart()`.
Server routes under `src/routes/api/` plus a `src/server/` layer, built to a Nitro `node-server`.
One repo, one build, one process, one router. A separate backend service would fork the type
definitions and the engine, which is precisely what D5 exists to prevent.

**The server hosts the frontend's build, so there is only ever one web server to run.** This is an
operational decision before it is an architectural one. The audience for this app is one person on
a home box or a small VPS hosting a game for their friends; asking them to run a static host *and*
an API, keep both alive, and keep them pointed at each other is a second system to operate for no
feature. `yarn build` produces one artifact and one documented command starts it.

What follows from it:

- The client addresses the API by **relative path** (`/api/rulesets`), and the socket derives its
  URL from `window.location`. There is no `VITE_API_URL`, no configurable base, no environment
  variable naming the backend — the backend is *this* server, and a variable that could point
  elsewhere is a variable someone will eventually point elsewhere.
- Every request is therefore same-origin, and **no CORS layer is needed anywhere in this
  milestone**. Treat one appearing as a signal that something got split in two — the fix is to put
  it back on one origin, not to widen the set of origins allowed to drive D3's session cookie.
- `yarn dev` serves the API from the **same Vite origin** as the app rather than from a second port
  behind a proxy. Same reason: one thing to start, and dev and production differ in build speed
  rather than in shape.

**The Vitest config still omits `tanstackStart()`** (see [CLAUDE.md](../../CLAUDE.md) and
[TEST_STATUS.md](../../TEST_STATUS.md)) — that stays true. Server code is tested by calling
`src/server/` functions and route handlers directly, never by booting Nitro.

### D2 — SQLite through Drizzle, migrations through drizzle-kit

New runtime dependencies: **`better-sqlite3`**, **`drizzle-orm`**. New dev dependency:
**`drizzle-kit`**. One database file, path from `DATABASE_URL`, WAL mode, foreign keys on.
Synchronous `better-sqlite3` is the right shape for a single-process app of this size and makes
every repository function trivially testable against an in-memory database.

### D3 — Authentication through Better Auth

New runtime dependency: **`better-auth`**. Email/password, the **Google and Discord** social
providers, session cookies, CSRF, and the account-linking rule in v3 Req 31.3 are all
security-sensitive code this milestone should not be writing by hand. It has a Drizzle/SQLite
adapter, so it shares D2's database file and D2's migration story — and both providers are built in,
so the second one costs a configuration block rather than a second integration.

**Two providers, both optional.** Discord is there because this is software for a group who play
together, and that group is usually already a Discord server; signing in as the person your table
knows is worth more than a generic second button. Either, both or neither may be configured, and the
identity rules run through **one** path so the providers cannot drift apart (v3 Req 31.7).

The one thing we do own is **authorization** — who may touch which ruleset, session and character.
That is v3 Req 32, it lives in `src/server/`, and no library decides it.

### D4 — A ruleset is stored as a JSON document, not normalised

A `Configuration` is fourteen interlinked entity kinds with id-resolved formula references, curve
override flags and stat ordering. Normalising it into tables would produce a second schema that has
to be kept in step with `src/types/config.ts` by hand, and a second validator beside
`validateConfigurationShape`. Every query the app actually makes is *"give me the whole ruleset"*.

So: `ruleset.data` is the `Configuration` as JSON text, with `schemaVersion` and `revision` as real
columns because those are the two things the server queries and gates on. Same for a Snapshot and
for a Character's player state. Accounts, memberships, invites and events **are** normalised — they
are the server's own model, and they are what the server joins on.

### D5 — The engine is the shared Kernel, and the server is authoritative

`src/types/` and `src/engine/` are already pure — no React, no storage, no network. They become the
**Kernel**, living in `src/shared/` after D14 and imported by both sides. A rule is written once.

The server re-derives everything it needs and trusts no derived value in a request body. The client
keeps calculating for display, and treats its own answer as a prediction. Dice are rolled on the
server. This is v3 Req 45, and it is the reason D1 chose one repo.

See **D14** for the tree this lands in and the boundary that enforces it.

### D6 — Local mode stays; sign-in gates connected play only

**Signing in is required to play at a table with other people, and for nothing else.** The app that
exists today keeps working signed out, unchanged:

| Signed out — **local mode** | Requires an Account |
|---|---|
| Build and edit a ruleset in this browser | Rulesets stored on the server |
| Export it, import one | Game sessions, invitations, membership |
| Create characters against the loaded ruleset, and play them | Live rooms, the DM's controls |

`dnd_builder_config` and `dnd_builder_characters` therefore **stay the source of truth for local
mode** — not a cache, not a staging area, not deprecated. A visitor who never signs in sees the
v2.0 app plus a sign-in button, and nothing about their experience degrades.

**Two homes, one app.** A signed-in Account sees both in the ruleset list: *this browser* and *their
account*. Which one an edit saves to follows from which one is open — a local ruleset persists to
LocalStorage through the existing store path, a server ruleset through RUL-02's. There is no sync
between them and no background copying in either direction.

**Uploading is an explicit, repeatable act** — "put this browser's ruleset on my account", available
whenever an Account is signed in, offered once on first sign-in as a convenience. A backup download
first, an explicit choice, no silent conversion — the discipline TICKET-IO-03 established, applied
here. Uploading **copies**; it does not move, and the local ruleset is untouched afterwards.

Offline *connected* play is still out: an Account with no network sees a disconnected table. What
they can always fall back to is local mode, which needs no server at all.

### D7 — A game session plays against a pinned Snapshot

Creating a Game_Session copies the Ruleset into it. The DM editing their ruleset afterwards does
not change a running game; pulling a new Snapshot is a deliberate act that is refused if it would
invalidate an existing character. Without this, a DM renaming a stat mid-session silently re-prices
every character at the table.

### D8 — WebSockets notify; HTTP mutates

Every state-changing action is an HTTP request. The socket is a **server → client** event feed plus
a subscribe/ack handshake, authenticated by the same cookie on the upgrade request. Two reasons:
every mutation stays testable without a socket, and authorization has exactly one implementation
rather than one per transport. Raw `ws` on the same HTTP listener; new runtime dependency: **`ws`**.

### D9 — Level stays derived; "points to spend" becomes a grant

The User asked for a DM who can edit a player's level and their points to spend. Neither is a
writable field, and making them one would break the rule the whole engine rests on.

- **Level** derives from experience through the `xp_thresholds` curve (TICKET-RES-01). A DM sets
  **experience**; the level follows. A "set level to 7" affordance is allowed as a convenience that
  computes and writes the threshold XP — never as a stored level.
- **Points to spend** derives as `level × const.points_per_level` (TICKET-RES-02). A DM handing out
  extra points is a **grant**: a new piece of stored player state, `Character.grantedStatPoints`,
  making the budget `derived pool + grants`. That is a **third** sanctioned exception to
  "derived values are never stored", alongside `currentResourceValues` and `experience`, and
  [CLAUDE.md](../../CLAUDE.md) is updated to say so when TICKET-DM-01 lands.

`Character.purse` (TICKET-CUR-02) is a fourth, and it is player state for the same reason
`currentResourceValues` is: money is spent at the table, not derived from anything.

### D10 — Tickets stay small

v2.0's rule carries over: at most **three to-be items** per ticket. Server/UI splits follow the
ROLL-01/ROLL-02 precedent — the server half is its own ticket wherever the UI half is more than a
form.

### D11 — New dependencies, in full

Runtime: `better-sqlite3`, `drizzle-orm`, `better-auth`, `ws`. Dev: `drizzle-kit`, `@types/ws`,
`dependency-cruiser`. That is the complete list this milestone adds; anything beyond it is a new
decision here. Note the shape of it: **four runtime dependencies for a backend, and the only one
that is a matter of taste is the auth library** — the rest are a driver, a query builder and a
WebSocket server. `dependency-cruiser` is development-only and is what makes D14's boundary a
check rather than a promise.
"The app stays browser-only" in [CLAUDE.md](../../CLAUDE.md) is superseded by this line and is
rewritten by TICKET-SRV-01.

### D14 — Three roots: `client/`, `server/`, `shared/`

**The backend is not a folder beside the components.** `src/server/` sitting as a sibling of
`src/components/` and `src/stores/` says the two are the same kind of thing, and a boundary that is
only a naming convention is one a tired afternoon erases. So `src/` gets exactly three top-level
areas, and the frontend is *inside* one of them:

```
src/
  shared/    the Kernel — types/ + engine/. Pure. Imports neither sibling.
  client/    components/ ui/ config/ play/ shared/, routes/, stores/,
             and the browser half of services/ (LocalStorage, download blobs)
  server/    db/, repositories/, auth/, ws/, routes' handlers, env
```

**The rule is symmetric and mechanical**: `client/` and `server/` may each import `shared/` and
nothing of each other; `shared/` imports neither. A test walks the tree and fails on any edge that
breaks it, and the build proves separately that no server-only module reaches the client bundle —
because the consequence of getting that wrong is a leaked secret, not an untidy diagram.

**Three path aliases replace relative imports across roots**: `#shared/*`, `#client/*`, `#server/*`.
This reverses [CLAUDE.md](../../CLAUDE.md)'s "the `#/*` alias exists but is unused — don't
half-adopt it", and the reversal is the point — it is adopted *fully*, in the one change where every
import is being rewritten anyway, so it costs nothing extra. It also makes a violation visible at the
import line rather than only in a test, and lets the boundary be checked by alias rather than by
counting `../`s.

**The move surfaces a real split in `services/`**, and TICKET-DX-07 has to make it: shape validation,
retired-field refusal and the stored↔display formula translation are pure and are needed by the
*server* (RUL-01, RUL-02, IO-04), while LocalStorage, `Blob` and the download helpers are browser-only.
The first group goes to `shared/`, the second stays in `client/`. That split was always there — the
one-root tree just let it hide.

### D13 — Sessions are long-lived and rolling, not an access/refresh pair

The User asked for refresh tokens so that opening the page does not mean signing in again. The
property is right; the mechanism for this stack is a **persistent HTTP-only session cookie with
rolling renewal** — an idle window that a use extends, an absolute ceiling it cannot pass, and a
rotated identifier on each renewal (TICKET-AUTH-04, v3 Req 48).

Why not an access/refresh pair: it would put a long-lived credential somewhere client-side code can
reach, to buy a property the cookie already has. The browser is the thing that needs to remember,
and a cookie is how a browser remembers. Better Auth issues sessions this way, so this is also the
path where the library's own hardening applies rather than being worked around.

**Real refresh tokens do exist here — the Providers' — and we deliberately do not keep them.** They
authorise calls to Google and Discord APIs on the Account's behalf, and this application makes none.
Storing one would be a long-lived credential held for no feature (v3 Req 48.10).

### D12 — No outbound email, at all

The application sends nothing. No SMTP configuration, no provider account, no mail port. A first
draft of this milestone had one; the User threw it out, and the milestone is better for it.

**"Invite by email" survives intact, delivered on-platform** (TICKET-GAM-03). The DM types an
address, and the Account holding it sees a pending invitation in the app. The email address is an
address book, not a transport. This is *better* than mail would have been — it cannot land in spam,
it cannot be forwarded to the wrong person, and it stays revocable after the fact. An address nobody
has registered yet holds the Invite pending until someone does.

One thing genuinely does go, and it is accepted deliberately rather than discovered later:

- **A password-only Account is unrecoverable.** Password reset needs mail, so there is none: forget
  the password and the rulesets go with it. Sign-up says so in words and offers linking a Google or
  Discord identity as the recovery path (v3 Req 30.10) — the price stated to the person paying it,
  at the moment they can still avoid it. That is what makes TICKET-AUTH-02 the milestone's only
  account recovery rather than a convenience.

If outbound email is ever wanted, it arrives as its own ticket with a port and one provider — not
as a dependency smuggled in under something else.

## Not in this milestone (deliberately)

Offline editing and conflict-free merge. Real-time collaborative *ruleset* editing (two Owners in
one ruleset — the `revision` guard refuses the second write rather than merging it). Chat, voice,
maps, tokens, initiative tracking. A public ruleset gallery or marketplace. Per-entity permissions
finer than owner/DM/player. A mobile app. **Anything involving outbound email** — sign-up
verification, password reset, invitation delivery (D12). Horizontal scaling: one process, one
SQLite file, in-memory socket rooms.

## Open — in build order

Server foundation — nothing here is user-visible, and everything after it depends on all of it:

- [ ] [TICKET-DX-07](./tickets/TICKET-DX-07-three-root-source-tree.md) — Three roots: `client/`, `server/`, `shared/` (v3 Req 50) — **first, before a line of server code exists**: a pure move of the existing tree, so nothing later has to be moved twice. Numbered 07 but built first, the DX-05-taken-early precedent. Also splits `services/` along the seam that was always there, and installs dependency-cruiser with the root boundary
- [ ] [TICKET-SRV-01](./tickets/TICKET-SRV-01-server-layer-and-kernel-boundary.md) — The server layer and the Kernel boundary (v3 Req 45, 47) — fills DX-07's empty `server/` root: the env loader and the request pipeline that every later ticket plugs into
- [ ] [TICKET-DB-01](./tickets/TICKET-DB-01-sqlite-drizzle-and-migrations.md) — SQLite, Drizzle and migrations (v3 Req 46) — the database file, the schema for the server's own model, and the migration runner
- [ ] [TICKET-DX-08](./tickets/TICKET-DX-08-architecture-rules-as-checks.md) — The project's architecture rules, as dependency-cruiser rules (v3 Req 51) — **after DB-01**, because two of the rules are about a database layer that has to exist first. Encodes what CLAUDE.md has stated as prose since v1.0: store-owned persistence, repository-owned queries, a framework-free Kernel, UI primitives as leaves
- [ ] [TICKET-DX-06](./tickets/TICKET-DX-06-server-test-harness.md) — Server test harness (v3 Req 45.3) — in-memory database per test, a request helper, and seeded fixtures; **before AUTH-01** so every server ticket after it is testable the same way

Accounts:

- [ ] [TICKET-AUTH-01](./tickets/TICKET-AUTH-01-email-password-accounts.md) — Email/password accounts and Auth_Sessions (v3 Req 30) — Better Auth on D2's database
- [ ] [TICKET-AUTH-02](./tickets/TICKET-AUTH-02-social-sign-in.md) — Social sign-in: Google **and Discord**, with identity linking (v3 Req 31) — needs AUTH-01's account table; each provider independently optional, and one shared rule path so the two cannot diverge. Under D12 this is the milestone's only account recovery, not a convenience
- [ ] [TICKET-AUTH-03](./tickets/TICKET-AUTH-03-authorization-and-protected-routes.md) — Authorization primitives and protected routes (v3 Req 32) — **the ticket the rest of the milestone leans on**: `requireAccount`, the ownership guards, and the indistinguishable 404
- [ ] [TICKET-AUTH-04](./tickets/TICKET-AUTH-04-persistent-sessions.md) — Persistent sessions with rolling renewal (v3 Req 48) — D13: closing the browser no longer signs you out. Last in this group because the expiry-mid-session surface reuses AUTH-03's return-to-destination redirect

Rulesets on the server:

- [ ] [TICKET-RUL-01](./tickets/TICKET-RUL-01-ruleset-records.md) — Ruleset records: list, create, rename, delete (v3 Req 33) — the first owned resource, and the template for every guard after it
- [ ] [TICKET-RUL-02](./tickets/TICKET-RUL-02-server-backed-ruleset-editing.md) — Server-backed ruleset editing (v3 Req 33.5–33.8) — the `revision` guard and the save pipeline; `useConfigStore` stops owning the truth
- [ ] [TICKET-RUL-03](./tickets/TICKET-RUL-03-copy-a-ruleset.md) — Copy a ruleset (v3 Req 34) — small, and it proves the document round-trips without shared references
- [ ] [TICKET-IO-04](./tickets/TICKET-IO-04-import-creates-a-ruleset.md) — Import creates a ruleset; upload this browser's to your account (v3 Req 35, 36) — reuses `importExport.ts` wholesale on both paths; D6's bridge between the two homes lands here, as a copy rather than a move

Game sessions:

- [ ] [TICKET-GAM-01](./tickets/TICKET-GAM-01-game-sessions-and-snapshots.md) — Game sessions and pinned Snapshots (v3 Req 37) — D7; the second owned resource and the room every later ticket scopes to
- [ ] [TICKET-GAM-02](./tickets/TICKET-GAM-02-join-by-invite-code.md) — Join by invite code (v3 Req 38.1, 38.2, 38.4, 38.7) — the path a table actually uses
- [ ] [TICKET-GAM-03](./tickets/TICKET-GAM-03-invite-by-email.md) — Invite by email, delivered on-platform (v3 Req 38.3, 38.5–38.7) — D12: no mail is sent; the Account holding that address sees a pending invitation in the app, and one for an unregistered address waits for it
- [ ] [TICKET-GAM-04](./tickets/TICKET-GAM-04-membership-roles-and-lobby.md) — Membership, roles and the session lobby (v3 Req 39) — remove, leave, transfer DM; the first surface that shows other people

Characters and play:

- [ ] [TICKET-CHAR-04](./tickets/TICKET-CHAR-04-characters-per-session.md) — Characters are created per session (v3 Req 40) — the creation wizard runs against the Snapshot and posts to the server
- [ ] [TICKET-PLY-01](./tickets/TICKET-PLY-01-player-actions-through-the-server.md) — Player actions go through the server (v3 Req 41) — spend, resources, inventory; the Kernel checks run server-side
- [ ] [TICKET-ROLL-07](./tickets/TICKET-ROLL-07-server-resolved-rolls.md) — Server-resolved rolls and the session roll log (v3 Req 41.6, 45.2) — the RNG moves; `useUIStore`'s history becomes a projection of Events
- [ ] [TICKET-CUR-02](./tickets/TICKET-CUR-02-character-purse.md) — A character carries a purse (v3 Req 43) — a persisted-shape change with a `schemaVersion` bump and a `docs/imports/` fragment; **before DM-02**, which edits it
- [ ] [TICKET-DM-01](./tickets/TICKET-DM-01-dm-controls-progression.md) — DM controls: experience, grants, resources (v3 Req 42.1–42.4) — D9; `grantedStatPoints` is the third sanctioned stored value
- [ ] [TICKET-DM-02](./tickets/TICKET-DM-02-dm-controls-inventory-and-purse.md) — DM controls: inventory and purse (v3 Req 42.5–42.7) — needs CUR-02
- [ ] [TICKET-DM-03](./tickets/TICKET-DM-03-quick-actions-and-sheet-sidebar.md) — Quick actions derived from the ruleset, and the sheet sidebar (v3 Req 49.1–49.7, 49.10) — mechanism before placement, the ROLL-01/ROLL-02 split. **The action set comes from the Snapshot's `isResource` stats**, so a ruleset naming its pools *Vigor* and *Focus* gets *Damage Vigor* and *Restore Focus* with no code change; every action is a shortcut to a DM-01/DM-02 route and adds no server surface

Live:

- [ ] [TICKET-LIVE-01](./tickets/TICKET-LIVE-01-websocket-transport-and-rooms.md) — WebSocket transport and authenticated rooms (v3 Req 44.1–44.3) — D8; cookie auth on upgrade, room per session
- [ ] [TICKET-LIVE-02](./tickets/TICKET-LIVE-02-event-fan-out-and-reconciliation.md) — Event fan-out and client reconciliation (v3 Req 44.4, 44.5, 44.7) — every Event written since PLY-01 finally goes somewhere
- [ ] [TICKET-LIVE-03](./tickets/TICKET-LIVE-03-presence-reconnect-and-replay.md) — Presence, reconnect and replay (v3 Req 44.6, 44.8, 44.9) — the ticket that makes a flaky connection survivable rather than confusing

The DM's cockpit, then closing:

- [ ] [TICKET-DM-04](./tickets/TICKET-DM-04-session-roster-with-quick-actions.md) — The session roster with quick actions (v3 Req 49.7–49.10) — **the last feature ticket, and deliberately after LIVE-03**: a roster is the surface that most obviously has to be live, and a DM reads it and acts without checking, so building it before the event feed and presence existed would mean building it twice. Replaces GAM-04's lobby rather than sitting beside it
- [ ] [TICKET-POL-03](./tickets/TICKET-POL-03-deployment-shape.md) — Deployment shape: build, environment, data directory, backup (v3 Req 47) — **last**: the milestone is not done until someone other than the author can run it. **One process serves the client bundle, the API and the socket** (D1) — the operator runs one web server, not a static host beside an API
- [ ] Final checkpoint — full suite green, mirroring v1.0's §18 and v2.0's final line: `npx vitest run` 0 failing / 0 skipped, `npx tsc --noEmit` at the documented baseline, `yarn run check` clean, `fallow audit --base HEAD` with zero introduced findings, and a live browser check of **both** loops — (a) signed out: build a ruleset, export it, create a character on it, spend points and roll, with no account anywhere; and (b) signed in: build a ruleset, start a session, invite a second account by email and have it appear in that account's invitations, create a character, spend points, roll, watch the DM's adjustment reach the other browser without a refresh, and **take damage off that character from the DM's roster and see it land in the player's browser** (Req 49) — then close both browsers, reopen them, and still be signed in (Req 48)

## Definition of Done (applies to every ticket)

Per [../../CLAUDE.md](../../CLAUDE.md): `npx vitest run` green — 0 failures, 0 skips —
`npx tsc --noEmit` with no errors beyond the documented baseline in
[TEST_STATUS.md](../../TEST_STATUS.md), `yarn run check` clean (the pre-commit hook enforces it),
verification via the `verifier` subagent plus the `fallow` and `coding-conventions` skills, and a
live browser check for anything UI-visible (ask the User first; if declined, the criterion stays
open with a note). A ticket that adds or reshapes a persisted entity also lands that feature's
fragment in [`docs/imports/`](../imports/README.md) and reruns `yarn run sheet:import`.

Four rules this milestone adds, on top of those:

1. **The Kernel stays pure**, and after DX-07 that is a check rather than a claim: `shared/` imports
   neither sibling, and `client/` and `server/` never reach each other. A rule that both sides need
   lives in `shared/`. A ticket does not get to add a dependency-cruiser exception to land.
2. **Authorization is proven, not asserted.** Every ticket adding a server route adds a test that
   the route refuses a non-owner, a non-member and an anonymous caller. A route without those three
   tests is not done. This one is a *test*, not a rule — dependency-cruiser sees imports, and a
   handler that imports a guard without calling it satisfies every import rule there is.
3. **No derived value crosses the wire as input.** A request body carrying a stat value, a level, a
   point budget or a roll result is rejected, and there is a test saying so.
4. **A schema migration is forward-only and tested.** Each migration ships with a test that applies
   it to the previous schema and asserts the resulting shape.
5. **Local mode never regresses.** A ticket touching a shared surface proves the signed-out path
   still works, and the cheapest proof is that the existing `configStore`, `characterStore` and
   component tests pass **unchanged**. A ticket that has to edit them to make local mode fit has
   probably put the branch in the wrong place (D6).
