/**
 * `GET /api/health` — the route that proves the pipeline (TICKET-SRV-01, TICKET-DB-01)
 *
 * The first server route, and deliberately the dullest one: whatever it does here, every later
 * route copies. It answers on the app's own origin, by relative path, with no CORS layer and no
 * variable naming a backend — because there is only ever one server (D1).
 *
 * **It reports database reachability and the applied migration, not just liveness** (v3 Req 47.5).
 * Those two are what separate "the process is up" from "the process can do its job", and they are
 * the first thing to look at when a deployment goes wrong. The asking is
 * [`db/health.ts`](../db/health.ts)'s job — a route does not open a connection.
 *
 * **Validates: v3 Req 47.5, 47.6**
 */

import { type DatabaseHealth, databaseHealth } from '../db/health';
import { serverEnv } from '../env';
import { defineHandler } from '../http/pipeline';

/** Whether the server can do its job, not merely whether it is running */
const HEALTH_STATUS = {
  OK: 'ok',
  UNHEALTHY: 'unhealthy',
} as const;

type HealthStatus = (typeof HEALTH_STATUS)[keyof typeof HEALTH_STATUS];

/** What `/api/health` reports */
interface HealthReport {
  status: HealthStatus;
  environment: string;
  database: DatabaseHealth;
}

export const health = defineHandler((): HealthReport => {
  const database = databaseHealth();

  return {
    status: database.reachable ? HEALTH_STATUS.OK : HEALTH_STATUS.UNHEALTHY,
    environment: serverEnv().nodeEnv,
    database,
  };
});
