/**
 * Whether an Account has already been offered the upload (TICKET-IO-04)
 *
 * One table, one statement, one question — v3 Req 36.6 asks that the offer be made **once** per
 * Account and never again, and the whole of that rule is the `ON CONFLICT DO NOTHING` below.
 *
 * **Claiming is a write, not a read followed by one.** A `SELECT` then an `INSERT` is a race two
 * tabs restoring the same session would win together, and the visible failure — being asked twice,
 * on the one occasion the rule is about — is exactly the failure the requirement names. Here the
 * conflict clause carries the decision, so the second caller learns it lost by getting no row back.
 *
 * **Validates: v3 Req 36.6**
 */

import { type Database, getDatabase } from '../db/client';
import { accountUploadPrompt } from '../db/schema';

/**
 * Take the one prompt this Account is owed, if it is still there
 *
 * @param accountId Whose prompt
 * @param now Epoch milliseconds
 * @param database The connection; defaults to the process's
 * @returns True when this call is the one that claimed it — so exactly one caller ever sees true
 */
export function claimUploadPrompt(
  accountId: string,
  now: number,
  database: Database = getDatabase()
): boolean {
  return (
    database.db
      .insert(accountUploadPrompt)
      .values({ accountId, promptedAt: now })
      .onConflictDoNothing()
      .returning()
      .all().length > 0
  );
}
