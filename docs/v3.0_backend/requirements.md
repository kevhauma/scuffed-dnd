# Requirements Document — v3.0 Backend & Multiplayer

## Introduction

This document specifies requirements for giving Custom DnD Builder a **backend**. Through v2.0 the
app was browser-only: one ruleset, one browser, LocalStorage, no accounts. v3.0 adds accounts,
server-owned rulesets, multi-player **game sessions** with a Dungeon Master, and live updates over
WebSockets, backed by SQLite.

**It adds; it does not replace.** The browser-only app keeps working signed out — build a ruleset,
export it, create characters on it, play them — and an Account is required only to sit at a table
with other people. That is
[overview.md D6](./overview.md#d6--local-mode-stays-sign-in-gates-connected-play-only), and several
requirements below open with a criterion **0** stating what the unauthenticated path must still do.

**Two subjects, on purpose.** v1.0's requirements all read `THE Application SHALL …`. This document
distinguishes them, because the split is the milestone's central rule:

- **THE Server SHALL …** — an obligation that must hold even if the client is hostile, patched, or
  replaced by `curl`. Every one of these is enforced in `src/server/`.
- **THE Client SHALL …** — a browser-side obligation about what the User or Player sees.
- **THE Application SHALL …** — an obligation on the system as a whole, where the split is not
  the point.

A client-side check is never sufficient on its own. Where a rule appears on both sides, the client
check exists to give a good message, and the server check exists to make the rule true.

## Glossary

Additions to the [v1.0 glossary](../v1.0_foundation/requirements.md#glossary). The v1.0 terms
(User, Player, Character, Stat, Skill, Formula, …) keep their meanings.

- **Account**: a registered identity — an email address plus a password, a linked social identity
  (Google or Discord), or both. One Account is both a User and a Player depending on which room they
  are standing in.
- **Provider**: an external identity source the application accepts a sign-in from. v3.0 has exactly
  two, Google and Discord, each independently optional.
- **Quick_Action**: a named one-press adjustment a DM applies to a Character — *damage*, *restore*,
  *give points*, *award XP*. Every Quick_Action is a presentation of a Requirement 42 control, never
  a separate power. The set is **derived from the Snapshot**, so a ruleset's own resource stats name
  their own actions.
- **Auth_Session**: the browser's proof of being signed in — a server-issued, HTTP-only cookie.
  Distinct from a Game_Session, and the two words are never used interchangeably below.
- **Ruleset**: what v1.0/v2.0 called a **Configuration**, now a server-owned record with an owner,
  a name, and a `revision`. The JSON document inside it is unchanged — still a `Configuration` as
  defined by `src/types/config.ts`.
- **Owner**: the Account that created a Ruleset. Only an Owner may edit or delete it.
- **Game_Session**: a table — one Ruleset snapshot, one DM, zero or more Players, and the
  Characters they play. The unit of live update.
- **DM**: the Account that created a Game_Session. Holds powers over every Character in it.
- **Member**: an Account that has joined a Game_Session, with a `role` of `dm` or `player`.
- **Invite**: a pending grant of membership, addressed either to an email address or to nobody in
  particular via a shareable **Invite_Code**.
- **Snapshot**: the frozen copy of a Ruleset taken when a Game_Session is created. The session is
  played against the Snapshot, not against the live Ruleset.
- **Revision**: a monotonically increasing integer on any server-owned document. A write states the
  revision it was based on; a mismatch is a conflict, not a silent overwrite.
- **Event**: an append-only record of something that changed in a Game_Session — a spend, a roll,
  a DM adjustment, a member joining. What the live feed carries.
- **Kernel**: `src/types/` and `src/engine/` — the pure layer both the browser and the server
  import, so that a rule is written once and enforced in both places.
v3.0 has **no** outbound email of any kind — no verification, no password reset, no invitation
delivery. An Invite's email address is a *binding* on who may redeem it, never an address anything
is sent to. See [overview.md D12](./overview.md#d12--no-outbound-email-at-all).

## Requirements

### Requirement 30: Accounts and Authentication

**User Story:** As a visitor, I want to create an account with my email and a password, so that my
rulesets and characters follow me between browsers and devices.

#### Acceptance Criteria

1. THE Server SHALL allow account creation from an email address and a password
2. THE Server SHALL reject an account creation whose email address is already registered, without
   revealing whether the existing account uses a password or a linked identity
3. THE Server SHALL store passwords only as a salted one-way hash, never in a recoverable form
4. THE Server SHALL issue an Auth_Session as an HTTP-only, `SameSite`-restricted cookie on
   successful sign-in, and SHALL NOT place the identity in a client-readable store
5. THE Server SHALL expire an Auth_Session on explicit sign-out and on the lifetimes defined in
   [Requirement 48](#requirement-48-session-persistence-and-renewal)
6. WHEN sign-in fails, THE Server SHALL respond identically for an unknown email and for a wrong
   password
7. THE Server SHALL rate-limit repeated failed sign-in attempts per email address
8. THE Client SHALL provide sign-up, sign-in and sign-out surfaces, and SHALL show the signed-in
   Account's email in the application shell
9. THE Application SHALL send no email — there is no address verification and no password reset
10. THE Client SHALL state at sign-up that a password-only Account cannot be recovered if its
    password is lost, and SHALL offer linking a social identity as the recovery path

### Requirement 31: Social Sign-In (Google and Discord)

**User Story:** As a visitor, I want to sign in with Google or Discord, so that I do not have to
manage another password — and, for a table that already organises itself on Discord, so that the
identity I bring is the one my group knows me by.

#### Acceptance Criteria

1. THE Server SHALL support the OAuth 2.0 authorization-code flow with PKCE for **Google** and for
   **Discord**
2. THE Server SHALL create an Account on a first social sign-in, taking the email address and
   display name from the verified provider profile
3. WHEN a provider profile's verified email matches an existing Account, THE Server SHALL link that
   identity to the Account rather than creating a second one
4. THE Server SHALL refuse to link a provider profile whose email address the provider has not
   verified, and SHALL refuse a profile carrying no email address at all
5. THE Server SHALL allow one Account to hold both provider identities, and SHALL refuse to link a
   provider identity already bound to a different Account
6. THE Application SHALL treat each provider as **independently optional** — with a provider's
   credentials unconfigured its button is absent, the other provider and email/password are
   unaffected, and the application is fully usable
7. THE Server SHALL apply every rule in this requirement through one provider-agnostic code path,
   so that the two providers cannot diverge in behaviour
8. THE Server SHALL keep OAuth client secrets out of the client bundle and out of version control
9. THE Client SHALL show an Account which identities are linked, and SHALL allow linking a provider
   to an Account that is already signed in

### Requirement 32: Access Control

**User Story:** As an account holder, I want my data to be mine, so that no other account can read
or change my rulesets, sessions or characters.

#### Acceptance Criteria

1. THE Server SHALL resolve every request to an Account or to nobody, and SHALL treat an absent or
   invalid Auth_Session as nobody
2. THE Server SHALL refuse every read and write of a Ruleset that the requesting Account does not
   own, except through a Game_Session the Account is a Member of
3. THE Server SHALL refuse every read and write within a Game_Session the requesting Account is not
   a Member of
4. THE Server SHALL refuse a write to a Character the requesting Account neither owns nor is DM over
5. THE Server SHALL respond to an unauthorized read and to a missing record indistinguishably, so
   that identifiers cannot be probed for existence
6. THE Client SHALL treat as protected exactly those routes that reach server-owned data — account
   rulesets, game sessions, invitations — and SHALL leave every local-mode route open to an
   unauthenticated visitor
7. THE Client SHALL redirect an unauthenticated visitor from a protected route to sign-in, and SHALL
   return them to the requested route afterwards
8. THE Server SHALL enforce every rule in this requirement in `src/server/`, independently of any
   client-side check

### Requirement 33: Ruleset Ownership and Lifecycle

**User Story:** As a User, I want several named rulesets under my account, so that I can develop
more than one game system.

#### Acceptance Criteria

1. THE Server SHALL store zero or more Rulesets per Account, each with a name, a `schemaVersion`, a
   `revision`, and the `Configuration` document
2. THE Server SHALL allow an Owner to create, rename and delete their own Rulesets
3. THE Server SHALL create a new Ruleset seeded exactly as `createFreshConfiguration()` seeds one,
   so a server-created ruleset and a browser-created one are the same ruleset
4. THE Server SHALL reject a Ruleset whose `schemaVersion` is not the supported version, with the
   version stated
5. THE Server SHALL validate a submitted `Configuration` with the same shape check the import path
   uses, before persisting it
6. THE Server SHALL increment `revision` on every accepted write, and SHALL refuse a write whose
   stated base revision is not the current one
7. THE Server SHALL refuse to delete a Ruleset that a Game_Session was created from, unless the
   Owner confirms, and SHALL leave every such session playable on its Snapshot afterwards
8. THE Client SHALL list an Account's Rulesets with their names and last-modified times, and SHALL
   surface a refused write as a conflict the User can resolve, never as a silent loss

### Requirement 34: Ruleset Copying

**User Story:** As a User, I want to copy a ruleset, so that I can try a rebalance without risking
the one my table is playing.

#### Acceptance Criteria

1. THE Server SHALL create an independent Ruleset from an existing one the Account owns, with a new
   id, a new name, and `revision` reset
2. THE Server SHALL copy the `Configuration` document such that no entity id, formula reference or
   curve override is shared by reference between the original and the copy
3. THE Server SHALL leave the source Ruleset unchanged by a copy
4. THE Server SHALL NOT copy a Ruleset the Account does not own
5. THE Client SHALL offer a copy action from the ruleset list, and SHALL default the new name to a
   distinguishable derivative of the original

### Requirement 35: Ruleset Import and Export

**User Story:** As a User, I want to import and export rulesets whether or not I am signed in, so
that sharing a system with another table works without an account and creates a ruleset when I have
one.

#### Acceptance Criteria

0. THE Client SHALL allow import and export in local mode with no Account, exactly as it does today —
   the import replaces the browser's loaded `Configuration` and the export downloads it
1. WHEN an Account is signed in, THE Server SHALL accept an uploaded `Configuration` JSON and
   **create** a new Ruleset from it, never overwriting an existing one
2. THE Server SHALL run the same `schemaVersion` gate, shape validation and retired-field refusal
   the browser import path runs, and SHALL persist nothing when any of them fails
3. THE Server SHALL run the engine's referential validation on an accepted import and SHALL return
   its report alongside the created Ruleset, applying the import even when the report has errors
4. THE Server SHALL export a Ruleset the Account owns as the same JSON document the browser export
   produced, so a file round-trips between the two
5. THE Client SHALL show the returned validation report after an import, and SHALL name the created
   ruleset in the result

### Requirement 36: Local Mode and Uploading

**User Story:** As a visitor, I want to build a ruleset and play characters on it without an
account, and to put it on my account later if I decide to — so that trying the app costs nothing and
adopting an account loses nothing.

#### Acceptance Criteria

1. THE Client SHALL allow an unauthenticated visitor to create, edit, import, export and validate a
   `Configuration` and to create and play Characters against it, persisted in LocalStorage exactly
   as the application did before this milestone
2. THE Application SHALL treat LocalStorage as the **source of truth for local mode**, not as a
   cache of server state, and signing in SHALL NOT alter, move or clear it
3. THE Client SHALL offer, to any signed-in Account and at any time, to upload the browser's stored
   `Configuration` as a Ruleset, and SHALL take no action without an explicit choice
4. THE Client SHALL offer a download of the raw stored bytes before any upload, reusing the existing
   backup path
5. WHEN an upload is accepted, THE Application SHALL create one Ruleset from the stored
   `Configuration` and one Character per stored `Character`, attributed to the signed-in Account,
   and SHALL leave the stored originals unchanged — an upload copies, it does not move
6. THE Client SHALL offer the upload once unprompted on an Account's first sign-in, and SHALL NOT
   prompt again for that Account, leaving the action reachable on demand
7. THE Application SHALL refuse to upload stored data whose `schemaVersion` this build does not
   support, with the same notice the existing incompatible-data path shows
8. THE Client SHALL make it unambiguous at all times whether the ruleset on screen lives in this
   browser or on the Account

### Requirement 37: Game Session Lifecycle

**User Story:** As a DM, I want to start a session from one of my rulesets and invite people to it,
so that we can play together.

#### Acceptance Criteria

1. THE Server SHALL create a Game_Session from a Ruleset the Account owns, recording the creating
   Account as DM
2. THE Server SHALL take a Snapshot of the Ruleset at creation, and SHALL evaluate every rule in
   the session against the Snapshot rather than the live Ruleset
3. THE Server SHALL allow a DM to refresh the Snapshot from the current Ruleset as an explicit act,
   and SHALL record the refresh as an Event
4. THE Server SHALL NOT change a Snapshot as a side effect of any edit to the source Ruleset
5. THE Server SHALL allow a DM to archive a Game_Session, after which it is readable but accepts no
   writes
6. THE Server SHALL refuse a Snapshot refresh that would leave an existing Character invalid
   against the new Snapshot, and SHALL name what breaks

### Requirement 38: Invitations

**User Story:** As a DM, I want to invite people by email address or by handing them a code, so that
joining my table is not an administrative exercise.

#### Acceptance Criteria

1. THE Server SHALL issue a per-session Invite_Code that any signed-in Account may redeem to join
   as a `player`
2. THE Server SHALL allow a DM to revoke and reissue an Invite_Code, invalidating the previous one
3. THE Server SHALL allow a DM to create an email-addressed Invite, redeemable only by the Account
   whose email matches
4. THE Server SHALL expire an Invite after a configured lifetime, and SHALL refuse an expired,
   revoked, declined or already-redeemed Invite with a distinct message for each
5. THE Server SHALL deliver an email-addressed Invite **on-platform** — it appears in the matching
   Account's pending invitations when that Account is signed in — and SHALL send no email
6. WHEN no Account holds the addressed email, THE Server SHALL hold the Invite pending and SHALL
   present it to the Account that later registers that address, within the Invite's lifetime
7. THE Client SHALL show an Account its pending invitations with the session name and who invited
   them, and SHALL let the Account accept or decline each one
8. WHEN an Account redeems an Invite they have already redeemed, THE Server SHALL return the
   existing membership rather than an error

### Requirement 39: Membership and Roles

**User Story:** As a DM, I want to see who is at my table and be able to remove someone, so that the
session's membership stays accurate.

#### Acceptance Criteria

1. THE Server SHALL record each Member with a `role` of exactly `dm` or `player`
2. THE Server SHALL keep exactly one `dm` per Game_Session
3. THE Server SHALL allow a DM to remove a `player` Member, and SHALL retain that Player's
   Characters in the session as read-only rather than deleting them
4. THE Server SHALL allow a DM to transfer the `dm` role to another Member, after which the former
   DM holds `player` powers
5. THE Server SHALL allow a `player` Member to leave a Game_Session, with the same retention rule
6. THE Server SHALL refuse a DM's attempt to remove themselves without transferring the role first
7. THE Client SHALL show every Member with their role and connection state in the session lobby

### Requirement 40: Characters within a Game Session

**User Story:** As a Player, I want to create my character inside the session I am playing, so that
it is built on that table's rules.

#### Acceptance Criteria

0. THE Client SHALL allow an unauthenticated visitor to create and play Characters against the
   browser's loaded `Configuration`, persisted in LocalStorage, with no Game_Session involved
1. THE Server SHALL scope every server-owned Character to exactly one Game_Session, owned by exactly
   one Account
2. THE Server SHALL build and validate a Character against the session's Snapshot, never against a
   live Ruleset
3. THE Server SHALL refuse a Character creation from an Account that is not a Member of the session
4. THE Server SHALL allow a Member to read every Character in their session, and to write only
   their own
5. THE Server SHALL persist only the player state the Kernel sanctions — invested points, current
   resource values, experience, inventory, purse, and DM grants — and SHALL reject a submitted
   Character carrying a derived value
6. THE Client SHALL run the existing creation wizard against the Snapshot, and SHALL create the
   Character through the server rather than in a local store
7. THE Server SHALL scope a Character uploaded from a browser (Req 36.5) to the Ruleset it was
   built against and to no Game_Session, and THE Client SHALL show its owner that it is at no table
   rather than leaving it unreachable
8. WHEN a Ruleset is deleted, THE Server SHALL delete the Characters uploaded with it, and SHALL
   allow an owner to delete one directly

> **7 and 8 were added by TICKET-CHAR-04**, and the honest version of why is that they were *its
> acceptance criteria first*. TICKET-IO-04 created a state this requirement did not describe — a
> Character owned by an Account, built against a Ruleset, at no table — and its own review flagged
> that nothing listed, deleted or cascaded to one. CHAR-04 owns closing that, so the behaviour it
> closes it with belongs here rather than only in a ticket. Criterion 1 above still reads *"scope
> every server-owned Character to exactly one Game_Session"*; 7 is the deliberate exception to it,
> and naming it as one is the point of writing it down.

### Requirement 41: Player Actions

**User Story:** As a Player, I want to spend my points, roll my rolls and manage my inventory at the
table, so that I can play without asking the DM to type for me.

#### Acceptance Criteria

1. THE Server SHALL accept a point spend only when the Kernel's allocation check accepts it against
   the session Snapshot, and SHALL refuse rather than clamp an unaffordable spend
2. THE Server SHALL accept a current-resource-value change, clamping to the derived maximum exactly
   as the existing store action does, and SHALL leave a stored current above a fallen maximum in
   place rather than rewriting it
3. THE Server SHALL accept equip, unequip and inventory-move actions only when the Kernel's slot
   rules accept them
4. THE Server SHALL accept a purse change only when the resulting balance is representable in the
   Snapshot's currency tiers
5. THE Server SHALL refuse a Player's write to a Character they do not own
6. THE Server SHALL record every accepted Player action as an Event
7. THE Client SHALL present a refused action as a refusal with the server's reason, and SHALL NOT
   leave the surface showing an action that did not land

### Requirement 42: Dungeon Master Controls

**User Story:** As a DM, I want to adjust a player's experience, spendable points, resources,
inventory and money, so that the table's fiction can be reflected in the sheet.

#### Acceptance Criteria

1. THE Server SHALL allow a DM to award and deduct experience on any Character in their session,
   refusing a deduction below zero
2. THE Application SHALL keep **level derived from experience** — a DM sets experience, and the
   level follows; there SHALL be no writable level field
3. THE Server SHALL allow a DM to grant and revoke spendable stat points on a Character, held as a
   distinct stored grant rather than as invested points, so that the Kernel's budget becomes
   `derived pool + grants`
4. THE Server SHALL refuse a grant revocation that would leave the Character having spent more than
   their budget, and SHALL name the overspend
5. THE Server SHALL allow a DM to set current resource values, add and remove inventory items, and
   set the purse on any Character in their session, under the same Kernel rules a Player's own
   action obeys
6. THE Server SHALL record every DM adjustment as an Event naming the DM, the Character, and the
   before and after values
7. THE Client SHALL present DM controls only to the DM, and SHALL show a Player the Events that
   changed their own sheet

### Requirement 43: Character Purse

**User Story:** As a Player, I want my character to carry money, so that the currency system the
ruleset defines has somewhere to land.

#### Acceptance Criteria

1. THE Application SHALL store a Character's money as a single amount in the ruleset's base
   currency tier, never as a per-tier breakdown
2. THE Application SHALL display a purse through the existing `formatCurrency` normalisation, so
   that the tier shown follows the ruleset's conversion rates
3. THE Application SHALL treat an absent purse as zero, and SHALL NOT grow the field on a Character
   that has none
4. THE Application SHALL refuse a purse change that would make the balance negative
5. THE Application SHALL add the purse to the persisted `Character` shape **without** a
   `SUPPORTED_SCHEMA_VERSION` bump, and SHALL land a matching `docs/imports/` fragment update

   > **Amended by TICKET-CUR-02 (2026-08-27), which found the two halves incompatible.** The version
   > gates the **`Configuration`**, not the Character: bumping it makes `loadConfiguration` throw
   > `StorageSchemaError` for a ruleset that did not change, so `RootLayout` renders
   > `IncompatibleDataNotice` and `loadCharacters` never runs. The ticket also has to *convert* a
   > per-tier `wallet` that shipped without one — so a bump would refuse to read the data the
   > conversion exists to keep. Bump and migrate are mutually exclusive, and the rule the bump
   > enforces (*a build must not crash on a field that moved*) is not engaged here: `purse` is
   > additive-optional and nothing reads `wallet`. A requirement change outranks a ticket, so this is
   > amended in place rather than quietly outgrown.

6. THE Application SHALL keep reading a stored Character that still carries the retired per-tier
   `wallet`, and SHALL convert it to a base-tier purse rather than discarding it

### Requirement 44: Live Updates

**User Story:** As a Player, I want the table to update as things happen, so that I see the DM's
adjustments and other players' rolls without refreshing.

#### Acceptance Criteria

1. THE Server SHALL accept WebSocket connections authenticated by the same Auth_Session cookie the
   HTTP requests use, and SHALL close a connection that presents none
2. THE Server SHALL admit a connection to a Game_Session's room only when the Account is a Member
   of it
3. THE Server SHALL broadcast an Event to every connection in that session's room, and to no other
   room
4. THE Server SHALL treat the socket as a **notification** channel: every state-changing action
   arrives over HTTP, and the socket carries what changed
5. THE Server SHALL assign each Event a per-session monotonic sequence number
6. WHEN a client reconnects, THE Server SHALL replay the Events it missed from its last-seen
   sequence number, or SHALL instruct it to resynchronise fully when the gap is too large
7. THE Client SHALL apply an Event to its cached state without refetching the whole session, and
   SHALL fall back to a full refetch when it cannot
8. THE Client SHALL show connection state, and SHALL make it obvious when what is on screen is
   stale
9. THE Application SHALL remain correct with the socket disconnected — actions still work over
   HTTP, only the liveness is lost

### Requirement 45: Server Authority

**User Story:** As a DM, I want the rules enforced by the server, so that a modified client cannot
give a character points nobody granted.

#### Acceptance Criteria

1. THE Server SHALL re-derive every value it needs from the Kernel, and SHALL NOT trust a derived
   value present in a request body
2. THE Server SHALL resolve dice rolls server-side, and SHALL treat a client-submitted roll result
   as invalid input
3. THE Server SHALL validate every mutation with the same `src/engine/` functions the client calls,
   so that a rule cannot be enforced in one place and not the other
4. THE Kernel SHALL remain pure — no storage, no network, no React — so that both callers can
   import it
5. THE Application SHALL NOT duplicate a rule in server-only code when the Kernel can hold it
6. THE Client SHALL keep calculating for display, and SHALL treat its own result as a prediction
   the server may overrule

### Requirement 46: Persistence

**User Story:** As an operator, I want everything in one SQLite file, so that backing the game up is
copying a file.

#### Acceptance Criteria

1. THE Server SHALL persist all state in a single SQLite database file whose path is configuration
2. THE Server SHALL apply schema migrations at start-up, and SHALL refuse to serve when a migration
   fails rather than serving a half-migrated schema
3. THE Server SHALL store a Ruleset's `Configuration`, a Snapshot, and a Character's player state as
   JSON documents, and SHALL NOT normalise the ruleset's entity graph into tables
4. THE Server SHALL enforce foreign keys and SHALL run every multi-row write in a transaction
5. THE Server SHALL keep Events append-only
6. THE Application SHALL keep exactly two persistence mechanisms and one rule for choosing between
   them: LocalStorage owns local mode, SQLite owns everything belonging to an Account, and neither
   shadows the other

### Requirement 47: Deployment and Operations

**User Story:** As an operator, I want to run this as one process with a handful of environment
variables, so that hosting it is not a project of its own.

#### Acceptance Criteria

1. THE Application SHALL build to a single Node server serving both the client bundle and the API
2. THE Application SHALL read its secrets and paths from environment variables, and SHALL fail at
   start-up with a named error when a required one is missing
3. THE Application SHALL document every environment variable it reads, with whether it is required
4. THE Application SHALL run with no external services configured — the two OAuth providers are the
   only external integrations it has, each independently optional, and it is fully usable with
   neither
5. THE Application SHALL provide a health endpoint reporting database reachability and applied
   migration version
6. THE Application SHALL serve the client bundle, the API and the WebSocket from **one server
   process**, so that an operator runs one web server rather than a static host alongside an API
7. THE Application SHALL address the API and the socket from the client by relative path and by
   `window.location` respectively — no configurable API base URL and no environment variable naming
   the backend
8. WHEN running the development server, THE Application SHALL serve the API from the same origin as
   the app, so that development and production differ in build speed and nothing else

### Requirement 48: Session Persistence and Renewal

**User Story:** As an account holder, I want to stay signed in when I close the tab and come back
tomorrow, so that playing my game does not start with typing a password every time.

> **On the word "refresh token".** This application issues an HTTP-only **session cookie**, not an
> access/refresh token pair, so staying signed in is a long-lived cookie with **rolling renewal**
> rather than a token exchange. The distinction is not pedantry: a refresh-token design would put a
> long-lived credential where client-side code can reach it, and the property being bought here —
> "the browser remembers me" — is exactly what a cookie already does, with less to get wrong.
> Genuine refresh tokens exist in this system, but they belong to the **Providers** and are covered
> by criterion 10.

#### Acceptance Criteria

1. THE Server SHALL issue an Auth_Session cookie with an explicit expiry that outlives the browser
   process, so that closing and reopening the browser leaves the Account signed in
2. THE Server SHALL define two lifetimes as configuration: an **idle lifetime**, after which an
   unused Auth_Session expires, and an **absolute lifetime**, beyond which one cannot be renewed
   however active it has been
3. WHEN an Auth_Session is used within its idle lifetime, THE Server SHALL renew it — extending the
   idle expiry without user interaction and without a request the User waits on
4. THE Server SHALL NOT renew an Auth_Session past its absolute lifetime, and SHALL require a fresh
   sign-in at that point
5. THE Server SHALL rotate the session identifier on renewal, invalidating the previous one, so that
   a captured cookie has a bounded useful life
6. THE Server SHALL invalidate an Auth_Session on sign-out, and SHALL NOT allow renewal to resurrect
   an invalidated one
7. THE Server SHALL allow an Account to invalidate **every** Auth_Session it holds, and SHALL list
   an Account's active Auth_Sessions with enough detail to recognise them
8. THE Client SHALL restore the signed-in state on page load without a visible signed-out state
   first, and SHALL NOT show a sign-in surface to an Account whose Auth_Session is still valid
9. WHEN an Auth_Session expires while the application is open, THE Client SHALL present it as an
   expired session and route to sign-in preserving the destination, and SHALL NOT present it as a
   permission error or a failed action
10. THE Server SHALL NOT store a Provider's OAuth refresh token — the application calls no Provider
    API on the Account's behalf, so a stored one would be a long-lived credential held for no
    feature
11. THE Client SHALL offer, at sign-in, a session that ends with the browser instead, for an Account
    signing in on a device that is not theirs

### Requirement 49: Dungeon Master Quick Actions

**User Story:** As a DM running a fight, I want to take 7 off someone's health from the list in front
of me, so that keeping the sheets honest costs me a press rather than a detour into each character.

#### Acceptance Criteria

1. THE Client SHALL derive the Quick_Action set from the session Snapshot — one *damage* and one
   *restore* action per `isResource` stat, labelled from that stat's own name — plus *give points*,
   *take points*, *award experience* and *deduct experience*
2. THE Application SHALL hard-code no stat name, and SHALL contain no reference to "health", "hit
   points" or "mana" as concepts — a ruleset naming its resources *Vigor* and *Focus* SHALL produce
   *Damage Vigor* and *Restore Focus* with no code change (v1.0 Req 20)
3. THE Client SHALL apply every Quick_Action through the Requirement 42 routes, and THE Server SHALL
   expose no route reachable only by a Quick_Action
4. THE Client SHALL let a DM set an amount per Quick_Action, offering presets and typed entry, and
   SHALL apply a resource change as a **delta** rather than as an absolute value
5. WHEN a Quick_Action is accepted, THE Client SHALL show what changed as before → after; WHEN one is
   refused, THE Client SHALL show the server's reason and leave the surface on the pre-action state
6. THE Client SHALL offer *undo* on the most recent Quick_Action, applying its **inverse** through
   the same routes, and SHALL state that an inverse is not a restoration of the prior state where
   clamping or a changed maximum makes the two differ
7. THE Client SHALL render the same derived Quick_Action set in **both** placements — a row per
   Character on the Game_Session overview, and a sidebar on a Character's detail page — from one
   definition, so the two cannot offer different actions
8. THE Client SHALL show the Game_Session overview roster with each Character's owner, level,
   unspent points and current-versus-maximum for every resource stat
9. THE Client SHALL update the roster from Events without a refresh, including changes another
   Member made
10. THE Client SHALL render Quick_Actions only for the DM — absent for a `player`, not present and
    disabled — and THE Server SHALL refuse them regardless of what the client renders

### Requirement 50: Source Tree Separation

**User Story:** As a developer, I want the frontend and the backend to be visibly separate parts of
the repository rather than folders that happen to sit beside each other, so that the boundary is a
structure rather than a habit.

#### Acceptance Criteria

1. THE Application SHALL organise `src/` into exactly three top-level areas — `shared/`, `client/`
   and `server/` — with no other module directory beside them
2. THE Application SHALL place every component, route, store and browser-side service **inside**
   `client/`, and SHALL NOT leave any of them at the same level as `server/`
3. THE Application SHALL place the Kernel — the type definitions and the engine — in `shared/`, and
   `shared/` SHALL import from neither sibling
4. THE Application SHALL prevent `client/` from importing `server/` and `server/` from importing
   `client/`, enforced by **dependency-cruiser** in the standard check run rather than by review
5. THE Application SHALL prove at build time that no `server/` module reaches the client bundle, so
   that a leaked secret is a failed build rather than a discovered incident
6. THE Application SHALL reference across roots through path aliases (`#shared/*`, `#client/*`,
   `#server/*`) rather than relative traversal, so that a boundary crossing is legible at the import
   line
7. THE Application SHALL split a module that mixes pure logic with browser-only I/O, placing the pure
   half in `shared/` where the server can reuse it, rather than duplicating it
8. THE Application SHALL keep `src/routeTree.gen.ts` generated, never hand-edited, wherever the
   router's route directory ends up
9. THE Application SHALL change no behaviour in the same change as the move — the test suite passes
   with the same count before and after

### Requirement 51: Enforced Architecture Rules

**User Story:** As a developer, I want the architecture rules this project already states in prose to
be checked automatically, so that they hold in six months rather than only on the day they were
written.

#### Acceptance Criteria

1. THE Application SHALL express its module-boundary rules as **dependency-cruiser** rules, and SHALL
   run them as part of the standard check command and on every commit
2. THE Application SHALL enforce the root boundary: `shared/` depends on neither sibling, `client/`
   never reaches `server/`, `server/` never reaches `client/`, and `server/` reaches nothing under
   `src/` except `shared/`
3. THE Application SHALL enforce that the Kernel stays framework-free — no React, no Zustand, no
   form library, no router — inside `shared/`
4. THE Application SHALL enforce that `shared/types/` imports no runtime module, keeping the type
   layer at the bottom
5. THE Application SHALL enforce that only store modules import the LocalStorage service, encoding
   the standing rule that persistence belongs to the store action
6. THE Application SHALL enforce that only repository modules import the database connection or the
   query builder, encoding the equivalent rule on the server side
7. THE Application SHALL enforce that base UI primitives depend on no store, service or feature
   component, keeping them leaves of the component graph
8. THE Application SHALL fail on a circular dependency, on a production module importing a
   development-only dependency, and on an import of a package absent from `package.json`
9. THE Application SHALL report an orphaned module as a warning rather than an error, since a
   deliberate entry point can look orphaned
10. WHEN a rule cannot express an obligation — one about call sites rather than imports — THE
    Application SHALL keep a purpose-written test for it rather than weakening the rule to fit
11. THE Application SHALL document each rule with the prose rule it encodes, so that a failure names
    the decision it protects rather than only the edge it found
