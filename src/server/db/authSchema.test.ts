/**
 * Our Drizzle tables against Better Auth's expectations (TICKET-AUTH-01)
 *
 * The library tells us what columns it reads — `getAuthTables()` is the same function its CLI
 * generates a schema from — so the two can be compared instead of trusted. Without this, a Better
 * Auth upgrade that adds a column is discovered by somebody failing to sign in, and the migration
 * that fixes it is written under pressure.
 *
 * **What this does not check is a type.** It compares the *set of columns*, because that is what
 * a missing migration gets wrong. A column that exists with the wrong affinity is a different
 * failure and SQLite would mostly tolerate it anyway.
 *
 * **Validates: v3 Req 46.3**
 */

// From `better-auth` rather than from `@better-auth/core/db`, which is where it is defined:
// the core package is a transitive dependency and is not in `package.json`, so importing it
// directly is what `no-undeclared-dependency` exists to refuse (DX-08) — and it caught this.
// `better-auth` re-exports the whole of `@better-auth/core/db`, so nothing is lost.
import { getAuthTables } from 'better-auth';
import { getTableColumns } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { SESSION_ADDITIONAL_FIELDS } from '../auth/sessionLifetime';
import { authAccount, authSession, authUser, authVerification } from './authSchema';

/**
 * The options that decide which tables exist
 *
 * Only the features that add columns matter here, and email/password adds none of its own —
 * `account.password` is in the base schema. TICKET-AUTH-02's social providers add none either,
 * which is why linking an identity is a row rather than a migration. TICKET-AUTH-04's two are the
 * first that genuinely are additions, and they are passed in from the one place that declares them.
 */
const authTables = getAuthTables({
  emailAndPassword: { enabled: true },
  // **The same constant the real instance is configured with**, not a copy (TICKET-AUTH-04). The
  // grace window's two columns are ours rather than the library's, so without telling
  // `getAuthTables` about them this comparison would report our schema as having two columns too
  // many — and the honest fix is to declare them once and hand the same object to both.
  session: { additionalFields: SESSION_ADDITIONAL_FIELDS },
});

/** Our tables, by the model name Better Auth knows them as */
const ours = {
  user: authUser,
  session: authSession,
  account: authAccount,
  verification: authVerification,
};

/** Every column Better Auth expects on a model, including the id it assumes */
function expectedFields(model: keyof typeof ours): string[] {
  const table = authTables[model];
  if (!table) throw new Error(`Better Auth no longer defines a "${model}" model`);

  return ['id', ...Object.keys(table.fields)].sort();
}

/** Every property our Drizzle table declares — the names the adapter matches on */
function ourFields(model: keyof typeof ours): string[] {
  return Object.keys(getTableColumns(ours[model])).sort();
}

describe('Better Auth’s schema and ours', () => {
  for (const model of Object.keys(ours) as (keyof typeof ours)[]) {
    it(`agrees on every column of "${model}"`, () => {
      expect(ourFields(model)).toEqual(expectedFields(model));
    });
  }

  it('covers every model the library defines, with none left over', () => {
    // A model added by an upgrade would otherwise be invisible: the per-model cases above only
    // check the four we already knew about
    expect(Object.keys(authTables).sort()).toEqual(Object.keys(ours).sort());
  });

  it('keeps the table names Better Auth defaults to, so nothing has to be configured', () => {
    for (const [model, table] of Object.entries(authTables)) {
      expect(table.modelName, model).toBe(model);
    }
  });
});
