/**
 * Who is asking, as a type (TICKET-AUTH-01)
 *
 * A file of its own for a mechanical reason worth stating: the pipeline needs this type to build a
 * context, and `currentAccount.ts` needs it to say what it returns. Declaring it in either of those
 * would make the two import each other, and `no-circular` refuses that — correctly, because a cycle
 * is what makes *which module owns this?* unanswerable.
 *
 * **Validates: v3 Req 32.1**
 */

/**
 * The acting Account
 *
 * An id and nothing else, because an id is the whole of what authorization compares: every table
 * DB-01 defines keys on `*_account_id`. Better Auth's own user row carries a name, an email and an
 * avatar, and a handler that wants one of those asks for it — carrying them here would put a copy
 * of the profile on every request that never reads it.
 */
export interface RequestAccount {
  id: string;
}
