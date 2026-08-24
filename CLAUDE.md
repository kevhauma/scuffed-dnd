# Custom DnD Builder

Browser-only React app for building a custom tabletop RPG ruleset (*Configuration mode*) and
playing characters on it (*Play mode*). **Signed out it is browser-only** — everything lives in
LocalStorage, with JSON import/export for sharing a ruleset, and nothing about that path degrades.
**Signed in it has a server** (v3.0, TICKET-SRV-01): accounts, server-owned rulesets, multi-player
sessions and live updates, on SQLite. One process serves the client bundle, the API and the socket
— see [D1](docs/v3.0_backend/overview.md#d1--the-backend-lives-in-this-repo-on-tanstack-start) and
[D6](docs/v3.0_backend/overview.md#d6--local-mode-stays-sign-in-gates-connected-play-only).

Stack: React 19, TypeScript, Vite, TanStack Router (file-based), Zustand, react-hook-form,
Tailwind CSS 4 (custom medieval theme), Vitest + fast-check, Biome.

## Commands

```bash
yarn dev            # app + API on :3000, one process (needs a .env — see .env.example)
yarn run test       # vitest, single pass
yarn run db:generate    # write a migration for the current src/server/db/schema.ts
yarn run sheet:import   # rebuild docs/imports/ducklets.json from the per-feature fragments
npx vitest run <path>   # one test file
npx tsc --noEmit    # typecheck
yarn run lint       # biome lint
yarn run arch       # dependency-cruiser: the three-root boundary
yarn run check      # biome lint + format + import sorting, then yarn run arch
```

`yarn check` does **not** run the check script — Yarn v1's builtin shadows it and only verifies
the lockfile. Always `yarn run …`.

Verification before declaring any change done: `npx vitest run` + `npx tsc --noEmit` +
`yarn run lint` (via the `verifier` subagent), plus **`fallow`** (say so and skip it if unavailable
in the session, don't skip it silently), plus a live browser check for UI-visible changes.

`fallow` is a check, not an optional review — `fallow audit --base main`, `fallow dead-code`,
`fallow health --hotspots --since 6m`. Three of its outputs are findings: **dead code the change
introduced** (delete it in the same change — there are no external consumers), **complexity** on a
function the change added or grew, and any touched file it tags **Accelerating** (churn and
complexity both rising), which earns a row in [TEST_STATUS.md](TEST_STATUS.md)'s hotspot table
naming the ticket. The `coding-conventions` skill's *Verification* section has the reasoning.

**The test suite is green — see [TEST_STATUS.md](TEST_STATUS.md) for the current count, 0 failing,
0 skipped.** Any failing or newly-skipped test
is a regression. **`yarn run check` is clean** as of TICKET-DX-02 — zero lint errors, zero
formatting drift — and a pre-commit hook keeps it that way, so any finding it reports is yours.
`npx tsc --noEmit` still has **2** known errors, enumerated in [TEST_STATUS.md](TEST_STATUS.md),
which is the baseline for that one. Never fix a failure by weakening the check.

Tests run from [vitest.config.ts](vitest.config.ts), which deliberately omits `tanstackStart()` —
that plugin double-instantiates React under Vitest and nulls the hooks dispatcher. Don't collapse
it back into `vite.config.ts`; TEST_STATUS.md has the evidence.

## Where knowledge lives (read these instead of re-exploring)

| Topic | Source |
|---|---|
| Coding conventions (layering, components, stores, styling, testing) | `.claude/skills/coding-conventions/SKILL.md` |
| Persisted shapes, LocalStorage keys, derived-vs-stored values, migrations | `.claude/skills/data-model/SKILL.md` |
| Route/store/engine/component map — what lives where | `.claude/skills/project-map/SKILL.md` |
| The three-root boundary, and how each rule is proven | `architecture/README.md` + `src/server/README.md` |
| Numbered requirements + EARS acceptance criteria + glossary | `docs/v1.0_foundation/requirements.md` |
| Architecture, component-library contracts, medieval theme | `docs/v1.0_foundation/design.md` |
| What's built, what's next, in build order | `docs/v1.0_foundation/overview.md` |
| Original task-numbered plan (referenced by commit messages) | `docs/v1.0_foundation/tasks.md` |
| Real ruleset data from the source spreadsheet, per feature | `docs/imports/README.md` |
| `docs/` folder naming scheme and ticket prefixes | `docs/README.md` |

Skills in `.claude/skills/`: `story-ticket` (write a new ticket), `work-ticket` (build one
end-to-end), plus the three knowledge skills above.
Subagents in `.claude/agents/`: `verifier` (test/typecheck/lint runner that reports the delta),
`conventions-reviewer` (diff review against project rules), `spec-navigator` (requirement
questions from `docs/`).

## Workflow

Work is ticketed. `docs/<version>/overview.md` is the build-order index; each ticketed line links
to `docs/<version>/tickets/TICKET-<PREFIX>-<NN>-*.md` carrying the user story, as-is/to-be, and
acceptance criteria.

- New bug/refactor/feature → **`story-ticket`** skill.
- Building one → **`work-ticket`** skill: plan against the criteria, wait for approval, implement,
  tick each criterion **with evidence**, then check the line off in `overview.md`.
- **Every User-authored formula field ships a preview.** A new field the User types a formula into
  renders `FormulaPreview` (TICKET-FORM-08) beneath it, with the `FormulaOwner` for that attachment
  point — editable sample values plus the level ladder. Never a bare `FormulaEditor`, and never a
  second hand-rolled evaluation: if the preview cannot express what the field needs, extend the
  component and note it on FORM-08.
- **Every feature ships its sheet data.** A ticket that adds or reshapes a persisted entity also
  adds or updates that feature's fragment in [`docs/imports/`](docs/imports/README.md) and reruns
  `yarn run sheet:import`. The fragments hold the real
  [source spreadsheet](https://docs.google.com/spreadsheets/d/1Y_KXFpPQTXaPi2oXn-LdZBTPZNLMPZ2xb3iK7wtHum4/edit)
  data, cite the cell ranges they came from, and record in `notes` anything the sheet lacks or the
  current shape cannot hold. Never invent a number to fill a required field.
- Remaining foundation items that aren't ticketed yet appear in `overview.md` as *(plan §N)* lines
  — expand one into a ticket before building it, never implement straight from a plan line.
- Commit messages: ticket ID + title (`TICKET-CHAR-01 Create CharacterList component`). Older
  commits use the plan's task numbers (`11.8 Create FocusStatConfig component`).

## Hard rules

- **Persistence belongs to the store action.** A component, hook, or engine module never calls
  `localStorage`, `saveConfiguration()`, or `saveCharacters()` — it calls a Zustand action, which
  patches state and persists.
- **Derived values are computed, never stored.** Composed stat values, the stat total, skill levels
  and bonuses, combat bonuses, equipment bonuses, and **the character's level** come from
  `engine/calculator.ts` / `engine/calculators/*` / `engine/characterSummary.ts` at read time.
  There are exactly two sanctioned exceptions, both genuine player state rather than derivations:
  `Character.currentResourceValues` (where a resource pool currently stands) and
  `Character.experience` (TICKET-RES-01 — XP is awarded at the table, and level derives *from* it).
- **All user-authored math goes through the formula engine** (`parseFormula` → `validateFormula` →
  `evaluateFormula`). No `eval`, no `new Function`, no hand-rolled arithmetic parsing.
- **Base components (`components/ui/`) carry intrinsic styling only** — no margin, flex/grid,
  `position`, z-index, or parent-imposed sizing. Feature components own all layout and compose
  primitives instead of raw `<button>`/`<input>`/`<select>`/`<textarea>`.
- **Medieval theme tokens only** — `parchment-*`, `ink-*`, `stone-*`, `crimson`, `forest`,
  `royal`, `amber`, `font-heading`/`font-body`/`font-mono`, `shadow-parchment*`. A raw hex or a
  `bg-blue-500` is a bug.
- **File edits go through the editor tools, never the shell.** Create and change files with
  Read/Write/Edit — never with shell or script workarounds (`echo >`, `cat <<EOF`, `sed -i`,
  `Set-Content`, `Out-File`, a throwaway Python/Node script). Same for reading and searching: Read,
  Glob, and Grep instead of `cat`/`head`/`find`/`rg`. The shell is for running commands — tests,
  typecheck, lint, git, yarn — not for authoring files.
- **`src/client/routeTree.gen.ts` is generated** — never hand-edit it.
- **A stat's `abbreviation` and the combat skill `code`s share one flat formula namespace and must
  be unique across both** (TICKET-STAT-01 merged `MainSkill` into `Stat`). Combat codes are 3
  letters; a stat abbreviation is an uppercase identifier. **A `Skill` is not in that space** — it
  lost its code in TICKET-SKL-02 and a formula reaches one as `skills.<name-slug>`, so two skills
  may share a spelling without colliding with anything (the sheet genuinely has `skinning` and
  `Skinning`); the first one wins the reference.
- **No bare string-union types.** A closed set of string values is a frozen const object with the
  type derived from it (`const X = {A: 'a', B: 'b'} as const;
  type X = (typeof X)[keyof typeof X]`), and call sites reference `X.A` rather than re-typing
  `'a'`. Discriminated unions of object shapes and a base component's own variant prop are the
  exceptions; the ~12 pre-existing bare unions are converted when touched, not swept.
- **SOLID and KISS are house rules**, spelled out concretely in the `coding-conventions` skill.
  The load-bearing pair: extend `ConfigPanelShell` through `headerExtra` and children rather than
  adding a prop named after one caller, and introduce no abstraction, option, or flag before its
  **third** caller exists.
- **`src/` has exactly three roots, and the boundary between them is checked** (TICKET-DX-07):
  `shared/` is the Kernel — `types/`, `engine/` and the pure half of `services/`, importing neither
  sibling; `client/` and `server/` may each import `shared/` and **nothing of each other**. A rule
  both sides need lives in `shared/`. `.dependency-cruiser.mjs` enforces it in `yarn run check` and
  the pre-commit hook, `architecture/boundaries.test.ts` proves each rule against a module that
  breaks it, and the client build fails on any `src/server/` module in its emitted chunks.
- New barrels use `export *`. Imports are **relative within a root** and **aliased across one** —
  `#shared/…`, `#client/…`, `#server/…`, never `../../shared/…`. This reverses the old "the `#/*`
  alias exists but is unused" line; the three aliases are fully adopted, and a crossing spelled
  with `../` is a dependency-cruiser error.
- No new runtime dependencies without asking. v3.0 adds exactly four —
  [D11](docs/v3.0_backend/overview.md#d11--new-dependencies-in-full) lists them; anything beyond
  that list is a new decision there, not a judgement call in a ticket.
- **The server is authoritative and the engine is shared** ([D5](docs/v3.0_backend/overview.md#d5--the-engine-is-the-shared-kernel-and-the-server-is-authoritative)).
  A rule lives once, in `shared/`; the server re-derives what it needs and trusts no derived value
  in a request body; the client keeps calculating for display and treats its answer as a
  prediction. Dice are rolled on the server.
- **`src/server/env.ts` is the only reader of `process.env`**, and every variable it reads is
  documented in `.env.example` — a test asserts the two name the same set. No variable names the
  backend: the API is a relative path and the socket derives its URL from `window.location`.
- **Queries belong to `src/server/repositories/`.** Nothing else imports Drizzle or the connection;
  a handler calls a repository. The server-side mirror of "persistence belongs to the store action",
  and TICKET-DX-08 makes it a dependency-cruiser rule.
- **A document change is not a migration.** `ruleset.data`, `game_session.snapshot` and
  `character.data` are JSON text (D4), so reshaping what is *inside* them follows the `data-model`
  skill and bumps `SUPPORTED_SCHEMA_VERSION`. Changing the normalised half means editing
  `db/schema.ts`, running `yarn run db:generate`, and landing the SQL **with a test that applies it
  to the previous schema**. Migrations are forward-only; there are no `down` files.
- **Formatting is settled and enforced** (TICKET-DX-02): `biome.json` is space/2, single quotes,
  `lineWidth` 100, es5 trailing commas — the style the code was already written in. The tree was
  formatted to match in one mechanical commit, so `npx biome check --write .` is now safe and
  expected rather than a mass-reformat hazard. A `.githooks/pre-commit` hook runs `yarn run check`
  on every commit; enable it in a fresh clone with `git config core.hooksPath .githooks`.

## Verifying

**In-browser verification**: always ask the user whether to verify in the browser. If they
decline, continue with the task and leave the browser criterion open with a note. If something is
broken in the browser, they will come back to correct it.
