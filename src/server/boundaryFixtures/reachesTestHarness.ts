/**
 * Violates `test-harness-stays-in-tests` (TICKET-DX-06)
 *
 * A shipped server module importing the harness. `callRoute` hands a handler an account nobody
 * authenticated, and `withTestDatabase` replaces the process's database — both fine inside a test
 * and neither fine anywhere a real request can reach. This is the import that would make
 * `testing/` being allowed past `queries-belong-to-repositories` an unsound trade.
 */

import { withTestDatabase } from '../testing/database';

export const theHarnessInShippedCode = withTestDatabase;
