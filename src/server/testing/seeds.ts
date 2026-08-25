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
 * **Where a repository exists, the seed calls it.** `seedRuleset` goes through `insertRuleset`, so
 * a change to how a ruleset is stored reaches the fixtures without anyone remembering to update
 * them. `seedSession` and `seedCharacter` write with Drizzle because GAM-01 and CHAR-04 have not
 * built their repositories yet — **point them at those when they land**, rather than leaving a
 * second way to create a session in the tree.
 *
 * **Validates: v3 Req 45.3**
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Configuration } from '#shared/types/config';
import type { Database } from '../db/client';
import {
  character,
  gameSession,
  MEMBER_ROLE,
  type MemberRole,
  ruleset,
  SESSION_STATUS,
  sessionMember,
} from '../db/schema';
import type { RequestAccount } from '../http/pipeline';
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
 */
function corpusSchemaVersion(): number {
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

/**
 * What a seeded ruleset may be told
 *
 * Every option here has a caller. `schemaVersion` and `now` were drafted alongside them and
 * removed: nothing needed either, and an option nothing passes is a promise the fixtures have not
 * been asked to keep. The corpus's own schema version is what a seeded row carries, which is the
 * answer a test would have wanted anyway.
 */
export interface SeedRulesetOptions {
  id?: string;
  owner?: RequestAccount | string;
  name?: string;
  /** The document as JSON text; defaults to the Ducklets corpus */
  data?: string;
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
  return insertRuleset(database, {
    id: options.id ?? nextId('ruleset'),
    ownerAccountId: accountId(options.owner ?? seedAccount()),
    name: options.name ?? 'Ducklets',
    schemaVersion: corpusSchemaVersion(),
    data: options.data ?? corpus,
    now: SEEDED_AT,
  });
}

/** What a seeded game session may be told */
export interface SeedSessionOptions {
  id?: string;
  /** Who runs it; defaults to a fresh account */
  dm?: RequestAccount | string;
  /** The ruleset it was created from; defaults to a freshly seeded one */
  from?: RulesetRow;
  name?: string;
}

export type GameSessionRow = typeof gameSession.$inferSelect;
export type SessionMemberRow = typeof sessionMember.$inferSelect;
export type CharacterRow = typeof character.$inferSelect;

/**
 * A game session with its Snapshot pinned and its DM seated
 *
 * Both halves, because a session without its mirroring `session_member` row is a session no
 * "who is at this table" query can see — and D7's whole point is that the snapshot is a **copy**
 * taken at creation, so it is copied here rather than referenced.
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

  const session = database.db
    .insert(gameSession)
    .values({
      id: options.id ?? nextId('session'),
      rulesetId: source.id,
      dmAccountId,
      name: options.name ?? 'Tuesday night',
      status: SESSION_STATUS.ACTIVE,
      snapshot: source.data,
      snapshotSchemaVersion: source.schemaVersion,
      snapshotTakenAt: SEEDED_AT,
      createdAt: SEEDED_AT,
      updatedAt: SEEDED_AT,
    })
    .returning()
    .get();

  const dm = seedMember(database, { session, account: dmAccountId, role: MEMBER_ROLE.DM });

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
 * `data` defaults to an empty object rather than to a plausible-looking character: what belongs in
 * there is the Kernel's answer, and CHAR-04 is the ticket that decides it. A fixture guessing now
 * would be a second definition of player state for a later ticket to disagree with.
 *
 * @param database The connection
 * @param options Which session it belongs to, and anything else the test cares about
 * @returns The stored row
 */
export function seedCharacter(database: Database, options: SeedCharacterOptions): CharacterRow {
  return database.db
    .insert(character)
    .values({
      id: options.id ?? nextId('character'),
      sessionId: options.session.id,
      ownerAccountId: accountId(options.owner ?? seedAccount()),
      name: options.name ?? 'Ducklet',
      revision: 1,
      data: options.data ?? '{}',
      createdAt: SEEDED_AT,
      updatedAt: SEEDED_AT,
    })
    .returning()
    .get();
}

/** Every ruleset row, for a test that counts rather than looks one up */
export function allRulesets(database: Database): RulesetRow[] {
  return database.db.select().from(ruleset).all();
}
