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

## Acceptance criteria

- [ ] API route files live under `server/routes/`, and dependency-cruiser's root boundary passes with
      **no exception granted for them** — or, if the plugin cannot be configured that way, the
      narrowest possible exception is recorded in the config with its reason and named as a
      divergence on this ticket.
- [ ] `src/server/env.ts` is the only reader of `process.env` in `src/`; a missing required variable
      fails at start-up naming every missing key at once, not the first one.
- [ ] `.env.example` lists every variable with a comment saying required or optional and what it is
      for; a test asserts `env.ts` and `.env.example` name the same set.
- [ ] `GET /api/health` returns a JSON body through the pipeline; a handler that throws an
      `AppError` produces its status and code, and a handler that throws anything else produces a
      500 with no internal detail in the body.
- [ ] Server tests call handlers directly and do not boot Nitro — `vitest.config.ts` still omits
      `tanstackStart()`, and `TEST_STATUS.md` records why that stays true.
- [ ] [CLAUDE.md](../../../CLAUDE.md), the **project-map** skill and the **data-model** skill no
      longer claim the app has no backend; each states the new layering row and points at
      [overview.md](../overview.md)'s D5.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.

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
- The env loader is deliberately eager about **required** variables. A server that starts and then
  500s on the first request is worse than one that refuses to start. Optional variables are a
  different case and the loader must handle both: AUTH-02 brings two independently optional OAuth
  credential pairs, and an absent pair means that provider is off, not that the server is broken.
