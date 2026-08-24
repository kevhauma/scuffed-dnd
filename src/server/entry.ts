/**
 * The server entry — one process, two jobs (TICKET-SRV-01)
 *
 * Every request arrives here. `/api/*` goes to this repository's own router; everything else falls
 * through to TanStack Start's SSR handler, which serves the app. That is D1's "one server, not
 * two" made literal: `yarn dev` and the production build both call *this* module, so a developer
 * starts one thing and an operator later runs one thing, and the two arrangements differ in build
 * speed rather than in shape.
 *
 * **This is also what keeps API route files out of `client/`.** TanStack Start generates its route
 * tree from a directory that TICKET-DX-07 put under `client/`; an API route living there would
 * import a `server/` module from `client/` and make D14's boundary exceptional on day one.
 * Configuring `server.entry` instead means API routes are plain modules under `server/routes/`,
 * reached from here, and dependency-cruiser passes with **no exception granted** — see the
 * ticket's acceptance criteria.
 *
 * **Validates: v3 Req 47.1, 47.6, 47.8**
 */

import type { Register } from '@tanstack/react-router';
import type { RequestHandler } from '@tanstack/react-start/server';
import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server';
import { runMigrations } from './db/migrate';
import { serverEnv } from './env';
import { handleApiRequest } from './http/apiRouter';

/**
 * The start-up door (v3 Req 47.2, 46.2)
 *
 * Reading the environment *here* rather than in `env.ts` at module scope is what makes a missing
 * required variable a start-up failure without also making every route module unimportable — see
 * that file's note. This is the one place that runs exactly once, when the server loads.
 *
 * Migrations run in the same breath, and for the same reason: **upgrading is starting the
 * process**, so there is no separate command to forget between pulling a build and restarting it.
 * A failure here throws before the handler below is ever reachable, which is the point — a server
 * that cannot bring its schema up to date must not serve a half-migrated one.
 */
serverEnv();
runMigrations();

/** Renders the app. Everything the API does not claim goes here. */
const renderApp = createStartHandler(defaultStreamHandler);

/**
 * The shape the framework calls — the same one `@tanstack/react-start`'s own default entry exports
 *
 * `RequestHandler` is taken from `@tanstack/react-start/server` rather than from
 * `@tanstack/start-server-core` for the reason the default entry states: so the emitted types do
 * not reach past the package this repository actually depends on.
 */
export interface ServerEntry {
  fetch: RequestHandler<Register>;
}

const entry: ServerEntry = {
  async fetch(...args) {
    return (await handleApiRequest(args[0])) ?? renderApp(...args);
  },
};

export default entry;
