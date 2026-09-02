/**
 * Health endpoint tests (TICKET-POL-03, TICKET-DB-01)
 *
 * The endpoint's whole claim is that it separates *the process is up* from *the process can do its
 * job*, so the case that matters is the second one — and it is asserted against a **genuinely
 * broken connection** rather than a mocked one: the underlying SQLite handle is closed under a live
 * database, after which the next statement really does throw. That is exactly the condition
 * `databaseHealth` claims to catch, produced rather than simulated.
 *
 * What this cannot produce is a *permissions* failure: on Windows the file cannot be made
 * unreadable while `better-sqlite3` holds it open. The narrower claim these cases make is the
 * honest one — an unusable connection is reported unhealthy, with a 503 — and it is the same code
 * path a chmod, a full disk or an unmounted volume reaches.
 *
 * **Validates: v3 Req 47.5**
 */

import { describe, expect, it } from 'vitest';
import { ERROR_CODE, HEALTH_STATUS } from '#shared/types/api';
import { callRoute, withTestDatabase } from '../testing';
import { health } from './health';

/** What the endpoint answers with, as far as these cases care */
interface HealthBody {
  status?: string;
  environment?: string;
  database?: { reachable: boolean; migration: string | null };
  error?: { code: string; message: string };
}

describe('GET /api/health', () => {
  it('answers 200 with the migration when the database is reachable', () =>
    withTestDatabase(async () => {
      const result = await callRoute<HealthBody>(health, { path: '/api/health' });

      expect(result.status).toBe(200);
      expect(result.body.status).toBe(HEALTH_STATUS.OK);
      expect(result.body.database?.reachable).toBe(true);
      expect(result.body.database?.migration).toEqual(expect.any(String));
    }));

  it('names the build it is running, which is what makes a cookie Secure', () =>
    withTestDatabase(async () => {
      const result = await callRoute<HealthBody>(health, { path: '/api/health' });

      expect(result.body.environment).toBe('test');
    }));

  it('needs nobody to be signed in, because a probe has no account', () =>
    withTestDatabase(async () => {
      const result = await callRoute<HealthBody>(health, { path: '/api/health', as: null });

      expect(result.status).toBe(200);
    }));

  describe('when the database cannot answer', () => {
    /**
     * Break the connection for real, then ask
     *
     * `sqlite.close()` under a live `Database` leaves every later statement throwing
     * `The database connection is not open` — the same shape of failure a chmod or an unmounted
     * volume produces, and not a stub of one.
     */
    async function askWithABrokenDatabase() {
      return withTestDatabase(async (database) => {
        database.sqlite.close();
        return callRoute<HealthBody>(health, { path: '/api/health' });
      });
    }

    it('answers 503, so every probe that reads a status line agrees with the body', async () => {
      const result = await askWithABrokenDatabase();

      // The decision DB-01 left open: `curl -f`, a container health check and a load balancer all
      // branch on the status line, and a 200 saying *unhealthy* reports healthy to each of them
      expect(result.status).toBe(503);
    });

    it('still reports reachability and the migration, spelled as the healthy body spells them', async () => {
      const result = await askWithABrokenDatabase();

      // The endpoint is read *when things are broken*, so this is the one answer that must not be
      // thinner than the other. Same keys, same nesting; only `error` is extra.
      expect(result.body.status).toBe(HEALTH_STATUS.UNHEALTHY);
      expect(result.body.database).toEqual({ reachable: false, migration: null });
      expect(result.body.environment).toBe('test');
    });

    it('says which refusal it is, in a sentence an operator can act on', async () => {
      const result = await askWithABrokenDatabase();

      expect(result.body.error?.code).toBe(ERROR_CODE.UNAVAILABLE);
      expect(result.body.error?.message).toContain('DATABASE_URL');
    });
  });
});
