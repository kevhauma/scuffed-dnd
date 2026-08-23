# docs/ layout

`docs/` holds one folder per **version** — a milestone of work — named `vX.Y_<topic>`.

## `vX.Y_<topic>`

Every version folder has the same two pieces:

- `overview.md` — the index: one checkbox line per ticket, **in recommended build order, not
  grouped by area**, each linking to its ticket file. Trailing notes carry the dependency or
  priority reasoning for that position.
- `tickets/TICKET-<PREFIX>-<NN>-<slug>.md` — one file per ticket, carrying its own user story,
  description, current situation (as-is), desired result (to-be), and acceptance criteria.

A version may also hold free-form spec documents. `v1.0_foundation` holds the two that everything
else traces back to:

- [`requirements.md`](./v1.0_foundation/requirements.md) — the glossary plus numbered requirements
  with EARS-style acceptance criteria (`THE Application SHALL …`). Tickets cite these numbers in
  their `Traceability` line, and code cites them in a `**Validates: Requirements …**` JSDoc line.
- [`design.md`](./v1.0_foundation/design.md) — architecture, component-library contracts, data
  models, and the medieval theme.

Its [`tasks.md`](./v1.0_foundation/tasks.md) is the original numbered implementation plan, kept
because commit messages and code comments reference those task numbers. New work is ticketed, not
added to it.

Don't hardcode the folder list anywhere; `ls docs/` is the source of truth (see the
`spec-navigator` subagent).

## `imports/`

Not a version — one folder for the whole project. [`imports/`](./imports/README.md) holds the real
ruleset data from the source spreadsheet, **one JSON fragment per built feature**, merged into an
importable `ducklets.json` by `yarn run sheet:import`. A ticket that adds or reshapes a persisted
entity lands its fragment in the same change; `src/services/sheetImport.test.ts` fails if the merge
goes stale or the corpus stops importing.

## Adding work

- A bug, refactor, or feature → the **`story-ticket`** skill. It asks which version the ticket
  belongs to, resolves the area prefix, writes the ticket, and inserts its line into that
  version's `overview.md` at the right build-order position.
- Building one → the **`work-ticket`** skill. It plans against the acceptance criteria, waits for
  approval, implements, ticks each criterion with evidence, then checks the line off in
  `overview.md`.
- A whole new milestone → a new `vX.Y_<topic>` folder scaffolded with `overview.md` + `tickets/`,
  mirroring the most recent version.

## Ticket prefixes

Prefixes are per-area and reused once minted — check `docs/*/tickets/` before inventing one.
In use: `FORM` (formula engine), `CALC` (calculators), `ROLL` (dice and combat rolls),
`SKL` / `STAT` / `MAT` / `ITEM` / `RACE` / `CUR` (configuration domains), `CHAR` (characters,
sheet, creation), `INV` (inventory and equipment), `NAV` (routing, layout, mode switching),
`IO` (import/export and storage), `UI` (base component library), `POL` (integration and polish),
`DX` (tooling, test infrastructure, and convention adoption — work that serves the developer
rather than the User or Player).

Added by [`v3.0_backend`](./v3.0_backend/overview.md): `SRV` (server runtime and request pipeline),
`DB` (SQLite schema, migrations, repositories), `AUTH` (accounts, sign-in, authorization),
`RUL` (server-owned rulesets — the successor to the single browser `Configuration`),
`GAM` (game sessions, invites, membership), `PLY` (session-scoped player actions),
`DM` (Dungeon Master controls), `LIVE` (WebSocket transport and live updates).
