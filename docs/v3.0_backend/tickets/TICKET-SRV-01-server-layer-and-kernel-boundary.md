# TICKET-SRV-01 — The server layer: env, pipeline, and filling the `server/` root

- **Area:** Server runtime (new area)
- **Type:** Feature
- **Traceability:** v3 [Req 45](../requirements.md#requirement-45-server-authority),
  [Req 47](../requirements.md#requirement-47-deployment-and-operations); overview
  [D1](../overview.md#d1--the-backend-lives-in-this-repo-on-tanstack-start),
  [D5](../overview.md#d5--the-engine-is-the-shared-kernel-and-the-server-is-authoritative)

## User story

As a developer, I want a server layer with a stated boundary against the client, so that every
ticket after this one has an obvious place to put server code and an obvious rule about what it may
import.

## Description

Nothing here is user-visible. **TICKET-DX-07 built the empty `src/server/` root and the boundary
that guards it**; this ticket fills it — the environment loader and the request pipeline
(parse → authenticate → authorize → act → respond) — so that DB-01 through POL-03 all plug into the
same shape rather than each inventing one.

It also rewrites the two lines in [CLAUDE.md](../../../CLAUDE.md) that say this app has no backend.

## Current situation (as-is)

- DX-07 restructured `src/` into `shared/`, `client/` and `server/`, left `server/` empty, and put
  the root boundary behind dependency-cruiser. `@tanstack/react-start` is a dependency and
  `vite.config.ts` runs `tanstackStart()`, but no server route exists yet.
- [CLAUDE.md](../../../CLAUDE.md) states "**No backend** — everything lives in LocalStorage" and
  "The app stays browser-only". The **project-map** and **data-model** skills say the same.
- `src/engine/` and `src/types/` are already pure and already import nothing below them, so the
  Kernel exists in fact — it just has no second caller.
- `vitest.config.ts` deliberately omits `tanstackStart()` (React double-instantiation), so server
  tests cannot boot Nitro.

## Desired result (to-be)

- A typed environment loader (`src/server/env.ts`) reads every variable the milestone needs, fails
  at start-up with a named error listing what is missing, and is the only place `process.env` is
  read. `.env.example` documents each one with whether it is required.
- A request pipeline: `defineHandler` wrapping a route handler with JSON body parsing, a typed
  error-to-response mapping (`AppError` → status + code + message), and a request context carrying
  the resolved Account (`null` until AUTH-03 fills it in). One `/api/health` route proves it end to
  end.
- **A settled answer to where an API route file lives.** The router generates from a configured
  routes directory that DX-07 put under `client/`, and a route file importing a `server/` handler
  from there would break D14 on day one. Server route files belong under `server/routes/`, with the
  plugin configured to find them — see implementation note 1 for the fallback if it cannot be.
- **One server, not two** (D1, v3 Req 47.6–47.8). `yarn dev` serves the API from the **same Vite
  origin** as the app rather than from a second port behind a proxy, so a developer starts one thing
  and an operator later runs one thing. The client calls `/api/…` by relative path, with no
  `VITE_API_URL` or equivalent in `env.ts` or `.env.example`, and the pipeline needs no CORS layer
  because there is no second origin to allow. This is the ticket that decides it, because whatever
  `/api/health` does here every later route copies.

## Acceptance criteria

- [x] API route files live under `server/routes/`, and dependency-cruiser's root boundary passes with
      **no exception granted for them** — or, if the plugin cannot be configured that way, the
      narrowest possible exception is recorded in the config with its reason and named as a
      divergence on this ticket.
      *No exception was needed. `tanstackStart({ server: { entry: '../server/entry' } })` points the
      framework at [`src/server/entry.ts`](../../../src/server/entry.ts), which dispatches `/api/*`
      to `http/apiRouter.ts` and falls through to the SSR handler for everything else — so a route
      is a plain module under `server/routes/` and never a file in the client's routes directory.
      `.dependency-cruiser.mjs` is unchanged by this ticket and `yarn run check` passes.*
- [x] `src/server/env.ts` is the only reader of `process.env` in `src/`; a missing required variable
      fails at start-up naming every missing key at once, not the first one.
      *Asserted by a test that walks the whole tree, not by a grep at review time.
      `collectMissing` returns every missing key and `MissingEnvironmentError` carries the list as
      data. The eager read happens in `entry.ts` — **the start-up door** — rather than at `env.ts`'s
      module scope, so a refusal stays a start-up failure without making every route module
      unimportable the moment DB-01 adds a required variable.*
- [x] `.env.example` lists every variable with a comment saying required or optional and what it is
      for; a test asserts `env.ts` and `.env.example` name the same set.
      *Three contract tests, including one that fails if a variable has no description. `.env` is
      loaded into `process.env` by `vite.config.ts` (Vite does not do it — it only exposes
      `VITE_`-prefixed keys to the client), proven with a temporary `SRV_PROBE` read back from the
      dev server's own log and then removed. The production half is `node --env-file=.env` and is
      documented in `.env.example` for TICKET-POL-03 to make part of the run command.*
- [x] `GET /api/health` returns a JSON body through the pipeline; a handler that throws an
      `AppError` produces its status and code, and a handler that throws anything else produces a
      500 with no internal detail in the body.
      *`{"status":"ok","environment":"development"}` in the browser. The 500 test asserts the
      absence of the thrown message from the body as well as the presence of the generic one — the
      failure that matters is a leak, not a wrong status.*
- [x] **`yarn dev` starts one server.** `GET /api/health` is reachable from the app's own origin with
      no second process and no proxy to a second port, and the README/ONBOARDING command list still
      names a single dev command.
      *Verified in the browser against `yarn dev` on `:3000`: `/api/health` → 200, `/api/nope` →
      404 `not_found`, `POST /api/health` → 405 `method_not_allowed`, and `/play` → 200 `text/html`
      with the app's nav rendered. One process, one port, one command.*
- [x] No environment variable names the backend: `env.ts` and `.env.example` contain no API base URL,
      and the client's fetch calls use relative paths. A grep for an origin-shaped variable and for
      `Access-Control` comes back empty — the pipeline needs no CORS layer because nothing is split
      across two origins.
      *A test asserts `.env.example` matches neither an `http(s)://` URL nor an origin-shaped name
      (`API_URL`, `API_BASE`, `BACKEND_URL`, `SOCKET_URL`) — the absence is checked rather than
      remembered, which is what makes a later addition visible.*
- [x] Server tests call handlers directly and do not boot Nitro — `vitest.config.ts` still omits
      `tanstackStart()`, and `TEST_STATUS.md` records why that stays true.
      *Every server test builds a plain `new Request(...)`. `TEST_STATUS.md` records not just that
      the omission stays true but *why it can*: the layer is shaped so nothing in `src/server/`
      needs a listener or a port to be exercised.*
- [x] [CLAUDE.md](../../../CLAUDE.md), the **project-map** skill and the **data-model** skill no
      longer claim the app has no backend; each states the new layering row and points at
      [overview.md](../overview.md)'s D5.
      *Plus ONBOARDING.md, whose "Deliberate constraint: no backend" section became "Two modes of
      persistence", and `src/server/README.md`, which now carries the request path and the
      configuration rules.*
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.
      *1883 tests green (+36), `tsc` at the documented 2-error baseline, `yarn run check` clean
      (biome + dependency-cruiser), `yarn build` green with `dist/server/entry.js` emitted.
      `fallow audit --base HEAD`: `dead_code_introduced: 0`, `complexity_introduced: 0`,
      `duplication_introduced: 0`, `styling_introduced: 0`. The `conventions-reviewer` pass found
      four reachable bugs and several wrong citations — see below.*

## Notes

1. **The route-file location is this ticket's one real risk, and it is worth resolving before
   writing anything else.** TanStack Start generates its route tree from a directory; if API routes
   have to sit inside the client's routes directory, every one of them imports a `server/` module
   from `client/` and D14's boundary is exceptional from the first commit. Establish the
   configuration first, on the `/api/health` route, and if it genuinely cannot be done, the
   exception is scoped to `client/routes/api/**` alone — never widened to `client/routes/**` — and
   recorded rather than quietly added.
- The pipeline's error mapping is where v3 Req 32.5's *"unauthorized and missing are
  indistinguishable"* becomes cheap: AUTH-03 adds one `NotFoundError` that both cases throw.
- Don't add a validation library. Request-body checking reuses the shape-check idiom already in
  `services/importExport.ts` (`collectionShapeErrors` and friends); a ruleset body is validated by
  that module's own function, not by a second schema.
- **A cross-origin error during this ticket means the dev setup split in two, not that CORS is
  missing.** The reflex is to reach for `cors()` because it makes the error go away; the fix is to
  put the API back on the app's origin, which is the arrangement D1 asks for and the one that keeps
  it to a single server. Asserting the absence now is what makes a later addition visible.
- The env loader is deliberately eager about **required** variables. A server that starts and then
  500s on the first request is worse than one that refuses to start. Optional variables are a
  different case and the loader must handle both: AUTH-02 brings two independently optional OAuth
  credential pairs, and an absent pair means that provider is off, not that the server is broken.

## How it landed

- **The route-file risk (note 1) resolved cleanly and no exception was needed.** TanStack Start
  resolves a configurable **server entry** — the module every request passes through, in dev and in
  the production build alike. Pointing it at `src/server/entry.ts` puts this repository's own
  dispatch in front of the SSR handler, which means API routes never touch the router's generated
  tree and never live under `client/`. The dev server imports the same entry
  (`start-plugin-core`'s dev-server plugin calls `serverEntry.default.fetch(request)`), so `yarn
  dev` and `yarn build` are the same arrangement rather than two.
- **`ENV_VARIABLES` holds one variable, and that is the honest number.** The loader arrives one
  ticket before the first thing that needs configuring: `DATABASE_URL` is the first *required*
  variable and lands with DB-01. What SRV-01 owes is the machinery and the `.env.example` contract,
  and both are tested — `collectMissing` takes its table as a parameter precisely so the
  required-variable path is proven against a table that has some, rather than waiting for DB-01 to
  prove it by accident.
- **Route matching is exact.** No path has a parameter yet, so there is no pattern matcher; RUL-01
  brings `/api/rulesets/:id` and extends it. A matcher written now would be written against
  imagined routes.
- **`RequestContext.account` is `null` and typed that way**, so every handler written between here
  and AUTH-03 is already shaped for the answer and none of them changes when it arrives.

## What the review changed

Four of these were reachable bugs, not style:

- **A handler that returned nothing produced a 200 whose body was the four characters `undefined`**,
  on which a client's `.json()` throws. RUL-01's delete is the first route that would have hit it.
  Now a 204 with an empty body.
- **`AppError` took its status from the caller**, so `new AppError(999, …)` would have thrown a
  `RangeError` *inside* the pipeline's catch and escaped it — the one thing `defineHandler`
  promises never happens. The status now derives from the code through `STATUS_FOR_CODE`, so the
  two cannot disagree, and a test walks every code asserting it lands in 200–599.
- **The 404/405 bodies echoed the request path and method back.** Unbounded attacker-controlled
  text in a response body earns nothing when the status already carries the meaning.
- **`HEAD` on a known route was answered with a 405**, which uptime probes and load balancers send.
  It is now answered by the `GET` route with the body dropped.
- **Nothing loaded `.env`.** Vite populates `import.meta.env` for `VITE_`-prefixed keys only and
  never writes `process.env`, so `src/server/env.ts` would have read a file nobody had loaded —
  and DB-01 would have been the ticket that discovered it. `vite.config.ts` now does it for `yarn
  dev`/`yarn build`; POL-03 owns the production half.
- **The eager env read moved from module scope to `entry.ts`.** Keeping it at module scope would
  have made every route module unimportable — including from its own tests — the moment a required
  variable existed, and would have taken local-mode SSR down with it.
- **Four `Validates:` lines cited requirements the module does not implement** (45.1/45.4/45.5 for
  what are really 47.1, 47.2/47.3 and 32.1). Corrected; the convention is that a wrong citation is
  worse than none, because `spec-navigator` quotes it as fact.
- Smaller: `AppError.ts` → `appError.ts` (the only PascalCase non-component module in `src/`);
  `nosniff` and `no-store` on every API response; `ServerEnv.isProduction`, `EnvVariable.fallback`
  and the producerless `ERROR_CODE` members dropped; the `work-ticket` skill's "the app stays
  browser-only with no backend" line, which this ticket's own criterion had missed.

**One thing was noted and deferred rather than fixed.** `defineHandler` cannot set a response
header or return 201 + `Location`, which AUTH-03 (`Set-Cookie`) and RUL-01 (create) will need; both
are additive and neither undoes the "returns data, throws refusals" contract. **Path parameters are
the one that is not additive**: `/api/rulesets/:id` changes the route table's value type, so RUL-01
touches every entry. That is an expected cost, recorded here so it is not a surprise. A request
body-size limit belongs with the first route that accepts a large body — also RUL-01.
