/**
 * `GET /api/health` — the route that proves the pipeline (TICKET-SRV-01, TICKET-DB-01, TICKET-POL-03)
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
 * ## Unhealthy is a 503, and how the body survives it (TICKET-POL-03)
 *
 * A health endpoint is read by machines that branch on the **status line** — `curl -f`, a container
 * health check, systemd, a load balancer — so a 200 whose body says *unhealthy* reports healthy to
 * every one of them. That settles the question DB-01's criterion left open: unhealthy is non-200.
 *
 * The interesting half is keeping the diagnostics. This endpoint is consulted *when things are
 * broken*, and answering that moment with a bare `{error:{code}}` would make it say **less** than
 * it says today. The pipeline's rule is that a handler returns data and throws refusals, and that
 * the status comes from the code rather than from a call site — so the report rides the refusal's
 * own `details` channel, flat and spelled identically to the healthy body. One reader parses both
 * answers: `body.database.reachable` means the same thing at 200 and at 503, and only `error` is
 * extra. **No handler gained the ability to pick a status**, which is the rule worth more than this
 * endpoint.
 *
 * **Validates: v3 Req 47.5, 47.6**
 */

import { HEALTH_STATUS, type HealthReport } from '#shared/types/api';
import { databaseHealth } from '../db/health';
import { serverEnv } from '../env';
import { unavailable } from '../http/appError';
import { defineHandler } from '../http/pipeline';

/** What an unreachable database is reported as, in a sentence an operator can act on */
const UNAVAILABLE_MESSAGE =
  'The database is unreachable, so this server cannot serve. Check that DATABASE_URL points at a ' +
  'readable file on a mounted, writable volume.';

export const health = defineHandler((): HealthReport => {
  const database = databaseHealth();
  const environment = serverEnv().nodeEnv;

  if (!database.reachable) {
    throw unavailable(UNAVAILABLE_MESSAGE, {
      status: HEALTH_STATUS.UNHEALTHY,
      environment,
      database,
    });
  }

  return { status: HEALTH_STATUS.OK, environment, database };
});
