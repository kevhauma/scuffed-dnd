/**
 * `GET /api/health` — the route that proves the pipeline (TICKET-SRV-01)
 *
 * The first server route, and deliberately the dullest one: whatever it does here, every later
 * route copies. It answers on the app's own origin, by relative path, with no CORS layer and no
 * variable naming a backend — because there is only ever one server (D1).
 *
 * TICKET-DB-01 adds database reachability and the applied migration version to this body, which is
 * what makes it a health check rather than a liveness ping (v3 Req 47.5).
 *
 * **Validates: v3 Req 47.5, 47.6**
 */

import { serverEnv } from '../env';
import { defineHandler } from '../http/pipeline';

/** What `/api/health` reports. Not exported — nothing needs the type until something fetches it. */
interface HealthReport {
  status: 'ok';
  environment: string;
}

export const health = defineHandler((): HealthReport => {
  return { status: 'ok', environment: serverEnv().nodeEnv };
});
