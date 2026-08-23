# TICKET-DX-08 — The project's architecture rules, as dependency-cruiser rules

- **Area:** Tooling, test infrastructure, and convention adoption
- **Type:** Feature
- **Traceability:** v3 [Req 51](../requirements.md#requirement-51-enforced-architecture-rules);
  the hard rules in [CLAUDE.md](../../../CLAUDE.md)

## User story

As a developer, I want the architecture rules this project already states in prose to be checked
automatically, so that they hold in six months rather than only on the day they were written.

## Description

DX-07 installed dependency-cruiser and landed the root boundary. This ticket encodes the rest —
the rules [CLAUDE.md](../../../CLAUDE.md) has stated as prose since v1.0 and that have survived so
far on attention alone.

Placed **after DB-01** because two of the rules are about the database layer and cannot be written,
let alone proven, before it exists.

## Current situation (as-is)

- DX-07 gave us `.dependency-cruiser.cjs` with the four root-boundary rules, wired into
  `yarn run check` and the pre-commit hook.
- The rules below exist today **only as prose**. Some have a bespoke test: `libraryConventions.test.ts`
  walks `components/ui/` for the styling rules, and DB-01 asks for a check that nothing outside
  `repositories/` imports Drizzle. Most have nothing.
- `fallow audit` already reports circular dependencies and dead code, but as a review signal rather
  than as a gate — the milestone's Definition of Done asks for zero *introduced* findings, which is
  a different thing from a rule that fails the build.

## Desired result (to-be)

- The rule set below, each named after the decision it protects and each carrying a `comment`
  naming that decision, so a failure reads as "persistence belongs to the store action" rather than
  as an edge in a graph.

  | Rule | Encodes |
  |---|---|
  | `kernel-is-framework-free` | `shared/` imports no React, Zustand, form library or router — D5's purity claim, currently only true by habit |
  | `types-are-the-bottom-layer` | `shared/types/` imports no runtime module |
  | `persistence-belongs-to-the-store` | only `client/stores/` imports the LocalStorage service |
  | `queries-belong-to-repositories` | only `server/repositories/` imports the connection or query builder (DB-01) |
  | `ui-primitives-are-leaves` | `client/components/ui/` imports no store, service or feature component |
  | `no-circular` | fails the build rather than being a review signal |
  | `no-dev-dep-in-production` | a shipped module importing a devDependency |
  | `no-undeclared-dependency` | an import of a package absent from `package.json` |
  | `no-orphans` | **warning**, not error — an entry point can look orphaned |

- Each rule proven by a fixture that violates it, so the config is tested rather than trusted.
- A short `docs/` note, or a comment block in the config, mapping every rule to the prose rule it
  replaces — and stating which obligations dependency-cruiser **cannot** express.

## Acceptance criteria

- [ ] Every rule in the table above is implemented, and each has a fixture proving it fails on a
      genuine violation and passes without one.
- [ ] A failure message names the decision, not just the edge — asserted on the actual output of at
      least the persistence and Kernel-purity rules.
- [ ] The Kernel-purity rule catches a real import: adding `import { create } from 'zustand'` to a
      file under `shared/` fails the check.
- [ ] `no-orphans` reports as a warning and does not fail the build, and the existing tree produces
      no *error*-level finding — an inherited violation is either fixed or explicitly exempted with a
      recorded reason, never silenced wholesale.
- [ ] The rules run in `yarn run check` and the pre-commit hook, and the run's added time is measured
      and recorded in [TEST_STATUS.md](../../../TEST_STATUS.md).
- [ ] The obligations dependency-cruiser cannot express are listed with what covers them instead —
      at minimum AUTH-03's "every route naming an owned resource calls a guard", which is about call
      sites rather than imports and stays a purpose-written test (v3 Req 51.10).
- [ ] `libraryConventions.test.ts` is reconciled rather than duplicated: whatever the `ui-primitives`
      rule now covers is removed from it, and what it uniquely checks — the styling rules — stays.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.

## Notes

- **A rule that cannot fail is worse than no rule**, because it reads as coverage. That is why every
  rule ships with a fixture that violates it — the config is code, and untested code that only ever
  returns "clean" is indistinguishable from a typo in a glob.
- **Expect inherited violations**, particularly around `ui-primitives-are-leaves` and `no-circular`.
  Each one is a decision: fix it, or exempt that specific edge with a comment saying why. A blanket
  `doNotFollow` to get to green would convert this ticket from a guard into decoration.
- **Know the tool's limit.** dependency-cruiser sees imports. It cannot see that a component called
  `localStorage` directly, that a handler forgot a guard, or that a formula was evaluated by hand —
  those need tests, and criterion six is there so the boundary between the two mechanisms is written
  down rather than rediscovered.
- Resist encoding every prose rule. The ones above are load-bearing and cheap; a rule per convention
  produces a config nobody can read and failures nobody trusts. If a rule fires only on things that
  turn out to be fine, delete it.
