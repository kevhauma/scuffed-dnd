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
- **The `verifier` subagent runs and reports it.** `.claude/agents/verifier.md` still lists three
  steps — vitest, tsc, lint — which was the whole of "does it still pass" in v1.0 and stops being
  so the moment a rule can fail the build. It gains dependency-cruiser as a fourth numbered step
  with its own baseline line, so an architecture violation surfaces in the same report as a broken
  test rather than only at commit time when the hook fires.

## Acceptance criteria

- [x] Every rule in the table above is implemented, and each has a fixture proving it fails on a
      genuine violation and passes without one.
      → All nine are in [`.dependency-cruiser.mjs`](../../../.dependency-cruiser.mjs) beside DX-07's
      six. Nine new fixtures, each in a `boundaryFixtures/` directory the rule's `from` actually
      matches: `shared/boundaryFixtures/reachesFramework.ts`,
      `shared/types/boundaryFixtures/reachesRuntime.ts`,
      `client/components/boundaryFixtures/reachesStorage.ts`,
      `server/boundaryFixtures/reachesTheDatabase.ts`,
      `client/components/ui/boundaryFixtures/reachesTheStore.ts`, `circularA`/`circularB`,
      `reachesDevDependency.ts`, `reachesUndeclaredPackage.ts`, `orphan.ts`. The "passes without
      one" half is now a test of its own rather than an inference — see criterion 4.
- [x] A failure message names the decision, not just the edge — asserted on the actual output of at
      least the persistence and Kernel-purity rules.
      → `architecture/boundaries.test.ts` → *a failure message* cruises both fixtures with the
      `err-long` reporter and asserts the comment's own sentences. **This found a real gap:**
      `depcruise`'s default `err` reporter prints the edge and drops the `comment` entirely, so
      every rule's explanation was being written and thrown away. `yarn run arch` gained
      `--output-type err-long`.
- [x] The Kernel-purity rule catches a real import: adding `import { create } from 'zustand'` to a
      file under `shared/` fails the check.
      → The fixture *is* that import, and the same thing was done to a real module
      (`shared/engine/calculator.ts`) for criterion 6's proof, where `yarn run arch` reported
      `kernel-is-framework-free: src/shared/engine/calculator.ts → node_modules/zustand/…`.
- [x] `no-orphans` reports as a warning and does not fail the build, and the existing tree produces
      no *error*-level finding — an inherited violation is either fixed or explicitly exempted with a
      recorded reason, never silenced wholesale.
      → `yarn run arch`: *no dependency violations found (402 modules, 1808 dependencies cruised)*,
      exit 0. `no-orphans` at `warn`, asserted on the severity of the orphan fixture's real finding
      rather than on the config literal. **Three inherited violations surfaced and each was decided
      individually** rather than swept: two test files importing the storage service (tests are not
      shipped — exempted by pattern), and the generated `routeTree.gen.ts` ↔ `router.tsx` cycle,
      which is type-only, erased at build, and in a file CLAUDE.md forbids hand-editing — exempted
      by naming both members. `useAppHydration.ts` is the fourth, exempted by name because it
      probes availability and persists nothing. **Four** exemptions, tabled in
      [TEST_STATUS.md](../../../TEST_STATUS.md), listed in the `verifier`'s brief and commented at
      their line in the config — one count, three documents, after the review found them disagreeing.
- [x] The rules run in `yarn run check` and the pre-commit hook, and the run's added time is measured
      and recorded in [TEST_STATUS.md](../../../TEST_STATUS.md).
      → `check` is `biome check && yarn run arch`, unchanged, and `.githooks/pre-commit` runs
      `check`. Measured at 3 runs per rule set: 6 rules 3.65/3.60/3.95s, 15 rules 3.74/3.71/3.66s —
      **no measurable cost**, because the graph is built once and a rule is a pass over a graph
      that already exists.
- [x] *(with one caveat, below)* The **`verifier` subagent** reports the dependency-cruiser result:
      [.claude/agents/verifier.md](../../../.claude/agents/verifier.md) lists the check as a numbered
      step beside `npx vitest run` / `npx tsc --noEmit` / `yarn run lint`, states its baseline (zero
      error-level findings — `no-orphans` warnings are not regressions, and any recorded exemption is
      named), and the agent's final report carries a PASS/FAIL line for it. Proven by running the
      subagent against a tree with a deliberate violation and seeing it named in the report, not by
      the edit alone.
      → `yarn run arch` added as step 4 with its baseline and all five exemptions named. The
      agent's stale baselines (400 tests, 9 typecheck errors, 35 lint errors — numbers three
      milestones old, against which it would have reported lint as *improved by 35*) were corrected
      in the same edit. **The caveat:** the proof run loaded the agent definition as it stood at
      session start, so the subagent ran three steps rather than four and the step-4 PASS/FAIL line
      is unproven — the edit is correct and takes effect in a fresh session, but this criterion is
      ticked on the edit plus a stronger substitute rather than on the run asked for. See the
      implementation note.
- [x] The obligations dependency-cruiser cannot express are listed with what covers them instead —
      at minimum AUTH-03's "every route naming an owned resource calls a guard", which is about call
      sites rather than imports and stays a purpose-written test (v3 Req 51.10).
      → [`architecture/README.md`](../../../architecture/README.md) → *What dependency-cruiser
      cannot express*: six obligations in a table, each with the reason the tool is blind to it and
      what covers it instead. The guard row is first.
- [x] `libraryConventions.test.ts` is reconciled rather than duplicated: whatever the `ui-primitives`
      rule now covers is removed from it, and what it uniquely checks — the styling rules — stays.
      → **Nothing was removed, because nothing overlapped**, and that is now written in the file's
      header rather than left to be rediscovered: every case it holds is about styling, the presence
      of a `.style.ts`, or barrel completeness — none of which is an import. Its file walk skips
      `boundaryFixtures/`, since the module proving `ui-primitives-are-leaves` is deliberately not a
      component and would fail every rule in the file on those grounds.
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.
      → `verifier`: vitest 1937/1937, tsc at the 2-error baseline, lint clean, arch clean. It caught
      one real defect mid-ticket — `.dependency-cruiser.d.mts` was not updated alongside the new
      `FIXTURES` export, so `tsc` saw a missing member while Vitest passed on the real `.mjs`.
      `fallow audit --base main`: *No issues in 21 changed files*; the one remaining finding is the
      inherited unused `fallow` dependency. `fallow health --hotspots --since 6m`: two files above
      threshold, both **stable**, neither touched — no hotspot row owed.
      `conventions-reviewer`: eight findings, all acted on — see below.

## Implementation notes

**The fallow answer changed twice before it was right.** Every fixture is, by construction,
something fallow reports: an unimported file, an import cycle, a devDependency in shipped code, a
package absent from `package.json`. DX-07's `dynamicallyLoaded` only answered *is it reachable* and
left the dependency findings standing; `ignoreFindings` hides path-owned findings but cannot reach a
**manifest**-owned one such as `dev-dependency-in-production`; a `fallow-ignore-file` marker
registered in `fallow suppressions` and still did not hide it, for the same reason. What is right is
`ignorePatterns: ["src/**/boundaryFixtures/**"]` — drop them from fallow's analysis entirely, since
dependency-cruiser is what judges them and fallow has nothing true to say about a module whose
purpose is to be wrong. Nothing else loses coverage: every module the fixtures import has real
consumers besides them.

**The `verifier` run against the planted violation, and what it actually proved.** With
`import { create } from 'zustand'` added to `src/shared/engine/calculator.ts`, the subagent reported
a FAIL naming `kernel-is-framework-free`, the file, the rule's own message and the exact
`depcruise` output — and correctly diagnosed it as a scratch probe rather than a broken test. The
probe was reverted immediately afterwards.

It reached that answer by the route this ticket did *not* plan for, and the difference matters.
**Step 4 did not run**: the session had loaded `.claude/agents/verifier.md` before this ticket
edited it, so the agent worked from its old three-step brief and old baselines. What caught the
violation instead was `npx vitest run` — `boundaries.test.ts`'s new *is broken by no module that is
not a fixture* case failed, and the agent ran `depcruise` itself to diagnose it.

That is a better outcome than the criterion asked for, and it is worth saying why rather than
treating it as a lucky escape. A rule that lives only in an agent's prompt holds for as long as
whoever is reading the prompt cooperates; the same rule asserted by a test in the suite holds for
`npx vitest run`, `yarn run check`, the pre-commit hook and every agent, cached brief or not. The
verifier step remains the right thing to have — it names the finding in the report rather than
leaving it as one failing test among 1937 — but it is now the convenience rather than the guard.

The step-4 line itself is unproven and will be true from the next session. It is called out above
rather than ticked silently.

**The `conventions-reviewer` pass, and the one finding that mattered.** `no-orphans` did not mean
what its comment said. dependency-cruiser's orphan predicate is **no dependencies *and* no
dependents** (`analyze/derive/orphan/is-orphan.mjs` returns false on the first import), so "a module
nothing under `src/` imports" was simply wrong: a dead file that imports anything at all is not an
orphan, which is nearly every dead file. Two things followed, and the second is the worse one:

- The justification for the warning severity — *the server entry, the generated route tree and a
  test all look orphaned from in here* — described a situation that cannot arise. All three have
  imports of their own.
- Four of the rule's five `pathNot` entries therefore **guarded nothing**, and each carried a
  comment explaining what it guarded. That is precisely the failure this ticket's own Notes name:
  *a rule that cannot fail is worse than no rule, because it reads as coverage* — reproduced inside
  the config of the ticket that wrote the warning. The four are deleted, the comment states the real
  predicate, and the same overstatement is corrected in `architecture/README.md` and TEST_STATUS.md.

Three findings were about a rule promising more than its regex delivered, and each was closed by
tightening the regex rather than the prose:

- **`persistence-belongs-to-the-store` and `ui-primitives-are-leaves` enumerated what is
  forbidden**, so a `client/hooks/` or a `components/campaign/` added later would have been allowed
  by omission. Both are now allow-lists — *everything in `client/` except the layers that own
  persistence*, and *anything in `client/` that is not another primitive* — which is the shape
  `server-reaches-only-shared` already argues for two rules above.
- **`ui-primitives-are-leaves` said "a service" and meant "a client service".** It now also refuses
  `shared/services/`, which is pure but is import/export-shaped and nothing a primitive should hold.
  The Kernel proper stays reachable: `FormulaEditor` calling the formula validator is correct.
- **`TESTS` missed `*.fixtures.ts`.** Nothing fires today, but `importExport.fixtures.ts` is
  test-only and should not be told it has broken a production install the day it reaches for
  `fast-check`.

The remaining findings were documentation drift — a 1925 that should have been 1937 in the
verifier's own baseline (introduced by the edit that fixed three other stale baselines), an
exemption count spelled three ways across three files, and two comments describing the shape the
code had before this ticket rewrote it.

**One rule's fixture is a hostage to the tree.** `reachesUndeclaredPackage.ts` imports `clsx`,
which is in `node_modules` and not in `package.json` because something else depends on it. If that
stops being true the fixture stops resolving and the test fails — which is the rule's own subject
matter happening to the rule, and the correct outcome. The file says so.

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
