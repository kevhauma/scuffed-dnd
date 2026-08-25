import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll } from 'vitest';

// The suite is an environment like any other, and since TICKET-DB-01 the server refuses to start
// without `DATABASE_URL`. `:memory:` is the right answer here: a test that wants a database asks
// the harness for one with `withTestDatabase()`, and one that merely imports a route module — the
// API router, say — should not need a file on disk to do it. `??=` so a real value still wins.
//
// **It stays here rather than moving into the harness (TICKET-DX-06)**, which is the opposite of
// what DB-01 predicted. `env.ts` reads `process.env` when a module first asks for it, and that can
// happen at *import* time, before any test body has run — so a harness function could not be early
// enough. What it is is a floor under the tests that never touch a database at all.
process.env.DATABASE_URL ??= ':memory:';

// Ensure React is properly loaded
beforeAll(() => {
  // This helps ensure React is properly initialized in the test environment
  if (typeof global !== 'undefined') {
    // @ts-ignore
    global.IS_REACT_ACT_ENVIRONMENT = true;
  }
});

// Cleanup after each test
afterEach(() => {
  cleanup();
});
