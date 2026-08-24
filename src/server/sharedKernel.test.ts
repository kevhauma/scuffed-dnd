/**
 * The Kernel, called from the server root (TICKET-DX-07)
 *
 * The first thing `src/server/` does, and the reason DX-07 came before a line of server code: the
 * pure half of the old `src/services/` is importable here, and the browser half is not. The server
 * validates a ruleset with the **same** function the import path validates one with — that is D5's
 * "a rule is written once" made concrete, and the check that stops RUL-01 from growing a second
 * validator beside `validateConfigurationShape`.
 *
 * The other half of the proof is a rule, not a test:
 * [`boundaryFixtures/reachesBrowserStorage.ts`](./boundaryFixtures/reachesBrowserStorage.ts)
 * imports `client/services/storage.ts` from here and `no-server-to-client` refuses it.
 *
 * **Validates: v3 Req 50; overview D5, D14**
 */

import { describe, expect, it } from 'vitest';
import {
  importConfiguration,
  SchemaVersionError,
  serializeConfiguration,
  validateConfigurationShape,
} from '#shared/services/importExport';
import { makeValidConfiguration } from '#shared/services/importExport.fixtures';

describe('the Kernel from src/server/', () => {
  it('validates a ruleset with the same function the client imports with', () => {
    expect(validateConfigurationShape(makeValidConfiguration())).toEqual({
      isValid: true,
      errors: [],
    });
  });

  it('refuses a body that is not a ruleset at all', () => {
    const result = validateConfigurationShape({ name: 'nearly' });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Field 'id' must be a string");
  });

  it('round-trips a ruleset through JSON text without a Blob or a File', () => {
    const config = makeValidConfiguration();

    expect(importConfiguration(serializeConfiguration(config))).toEqual(config);
  });

  it('refuses a document written against another persisted shape', () => {
    const stale = JSON.stringify({ ...makeValidConfiguration(), schemaVersion: 1 });

    expect(() => importConfiguration(stale)).toThrow(SchemaVersionError);
  });
});
