# Custom DnD Builder

Browser-only React app for building a custom tabletop RPG ruleset (*Configuration mode*) and
playing characters on it (*Play mode*). **No backend** — everything lives in LocalStorage, with
JSON import/export for sharing a ruleset.

Stack: React 19, TypeScript, Vite, TanStack Router (file-based), Zustand, react-hook-form,
Tailwind CSS 4 (custom medieval theme), Vitest + fast-check, Biome.

## Commands

```bash
yarn dev            # dev server on :3000
yarn run test       # vitest, single pass
npx vitest run <path>   # one test file
npx tsc --noEmit    # typecheck
yarn run lint       # biome lint
yarn run check      # biome lint + format + import sorting
```

`yarn check` does **not** run the check script — Yarn v1's builtin shadows it and only verifies
the lockfile. Always `yarn run …`.

Verification before declaring any change done: `npx vitest run` + `npx tsc --noEmit` +
`yarn run lint` (via the `verifier` subagent), plus the `Fallow` skill (code-quality check — say
so and skip it if unavailable in the session, don't skip it silently), plus a live browser check
for UI-visible changes.

**The test suite is green — 981 passing, 0 failing, 0 skipped.** Any failing or newly-skipped test
is a regression. **`yarn run check` is clean** as of TICKET-DX-02 — zero lint errors, zero
formatting drift — and a pre-commit hook keeps it that way, so any finding it reports is yours.
`npx tsc --noEmit` still has **4** known errors, enumerated in [TEST_STATUS.md](TEST_STATUS.md),
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
| Numbered requirements + EARS acceptance criteria + glossary | `docs/v1.0_foundation/requirements.md` |
| Architecture, component-library contracts, medieval theme | `docs/v1.0_foundation/design.md` |
| What's built, what's next, in build order | `docs/v1.0_foundation/overview.md` |
| Original task-numbered plan (referenced by commit messages) | `docs/v1.0_foundation/tasks.md` |
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
- Remaining foundation items that aren't ticketed yet appear in `overview.md` as *(plan §N)* lines
  — expand one into a ticket before building it, never implement straight from a plan line.
- Commit messages: ticket ID + title (`TICKET-CHAR-01 Create CharacterList component`). Older
  commits use the plan's task numbers (`11.8 Create FocusStatConfig component`).

## Hard rules

- **Persistence belongs to the store action.** A component, hook, or engine module never calls
  `localStorage`, `saveConfiguration()`, or `saveCharacters()` — it calls a Zustand action, which
  patches state and persists.
- **Derived values are computed, never stored.** Total skill levels, max stats, speciality totals,
  combat bonuses, and equipment bonuses come from `engine/calculator.ts` /
  `engine/calculators/*` at read time. `Character.currentStatValues` is the one sanctioned
  exception — it's player state, not a derivation.
- **All user-authored math goes through the formula engine** (`parseFormula` → `validateFormula` →
  `evaluateFormula`). No `eval`, no `new Function`, no hand-rolled arithmetic parsing.
- **Base components (`components/ui/`) carry intrinsic styling only** — no margin, flex/grid,
  `position`, z-index, or parent-imposed sizing. Feature components own all layout and compose
  primitives instead of raw `<button>`/`<input>`/`<select>`/`<textarea>`.
- **Medieval theme tokens only** — `parchment-*`, `ink-*`, `stone-*`, `crimson`, `forest`,
  `royal`, `amber`, `font-heading`/`font-body`/`font-mono`, `shadow-parchment*`. A raw hex or a
  `bg-blue-500` is a bug.
- **`src/routeTree.gen.ts` is generated** — never hand-edit it.
- **Skill codes are 3 letters and unique across main, speciality, and combat skills** — they share
  one formula namespace.
- New barrels use `export *`; imports are relative (the `#/*` alias exists but is unused — don't
  half-adopt it).
- No new runtime dependencies without asking. The app stays browser-only.
- **Formatting is settled and enforced** (TICKET-DX-02): `biome.json` is space/2, single quotes,
  `lineWidth` 100, es5 trailing commas — the style the code was already written in. The tree was
  formatted to match in one mechanical commit, so `npx biome check --write .` is now safe and
  expected rather than a mass-reformat hazard. A `.githooks/pre-commit` hook runs `yarn run check`
  on every commit; enable it in a fresh clone with `git config core.hooksPath .githooks`.

## Verifying

**In-browser verification**: always ask the user whether to verify in the browser. If they
decline, continue with the task and leave the browser criterion open with a note. If something is
broken in the browser, they will come back to correct it.
