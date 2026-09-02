# TICKET-POL-03 — Deployment shape: build, environment, data directory, backup

- **Area:** Integration and polish
- **Type:** Feature
- **Traceability:** v3 [Req 47](../requirements.md#requirement-47-deployment-and-operations)

## User story

As an operator — most likely the User, on a small box or a home server — I want to run this with one
command and a handful of environment variables, so that hosting my group's game is not a project of
its own.

## Description

**Last ticket of the milestone.** The milestone is not done when the features work on the author's
machine; it is done when someone else can run it. This ticket is the difference, and it is where the
env variables scattered across SRV-01, AUTH-01, AUTH-02 and LIVE-03 get collected, documented and
verified as a set.

## Current situation (as-is)

- SRV-01 established `src/server/env.ts` as the only reader of `process.env`, failing at start-up
  and naming every missing required key at once, with `.env.example` kept in step by a test.
- Optional configuration accumulated across the milestone: **two** OAuth credential pairs — Google
  and Discord (AUTH-02) — the idle and absolute session lifetimes (AUTH-04), replay window and idle
  timeout (LIVE-03), rate limits (AUTH-01). Those two providers are the **only** external
  integrations, each independently optional; D12 left the milestone with no mail configuration to
  document.
- DB-01 applies migrations at start-up and refuses to serve on failure. `DATABASE_URL` points at a
  file that must live somewhere durable.
- `yarn build` currently produces a client bundle only; nothing has ever needed to serve it.
- SRV-01 settled **one server, not two** (D1, v3 Req 47.6–47.8): relative API paths, a socket URL
  derived from `window.location`, no variable naming the backend. This ticket is where that stops
  being a development-time arrangement and becomes the deployed shape.

## Desired result (to-be)

- A production build producing **one** Node process serving both the client bundle and the API, run
  by a documented command, with ~~the Nitro `node-server` target and~~ the WebSocket server attached
  to the same listener. **The bundle is served by the server, not by a separate static host** — the
  operator runs one web server, starts one thing, and keeps one thing alive.
- A documented data directory: where the SQLite file and its WAL companions live, what to back up
  (copy the file with the database quiesced, or `VACUUM INTO`), and how to restore it.
- A README section covering every environment variable with required/optional and its default,
  first-run setup from an empty directory, and the health endpoint's meaning.

## Implementation notes (2026-09-02)

**There is no Nitro in this version, so the to-be's "Nitro `node-server` target" describes an
arrangement that does not exist here** — struck through above rather than quietly satisfied.
`@tanstack/react-start@1.132` ships no `node-server` target and emits no `.output/`: `yarn build`
produces `dist/client/` (assets only; the shell is server-rendered, so there is no `index.html`) and
a single `dist/server/entry.js` default-exporting the `entry` object. **The runner is therefore
this repository's own**, and the property the to-be was reaching for is delivered in full — one
process, one port, the bundle served by the server, the socket on the same listener.

Two things were broken and unnoticed because **the production build had never been run**:

1. **The built server could not find its migrations.** `MIGRATIONS_DIR` resolves beside the module,
   which in the bundle is `dist/server/migrations/` — a folder the build never created.
   `scripts/server-migrations.mjs` now emits them there through Rollup, so a journal entry with no
   file fails the build rather than an operator's first start-up.
2. **The built server did not load at all**, throwing `z.looseObject is not a function` on import.
   The Start plugin puts `better-auth` in `resolve.noExternal`, so Rollup inlined its source but
   left its own `import … from 'zod'` a bare specifier; Node then resolved that from
   `dist/server/` to the hoisted root **zod 3**, while better-auth needs the **zod 4** nested in its
   own `node_modules`. Under `yarn dev` the same import resolves relative to the *importer* and
   finds zod 4, which is why development never saw it. Fixed by externalising `better-auth` in the
   `ssr` environment — Vite's `createIsConfiguredAsExternal` tests `external` **before** `noExternal`
   and compares package names, so one entry covers every subpath and the Start plugin's list is left
   alone. No new dependency.

**`/api/health` answers 503 when unhealthy, and keeps its whole body** (the question the criteria
left open). Non-200 because every consumer of a health endpoint branches on the status line, and a
200 saying *unhealthy* reports healthy to `curl -f`, a container health check and a load balancer
alike. The body did **not** narrow to a bare refusal code: the report rides the refusal's own
`details` channel, flat and spelled exactly as the healthy body spells it, so one reader parses both
answers and only `error` is extra. That keeps the pipeline's rule intact — the status still comes
from the code and **no handler gained the ability to pick one**, which is worth more than this
endpoint.

**Start-up moved out of module scope, so a backup can be taken when start-up cannot** (review,
2026-09-02). `entry.ts` is the built artefact's only door, so `yarn run db:backup` reached
`backupDatabase` by importing it — which ran `serverEnv()` and `runMigrations()` at module scope.
The command therefore **migrated the database before copying it, and refused to copy at all when a
migration failed**: unusable at exactly the moment README.md points an operator at it, since
recovery from a bad upgrade *is* the backup. The fix is an idempotent exported `startup()`, called
by `start()` — so a failed migration now refuses to serve **before the listener exists**, stricter
than the old arrangement rather than looser — with the module-scope call kept for the dev server
alone behind `if (import.meta.env.DEV)`. Vite replaces that constant with `false` in the SSR build
and eliminates the branch, so the production bundle has no module-scope start-up (verified:
`import.meta.env` appears zero times in `dist/server/entry.js`, `runMigrations()` once) while
`yarn dev` fails at load exactly when it always did.

Proven on all three counts: a database whose migration fails **backs up** (exit 0, file written),
the same database **refuses to serve** (exit 1, nothing listening), and `yarn dev` is untouched —
measured against a fresh `DATABASE_URL`, where it still creates and migrates the file and reports
`environment: development`.

**Measuring that third one corrected a claim this repository had been repeating.** Vite evaluates
the SSR entry **lazily, on the first request**: the dev server listens with no database file on
disk, and the file appears only when something asks for a page. So *"a missing variable is a dev
start-up failure"* was never true — it has always been a failed first request — and `entry.ts`'s
docblock said otherwise until now. Nothing about the behaviour changed here; the sentence describing
it did.

**The rejected alternative was a second rollup input** — `src/server/backupEntry.ts` as a second
`ssr` entry, giving the backup its own door and leaving the module-scope statement unconditional. It
would work, and it was turned down because it means overriding the input the TanStack Start plugin
sets for that environment: a change to the build graph, and therefore to whatever the plugin does
with its manifest and to `vite preview`, in return for the same property one line inside the module
that owns the problem already buys.

**`.env.example` shipped a trap, found by following the README literally.** It set
`NODE_ENV=development`; `--env-file` populates `process.env` before the runner's default can apply,
so a copied `.env` would have put a production deployment in development — and `useSecureCookies` is
`nodeEnv === 'production'`, so the symptom would have been session cookies without `Secure`,
announcing itself nowhere. The example now ships the key **blank** and the runner treats blank as
unset.

## Acceptance criteria

- [ ] A clean checkout with an empty data directory and only the required variables set builds,
      migrates and serves — sign-up through to a working session, verified by following the README
      rather than by memory.
      **Open on its signed-in half only** (2026-09-02). Everything up to an Account was done by
      following the README's *First run, from an empty directory* literally, not from memory:
      `cp .env.example .env`, a real `openssl rand -base64 32` secret, `DATABASE_URL` pointed at an
      empty scratch directory, then `yarn install && yarn build && yarn start`. The directory was
      created, all six migrations applied (`app.db` + `-wal` + `-shm` appeared), and
      `GET /api/health` answered `{"status":"ok","environment":"production","database":
      {"reachable":true,"migration":"c4839fb9…"}}` — `environment: production` proving the runner's
      `NODE_ENV` default, and therefore a `Secure` cookie. The app rendered and a deep link
      (`/config/stats`) server-rendered correctly. **Sign-up itself was not driven**: the agent may
      not create an account or type a password, and the User declined the signed-in browser loop for
      this run. Following the README is what found the `NODE_ENV=development` trap above — the
      criterion's own point.
- [x] The build serves the client bundle and the API from one process and one port; the socket
      connects on that same port.
      **The socket half is an explicit debt from TICKET-LIVE-01 and will not happen by itself.**
      `attachLiveSocket(httpServer)` in
      [`src/server/ws/liveSocketServer.ts`](../../../src/server/ws/liveSocketServer.ts) takes the
      listener as a parameter, and today its **only** caller is `scripts/live-socket.mjs`, a
      dev-only Vite plugin. `src/server/entry.ts` is handed a `Request` and never sees a listener,
      so this ticket's runner must call `attachLiveSocket` on whatever server it creates — otherwise
      the production build has an API and no socket, and every LIVE-0x feature is silently absent
      in the one environment that matters. Written here rather than only in LIVE-01's prose,
      because a dependency that lives in a closed ticket is one that gets rediscovered at the
      worst possible moment.
      **Done.** `src/server/serve.ts` creates the one `node:http` listener, serves `dist/client/`
      from it, bridges everything else to `entry.fetch`, and calls `attachLiveSocket(server)` on that
      same server. Proven three ways: `serve.test.ts` — *serves the client bundle from the same port
      as everything else*, *hands everything the bundle does not hold to the app*, and *carries the
      live socket on that same listener*, the last by a hand-written upgrade over `node:http`'s own
      client (not `ws`, whose single permitted importer this is not) asserting `101 Switching
      Protocols`. Against the **built artefact**, a browser on `http://localhost:3000` opened
      `ws://localhost:3000/api/live` derived from `window.location` and got `opened: true` then close
      code **4401** with `"Sign in to connect to a game."` — a frame only `liveSocketServer.refuse()`
      produces, so attachment is proven signed out. Repeated on `PORT=4173`, where the socket moved
      with the app.
- [ ] **The documented run is one command starting one process**, and nothing in the README asks the
      operator to serve the client bundle separately. Verified from the network log of a full
      signed-in loop — page load, API calls, socket upgrade — every request landing on that one
      server.
      **Open on its signed-in half only** (2026-09-02). The command is one: `yarn start` =
      `node --env-file-if-exists=.env scripts/serve.mjs`, and the README's *Running it in
      production* asks the operator to serve nothing separately — `env.test.ts`'s *documents the one
      command that starts it* keeps that true. The **signed-out** network log against the production
      build, taken in the preview browser, is every request of a page load landing on one server:
      `GET http://localhost:3000/` → 200, `/assets/main-DRCy4Du8.js` → 200,
      `/assets/styles-CoJALCOY.css` → 200, `/api/auth/get-session` → 200, and the socket upgrade to
      `ws://localhost:3000/api/live` beside them; no console errors. The **signed-in** loop was
      declined by the User for this run, so the log has no authenticated API calls in it.
- [x] Nothing in the shipped bundle or the documented environment names an origin: the README's
      variable table contains no API or socket URL, and a grep of the built output finds no
      hard-coded host. An operator changes the port and everything still talks to itself.
      (`env.test.ts` — *names no origin in that table*, the `.env.example` rule extended to the
      README's rows. `PORT` and `HOST` are documented as naming *this* server rather than another.
      Grep of `dist/client/assets/*`: `www.w3.org`, `react.dev` and `fonts.googleapis.com`, plus one
      `http://localhost` that is **TanStack Router's own fallback** for a missing `window.origin`
      — `window?.origin && window.origin !== "null" ? window.origin : "http://localhost"` — library
      code that never applies in a browser; nothing of ours names an origin. Proven empirically as
      well: the whole thing was moved to `PORT=4173` and the page, both assets, `/api/health` and
      the socket all followed, with nothing left answering on 3000.)
- [x] `/api/health` reports database reachability and the applied migration version, and reports
      unhealthy when the database file is unreadable.
      **Mostly done by TICKET-DB-01** — the body carries `status`, `environment` and
      `{ reachable, migration }`, because the data was already there once the migration runner
      existed. What is left for this ticket is the *unreadable file* half: prove it against a real
      deployment (permissions, a full disk, a moved data directory) rather than against an
      in-memory database, and decide whether unhealthy should also be a non-200 status for a load
      balancer to read.
      **Decided and done: unhealthy is 503, and the body does not narrow** — the reasoning is in the
      implementation notes above and in `routes/health.ts`. Proven against a **real, on-disk,
      genuinely broken connection** rather than a mock: `routes/health.test.ts` closes the underlying
      SQLite handle under a live database, after which the next statement really does throw, and
      asserts 503 with `{status:'unhealthy', environment, database:{reachable:false,migration:null}}`
      beside `error.code === 'unavailable'`. Against the deployment, the healthy half was read off
      the built server (`{"status":"ok",…,"migration":"c4839fb9…"}`).
      **One narrower claim is left unproven, honestly:** a *permissions-denied file* could not be
      produced on Windows, because `better-sqlite3` holds the handle open and the file can be
      neither replaced nor moved while the server is serving. A chmod, a full disk and an unmounted
      volume all reach the identical code path — the one this test breaks — but the OS-level case
      itself was not staged.
- [x] Every environment variable the code reads appears in the README and in `.env.example` with
      required/optional stated — the existing SRV-01 test extended to cover the README too.
      (`env.test.ts` → *the README contract (TICKET-POL-03)* → *documents every variable the code
      reads, and says whether it is required*, matching on the table row `| \`NAME\` |` rather than
      on the name appearing anywhere, so prose cannot vouch for a missing row. All sixteen are in
      the README's table and in `.env.example`, `PORT` and `HOST` included.)
- [x] A documented backup produces a file that restores into a working server with the game intact,
      demonstrated end to end rather than described.
      (`yarn run db:backup` → `src/server/db/backup.ts`, `VACUUM INTO`. Demonstrated end to end
      against the running production server: a ruleset, a game session and a character were written
      into the live database, backed up **while it was serving and without a checkpoint**, and the
      single 176 KB file — no `-wal`/`-shm` beside it — was copied into a fresh directory and served
      by a second start-up, which reported healthy with the *same* migration hash and held
      `Ducklets` / `Tuesday night` / `Quackers` with its experience intact. A second backup to the
      same name was refused: *"already exists. A backup never overwrites one"*. `db/backup.test.ts`
      pins the WAL case — the row it reads back exists only in the WAL, so `cp app.db` would have
      lost it, which is the *restores usually* hazard the Notes name. Reading the *game* through a
      signed-in UI is the declined half.)
- [x] Starting with a missing required variable fails immediately naming all of them; starting with
      a failed migration refuses to serve rather than serving a half-migrated schema.
      (Both against the **built artefact**, both exiting 1 with nothing listening. Missing:
      *"The server cannot start: 2 required environment variables are missing — DATABASE_URL,
      BETTER_AUTH_SECRET. See .env.example."* — all of them, one round trip. Failed migration,
      staged as a real deployment would meet it, a valid database whose schema conflicts
      (`CREATE TABLE ruleset (something_else TEXT)`): *"The database schema could not be brought up
      to date, so the server will not start. Nothing was half-applied — each migration runs in a
      transaction."*, and `netstat` showed nothing on the port. `scripts/serve.mjs` prints those two
      named refusals as their message rather than as a stack dump — an operator gets the sentence,
      not a code frame.)
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check against the production build (ask the User first).
      **Open on its signed-in half only** (2026-09-02), like DM-04, LIVE-03 and DM-05 before it. The
      User approved an **unattended signed-out smoke run against the production build** and declined
      the two-account loop; that run is the evidence on criteria 1, 2, 3 and 4 above. The rest is
      done: the suite is green at **4341 across 263 files** (up 52 from DM-04's 4289/258), 0 failing
      and 0 skipped; `npx tsc --noEmit` is at the documented 2-error baseline; `yarn run check` is
      clean (869 modules, 4526 dependencies cruised). `fallow audit --base main` returns **pass**
      with `dead_code_introduced: 0`, `complexity_introduced: 0` and `duplication_introduced: 0` —
      the last only after the one duplication this ticket *did* introduce was removed rather than
      suppressed: `nodeBridge.ts`'s header conversion had been a second copy of
      `liveSocketServer.ts`'s `upgradeRequest`, and the two had already begun to disagree about
      repeated headers, so the socket now upgrades through the same `toWebRequest` every HTTP
      request uses. `fallow health --hotspots --since 6m` tags **no file this ticket touched** as
      Accelerating (`liveSocketServer.test.ts` cooling, `env.ts` and `appError.ts` stable), so no
      hotspot row is owed.

## Notes

- **Follow the README literally when verifying**, on a clean directory. An operator's first run is
  the one path nobody tests, because the author's machine is never clean and their memory fills
  every gap the document has.
- Back up by copying the SQLite file only when the database is quiesced, or with `VACUUM INTO` —
  copying a live WAL database with `cp` produces a file that restores *usually*, which is worse than
  one that fails loudly. Say so in the README.
- Reverse proxy and TLS are the operator's business and out of scope. What is **not** out of scope
  is that the cookie must be `Secure` outside development and the socket must work through a proxy —
  note the proxy headers required, since a socket behind a misconfigured proxy fails in a way that
  looks like an application bug.
- **A reverse proxy is the one place an operator can split this back into two**, by serving the app
  and the API from different hostnames. The README says plainly that both live behind the same
  origin, because the failure that produces — a session cookie the socket never receives — reads as
  "live updates are broken" rather than as a proxy misconfiguration.
