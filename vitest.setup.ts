import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll } from 'vitest';

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
