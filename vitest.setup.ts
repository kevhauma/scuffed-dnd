import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll } from 'vitest';

// The suite is an environment like any other, and since TICKET-DB-01 the server refuses to start
// without `DATABASE_URL`. `:memory:` is the right answer here: a test that wants a database opens
// its own with `createDatabase(':memory:')`, and one that merely imports a route module — the API
// router, say — should not need a file on disk to do it. `??=` so a real value still wins.
// TICKET-DX-06 folds this into the server test harness.
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
