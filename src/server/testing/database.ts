/**
 * A database per test, and no way to forget to close it (TICKET-DX-06)
 *
 * **The shape is a callback rather than a `beforeEach` pair**, and that is the decision this module
 * rests on. A hook pair leaks state between the two halves — the database has to live in a
 * file-scoped variable, which is exactly the thing that makes one test able to see another's rows.
 * A callback owns the whole lifetime: opened, migrated, run, closed in a `finally`, including when
 * the body throws. There is nothing to remember and nothing to share.
 *
 * It also keeps the harness free of `vitest`. Nothing here imports the runner, so `testing/` is
 * plain server code that happens to be useful to tests rather than a second framework — which is
 * why `no-dev-dep-in-production` has nothing to say about it.
 *
 * **In-memory, always.** Each call is its own `:memory:` database, which shares nothing with any
 * other by construction: not a file, not a page cache, not a WAL. There is no fixture on disk and
 * no cleanup to forget. What that costs is the two pragmas WAL would exercise — see
 * `db/client.ts`, which sets `journal_mode` only where it means something.
 *
 * **One caveat, stated rather than discovered.** While the callback runs, this is also the
 * *process's* database (see {@link setProcessDatabase}), so that a handler reaching `getDatabase()`
 * finds the test's schema. That is a module-level swap, restored on the way out. Nesting and
 * throwing are safe; **two calls that overlap in one module registry are not** — `it.concurrent`,
 * or a `Promise.all` of two calls inside one ordinary test. Overlapping is not merely unsupported,
 * it would leave a *closed* connection installed as the process database for the rest of the file,
 * so the restore is a compare-and-swap that throws rather than a blind one that corrupts. Vitest
 * parallelises across files, where each worker has its own module registry and none of this arises.
 *
 * One relative of that case is not detected: a body that starts work it never `await`s has the
 * connection closed underneath it. The fix is to await it; there is no way from here to tell that
 * kind of floating promise from a finished one.
 *
 * **Validates: v3 Req 45.3**
 */

import { createDatabase, type Database, setProcessDatabase } from '../db/client';
import { runMigrations } from '../db/migrate';

/**
 * Run something against a freshly migrated database of its own
 *
 * ```ts
 * it('should store a ruleset', () =>
 *   withTestDatabase((database) => {
 *     const row = seedRuleset(database);
 *     expect(findRuleset(database, row.id)).not.toBeNull();
 *   }));
 * ```
 *
 * @param run What to do with it; may be sync or async, and its value is returned
 * @returns Whatever `run` returned
 */
export function withTestDatabase<T>(run: (database: Database) => T): T {
  const database = createDatabase(':memory:');
  runMigrations(database);

  // Installed as the process's database too, so a route handler under test reaches *this* schema
  // rather than opening `DATABASE_URL`. The previous value is restored rather than cleared, so a
  // nested call puts its parent back rather than dropping it.
  const previous = setProcessDatabase(database);

  /**
   * Put the process's database back and close this one
   *
   * Returns the overlap error rather than throwing it, because release runs on the failure path
   * too and a harness complaint must not replace the body's own error.
   */
  const release = (): Error | null => {
    const displaced = setProcessDatabase(previous);
    database.close();

    // A compare-and-swap rather than a blind restore. Two **overlapping** calls interleave as
    // A-installs, B-installs, A-restores-and-closes, B-restores — and that last step puts a
    // *closed* handle back. `getDatabase()` is `opened ??=`, so a non-null closed handle is never
    // replaced, and every later call in this module registry gets a dead connection. Failing here
    // turns a silently corrupted file into one loud test.
    return displaced === database
      ? null
      : new Error(
          'withTestDatabase calls overlapped: the process database was not this call’s to ' +
            'restore. Two calls ran at once in one module registry — it.concurrent, or a ' +
            'Promise.all of two calls in one test. Run them one after another.'
        );
  };

  let result: T;
  try {
    result = run(database);
  } catch (error) {
    release();
    throw error;
  }

  // An async body has not finished when `run` returns, and closing here would pull the connection
  // out from under it. `then` rather than `finally` so the rejection still propagates untouched.
  if (result instanceof Promise) {
    return result.then(
      (value) => {
        const overlap = release();
        if (overlap) throw overlap;
        return value;
      },
      (error: unknown) => {
        release();
        throw error;
      }
    ) as T;
  }

  const overlap = release();
  if (overlap) throw overlap;
  return result;
}
