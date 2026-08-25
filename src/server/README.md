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
request → entry.ts ─ /api/auth/* ─→ auth/authRoutes.ts → Better Auth's handler
                   ├ /api/*      ─→ http/apiRouter.ts → http/pipeline.ts → routes/<name>.ts
                   └ anything else ─→ TanStack Start's SSR handler → the app
```

**The auth subtree is matched first and does not go through `defineHandler`** (TICKET-AUTH-01).
That pipeline exists to turn returned data into a response and thrown `AppError`s into statuses;
Better Auth already produces a finished `Response` with `Set-Cookie` on it, and passing it through
a second shaper could only damage it. Everything else keeps the shape below.

**Every other route learns who is asking from the cookie**, resolved once per request in
`auth/currentAccount.ts` and read as `context.account`. Nothing else resolves it — an authorization
rule is only as good as the number of places that decide who you are.

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

## The database

One SQLite file, at `DATABASE_URL`, holding every piece of server state
([D2](../../docs/v3.0_backend/overview.md#d2--sqlite-through-drizzle-migrations-through-drizzle-kit)).
Two pragmas are set on every connection and neither is optional: `foreign_keys = ON`, because
SQLite defaults it *off per connection* and every cascade below is a lie without it, and
`journal_mode = WAL`, which is why the database is really three files and why a backup copies the
set (or uses `VACUUM INTO`) rather than the `.db` alone.

**What is a table and what is a document** is D4's decision: a `Configuration`, a Snapshot and a
Character's player state are JSON text with `schema_version` and `revision` as real columns;
ownership, membership, invites and events are normalised, because that is the server's own model
and what it joins on. A document change — `grantedStatPoints` in DM-01, `purse` in CUR-02 — is
therefore **not** a migration.

**Migrations run at start-up and are forward-only.** `entry.ts` calls `runMigrations()` as it
loads, so upgrading is starting the process and there is no separate command to forget. There are
no `down` files: rolling back a schema change that has already accepted writes is a data question,
and the answer is the backup. Generate a new one with `yarn run db:generate` after editing
`db/schema.ts`, and ship it with a test that applies it to the previous schema.

**Only `db/`, `repositories/` and `testing/` may import the connection or Drizzle.** Handlers call
repositories. `queries-belong-to-repositories` in
[`.dependency-cruiser.mjs`](../../.dependency-cruiser.mjs) enforces it (TICKET-DX-08), and
`testing/` is in the list only because `test-harness-stays-in-tests` locks it from the other side.

| Relation | On delete | Why |
|---|---|---|
| `game_session.ruleset_id` → `ruleset` | **SET NULL** | The session holds a *pinned snapshot* (D7), so it keeps playing; what is lost is provenance, not rules |
| `session_member.session_id` | CASCADE | A membership of a session that no longer exists grants nothing |
| `session_invite.session_id` | CASCADE | Same |
| `character.session_id` | CASCADE | Characters are created per session (CHAR-04); the game is the unit |
| `event.session_id` | CASCADE | An event about a deleted session describes nothing |

## Testing a route

[`testing/`](./testing/index.ts) is the harness every server test uses (TICKET-DX-06). Three
pieces, and nothing else:

```ts
it('should refuse a stranger', () =>
  withTestDatabase(async (database) => {
    const owner = seedAccount();
    const row = seedRuleset(database, { owner });
    const params = { id: row.id };

    expect((await callRoute(route, { as: null, params })).status).toBe(404);
    expect((await callRoute(route, { as: seedAccount(), params })).status).toBe(404);
    expect((await callRoute(route, { as: owner, params })).status).toBe(200);
  }));
```

- **`withTestDatabase(run)`** — a fresh `:memory:` database, migrated, closed on the way out
  including when the body throws. A callback rather than a `beforeEach` pair, because a hook pair
  needs a file-scoped variable and that variable is how one test comes to see another's rows.
  Measured at **~2–3 ms** per call.
- **`callRoute(route, options)`** — calls the real route through the real pipeline. There is no
  test server and no second pipeline: a route is already a function from `Request` to `Response`,
  so the status a refusal produces here is the status it produces in production.
- **`seedAccount` / `seedRuleset` / `seedSession` / `seedMember` / `seedCharacter`** — each returns
  the row rather than an id, and a ruleset holds the **real Ducklets corpus** by default. A toy
  ruleset with two stats will not catch a formula reference a snapshot copy broke.

`as` reaches the handler through `RequestScope`, the pipeline's one injection point. **The route
table never passes one** — `handleApiRequest` calls `route(request)` with a single argument, and
`apiRouter.test.ts` asserts it — so nothing reachable from a socket can name an account, and
`pipeline.test.ts` asserts that exactly two modules under `src/server` so much as *name*
`RequestScope`. AUTH-01 makes the Auth_Session cookie the default this overrides, inside
`defineHandler`, rather than a third caller.

## What lands here, and when

| Ticket | What it adds |
|---|---|
| SRV-01 | `entry.ts`, `env.ts`, `http/` (pipeline, `AppError`, the route table), `routes/health` ✅ |
| DB-01 | `db/` (connection, schema, migrations), `repositories/` ✅ |
| DX-06 | `testing/` — the per-test database, `callRoute`, and the seeded fixtures ✅ |
| AUTH-01 | `auth/` — Better Auth, the `/api/auth/*` subtree, the per-address sign-in limit, and the cookie the pipeline resolves ✅ |
| AUTH-02 | `auth/socialProviders.ts` + `auth/identityRules.ts` — Google and Discord, each independently optional, behind **one** rule path; `routes/authProviders` so the client knows which buttons to draw ✅ |
| AUTH-03–04 | the authorization guards, and rolling renewal |
| RUL/GAM/PLY/DM | `repositories/` and `routes/` per resource |
| LIVE-01–03 | `ws/` — rooms, fan-out, presence |
