/**
 * What the two roots agree an API response looks like (TICKET-RUL-01)
 *
 * **A contract both sides need, so it lives in the Kernel** — the rule
 * [CLAUDE.md](../../../CLAUDE.md) states as *"a rule both sides need lives in `shared/`"*, and
 * `#shared/types/socialProvider` is the precedent: the server produces these shapes, the client
 * branches on them, and a copy on either side is a copy that can drift silently. Nothing here is
 * behaviour — `AppError`, the status map and the factory functions stay in `server/http/appError.ts`
 * where they belong, and `client/services/api.ts` never learns how a refusal is *made*.
 *
 * The RUL-01 review found four duplicated declarations that this module replaces, one of them a
 * bare `'conflict'` literal in the client. A renamed code would have quietly stopped matching, and
 * grepping a bare literal finds coincidences rather than the contract.
 *
 * **Validates: v3 Req 32.5, 33.1, 33.8**
 */

import type { Character } from './character';
import type { Configuration } from './config';
import type { RollOutcome } from './formula';
import type { ValidationReport } from './validation';

/**
 * The machine-readable half of a refusal — a client switches on this, never on the message
 *
 * Deliberately short: a code with no producer is a code nobody has decided the meaning of yet.
 */
export const ERROR_CODE = {
  BAD_REQUEST: 'bad_request',
  /** Nobody is signed in, on a route that needs somebody to be (TICKET-AUTH-03) */
  UNAUTHENTICATED: 'unauthenticated',
  NOT_FOUND: 'not_found',
  METHOD_NOT_ALLOWED: 'method_not_allowed',
  /** The request was understood and refused by the *state* of the resource (TICKET-RUL-01) */
  CONFLICT: 'conflict',
  /**
   * The caller has been trying too often (TICKET-GAM-02)
   *
   * The first producer is invite-code redemption, where the limiter is half of what makes a
   * human-typeable code safe. Distinct from every other refusal because the remedy is *wait* rather
   * than *change something* — a client that treated it as a bad-request would tell somebody to fix
   * a code that was fine.
   */
  TOO_MANY_REQUESTS: 'too_many_requests',
  INTERNAL: 'internal',
} as const;

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

/** The body every refusal has, whichever route produced it */
export interface ErrorBody {
  error: { code: ErrorCode; message: string };
}

/**
 * What a refusal may carry beside its sentence (TICKET-RUL-02)
 *
 * **Declared here rather than as `Record<string, unknown>` on the server**, which is what it was
 * until the RUL-02 review pointed out the hole: an open record accepts `currentRev` as happily as
 * `currentRevision`, so a typo would compile on the server and read as `undefined` on the client.
 * The whole reason this module exists is that a shape both roots use is checked once.
 *
 * Only what a caller has to **act** on belongs here. What a stack trace would say is how this
 * server is built, and that still never leaves it.
 */
export interface ErrorDetails {
  /** On a `conflict` from a write: what the resource's revision actually is now */
  currentRevision?: number;
  /** On a `bad_request` from shape validation: what failed, in the validator's own words */
  fields?: string[];
  /**
   * On a refused Snapshot refresh: which characters would break, and how (TICKET-GAM-01)
   *
   * Declared here rather than as its own loose bag for the reason the docblock above gives — the
   * server attaches it through the same `details` channel every other refusal uses, so it has to be
   * a field this contract names or it cannot be attached at all.
   */
  conflicts?: SnapshotConflict[];
}

/**
 * A Ruleset as a client sees it in a listing (v3 Req 33.8)
 *
 * Names and last-modified times, which is what the requirement asks for, plus the two the client
 * needs in order to act: `id` to open one and `revision` to write one back.
 *
 * **There is no `data` here, and that is a rule rather than an economy.** A list endpoint that
 * hands back whole documents invites a client that renders from the list and then edits the copy it
 * happens to hold, which is how RUL-02's revision guard gets bypassed by accident. The repository
 * refuses to *select* the column and this refuses to *name* it.
 */
export interface RulesetSummary {
  id: string;
  name: string;
  schemaVersion: number;
  revision: number;
  /** Epoch milliseconds, as the column holds it — formatting is the browser's locale, not ours */
  createdAt: number;
  updatedAt: number;
}

/** What `GET /api/rulesets` answers — most recently updated first, empty for a new Account */
export interface RulesetListing {
  rulesets: RulesetSummary[];
}

/**
 * One ruleset **with** its document (TICKET-RUL-02)
 *
 * What `GET /api/rulesets/:id` answers and what `PUT` gives back. Deliberately a different type
 * from {@link RulesetSummary} rather than a summary with an optional field: a listing that could
 * carry a document is a listing somebody will eventually render from and then edit, and the whole
 * point of the split is that they cannot.
 *
 * `configuration` is in **display** form — every formula spelled with the entity's current name,
 * exactly as `importConfiguration` hands one back. The server stores the id-resolved form
 * (TICKET-REF-01) and translates at this boundary, which is the same thing `storage.ts` and the
 * export path do.
 */
export interface RulesetDocument extends RulesetSummary {
  /**
   * The ruleset itself, typed
   *
   * Unlike {@link RulesetSaveRequest.configuration}, which is whatever a client sent and is
   * `unknown` until it has been validated. This one the **server** just produced from a document it
   * had already gated, so typing it is not a claim about untrusted input — and leaving it `unknown`
   * only moved an unchecked `as Configuration` into the config store, where a wrong response would
   * land in every panel.
   */
  configuration: Configuration;
}

/**
 * What a client sends to save a ruleset (v3 Req 33.6)
 *
 * **`revision` is what the caller believed it was**, not what they want it to become — the server
 * increments. A write whose base revision is behind is refused with a `conflict` rather than
 * merged, and the User meets a question rather than a disappearance (v3 Req 33.8).
 *
 * Nothing derived crosses the wire: a `Configuration` is entirely authored data. Stat values,
 * levels, point budgets and roll results are re-derived server-side from it and are refused as
 * input everywhere they appear (the milestone's third Definition-of-Done rule).
 */
export interface RulesetSaveRequest {
  revision: number;
  configuration: unknown;
}

/**
 * What a client sends to create a ruleset from a document it already has (v3 Req 35.1, 36.5)
 *
 * **One request shape for both of IO-04's paths**, because server-side they are one operation.
 * *Import this file* and *upload this browser's ruleset* differ in where the client got the bytes,
 * which is a fact about the client; what the server does with them — gate, shape-check, create,
 * never overwrite — is identical, and two routes would be two places for that chain to drift.
 *
 * `configuration` is `unknown` for {@link RulesetSaveRequest}'s reason: it is whatever a client
 * sent, and it is untrusted until the Kernel's own import gates have run on it.
 */
export interface RulesetImportRequest {
  configuration: unknown;
  /**
   * The Characters to bring along, or nothing
   *
   * Absent on the file-import path — a `Configuration` file has never carried characters — and the
   * browser's stored roster on the upload path. Each becomes a Character owned by the Account and
   * belonging to **no Game_Session**: they were built against a local ruleset rather than against a
   * Snapshot, and inventing a session to hold them would put people at a table nobody started.
   */
  characters?: unknown[];
}

/**
 * What an accepted import answers with (v3 Req 35.3, 35.5)
 *
 * The created ruleset — so the client can name it, rather than saying "imported" and leaving the
 * User to find it — and the engine's **referential** report, which is reported and not fatal. That
 * is the v1.0 rule carried onto the server path unchanged: a ruleset that parses but does not hang
 * together still reaches the User, because refusing it would leave them unable to repair it in the
 * app.
 */
export interface RulesetImportResult extends RulesetSummary {
  report: ValidationReport;
  /** How many Characters were created alongside it — zero on the file-import path */
  charactersCreated: number;
}

/**
 * Whether this Account is owed its one unprompted offer to upload (v3 Req 36.6)
 *
 * **The answer is produced by claiming it, not by reading it.** `POST /api/account/upload-prompt`
 * returns `true` to exactly one caller ever; every later call — another tab, another device, the
 * next sign-in — gets `false`. A `GET` that only reported would leave the marking to a second
 * request nobody can guarantee arrives.
 */
export interface UploadPromptClaim {
  shouldPrompt: boolean;
}

/**
 * What an Account may do at a table (v3 Req 39)
 *
 * The client's copy of `session_member.role`, in the Kernel for the reason this whole module is:
 * the server produces it and the client branches on it, so a second declaration on either side is
 * one that can drift.
 */
export const MEMBER_ROLE = {
  DM: 'dm',
  PLAYER: 'player',
} as const;

export type MemberRole = (typeof MEMBER_ROLE)[keyof typeof MEMBER_ROLE];

/** What a Game_Session currently is (v3 Req 37.5) */
export const SESSION_STATUS = {
  ACTIVE: 'active',
  /** Readable forever; accepts no writes */
  ARCHIVED: 'archived',
} as const;

export type SessionStatus = (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS];

/**
 * A Game_Session as a client sees it in a listing (TICKET-GAM-01)
 *
 * **There is no `snapshot` here, for {@link RulesetSummary}'s reason** and one more of its own: a
 * Snapshot is what the table *plays against* (D7), so a client holding one from a list is a client
 * that can compute against rules it never asked the server to confirm.
 *
 * `role` is what the asking Account is at this table — it comes from the membership the listing
 * joined on, so the answer is per-caller rather than a property of the session.
 */
export interface GameSessionSummary {
  id: string;
  /** The Ruleset it was created from, or `null` once that ruleset has been deleted */
  rulesetId: string | null;
  name: string;
  status: SessionStatus;
  role: MemberRole;
  /** When the pinned Snapshot was taken — epoch milliseconds, like every timestamp here */
  snapshotTakenAt: number;
  createdAt: number;
  updatedAt: number;
}

/** What `GET /api/sessions` answers — every table this Account sits at, newest first */
export interface GameSessionListing {
  sessions: GameSessionSummary[];
}

/**
 * One session **with** the Snapshot it plays against (v3 Req 37.2)
 *
 * `RulesetDocument`'s counterpart, and the same split for the same reason: a listing that could
 * carry a document is a listing somebody renders from.
 *
 * `snapshot` is in **display** form — every formula spelled with the entity's current name — which
 * is the boundary `storage.ts`, the export path and `GET /api/rulesets/:id` already apply.
 */
export interface GameSessionDocument extends GameSessionSummary {
  snapshot: Configuration;
  /**
   * The code this table is currently handing out — **DM only** (TICKET-GAM-02)
   *
   * Absent for a player, and absent for a DM whose session has none. It rides on the session rather
   * than earning a route of its own because it is *part of what a DM sees when they look at their
   * table*, and a second request to fetch one string is a second thing to keep in step.
   *
   * A player holding it could invite the table's next member, which is the DM's decision.
   *
   * **It carries `expiresAt`, and the review is why.** An expired code is deliberately still shown
   * — a DM looking at a stale one should be told it is stale rather than shown nothing, which they
   * would read as *I never issued one* — but a bare string cannot say that, so the surface rendered
   * a dead code as the live invitation with a *Copy link* beside it. The rationale was only
   * implementable once the expiry came with it.
   */
  invite?: SessionInvite;
}

/** What a client sends to start a table (v3 Req 37.1) */
export interface GameSessionCreateRequest {
  /** Which Ruleset to copy. The Account must own it; the copy is what the table plays. */
  rulesetId: string;
  name: string;
}

/**
 * The code a DM hands out, as the DM sees it (v3 Req 38.1, 38.2, TICKET-GAM-02)
 *
 * **Only ever sent to the DM.** It is the credential for joining, so a player holding one could
 * invite the table's next member — which is the DM's decision, not theirs.
 */
export interface SessionInvite {
  /** Hyphenated for reading aloud — `A1B2C-3D4E5`. Typed back in any case, with or without it. */
  code: string;
  expiresAt: number;
}

/**
 * What somebody following an invite link is shown **before** they join (v3 Req 38.1)
 *
 * Deliberately thin: the table's name and nothing about who is at it. Somebody holding a code has
 * not joined yet, and a preview that listed the members would make an unredeemed code a way to read
 * a roster.
 */
export interface InvitePreview {
  sessionName: string;
  /** False when the code is real but the session has been archived — join is refused, and says so */
  isJoinable: boolean;
}

/**
 * What redeeming a code answers with (v3 Req 38.7)
 *
 * `joined` is false when the Account was **already** at the table, which is a success rather than an
 * error — somebody will click the link twice, and telling them *you are not welcome* for it is
 * exactly the wrong answer.
 */
export interface InviteRedemption {
  session: GameSessionSummary;
  joined: boolean;
}

/**
 * What has become of one addressed invitation (v3 Req 38.4, TICKET-GAM-03)
 *
 * **Five values because the requirement asks for a distinct message for each**, and the DM's list is
 * where four of them are read side by side: *they have not answered yet*, *they said no*, *it ran
 * out*, *I took it back* and *they are in* are five different situations, and a DM deciding whether
 * to invite somebody again cannot act on a shared "not pending".
 *
 * The state is **derived** from the row's four timestamps at read time rather than stored beside
 * them — a stored copy is a second answer to the same question, and the one that goes stale is
 * always the one somebody renders.
 */
export const INVITE_STATE = {
  /** Nobody has answered and nothing has expired it */
  PENDING: 'pending',
  /** The invitee joined */
  ACCEPTED: 'accepted',
  /** The invitee turned it down — the same address may be invited again */
  DECLINED: 'declined',
  /** Its lifetime ran out before anybody answered */
  EXPIRED: 'expired',
  /** The DM took it back */
  REVOKED: 'revoked',
} as const;

export type InviteState = (typeof INVITE_STATE)[keyof typeof INVITE_STATE];

/** What a DM sends to invite an address (v3 Req 38.3) */
export interface AddressedInviteRequest {
  email: string;
}

/**
 * One addressed invitation, as the DM who sent it sees it (v3 Req 38.3, 38.4)
 *
 * **No code, because an addressed invitation has none** — it is redeemed from the invitee's own
 * pending list, by the Account whose address it names. A DM's copy is an address and a state.
 */
export interface AddressedInvite {
  id: string;
  email: string;
  state: InviteState;
  /**
   * When it runs out — rendered beside a pending one, so *waiting* comes with *until when*
   *
   * **There is no `createdAt` beside it**, though the listing is ordered by one: ordering is the
   * repository's `ORDER BY`, which needs the column and not the wire field. A field the server
   * populates and nothing renders is a claim that something uses it.
   */
  expiresAt: number;
}

/** What `GET /api/sessions/:id/invitations` answers — the DM's own outbox, newest first */
export interface AddressedInviteListing {
  invites: AddressedInvite[];
}

/**
 * One invitation waiting for the Account that reads it (v3 Req 38.5, 38.7)
 *
 * **The first shape in the app scoped to an Account rather than to a ruleset or a session**, and
 * deliberately shaped as a notification rather than as a session: what the invitee needs in order
 * to decide is the table's name, who asked them and how long they have — not the session's id,
 * which they are not a Member of and have no route to read.
 */
export interface PendingInvitation {
  /** The invitation's own id — what accept and decline are addressed to */
  id: string;
  sessionName: string;
  /** Who asked them, by the name that Account signed up with */
  invitedBy: string;
  /** When it runs out — *how long you have* is half of what makes an invitation actionable */
  expiresAt: number;
}

/** What `GET /api/invitations` answers — everything waiting for this Account, soonest to expire first */
export interface PendingInvitationListing {
  invitations: PendingInvitation[];
}

/**
 * One Character, as a name on somebody else's row (TICKET-GAM-04)
 *
 * **Deliberately two fields.** The lobby says *who is at this table and what are they playing*; a
 * sheet is CHAR-04's, and a member list that carried whole characters would be a list somebody
 * renders a sheet from — `RulesetSummary`'s rule, one aggregate over.
 */
export interface SessionCharacterSummary {
  id: string;
  name: string;
}

/**
 * One Member of a table (v3 Req 39.7, TICKET-GAM-04)
 *
 * **There is no `presence` field, and its absence is the design.** The requirement asks the lobby to
 * show a connection state, and the server cannot observe one until LIVE-01's socket exists — so the
 * column is rendered as *Unknown* by the client rather than sent as a value the server invented.
 * Shipping `presence: 'unknown'` would be a field with one possible value and a claim the server
 * cannot support; LIVE-03 adds it here when there is something real to put in it.
 */
export interface SessionMemberSummary {
  /** Better Auth's account id — what remove and transfer are addressed to */
  accountId: string;
  /** The name that Account signed up with */
  name: string;
  role: MemberRole;
  joinedAt: number;
  /**
   * Their Characters at this table, retained even after they leave (v3 Req 39.3, 39.5)
   *
   * A departed Member keeps no row here — they are gone from the list — but their characters stay
   * in the session and appear on {@link SessionMemberListing.departedCharacters}.
   */
  characters: SessionCharacterSummary[];
}

/**
 * What `GET /api/sessions/:id/members` answers (v3 Req 39.7)
 *
 * **Characters outlive memberships**, which is the one thing this shape has to express that a plain
 * list of Members cannot: removing somebody retains their Characters as read-only rather than
 * deleting them (v3 Req 39.3), so a session can hold a character whose owner is nobody at the table.
 * They are listed separately rather than under a ghost Member, because *who is here* and *what is
 * still on the table* are two different questions and answering them in one list makes both unclear.
 */
export interface SessionMemberListing {
  members: SessionMemberSummary[];
  /** Characters whose owner has left or been removed — readable by Members, writable by nobody */
  departedCharacters: SessionCharacterSummary[];
}

/** What a DM sends to hand the table over (v3 Req 39.4) */
export interface TransferDmRequest {
  /** The Member who becomes the DM. They must already be at the table. */
  accountId: string;
}

/**
 * What a client sends to create a character (v3 Req 40.1, 40.5, TICKET-CHAR-04)
 *
 * **Exactly the Player's choices, and nothing derived.** A stat value, a level, a point budget and
 * a roll result are all computed from these five fields against the session's Snapshot, so a body
 * carrying one is either confused or lying — and either way the server rejects it **by name**
 * rather than stripping it silently (the milestone's third Definition-of-Done rule). Silently
 * ignoring a field is how a client comes to believe it is being honoured.
 *
 * `currentResourceValues` is not here either, though it is genuinely stored: a *fresh* character's
 * is seeded from the Snapshot's maxima by the Kernel, and letting a client send one would let it
 * start at any number it liked.
 */
export interface CharacterCreateRequest {
  name: string;
  raceIds: string[];
  /** Points spent per stat id — what they *buy* is the point-buy curve's answer, never sent */
  investedStatPoints: Record<string, number>;
  /** Required when the Snapshot defines any archetypes, and refused when it defines none */
  archetypeId?: string;
  investedSkillPoints: Record<string, number>;
  /**
   * The three focus picks, empties left out (TICKET-SKL-05)
   *
   * Optional on the wire for the reason it is optional on `Character` — a Snapshot that states
   * neither focus dial asks for none — but **a wizard that collected three has to send them**: the
   * server re-runs `characterCreationErrors` against the Snapshot, so a body that dropped them would
   * be refused for naming no focus skills by a Player who named three.
   */
  focusSkillIds?: string[];
}

/**
 * One character as the server holds it (v3 Req 40.1, 40.4)
 *
 * **`character` is the player state and nothing else** — the Kernel's `Character`, exactly what a
 * local one in LocalStorage is. Every derived number the sheet shows is computed from it against
 * the ruleset it belongs to, which is the session's Snapshot or, for an uploaded one, the Ruleset
 * `rulesetId` names.
 *
 * **`revision` counts writes; it does not guard them** (TICKET-PLY-01). A ruleset save states the
 * base revision it is replacing because it carries a whole document, and two Owners editing one
 * ruleset have to be told about each other. A player action carries an **intent** — spend 3 points,
 * take 7 off this pool — which the server applies to the row as it stands, so there is nothing for a
 * stale client to overwrite and a conflict would be a refusal nobody could act on. The number is
 * bumped on every accepted action so LIVE-02 can tell a client whether what it holds is current.
 */
export interface CharacterDocument {
  id: string;
  /** The table it plays at, or `null` for one uploaded from a browser (v3 Req 36.5) */
  sessionId: string | null;
  /** The Ruleset it was built against, or `null` for a session character playing by a Snapshot */
  rulesetId: string | null;
  /** Whose it is — every Member of a session reads them all, and writes only their own */
  ownerAccountId: string;
  name: string;
  revision: number;
  /** Epoch milliseconds */
  createdAt: number;
  updatedAt: number;
  character: Character;
}

/** What `GET /api/sessions/:id/characters` and `GET /api/characters` answer */
export interface CharacterListing {
  characters: CharacterDocument[];
}

/**
 * The writes a Player makes to their own sheet (v3 Req 41, TICKET-PLY-01)
 *
 * **One value per named intent, and it is three things at once**: the last segment of the route's
 * path, the `type` of the Event the accepted action appends, and the tag the client's store sends.
 * That is deliberate — the ticket's own note asks that the log say *what happened* rather than that
 * something did, and a generic *patch character* route could not. Keeping the three spellings as one
 * constant is what stops a route, an event type and a client call drifting into three names for one
 * act.
 *
 * `experience`, the purse and everything else a **DM** changes are deliberately absent: those are
 * TICKET-DM-01 and TICKET-DM-02, and a Player granting themselves experience is the exact thing v3
 * Req 41 exists to prevent.
 *
 * ## `wear-item` and `stow-item` are retired (TICKET-INV-06)
 *
 * There were four inventory-placement intents for what turned out to be two acts. *Wear* — take a
 * thing out of the pack and put it on — and *equip* became one implementation under INV-05, because a
 * build a character does not hold cannot be equipped from anywhere else. *Stow* and *unequip* were
 * separated only by the stored pack: one put the build there, the other destroyed it. With the
 * **Backpack derived** as everything built and not worn, taking a thing off *is* putting it in the
 * bag, so both pairs collapse and what is left is one intent per act — build it, put it on, take it
 * off, throw it away.
 *
 * Retiring a value rather than aliasing it is D6's clean break applied to the API surface: an alias
 * would be a second spelling in the Event log's `type` column for something no route can produce.
 *
 * ## `take-item` became `build-item` for the same reason, one step further on
 *
 * Retiring two values while **keeping a third whose meaning had changed** would have been the exact
 * failure the retirements were for. `take-item` meant *put a template in the pack*; the act it names
 * now is *build a template, a material tier and an optional gem tier into one thing*, which is a
 * different thing a person does at a table. Two `event` rows sharing one `type` string and meaning
 * two acts is unreadable in a way a *missing* string never is — a log with no `wear-item` after some
 * date is a retirement, a log where `take-item` silently changed meaning is a lie. So the value was
 * renamed with the act, which is also what the vocabulary rule in
 * [`playerActions.ts`](../services/playerActions.ts) asks for: the route is named for what the person
 * did, and the person now builds.
 */
export const PLAYER_ACTION = {
  /** Put points into one invested stat — refused when the derived budget cannot pay for it */
  INVEST_STAT_POINTS: 'invest-stat-points',
  /** Put points into one skill — no budget exists to refuse it, only the shape of the number */
  INVEST_SKILL_POINTS: 'invest-skill-points',
  /** Name the skills this character focuses on — all three slots at once (TICKET-SKL-05) */
  SET_FOCUS_SKILLS: 'set-focus-skills',
  /** Write where a resource pool stands */
  SET_RESOURCE: 'set-resource',
  /** Move a resource pool by a delta — Concept 20's quick entry */
  ADJUST_RESOURCE: 'adjust-resource',
  /** Fill a resource pool to its derived maximum */
  RESET_RESOURCE: 'reset-resource',
  /** Put a build in an equipment slot */
  EQUIP_ITEM: 'equip-item',
  /** Take whatever is in a slot off — it is in the Backpack the moment it is not worn */
  UNEQUIP_ITEM: 'unequip-item',
  /** Build a template, a material tier and an optional inlay tier into one thing (TICKET-INV-06) */
  BUILD_ITEM: 'build-item',
  /** Destroy a build the character is not wearing */
  DROP_ITEM: 'drop-item',
  /** Unlock one spell — the sheet's `locked` → `Learned` flag, set by hand (TICKET-SPL-02) */
  LEARN_SPELL: 'learn-spell',
  /** Lock one back up, which is also how a Player clears an id the ruleset has lost */
  UNLEARN_SPELL: 'unlearn-spell',
  /**
   * Cast a learned spell — a **resource spend**, never a roll (TICKET-SPL-02)
   *
   * The mana comes off the pool the request names, because nothing in a ruleset says which of its
   * resources casting draws on (the User's ruling, 2026-08-31: the Player picks at cast time). The
   * spend itself is `adjustResourceValue`'s, so a cast and a hand-typed deduction move the pool by
   * the same arithmetic. Whatever the effect text says about dice stays a Player-driven roll on the
   * existing roll surface — server-resolved rolls are untouched by this action.
   */
  CAST_SPELL: 'cast-spell',
} as const;

export type PlayerAction = (typeof PLAYER_ACTION)[keyof typeof PLAYER_ACTION];

/** What a client sends to spend points on a stat — the new total, never a delta */
export interface StatPointsRequest {
  statId: string;
  points: number;
}

/** What a client sends to spend points on a skill */
export interface SkillPointsRequest {
  skillId: string;
  points: number;
}

/**
 * What a client sends to name its focus skills — the whole list, never one slot (TICKET-SKL-05)
 *
 * The slots are positional and duplicates are legal, so this is a list rather than a set; what may be
 * in it is the Kernel's `focusPickRefusal`.
 */
export interface FocusSkillsRequest {
  focusSkillIds: string[];
}

/** What a client sends to write where a pool stands */
export interface ResourceValueRequest {
  statId: string;
  value: number;
}

/** What a client sends to move a pool by a delta */
export interface ResourceDeltaRequest {
  statId: string;
  delta: number;
}

/** What a client sends to fill a pool, or to name one with nothing else to say */
export interface ResourceRequest {
  statId: string;
}

/** What a client sends to put an item somewhere it has to fit */
export interface ItemPlacementRequest {
  equipmentSlotType: string;
  itemId: string;
}

/** What a client sends to act on a slot's current occupant */
export interface EquipmentSlotRequest {
  equipmentSlotType: string;
}

/** What a client sends to put a build down — `itemId` is a `ComposedItem.id` */
export interface ItemRequest {
  itemId: string;
}

/** What a client sends to learn or unlearn one spell — a `Spell.id` in the ruleset's compendium */
export interface SpellRequest {
  spellId: string;
}

/**
 * What a client sends to cast one spell (TICKET-SPL-02)
 *
 * **Two ids, because a cast names its pool.** No ruleset field says which resource casting draws on
 * (the User's ruling: the Player picks at cast time), so the request carries the choice rather than
 * the server inferring one — and `statId` is checked as a pool the same way `set-resource`'s is.
 */
export interface CastSpellRequest {
  spellId: string;
  /** Which resource pool the mana comes off */
  statId: string;
}

/**
 * What a client sends to build one thing — the sheet's three picker columns (TICKET-INV-06)
 *
 * `itemId` is the **template** and the other four are the parts, spelled exactly as they are stored
 * on `ComposedItem` so the route assembles a record rather than translating one. The identity is not
 * on the wire: each root mints its own, and a client-supplied id would be an id the server had no
 * reason to trust.
 *
 * **Every field but the template is optional here and not all of them are optional to the rule.**
 * `buildItem` requires a material and its tier and refuses an inlay named without one — this shape's
 * job is only to say what may be *in the body*, and a `materialId` missing from the JSON has to reach
 * the Kernel to be answered in the Kernel's words (`playPayloads`' standing split: the route asks
 * *is this a number*, the rule asks *is this number allowed*).
 */
export interface BuildItemRequest extends ItemRequest {
  materialId?: string;
  materialLevel?: number;
  inlayId?: string;
  inlayLevel?: number;
}

/**
 * What an accepted player action wrote to the Event log (v3 Req 41.7, 44.4)
 *
 * **Before and after are recorded even where they feel redundant**, which is the ticket's own note
 * and the reason this shape exists at all: DM-01's audit and LIVE-02's reconciliation both have to
 * say *what changed* without re-reading the whole character, and a payload naming only the action
 * cannot.
 *
 * The actor is the row's `actor_account_id` column rather than a field here — it is what the log is
 * queried by, and a copy inside the JSON is a second answer to the same question.
 */
export interface PlayerActionEvent {
  characterId: string;
  /**
   * Which named intent this was
   *
   * Widened to {@link SheetAction} by TICKET-DM-01: a DM adjustment is logged through the same
   * pipeline and has the same three fields to record, so it writes this payload rather than a
   * near-identical second one.
   */
  action: SheetAction;
  /** Which stat, skill, equipment slot or item the action moved */
  target: string;
  before: ActionValue;
  after: ActionValue;
}

/**
 * What one player action moved, in the only three forms any of them take
 *
 * A number for points and pools, an item id for a slot that gained one, `null` for a slot empty on
 * one side of the change. **Declared here rather than in `shared/services/playerActions.ts`**, which
 * is where it started: `types/` is the bottom layer and may not import a service, so the wire shape
 * would have had to restate the union — two spellings of one set, which is exactly what this module
 * exists to prevent.
 */
export type ActionValue = number | string | null;

/**
 * The writes a DM makes to a Character in their session (v3 Req 42, TICKET-DM-01)
 *
 * {@link PLAYER_ACTION}'s counterpart, and the same three-things-at-once: the last segment of the
 * route's path, the `type` of the Event it appends, and the tag the client's store sends. **One flat
 * namespace with the player's**, hence the `dm-` prefix on every value — the Event log holds both
 * kinds in one `type` column, and a DM's *set-resource* and a Player's have to be tellable apart by
 * a reader six months later. It also keeps a route's path and its Event type one spelling, which is
 * what makes `apiRouter`'s table readable.
 *
 * **There is no `dm-set-level`-shaped lie in here**: `DM_SET_LEVEL` writes *experience*, and the
 * Event's before/after are experience totals. The level derives from them
 * ([D9](../../../docs/v3.0_backend/overview.md#d9--level-stays-derived-points-to-spend-becomes-a-grant)).
 *
 * Inventory and the purse are deliberately absent — they are TICKET-DM-02's.
 */
export const DM_ACTION = {
  /** Add to a Character's accumulated experience */
  AWARD_EXPERIENCE: 'dm-award-experience',
  /** Take experience away — refused below zero rather than clamped */
  DEDUCT_EXPERIENCE: 'dm-deduct-experience',
  /** Put a Character at a level by writing what that level costs on the `xp_thresholds` curve */
  SET_LEVEL: 'dm-set-level',
  /** Set the extra spendable stat points the DM has handed out — a total, not a delta */
  GRANT_POINTS: 'dm-grant-points',
  /** Write where one of a Character's resource pools stands */
  SET_RESOURCE: 'dm-set-resource',
  /**
   * Set how far a Character stands in their dream — a total, not a delta (TICKET-RES-04)
   *
   * The sixth, and the first this namespace has gained since it was minted. It is a DM action rather
   * than a Player one by the User's own ruling (2026-08-29): dream level is raised on the surface
   * that awards experience and sets level.
   */
  SET_DREAM_LEVEL: 'dm-set-dream-level',
} as const;

export type DmAction = (typeof DM_ACTION)[keyof typeof DM_ACTION];

/**
 * Anything a named intent can be, whoever performed it
 *
 * The union exists because one pipeline serves both: `applyPlayerAction` writes the character and
 * appends the Event for a Player's action and a DM's alike, and `sendPlayerAction` posts either.
 * Splitting them would have been two copies of *apply the Kernel's answer, then log what moved*,
 * which is the one thing v3 Req 42.6 needs to happen exactly once.
 */
export type SheetAction = PlayerAction | DmAction;

/** What a client sends to award or deduct experience — a positive amount, direction in the route */
export interface ExperienceRequest {
  amount: number;
}

/**
 * What a client sends to put a Character at a level (v3 Req 42.2)
 *
 * **The level is an instruction, not a stored value.** The server answers it by writing the
 * experience the ruleset's curve prices that level at, and refuses when the curve cannot.
 */
export interface LevelRequest {
  level: number;
}

/** What a client sends to set the DM's point grant — the new total, never a delta */
export interface GrantRequest {
  points: number;
}

/**
 * What a client sends to set a Character's dream level (TICKET-RES-04)
 *
 * Spelled `dreamLevel` rather than `level` even though it is the only field in the body: this and
 * {@link LevelRequest} are two bodies that mean opposite things — one is an instruction the server
 * prices into experience, this one is the number that gets stored — and a shared field name would
 * make a mis-routed body silently valid.
 */
export interface DreamLevelRequest {
  dreamLevel: number;
}

/**
 * One DM adjustment as a Player reads it back (v3 Req 42.6, 42.7)
 *
 * A projection of the Event log, like {@link SessionRoll} — the same shape of answer for the same
 * reason: the log is the record, and a second store of what changed would be a second truth.
 *
 * `target` is the stat a resource adjustment names, and empty for the ones that name nothing but the
 * character. Names are resolved at read time so a renamed Account does not leave the history calling
 * somebody by a name they no longer have.
 */
export interface CharacterAdjustment {
  /** The Event's id, so a list can key on something the server minted */
  id: string;
  seq: number;
  action: DmAction;
  target: string;
  before: ActionValue;
  after: ActionValue;
  /** Epoch milliseconds */
  at: number;
  /** The Account that made the adjustment, by name — `null` if that profile has gone */
  by: string | null;
}

/** What `GET /api/characters/:id/adjustments` answers — newest first */
export interface CharacterAdjustmentListing {
  adjustments: CharacterAdjustment[];
}

/**
 * The Event a resolved roll appends (v3 Req 41.6, TICKET-ROLL-07)
 *
 * **Not a `PLAYER_ACTION`**, and the distinction is real rather than filing: every value there is a
 * write to the character's own sheet, with a before and an after. A roll changes nothing — it
 * *happened*, and what it produced is the whole `RollOutcome`. Sharing the constant would have meant
 * an `ActionValue` before/after pair that a roll has nothing to put in.
 */
export const ROLL_EVENT = 'roll';

/**
 * What a client sends to roll (v3 Req 41.6, 45.2)
 *
 * **Which roll, and nothing else.** The dice are the server's — a body carrying `total`, `results`
 * or `pool` is refused by name, because a client that could report its own result is a client that
 * could report any result, and that is the whole of what this ticket moves.
 */
export interface RollRequest {
  rollId: string;
}

/**
 * One roll as the table reads it (v3 Req 41.6)
 *
 * The `RollOutcome` the engine produced, plus the three things a *shared* log needs that a private
 * one did not: which character rolled, who was driving them, and where the roll sits in the
 * session's order. `seq` is the Event's own — the same `(session, seq)` key LIVE-03 replays from,
 * which is why the log is read that way here rather than by timestamp.
 */
export interface SessionRoll extends RollOutcome {
  /** The Event's id, so a list can key on something the server minted */
  id: string;
  seq: number;
  characterId: string;
  characterName: string;
  /** The Account that rolled, by the name it signed up with — `null` if that profile has gone */
  rolledBy: string | null;
}

/** What `GET /api/sessions/:id/rolls` answers — the table's log, newest first */
export interface SessionRollListing {
  rolls: SessionRoll[];
}

/**
 * Why a Snapshot refresh was refused (v3 Req 37.6)
 *
 * **One entry per character that would break, naming the character and what breaks** — the ticket's
 * own words. A generic *"some characters would be invalid"* is a refusal a DM cannot act on: they
 * cannot tell whether to fix the ruleset, fix a character, or leave the table where it is.
 */
export interface SnapshotConflict {
  characterId: string;
  characterName: string;
  /** What the new Snapshot would break about them, as a sentence */
  reason: string;
}

/**
 * What a refused save says beyond its message (v3 Req 33.8)
 *
 * Two shapes rather than a free-text message, because the client has to *act*: a conflict needs the
 * revision it is behind so a reload can be offered, and a shape failure needs the fields so the
 * User can be told which part of their ruleset the server could not read.
 */
export type RulesetSaveRefusal = ErrorBody & ErrorDetails;
