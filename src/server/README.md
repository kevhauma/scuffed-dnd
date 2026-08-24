# `src/server/` — the backend root

Empty of runtime code until [TICKET-SRV-01](../../docs/v3.0_backend/tickets/TICKET-SRV-01-server-layer-and-kernel-boundary.md)
fills it, and real from the moment it exists so that the boundary is a structure rather than a
plan. [TICKET-DX-07](../../docs/v3.0_backend/tickets/TICKET-DX-07-three-root-source-tree.md)
created it; [D14](../../docs/v3.0_backend/overview.md#d14--three-roots-client-server-shared) says
why it is a *root* and not a folder beside the components.

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

## What lands here, and when

| Ticket | What it adds |
|---|---|
| SRV-01 | `env.ts`, the request pipeline, `AppError`, `routes/health` |
| DB-01 | `db/`, the Drizzle schema, the migration runner |
| AUTH-01–04 | `auth/`, the session and authorization guards |
| RUL/GAM/PLY/DM | `repositories/` and `routes/` per resource |
| LIVE-01–03 | `ws/` — rooms, fan-out, presence |
