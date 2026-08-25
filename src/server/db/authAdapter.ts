/**
 * The Drizzle adapter Better Auth is handed (TICKET-AUTH-01, TICKET-AUTH-04)
 *
 * **This lives in `db/` for a rule, not for tidiness.** `queries-belong-to-repositories` (DX-08)
 * says only `db/`, `repositories/` and `testing/` may import the connection or the query builder —
 * and building the adapter needs both. Putting it here means `auth/` receives an adapter and never
 * learns there is a database, which keeps the rule intact rather than earning `auth/` an exemption
 * it would then keep forever.
 *
 * It is resolved **per call** rather than once, because the process's database can be replaced —
 * `withTestDatabase` does exactly that (DX-06), and an adapter that captured the connection at
 * module load would send every test's sign-up to whichever database happened to be open first.
 *
 * ## The session rules are applied here, and nowhere else would do (TICKET-AUTH-04)
 *
 * Rolling renewal needs the **current row and the pending write at the same moment** — to cap a new
 * expiry against a `createdAt` the write does not carry, and to move the outgoing identifier into
 * `previousToken`. Better Auth's `databaseHooks` see one or the other and neither can reach the
 * cookie; its `/get-session` route sees neither in a form we can extend. The adapter is the single
 * point every read and write of a session already passes through.
 *
 * Four operations are wrapped, and the fourth is the one that is easy to miss:
 *
 * | | Why |
 * |---|---|
 * | `create` | the ceiling applies from the first write, so a short absolute lifetime is honoured immediately |
 * | `findOne` | an identifier a rotation only just replaced still resolves, for the grace window |
 * | `findMany` | the same, and it is **not** redundant — see below |
 * | `update` | renewal caps the expiry and rotates the identifier — at most once per update window |
 * | `delete` | **sign-out names the token the *cookie* carried**, which during grace is the previous one |
 *
 * **`findMany` is the one that had to be found by a failing test.** Better Auth's `deleteWithHooks`
 * looks the row up with `findMany({ limit: 1 })` before deleting, and skips the delete entirely when
 * that finds nothing — so wrapping `delete` alone left signing-out-during-grace deleting nothing at
 * all, silently. The cookie was cleared, the person believed they had signed out, and the row stayed
 * live for whoever held the current identifier.
 *
 * **What is applied is not decided here.** `authServer.ts` hands in a {@link SessionRules} and this
 * module obeys it, so `db/` decides no policy and holds no import of `auth/`. The rules themselves
 * are pure functions in [`auth/sessionLifetime.ts`](../auth/sessionLifetime.ts).
 *
 * **One path deliberately bypasses all of this**, and it is safe today: a write inside
 * `runWithTransaction` gets a `trx` adapter built from the inner Drizzle adapter, so the overrides
 * do not apply. Only user creation and sign-up use transactions, and both are creates of a *user*.
 * Enabling `session.cookieCache` would be the other way round it — the cache answers from a signed
 * cookie without touching the adapter at all — which is why it stays off.
 *
 * **Validates: v3 Req 46.1, 48.3, 48.4, 48.5, 48.6**
 */

import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getDatabase } from './client';
import * as schema from './schema';

/** Better Auth's name for the session model, which is what the adapter switches on */
const SESSION_MODEL = 'session';

/** The column a session cookie names */
const TOKEN_FIELD = 'token';

/** The column an identifier moves to when a rotation replaces it */
const PREVIOUS_TOKEN_FIELD = 'previousToken';

/** What a rotation writes onto the row */
export interface SessionRotation {
  token: string;
  previousToken: string;
  previousTokenExpiresAt: Date;
}

/** As much of a stored session as the rules read */
export interface StoredSession {
  token: string;
  createdAt: Date;
  updatedAt: Date;
  previousToken?: string | null;
  previousTokenExpiresAt?: Date | null;
}

/**
 * What this module is told to do, without being told why
 *
 * Declared here rather than imported from `auth/` so that `db/` holds **no** import of `auth/` at
 * all — the folder-level edge would not be a module cycle, but it would be one edit away from
 * becoming one, and the header's claim that `db/` decides no policy is worth more as a fact than as
 * a sentence. `auth/sessionLifetime.ts` implements this interface and imports the type; that
 * direction already exists.
 */
export interface SessionRules {
  /** Whether a write moving `expiresAt` is due to renew, or should be left exactly as it is */
  isDueForRenewal(session: StoredSession, now: Date): boolean;
  /** The expiry a create or a renewal should write — the earlier of idle window and ceiling */
  expiryFor(createdAt: Date, now: Date): Date;
  /** The columns a rotation sets, or `null` when this deployment rotates without a grace window */
  rotationFor(currentToken: string, now: Date): SessionRotation | null;
  /** Whether a presented identifier is this row's previous one, still inside its window */
  resolvesPrevious(session: StoredSession, presented: string, now: Date): boolean;
}

/** One clause of a `where`, as the adapter contract shapes it */
interface WhereClause {
  field: string;
  value: unknown;
  operator?: string;
}

/**
 * Which session identifier a `where` is looking for, when it is looking for one
 *
 * A lookup by anything else — by `userId` for the sessions list, by `id` for a revocation — is
 * none of the grace rule's business and comes back `null`.
 */
function tokenSought(where: WhereClause[] | undefined): string | null {
  if (!where || where.length !== 1) return null;

  const [clause] = where;
  if (!clause || clause.field !== TOKEN_FIELD) return null;
  if (clause.operator && clause.operator !== 'eq') return null;

  return typeof clause.value === 'string' ? clause.value : null;
}

/** The same `where`, asking about `previousToken` instead */
function byPreviousToken(presented: string): WhereClause[] {
  return [{ field: PREVIOUS_TOKEN_FIELD, value: presented, operator: 'eq' }];
}

/** What the wrapper needs to do its job */
export interface AuthAdapterOptions {
  rules: SessionRules;
  /** The clock, passed in so a test can drive one */
  now?: () => Date;
}

/**
 * Which database the process currently has, as an opaque identity
 *
 * `auth/` memoises its Better Auth instance against this rather than rebuilding one per request:
 * constructing it assembles a route table, and doing that on every call would be a real cost for
 * a value that changes only in tests. Returned as `object` so that nothing outside `db/` can do
 * anything with it except compare it — which is the whole of what it is for.
 *
 * @returns The current connection, usable only as a cache key
 */
export function currentDatabaseKey(): object {
  return getDatabase();
}

/**
 * An adapter over whichever database this process currently has
 *
 * @param options The session rules to apply, and the seams a test needs
 * @returns Better Auth's Drizzle adapter with AUTH-04's session rules wrapped around it
 */
export function authDatabaseAdapter(options: AuthAdapterOptions) {
  const inner = drizzleAdapter(getDatabase().db, {
    provider: 'sqlite',
    // Named explicitly rather than left to the adapter's own discovery, so that a table renamed in
    // `authSchema.ts` is a compile error here rather than a "no such table" at somebody's sign-in
    schema: {
      user: schema.authUser,
      session: schema.authSession,
      account: schema.authAccount,
      verification: schema.authVerification,
    },
  });

  return withSessionRules(inner, options, options.now ?? (() => new Date()));
}

/** What `drizzleAdapter` hands back, as much of it as this module reshapes */
type InnerAdapter = ReturnType<typeof drizzleAdapter>;

/**
 * The session rules, wrapped around the library's adapter
 *
 * Everything not named here passes straight through, so an upgrade that adds an adapter method
 * keeps working rather than losing it.
 */
function withSessionRules(
  inner: InnerAdapter,
  options: AuthAdapterOptions,
  clock: () => Date
): InnerAdapter {
  return ((context: Parameters<InnerAdapter>[0]) => {
    const adapter = inner(context);

    /**
     * A row found by its previous identifier, but only while that identifier is still honoured
     *
     * Without the window check a rotation would be decorative — the identifier it replaced would go
     * on working for ever.
     */
    const graced = (row: StoredSession | null, presented: string): StoredSession | null =>
      row && options.rules.resolvesPrevious(row, presented, clock()) ? row : null;

    return {
      ...adapter,

      /**
       * A new session, with the ceiling applied from the very first write
       *
       * Without this an absolute lifetime *shorter* than the idle one would not bite until the
       * first renewal — a whole update window later — which is exactly the configuration
       * `.env.example` says is supported.
       */
      create: async (query: Parameters<typeof adapter.create>[0]) => {
        if (query.model !== SESSION_MODEL) return adapter.create(query);

        const now = clock();
        const created = (query.data as { createdAt?: Date }).createdAt ?? now;

        return adapter.create({
          ...query,
          data: { ...query.data, expiresAt: options.rules.expiryFor(created, now) },
        });
      },

      /**
       * A session by token, honouring one that a rotation has only just replaced
       *
       * The second lookup happens **only** when the first found nothing and the request really was
       * naming a token, so the common path costs exactly what it did before.
       */
      findOne: async <T>(query: Parameters<typeof adapter.findOne>[0]): Promise<T | null> => {
        const found = await adapter.findOne<T>(query);
        if (found || query.model !== SESSION_MODEL) return found;

        const presented = tokenSought(query.where as WhereClause[]);
        if (presented === null) return null;

        const previous = await adapter.findOne<StoredSession>({
          ...query,
          where: byPreviousToken(presented) as typeof query.where,
        });

        return graced(previous, presented) as T | null;
      },

      /**
       * The same fallback, for the lookup a delete does first
       *
       * `deleteWithHooks` finds the row with `findMany({ limit: 1 })` and skips the delete when
       * nothing comes back, so without this a sign-out inside the grace window deletes nothing and
       * says nothing.
       */
      findMany: async <T>(query: Parameters<typeof adapter.findMany>[0]): Promise<T[]> => {
        const found = await adapter.findMany<T>(query);
        if (found.length > 0 || query.model !== SESSION_MODEL) return found;

        const presented = tokenSought(query.where as WhereClause[]);
        if (presented === null) return found;

        const previous = await adapter.findOne<StoredSession>({
          model: SESSION_MODEL,
          where: byPreviousToken(presented) as NonNullable<typeof query.where>,
        });
        const resolved = graced(previous, presented);

        return resolved ? [resolved as T] : found;
      },

      /**
       * A session update, with the ceiling applied and the identifier rotated
       *
       * Only a write that is **already** moving `expiresAt`, on a row that is **due**, is treated
       * as a renewal. The second half is not belt-and-braces: capping `expiresAt` at the ceiling
       * breaks the library's own once-per-`updateAge` test — its formula assumes
       * `expiresAt = lastRenewal + idle` — so from the moment the ceiling binds it would otherwise
       * renew *and rotate* on every single request, turning the grace window from a rare race into
       * every concurrent pair.
       */
      update: async <T>(query: Parameters<typeof adapter.update>[0]): Promise<T | null> => {
        if (query.model !== SESSION_MODEL || !isRenewal(query.update)) {
          return adapter.update<T>(query);
        }

        const current = await adapter.findOne<StoredSession>({
          model: SESSION_MODEL,
          where: query.where,
        });
        const now = clock();
        if (!current || !options.rules.isDueForRenewal(current, now)) {
          return adapter.update<T>(query);
        }

        return adapter.update({
          ...query,
          update: {
            ...(query.update as Record<string, unknown>),
            // The absolute ceiling, as an ordinary expiry — see `sessionLifetime.ts` for why that
            // is the whole of how a ceiling gets enforced
            expiresAt: options.rules.expiryFor(current.createdAt, now),
            ...(options.rules.rotationFor(current.token, now) ?? {}),
          },
        }) as Promise<T | null>;
      },

      /**
       * A session deleted by the identifier the **cookie** carried
       *
       * **The asymmetry this exists for is a real one.** Better Auth signs out by deleting the token
       * it read from the cookie, not the one it resolved the session to — and during the grace
       * window those differ. Left alone, signing out after a rotation matched nothing: the browser's
       * cookie was cleared, the person believed they had signed out, and the row stayed live for
       * anyone holding the current identifier. That would have made a liar of the whole reason
       * sign-out deletes a row rather than clearing a cookie.
       */
      delete: async (query: Parameters<typeof adapter.delete>[0]): Promise<void> => {
        await adapter.delete(query);
        if (query.model !== SESSION_MODEL) return;

        const presented = tokenSought(query.where as WhereClause[]);
        if (presented === null) return;

        // Unconditional rather than guarded on the grace window: a row still carrying this as its
        // `previousToken` is a row this sign-out was meant to remove, whatever the clock says.
        await adapter.delete({
          ...query,
          where: byPreviousToken(presented) as typeof query.where,
        });
      },
    };
  }) as InnerAdapter;
}

/**
 * Whether an update is the renewal Better Auth performs once per `updateAge`
 *
 * `expiresAt` moving and `token` **not** moving. The second half is forward-looking: in Better Auth
 * 1.7.1 the only session write carrying `expiresAt` is that refresh, and every revocation deletes
 * instead — but a future "extend this session" write that also set a token would otherwise be
 * rotated underneath, which would sign somebody out with nothing to explain it.
 */
function isRenewal(update: unknown): boolean {
  if (typeof update !== 'object' || update === null) return false;
  return 'expiresAt' in update && !(TOKEN_FIELD in update);
}
