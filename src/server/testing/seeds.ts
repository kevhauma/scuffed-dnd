/**
 * Rows to test against (TICKET-DX-06)
 *
 * **Each returns the row, not the id.** A test asserting on `revision` or `updatedAt` should not
 * have to read back what it just wrote, and a helper that hands out ids makes every caller do
 * exactly that.
 *
 * **The real corpus is the default, and there is no toy variant.** A two-stat ruleset will not
 * catch a formula reference that a snapshot copy broke, or a curve flag that a round-trip dropped;
 * the Ducklets corpus — the real thing the source spreadsheet produced — will. `seedRuleset` holds
 * it, a session's snapshot is taken from it, and a test that genuinely wants two stats passes
 * `data`. See {@link seedRuleset} for why that is one function rather than two.
 *
 * **Where a repository exists, the seed calls it.** `seedRuleset` goes through `insertRuleset` and
 * `seedSession` through `insertGameSession` (TICKET-GAM-01), so a change to how either is stored
 * reaches the fixtures without anyone remembering to update them. **TICKET-CHAR-04 finished the
 * job**: `seedCharacter` goes through `insertSessionCharacter`, so there is no longer a second way
 * to create a character in the tree, and the fixture cannot get wrong what the repository knows —
 * that a session character names no ruleset, which a raw insert had no reason to know.
 *
 * **Validates: v3 Req 45.3**
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Character } from '#shared/types/character';
import type { Configuration } from '#shared/types/config';
import type { Database } from '../db/client';
import {
  authUser,
  character,
  gameSession,
  MEMBER_ROLE,
  type MemberRole,
  ruleset,
  sessionMember,
} from '../db/schema';
import type { RequestAccount } from '../http/pipeline';
import { type CharacterRow, insertSessionCharacter } from '../repositories/characterRepository';
import {
  findSessionMember,
  type GameSessionRow,
  insertGameSession,
  type SessionMemberRow,
} from '../repositories/gameSessionRepository';
import { insertRuleset, type RulesetRow } from '../repositories/rulesetRepository';

/**
 * The moment every seeded row is stamped with
 *
 * Fixed rather than `Date.now()`, so an assertion about a timestamp is an assertion rather than a
 * race — every seeded row in a run carries the same moment.
 *
 * Neither exported nor overridable per seed: nothing has needed either yet, and an option nothing
 * passes is a promise the fixtures have not been asked to keep. The first test that needs two rows
 * an hour apart adds a `now` and this comment goes.
 */
const SEEDED_AT = 1_700_000_000_000;

/**
 * Unique-per-process ids, in sequence
 *
 * Readable rather than random — `ruleset-3` in a failure message says more than a UUID does — and
 * still distinct across every seed in a run, so a row leaking between two tests would show up as
 * an id the second test never asked for rather than as a plausible collision.
 */
let counter = 0;
function nextId(kind: string): string {
  counter += 1;
  return `${kind}-${counter}`;
}

/** The real ruleset the sheet produced, read once for the whole run */
const CORPUS_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'docs',
  'imports',
  'ducklets.json'
);

const corpus = readFileSync(CORPUS_PATH, 'utf8');

/** Parsed at most once, and only if something asks — 306 KB is not a module-load cost */
let parsedCorpus: Configuration | null = null;

function corpusObject(): Configuration {
  parsedCorpus ??= JSON.parse(corpus) as Configuration;
  return parsedCorpus;
}

/**
 * The schema version the corpus is written at
 *
 * Read from the corpus rather than restated, so bumping `SUPPORTED_SCHEMA_VERSION` and regenerating
 * `ducklets.json` cannot leave the fixtures claiming the old one.
 *
 * **Exported since TICKET-INV-05**, because that is exactly what it failed to prevent:
 * `rulesetRepository.test.ts` was inserting its own row with a hand-written `schemaVersion: 9`
 * beside a `data` document the bump had moved to 10, and asserting the 9 back. A test that restates
 * the number cannot be protected by a helper it does not call.
 */
export function corpusSchemaVersion(): number {
  return corpusObject().schemaVersion ?? 1;
}

/**
 * The Ducklets corpus as JSON text, exactly as it sits on disk
 *
 * The stored form — id-resolved references, curve override flags and all — which is what a
 * `data` column holds and what a round-trip has to give back unchanged.
 *
 * @returns 306 KB of real ruleset
 */
export function realRulesetJson(): string {
  return corpus;
}

/**
 * The Ducklets corpus parsed
 *
 * A **fresh object each call**, deliberately: a test that mutates one must not change what the next
 * one sees, and the whole point of the corpus is that everything runs against the same thing. That
 * is why this re-parses rather than returning {@link corpusObject}'s cached copy, which exists only
 * for the internal reads that never mutate.
 *
 * @returns The real ruleset as a `Configuration`
 */
export function realConfiguration(): Configuration {
  return JSON.parse(corpus) as Configuration;
}

/**
 * An Account to act as
 *
 * **Not a row.** There is no account table until TICKET-AUTH-01 brings Better Auth's schema — every
 * DB-01 table keys on an account id it cannot yet enforce a foreign key on. So this hands back the
 * id and the shape `RequestContext.account` will carry, which is the whole of what a `callRoute`
 * or an ownership check compares. AUTH-01 makes it insert.
 *
 * @param id A specific id, when a test needs two references to the same account
 * @returns The acting account
 */
export function seedAccount(id: string = nextId('account')): RequestAccount {
  return { id };
}

/** What a seeded registered Account may be told */
export interface SeedRegisteredAccountOptions {
  id?: string;
  /** Defaults to one derived from the id, so two seeded Accounts never share an address */
  email?: string;
  name?: string;
}

/**
 * An Account that really has a row in Better Auth's `user` table (TICKET-GAM-03)
 *
 * **Beside {@link seedAccount} rather than replacing it**, and the difference is the point. Most
 * authorization compares an id, which is all `seedAccount` has ever needed to hand out — and making
 * that function insert would mean threading a `database` through a hundred call sites to record
 * something none of them reads. What GAM-03 introduced is the first rule that compares something
 * *else*: an invitation is matched to the Account holding an **email address**, so a test about one
 * needs an Account that has one.
 *
 * The row is written with Drizzle rather than through Better Auth, for `seedCharacter`'s reason:
 * signing an account up would run the library's whole password pipeline to produce a row whose only
 * interesting column here is `email`. `auth.test.ts` is where the real sign-up is exercised.
 *
 * @param database The connection
 * @param options Anything the test cares about; the rest is filled in
 * @returns The acting account, whose id is now resolvable to a name and an address
 */
export function seedRegisteredAccount(
  database: Database,
  options: SeedRegisteredAccountOptions = {}
): RequestAccount {
  const id = options.id ?? nextId('account');

  database.db
    .insert(authUser)
    .values({
      id,
      name: options.name ?? id,
      // Lower-cased here, because that is the form Better Auth stores and the form every
      // comparison is made in — a fixture holding `Account-3@example.test` would be testing the
      // normalisation rather than the rule
      email: (options.email ?? `${id}@example.test`).toLowerCase(),
      emailVerified: false,
      createdAt: new Date(SEEDED_AT),
      updatedAt: new Date(SEEDED_AT),
    })
    .run();

  return { id };
}

/**
 * What a seeded ruleset may be told
 *
 * Every option here has a caller. `now` was drafted alongside them and removed: nothing needed it,
 * and an option nothing passes is a promise the fixtures have not been asked to keep.
 *
 * **`schemaVersion` was removed for that reason and came back with TICKET-RUL-01**, which needed a
 * row this build cannot read in order to prove the server refuses one (v3 Req 33.4). It defaults to
 * the corpus's own, so nothing that does not care has to say.
 */
export interface SeedRulesetOptions {
  id?: string;
  owner?: RequestAccount | string;
  name?: string;
  /** The document as JSON text; defaults to the Ducklets corpus */
  data?: string;
  /** What the **column** says the document is; defaults to the corpus's own version */
  schemaVersion?: number;
}

/** An account or a bare id, as an id */
function accountId(owner: RequestAccount | string): string {
  return typeof owner === 'string' ? owner : owner.id;
}

/**
 * A ruleset owned by an Account, holding the real corpus
 *
 * **There is deliberately no toy variant.** The ticket asked for a `seedRuleset()` beside a
 * `seedRealRuleset()`, on the reasoning that the real corpus is what catches a formula reference a
 * snapshot copy broke. That reasoning argues for one function rather than two: if the real one is
 * the honest one, a second function whose only distinguishing feature is being *less* honest is a
 * trap with a convenient name. A test that genuinely wants a two-stat ruleset passes `data`.
 *
 * @param database The connection
 * @param options Anything the test cares about; the rest is filled in
 * @returns The stored row
 */
export function seedRuleset(database: Database, options: SeedRulesetOptions = {}): RulesetRow {
  return insertRuleset(
    {
      id: options.id ?? nextId('ruleset'),
      ownerAccountId: accountId(options.owner ?? seedAccount()),
      name: options.name ?? 'Ducklets',
      schemaVersion: options.schemaVersion ?? corpusSchemaVersion(),
      data: options.data ?? corpus,
      now: SEEDED_AT,
    },
    database
  );
}

/** What a seeded game session may be told */
export interface SeedSessionOptions {
  id?: string;
  /** Who runs it; defaults to a fresh account */
  dm?: RequestAccount | string;
  /** The ruleset it was created from; defaults to a freshly seeded one */
  from?: RulesetRow;
  name?: string;
  /**
   * The pinned document as JSON text; defaults to the source ruleset's own (TICKET-GAM-01)
   *
   * For the one thing a Snapshot can be that a ruleset cannot: **different from the ruleset it came
   * from**. That is the whole of D7, so a test proving a session ignores a later edit needs to say
   * so directly rather than by editing a row and hoping.
   */
  snapshot?: string;
}

/**
 * The row types the seeds hand back
 *
 * **Re-exported from the repositories rather than re-inferred** (TICKET-GAM-01). They were declared
 * here because no session repository existed; now that one does, two `export type GameSessionRow`
 * in one barrel's reach is an ambiguity waiting to resolve the wrong way — and a fixture that infers
 * its own row type is the same second-definition problem `seedSession` writing raw SQL was.
 * `CharacterRow` follows the same rule from `characterRepository`.
 */
export type { CharacterRow } from '../repositories/characterRepository';
export type {
  GameSessionRow,
  SessionMemberRow,
} from '../repositories/gameSessionRepository';

/**
 * A game session with its Snapshot pinned and its DM seated
 *
 * Both halves, because a session without its mirroring `session_member` row is a session no
 * "who is at this table" query can see — and D7's whole point is that the snapshot is a **copy**
 * taken at creation, so it is copied here rather than referenced.
 *
 * **Through `insertGameSession` since TICKET-GAM-01**, which is what the DX-06 note asked for: this
 * used to write both tables with raw Drizzle because no session repository existed, and a fixture
 * that defines what a session row looks like is a second definition for the next migration to
 * remember. The seeded row is now the row a real `POST /api/sessions` produces.
 *
 * @param database The connection
 * @param options Anything the test cares about; the rest is filled in
 * @returns The session row and the DM's membership
 */
export function seedSession(
  database: Database,
  options: SeedSessionOptions = {}
): { session: GameSessionRow; dm: SessionMemberRow } {
  const source = options.from ?? seedRuleset(database);
  const dmAccountId = accountId(options.dm ?? seedAccount());

  const session = insertGameSession(
    {
      id: options.id ?? nextId('session'),
      rulesetId: source.id,
      dmAccountId,
      name: options.name ?? 'Tuesday night',
      // The stored text verbatim, which is what a Snapshot is: a copy of the ruleset as it stood
      snapshot: options.snapshot ?? source.data,
      snapshotSchemaVersion: source.schemaVersion,
      now: SEEDED_AT,
      memberId: nextId('member'),
    },
    database
  );

  // Seated by `insertGameSession` in the same transaction; read back rather than inserted again,
  // because a second `dm` row is what the partial unique index exists to refuse
  const dm = findSessionMember(session.id, dmAccountId, database);

  if (!dm) throw new Error(`seedSession: ${session.id} has no DM membership, which cannot happen`);

  return { session, dm };
}

/** What a seeded membership may be told */
export interface SeedMemberOptions {
  session: GameSessionRow;
  account: RequestAccount | string;
  role?: MemberRole;
}

/**
 * Somebody at the table
 *
 * @param database The connection
 * @param options Which session, which account, and in what role
 * @returns The membership row
 */
export function seedMember(database: Database, options: SeedMemberOptions): SessionMemberRow {
  return database.db
    .insert(sessionMember)
    .values({
      id: nextId('member'),
      sessionId: options.session.id,
      accountId: accountId(options.account),
      role: options.role ?? MEMBER_ROLE.PLAYER,
      joinedAt: SEEDED_AT,
    })
    .returning()
    .get();
}

/** What a seeded character may be told */
export interface SeedCharacterOptions {
  id?: string;
  session: GameSessionRow;
  owner?: RequestAccount | string;
  name?: string;
  /** The player state as JSON text */
  data?: string;
}

/**
 * A character in a session
 *
 * **Through `insertSessionCharacter` since TICKET-CHAR-04**, which is what this file's header asked
 * for: the fixture stopped writing the `character` table itself the moment there was a repository
 * function that knew how one is stored — including that a session character names **no** ruleset,
 * which a raw insert had no reason to know and would have got wrong.
 *
 * `data` also stopped being `'{}'`. That was honest while nothing had decided what a session
 * character's player state is; CHAR-04 decided, and the default is now a real `Character` that
 * `isReadableCharacter` accepts, so a route that parses one in a test is parsing a shape it can
 * parse in production. It is deliberately **not** run through `buildCharacter`: seeding the
 * resource maxima means evaluating every formula in a 306 KB ruleset, per character, in fixtures
 * that mostly care about who owns what.
 *
 * **`configurationId` is a placeholder here and production's is not the same value.** A real one
 * names the Snapshot, which `copyConfiguration` mints a fresh id for when the session is created —
 * neither the session's id nor the ruleset's. Nothing in the tree reads a *session* character's
 * `configurationId` yet (the sheet is TICKET-PLY-01's), so the fixture puts the session id there as
 * the nearest true thing and says so rather than implying a shape production produces. The first
 * test that depends on it should pass `data` and mean it.
 *
 * @param database The connection
 * @param options Which session it belongs to, and anything else the test cares about
 * @returns The stored row
 */
export function seedCharacter(database: Database, options: SeedCharacterOptions): CharacterRow {
  const id = options.id ?? nextId('character');
  const name = options.name ?? 'Ducklet';

  return insertSessionCharacter(
    {
      id,
      sessionId: options.session.id,
      ownerAccountId: accountId(options.owner ?? seedAccount()),
      name,
      data: options.data ?? JSON.stringify(plainCharacter(id, name, options.session.id)),
      now: SEEDED_AT,
    },
    database
  );
}

/**
 * The least a `Character` can be and still be one
 *
 * Every field `isReadableCharacter` requires, and nothing invented beyond them: no races, no
 * allocation, no experience. A fixture that picked a race would be making a claim about the corpus
 * that the next ruleset change could quietly falsify.
 *
 * @param id The character's id
 * @param name What it is called
 * @param sessionId The table it plays at, stood in `configurationId` as a placeholder — see the
 *   note on {@link seedCharacter} for why that is not the value production writes
 * @returns The player state
 */
function plainCharacter(id: string, name: string, sessionId: string): Character {
  return {
    id,
    name,
    configurationId: sessionId,
    raceIds: [],
    investedStatPoints: {},
    investedSkillPoints: {},
    currentResourceValues: {},
    experience: 0,
    inventory: { equippedItems: {}, miscItems: [], composedItems: [] },
    createdAt: new Date(SEEDED_AT).toISOString(),
    updatedAt: new Date(SEEDED_AT).toISOString(),
  };
}

/** Every ruleset row, for a test that counts rather than looks one up */
export function allRulesets(database: Database): RulesetRow[] {
  return database.db.select().from(ruleset).all();
}

/**
 * Every game session row (TICKET-RUL-01)
 *
 * The counterpart to {@link allRulesets}, and it exists for one question RUL-01 has to answer with
 * evidence: after an Owner confirms deleting a ruleset a table was playing from, **is that table
 * still there?**
 *
 * **It is about the whole table rather than one row**, which is why it stayed after TICKET-GAM-01
 * added `findGameSession` beside it. This docblock used to explain the absence of that function;
 * the reason it is still here is different and better — *how many sessions exist* is not a question
 * any route asks, so there is no route-facing read to borrow.
 */
export function allGameSessions(database: Database): GameSessionRow[] {
  return database.db.select().from(gameSession).all();
}

/**
 * Every character row (TICKET-IO-04)
 *
 * The third of the same kind, and it exists for the question the upload has to answer with evidence:
 * after an Account uploads this browser's data, **what is on the Account?** One ruleset and one row
 * per stored Character, each at no table — which is a statement about the whole table rather than
 * about a row a test already knows the id of.
 */
export function allCharacters(database: Database): CharacterRow[] {
  return database.db.select().from(character).all();
}
