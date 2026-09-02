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
 * **This module is also the built artefact's only door** (TICKET-POL-03). `yarn build` emits
 * exactly one server file, `dist/server/entry.js`, so anything a runner outside the bundle needs
 * has to come out of *here* — which is why {@link start} and {@link backupDatabase} are re-exported
 * below rather than reached directly. `scripts/serve.mjs` and `scripts/backup.mjs` are plain ESM
 * beside the tree and cannot import TypeScript under `src/server/`; the bundle is what they load.
 *
 * **Validates: v3 Req 47.1, 47.6, 47.8**
 */

import type { Register } from '@tanstack/react-router';
import type { RequestHandler } from '@tanstack/react-start/server';
import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server';
import { backupDatabase } from './db/backup';
import { runMigrations } from './db/migrate';
import { serverEnv } from './env';
import { handleApiRequest } from './http/apiRouter';
import { type RunningServer, startServer, stopOnSignals } from './serve';

/** Whether {@link startup} has already run — the environment and the schema settle once */
let started = false;

/**
 * The start-up door (v3 Req 47.2, 46.2)
 *
 * Reading the environment *here* rather than in `env.ts` at module scope is what makes a missing
 * required variable a start-up failure without also making every route module unimportable — see
 * that file's note.
 *
 * Migrations run in the same breath, and for the same reason: **upgrading is starting the
 * process**, so there is no separate command to forget between pulling a build and restarting it.
 * A failure here throws before the handler below is ever reachable, which is the point — a server
 * that cannot bring its schema up to date must not serve a half-migrated one.
 *
 * @throws {MissingEnvironmentError} If a required variable is unset
 * @throws {MigrationError} If the schema could not be brought up to date
 */
export function startup(): void {
  if (started) return;
  started = true;

  serverEnv();
  runMigrations();
}

/**
 * **Dev runs this on load; production runs it from {@link start}, and `yarn run db:backup` runs it
 * never** (TICKET-POL-03)
 *
 * It was an unconditional statement at module scope until the review found what that costs: the
 * backup command reaches `backupDatabase` through this module — the built artefact's only door —
 * so importing it *migrated the database before copying it*, and **refused to copy at all when a
 * migration failed**. That is precisely the moment README.md points an operator here, since
 * recovery from a bad upgrade is the backup. A backup must be able to run when start-up cannot.
 *
 * `import.meta.env.DEV` is Vite's build-time constant, replaced with `false` in the SSR build and
 * eliminated with the branch, so the production bundle has no module-scope start-up at all. Under
 * `yarn dev` it is `true` and this runs exactly when it always did.
 *
 * **And *when* that is, is worth stating, because this file used to imply otherwise.** Vite
 * evaluates the SSR entry **lazily, on the first request** — measured: with a fresh `DATABASE_URL`
 * the dev server listens with no database file on disk, and the file appears only once something
 * asks for a page. So a missing variable has always been a failed *first request* in development,
 * never a failed start-up, and the sentence this docblock replaced ("the one place that runs
 * exactly once, when the server loads") was true of the artefact and not of `yarn dev`. Production
 * is the strict one, and now more so: {@link start} runs this **before the listener exists**.
 *
 * **The alternative was a second rollup input** (`src/server/backupEntry.ts`) giving the backup its
 * own door and leaving this statement unconditional. Rejected: it means overriding the input the
 * TanStack Start plugin sets for the `ssr` environment, which is a change to the build graph — and
 * therefore to `vite preview` and to whatever the plugin does with its manifest — in return for the
 * same property this one line buys inside the module that owns it.
 */
if (import.meta.env.DEV) startup();

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

/**
 * Start listening — what `yarn start` runs (TICKET-POL-03)
 *
 * The framework calls {@link ServerEntry.fetch} and never creates a listener, so in production
 * something has to. That something is [`serve.ts`](./serve.ts), which serves `dist/client/`,
 * bridges everything else to the handler above and attaches the live socket to the same server. It
 * is handed the fetch by parameter rather than importing this module, which is what keeps the two
 * out of a cycle.
 *
 * The signal handlers are registered here rather than inside `startServer`, so that a test starting
 * a server does not leave a process-wide listener behind each time.
 *
 * **{@link startup} runs here rather than at module scope**, so that a failed migration refuses to
 * serve — before the listener exists, which is stricter than the old arrangement rather than looser
 * — while `scripts/backup.mjs`, which imports this module for `backupDatabase` alone, migrates
 * nothing.
 *
 * @returns The running server, once it is listening
 * @throws {MissingEnvironmentError} If a required variable is unset
 * @throws {MigrationError} If the schema could not be brought up to date
 */
export async function start(): Promise<RunningServer> {
  startup();

  const handler = entry.fetch;
  const running = await startServer(handler);

  stopOnSignals(running);

  return running;
}

export { backupDatabase };
