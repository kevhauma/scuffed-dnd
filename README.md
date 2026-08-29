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
│   ├── services/                 # LocalStorage, Blob/File download, the /api/* client
│   ├── components/               # ui/ primitives → config/, play/, rulesets/, auth/, shared/
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
- **Server**: one Node process serving the client bundle and the API from one origin
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

# Build for production
yarn build
```

## Features

### Configuration Mode
- Keep one ruleset in this browser, or several on your account — the two are shown side by side and
  never merged
- Define custom skills with 3-letter codes
- Create stats with formula-based calculations
- Build materials with bonuses and tiers
- Design items and equipment systems
- Configure races as stat blocks, with a creature type and size picked from your own lists
- Set up multi-tier currency systems

### Play Mode
- Create characters with your custom system
- Manage inventory and equipment
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
`app.db-shm`), so **back up the directory, not the `.db`** — or use `VACUUM INTO` to write a
consistent single-file copy while the server is running. Migrations are applied automatically at
start-up and are forward-only; there are no `down` files, so recovery from a bad upgrade is that
backup. `data/` is gitignored.

## Linting & Formatting

This project uses [Biome](https://biomejs.dev/) for linting and formatting:

```bash
yarn run lint
yarn run format
yarn run check
```

Use `yarn run check`, not `yarn check` — Yarn v1's built-in `check` command shadows the script
and only verifies the lockfile.
