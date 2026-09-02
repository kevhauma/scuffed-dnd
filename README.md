# Custom DnD Builder

A browser-based React application for creating fully customizable tabletop RPG experiences.

New to the project? Start with [ONBOARDING.md](ONBOARDING.md) — what the app does, how the code
is organised, setup steps, and the rules every change must follow.

## Project Structure

`src/` has exactly three roots. `client/` and `server/` may each import `shared/` and nothing of
each other; `shared/` imports neither. Crossings are spelled `#shared/…`, `#client/…`, `#server/…`,
and `yarn run check` refuses the rest.

```
src/
├── shared/                       # The Kernel — pure, imported by both sides
│   ├── types/                    # TypeScript type definitions (the schema)
│   ├── engine/                   # Formula engine, calculators, dice, validation
│   │   ├── formula/              # Parser, evaluator, references, scoping
│   │   ├── calculators/          # Stats, skills, rolls, equipment, point buy
│   │   └── golden/               # Parity fixtures from the source spreadsheet
│   └── services/                 # Shape validation, import semantics, serialisation
├── client/                       # The browser app
│   ├── routes/                   # TanStack Router file-based routes
│   │   ├── __root.tsx            # Root layout with mode switcher
│   │   ├── index.tsx             # Landing page
│   │   ├── rulesets.tsx          # The two homes a ruleset lives in — mode entry point
│   │   ├── config/               # Configuration mode routes
│   │   └── play/                 # Play mode routes
│   ├── stores/                   # Zustand state stores
│   ├── services/                 # LocalStorage, Blob/File download, /api/* client, the live socket
│   ├── components/               # ui/ primitives → config/, play/, rulesets/, auth/, live/, shared/
│   ├── integration/              # The nothing-mocked suites
│   ├── router.tsx                # Router creation
│   ├── routeTree.gen.ts          # Generated — never hand-edit
│   └── styles.css                # Tailwind v4 + the medieval theme
└── server/                       # The backend — see src/server/README.md
```

## Technology Stack

- **Framework**: React 19 with TypeScript, on TanStack Start
- **Build Tool**: Vite
- **Routing**: TanStack Router (file-based routing)
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Server**: one Node process serving the client bundle, the API and the live WebSocket (`ws`) from
  one origin and one port — `yarn dev` in development, `yarn start` against the build, and the two
  differ in build speed rather than in shape
- **Database**: SQLite (`better-sqlite3`) through Drizzle, migrations through drizzle-kit
- **Testing**: Vitest + fast-check

## Getting Started

```bash
# Install dependencies
yarn install

# Start development server
yarn dev

# Run tests
yarn test

# Build for production, then serve it
yarn build
yarn start
```

`yarn dev` needs a `.env` — copy `.env.example` and fill in the two required variables.
[Running it in production](#running-it-in-production) covers the deployed shape.

## Features

### Configuration Mode
- Keep one ruleset in this browser, or several on your account — the two are shown side by side and
  never merged
- Define custom skills, weighted against the stats they grow from — a formula reaches one by name
- Create stats with formula-based calculations
- Build materials with bonuses and tiers
- Catalogue gem inlays — families of socketable stones, in tiers of stat grants
- Keep a spell compendium — cost, range and effect text per spell, searchable and paged so it stays
  usable at four hundred of them
- Catalogue passive abilities — resistances, immunities and senses, whose effect text may compute
  from the holder's own stats and skills
- Design items and equipment systems
- Configure races as stat blocks, with a creature type and size picked from your own lists
- Set up multi-tier currency systems

### Play Mode
- Create characters with your custom system
- Build items out of a template, a material tier and an optional gem, and wear them
- Manage inventory and equipment — the Backpack is everything you have built and are not wearing
- Hold passive abilities, their effect text worked out for your own character
- Track stats and skill progression
- Roll combat skills with dice simulation
- All data stored locally in browser

## Specs and tickets

Work is specced and ticketed under [`docs/`](docs/README.md), one folder per version:

- [`v1.0_foundation/requirements.md`](docs/v1.0_foundation/requirements.md) — numbered requirements with EARS-style acceptance criteria and the domain glossary
- [`v1.0_foundation/design.md`](docs/v1.0_foundation/design.md) — architecture, component contracts, data models, theme
- [`v1.0_foundation/overview.md`](docs/v1.0_foundation/overview.md) — what's built and what's next, in build order
- [`v1.0_foundation/tickets/`](docs/v1.0_foundation/tickets/) — one file per ticket: user story, as-is, to-be, acceptance criteria
- [`v1.0_foundation/tasks.md`](docs/v1.0_foundation/tasks.md) — the original numbered plan, kept because older commits reference its task numbers

Commits are named after the ticket they complete (`TICKET-CHAR-01 Create CharacterList component`);
older ones use plan task numbers (`11.8 Create FocusStatConfig component`).

## Working with Claude Code

[`CLAUDE.md`](CLAUDE.md) carries the project context Claude loads automatically — commands,
architecture, hard rules, and where the rest of the knowledge lives.

| Skill / command | Does |
| --- | --- |
| `story-ticket` | Writes a new ticket (user story, as-is, to-be, acceptance criteria) and inserts its line into the right version's `overview.md` at the right build-order position |
| `work-ticket` | Spawns the `work-ticket` subagent, which builds one ticket end-to-end: plan → approval → implement → tick each criterion with evidence → check off the story |
| `/spec-status` | Progress per version plus a test / typecheck / lint delta against the known baseline |

Subagents: `work-ticket` (the ticket-building procedure itself), `verifier` (runs the suite,
reports regressions vs. the documented baseline),
`conventions-reviewer` (diff review against this project's rules), `spec-navigator` (requirement
questions). Knowledge skills — `project-map`, `data-model`, `coding-conventions` — are read
instead of re-exploring the codebase, and are updated by the ticket that changes them.

## Development

The application uses file-based routing with TanStack Router. Routes are automatically generated from the `src/client/routes/` directory structure. **API routes are not among them** — they live in
`src/server/routes/` and are reached from `src/server/entry.ts`, which keeps the client/server
boundary free of exceptions.

**Signed out, all data persists in browser LocalStorage** with import/export for sharing
configurations, and that path needs no server at all. **Signed in**, server state lives in one
SQLite file.

### The data directory

`DATABASE_URL` points at the SQLite file — `./data/app.db` by default; copy `.env.example` to
`.env` before the first run. WAL mode means it is really three files (`app.db`, `app.db-wal`,
`app.db-shm`). Migrations are applied automatically at start-up and are forward-only; there are no
`down` files, so recovery from a bad upgrade is a backup —
[see below](#backing-up-and-restoring) for the command that makes one. `data/` is gitignored.

## Running it in production

### One command, one process, one port

```bash
yarn install
yarn build
yarn start
```

`yarn start` is `node --env-file-if-exists=.env scripts/serve.mjs`. That one process serves the
client bundle, the API **and** the live WebSocket on the same port — there is no static host to run
beside it, no second port and no second thing to keep alive. Nothing in the bundle or in the
variables below names an origin: the browser addresses the API by relative path and the socket from
`window.location`, so changing `PORT` moves all three together.

Variables can come from a `.env` beside the app or from the environment your supervisor sets —
`--env-file-if-exists` does not mind a missing file, and a variable already set in the environment
wins over the file, so the same command works either way. `NODE_ENV` defaults to `production` when
started this way, which is what makes the session cookie `Secure`.

The runtime needs `node_modules` — `better-sqlite3` is a native module and `better-auth`,
`drizzle-orm` and `ws` are loaded rather than bundled. A production install (`yarn install
--production`) is enough; the build is what needs the dev dependencies.

### Environment variables

Every variable the server reads, and nothing else. `src/server/env.test.ts` fails if this table,
[`.env.example`](.env.example) and `src/server/env.ts` ever name different sets.

| Variable | Required | Default | What it is for |
| --- | --- | --- | --- |
| `PORT` | Optional | `3000` | Which port to listen on. Not an origin — it says where this server answers. |
| `HOST` | Optional | every interface | Which interface to bind, e.g. `127.0.0.1`. Set it to loopback behind a reverse proxy. |
| `NODE_ENV` | Optional | see note | Which build this is, and what turns `Secure` on for the session cookie. **Two modules answer it and they answer differently**: `scripts/serve.mjs` defaults it to `production` before the server loads, because a built artefact is production; `src/server/env.ts`, which everything else goes through, falls back to `development` — the less privileged reading, which is right for tests and for `yarn dev`. So under `yarn start` it is `production` and everywhere else it is `development`. Leave it blank unless you mean to overrule that. |
| `DATABASE_URL` | **Required** | — | Path to the SQLite file holding every piece of server state. Relative paths resolve from the working directory. |
| `BETTER_AUTH_SECRET` | **Required** | — | The key every session cookie is signed with. Generate with `openssl rand -base64 32`. Changing it signs everybody out. |
| `AUTH_SESSION_DAYS` | Optional | `30` | The **idle** half of a session lifetime, in days. Every use pushes it out again. |
| `AUTH_SESSION_ABSOLUTE_DAYS` | Optional | `90` | The **absolute** ceiling, in days. No amount of use extends a session past it. |
| `AUTH_SESSION_UPDATE_HOURS` | Optional | `24` | How often a session in use is renewed and its identifier rotated. |
| `AUTH_SESSION_GRACE_SECONDS` | Optional | `30` | How long a rotated-away identifier stays valid, so two tabs renewing at once do not sign each other out. |
| `AUTH_SIGNIN_MAX_ATTEMPTS` | Optional | `5` | Failed sign-ins allowed per email address inside the window. `0` disables the limit. |
| `AUTH_SIGNIN_WINDOW_SECONDS` | Optional | `900` | The window those attempts are counted over, in seconds. |
| `AUTH_ALLOWED_HOSTS` | Optional, **required** once a provider below is set | empty | Comma-separated hostnames this deployment answers on, e.g. `dnd.example.com`. Wildcards allowed. It is what an OAuth callback URL is built from, so a forged `Host` header cannot steer one. |
| `GOOGLE_CLIENT_ID` | Optional | — | OAuth client id from the Google Cloud console. Set both halves or neither. |
| `GOOGLE_CLIENT_SECRET` | Optional | — | The secret paired with it. Server-only. |
| `DISCORD_CLIENT_ID` | Optional | — | OAuth client id from the Discord developer portal, on the same terms. |
| `DISCORD_CLIENT_SECRET` | Optional | — | The secret paired with it. Server-only. |

Both OAuth providers are **independently optional** and are the only external integrations there
are: with neither set, email and password is the whole of sign-in and nothing else changes. Half a
pair is a start-up failure naming the missing half, rather than a silently absent button. A missing
**required** variable names *all* of them at once, so filling in a `.env` is one round trip.

The redirect URI to register with each provider is a path on whichever host you serve from —
`/api/auth/callback/google` and `/api/auth/callback/discord`.

### First run, from an empty directory

1. `cp .env.example .env`
2. Put a real secret in `BETTER_AUTH_SECRET` (`openssl rand -base64 32`).
3. Point `DATABASE_URL` somewhere durable. The directory is created if it is missing; the file and
   its `-wal`/`-shm` companions live beside each other.
4. `yarn install && yarn build && yarn start`.

The schema comes up to date on its own — **upgrading is starting the process**, so there is no
migrate step to forget between pulling a build and restarting. A migration that fails takes the
start-up with it and the server refuses to serve rather than answering from a half-migrated schema;
each migration runs in a transaction, so nothing is left half-applied.

### Health

`GET /api/health` reports whether the process can do its job rather than whether it is running:

```json
{ "status": "ok", "environment": "production",
  "database": { "reachable": true, "migration": "<hash of the last applied migration>" } }
```

`reachable` is a real query, not a "did the connection object get made" — a file can be opened and
then become unreadable. When it cannot answer, the endpoint replies **503** with the same three
fields plus an `error`, so `curl -f`, a container health check or a load balancer sees the failure
on the status line and a person still gets the diagnosis in the body. Anything else — no answer at
all, or a connection refused — means the process is not up.

### Backing up and restoring

```bash
yarn run db:backup ./backups/app-2026-09-02.db
```

That runs SQLite's `VACUUM INTO`, which writes **one** consistent file while the server keeps
running. Restoring is putting that file where `DATABASE_URL` points and starting the process; it
comes up to the current schema on its own.

**Do not back up by copying `app.db` with `cp` while the server is running.** WAL mode spreads the
committed truth across `app.db` and `app.db-wal`, so a copy of the first alone is a moment that
never existed — and it *opens*, which is what makes it dangerous rather than obviously broken. If
you would rather copy files than run the command, stop the server first and copy all three
together. An existing backup file is refused rather than overwritten, so name each one for the
moment it captures.

### Behind a reverse proxy

TLS and the proxy itself are yours to run, but three things about this app are worth knowing before
you configure one.

- **The app and the API must stay on one origin.** They are one server and there is no variable that
  could point them apart; serving the app from one hostname and `/api` from another gives the socket
  a request with no session cookie on it, and the symptom is *live updates are broken* rather than
  anything that looks like a proxy problem.
- **The socket needs the upgrade headers forwarded.** `/api/live` is a WebSocket: pass `Upgrade` and
  `Connection` through, and give it a read timeout longer than the 30-second heartbeat (nginx:
  `proxy_http_version 1.1;`, `proxy_set_header Upgrade $http_upgrade;`, `proxy_set_header Connection
  "upgrade";`, `proxy_read_timeout 300s;`). A socket behind a proxy that drops upgrades fails in a
  way that reads as an application bug.
- **The cookie is `Secure` because `NODE_ENV` says `production`**, not because the request looked
  encrypted — so terminating TLS at the proxy and forwarding plain HTTP is fine, and no
  `X-Forwarded-Proto` handling is required for it.

Set `HOST=127.0.0.1` so the app is reachable only through the proxy.

## Linting & Formatting

This project uses [Biome](https://biomejs.dev/) for linting and formatting:

```bash
yarn run lint
yarn run format
yarn run check
```

Use `yarn run check`, not `yarn check` — Yarn v1's built-in `check` command shadows the script
and only verifies the lockfile.
