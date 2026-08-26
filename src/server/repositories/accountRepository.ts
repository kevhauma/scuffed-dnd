/**
 * The two questions the server ever asks Better Auth's user table (TICKET-GAM-03)
 *
 * **A repository over the library's table, and that is not a contradiction.** `authSchema.ts` holds
 * the *shape* because it is Better Auth's; the queries are still ours, and
 * `queries-belong-to-repositories` makes no exception for a table somebody else declared. A handler
 * reaching for `authUser` directly would be reaching for a connection, which is the thing that rule
 * exists to stop.
 *
 * **What is here is an address book and nothing more.** GAM-03 matches an invitation to the Account
 * holding an email address (v3 Req 38.3) and shows the invitee who asked them (v3 Req 38.7); those
 * two questions are the whole reason this module exists. Nothing here **writes** — identity is
 * Better Auth's, and the moment this file updates that table the library's own invariants have a
 * second author.
 *
 * **Matching is on the address the Account registered, which nothing verifies** — this milestone
 * sends no email (D12), so somebody could register an address they do not own and receive its
 * invitations. Stated rather than papered over; when sign-up verification lands, the binding becomes
 * as strong as it reads with no change here.
 *
 * **Validates: v3 Req 38.3, 38.5, 38.6**
 */

import { eq, sql } from 'drizzle-orm';
import { type Database, getDatabase } from '../db/client';
import { authUser } from '../db/schema';

/** As much of an Account as anything outside `auth/` ever needs */
export interface AccountIdentity {
  id: string;
  name: string;
  /** **Normalised** — see {@link normalizeEmailAddress} */
  email: string;
}

/**
 * An email address in the one form comparisons are made between
 *
 * Lower-cased and trimmed, because a DM typing `Ada@Example.com` has not made a mistake worth an
 * invitation nobody can redeem. **Both sides go through this**, so a comparison is between two
 * normal forms rather than between one and whatever a keyboard produced — the same discipline
 * `normalizeInviteCode` applies to a code.
 *
 * The local part of an address is case-*sensitive* by the RFC, which is the argument against doing
 * this. It loses to the argument for: no mail server anybody uses honours that, and the failure it
 * would buy is an invitation that silently never arrives.
 *
 * @param raw Whatever was typed or stored
 * @returns The comparable form; an empty string when there was nothing usable in it
 */
export function normalizeEmailAddress(raw: string): string {
  return raw.trim().toLowerCase();
}

/** The three columns anything outside `auth/` is allowed to care about */
const IDENTITY = { id: authUser.id, name: authUser.name, email: authUser.email };

/** A selected row as an identity, with its address in the normal form */
function toIdentity(row: AccountIdentity | undefined): AccountIdentity | null {
  return row ? { id: row.id, name: row.name, email: normalizeEmailAddress(row.email) } : null;
}

/**
 * The Account with this id
 *
 * @param accountId Better Auth's user id
 * @param database The connection; defaults to the process's
 * @returns The identity, or `null` when no such Account exists
 */
export function findAccountById(
  accountId: string,
  database: Database = getDatabase()
): AccountIdentity | null {
  return toIdentity(
    database.db.select(IDENTITY).from(authUser).where(eq(authUser.id, accountId)).get()
  );
}

/**
 * The Account holding an address, if anybody does
 *
 * **Compared case-insensitively in SQL rather than on the stored text**, which costs the index on a
 * table holding one row per person at one table's worth of games. Better Auth lower-cases what it
 * stores today; a stored `Ada@Example.com` — from an older row, an imported one, or a future version
 * that stops normalising — would otherwise make an invitation silently unredeemable, and *silently*
 * is the part that rules the cheaper comparison out.
 *
 * @param email The **normalised** address
 * @param database The connection; defaults to the process's
 * @returns The identity, or `null` when nobody has registered it
 */
export function findAccountByEmail(
  email: string,
  database: Database = getDatabase()
): AccountIdentity | null {
  if (email === '') return null;

  return toIdentity(
    database.db
      .select(IDENTITY)
      .from(authUser)
      .where(sql`lower(${authUser.email}) = ${email}`)
      .get()
  );
}
