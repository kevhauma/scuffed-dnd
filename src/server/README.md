# `src/server/` — the backend root

[TICKET-DX-07](../../docs/v3.0_backend/tickets/TICKET-DX-07-three-root-source-tree.md) created this
root and the boundary that guards it;
[TICKET-SRV-01](../../docs/v3.0_backend/tickets/TICKET-SRV-01-server-layer-and-kernel-boundary.md)
filled it with the environment loader and the request pipeline every later ticket plugs into.
[D14](../../docs/v3.0_backend/overview.md#d14--three-roots-client-server-shared) says why it is a
*root* and not a folder beside the components.

## Where a request goes

`entry.ts` is the only door. `vite.config.ts` points `tanstackStart({ server: { entry } })` at it,
and **the dev server and the production build call the same module** — one process serving the
client bundle, the API and (from LIVE-01) the socket, in both
([D1](../../docs/v3.0_backend/overview.md#d1--the-backend-lives-in-this-repo-on-tanstack-start)).

```
request → entry.ts ─ /api/* ─→ http/apiRouter.ts → http/pipeline.ts → routes/<name>.ts
                   └ anything else ─→ TanStack Start's SSR handler → the app
```

That shape is also the answer to *where an API route file lives*. The router generates its tree
from a directory under `client/`; a route file there would import a `server/` module from
`client/`, and D14's boundary would be exceptional from the first commit. Routes are plain modules
under `routes/` instead, reached from `entry.ts` — **no exception is granted anywhere**.

A handler **returns data and throws refusals**. It never builds a `Response`, never picks a status
for the happy path, and never catches its own errors: an `AppError` becomes its status and code,
and anything else is a bug — logged server-side, answered with a bare 500 that tells the client
nothing about how this server is built.

## The rule this root is filled under

> `client/` and `server/` may each import `shared/` and nothing of each other; `shared/` imports
> neither.

Symmetric, mechanical, and checked: [`.dependency-cruiser.mjs`](../../.dependency-cruiser.mjs)
carries the rules, `yarn run check` runs them, the pre-commit hook runs `yarn run check`, and
[`architecture/`](../../architecture/README.md) proves each rule with a module that violates it.

A crossing is spelled with its alias — `#shared/engine/calculator`, never `../../shared/…` — so a
violation is visible at the import line before any tool reads it.

## What that means in practice

- **A rule both sides need lives in `shared/`.** The engine is the Kernel (D5): written once,
  called by the client for display and by the server for the answer that counts. If the server
  needs a check the client already does, it imports it — it does not restate it.
- **Nothing here may be reachable from the client bundle.** This is the one boundary whose failure
  leaks a secret rather than producing an untidy diagram, so it is asserted against the *built*
  output as well — `yarn build` fails on any `src/server/` module in the emitted client chunks
  ([`scripts/no-server-in-client-bundle.mjs`](../../scripts/no-server-in-client-bundle.mjs)).
- **The browser half of a service is not available here.** `client/services/storage.ts` and
  `client/services/configFiles.ts` touch `localStorage`, `Blob` and `File`; their pure counterpart
  `shared/services/importExport.ts` is what the server reuses. DX-07 split them along exactly that
  seam.

## Configuration

`env.ts` is the **only** reader of `process.env` in `src/`, and a test walks the tree to keep it
that way. Everything the server can be told is declared in its `ENV_VARIABLES` table, `.env.example`
is checked against that table by the same test, and required variables are read eagerly — a server
that starts and then 500s on its first request is worse than one that refuses to start, and it
names *every* missing key at once so filling in a `.env` takes one round trip.

**No variable names the backend** (v3 Req 47.7). The API is a relative path and the socket will
derive its URL from `window.location`; a variable that could point somewhere else is a variable
someone will eventually point somewhere else. For the same reason there is **no CORS layer**: a
cross-origin error here means something got split in two, and the fix is to put it back on one
origin rather than to widen the set of allowed origins.

## What lands here, and when

| Ticket | What it adds |
|---|---|
| SRV-01 | `entry.ts`, `env.ts`, `http/` (pipeline, `AppError`, the route table), `routes/health` ✅ |
| DB-01 | `db/`, the Drizzle schema, the migration runner |
| AUTH-01–04 | `auth/`, the session and authorization guards |
| RUL/GAM/PLY/DM | `repositories/` and `routes/` per resource |
| LIVE-01–03 | `ws/` — rooms, fan-out, presence |
