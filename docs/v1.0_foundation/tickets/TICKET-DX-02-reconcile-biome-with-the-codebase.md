# TICKET-DX-02 — Reconcile Biome with the codebase and clear the lint errors

- **Area:** Developer experience / tooling
- **Type:** Refactor
- **Traceability:** none directly — makes `yarn run check` a usable gate

## User story

As a Developer, I want `yarn run check` to mean something, so that a lint run tells me about my
change instead of drowning it in 270 pre-existing complaints.

## Description

`biome.json` and the committed code disagree about basic formatting, so the formatter reports
essentially the whole codebase, and 35 genuine lint errors hide behind that noise. Two decisions
are needed — which formatting style wins, and whether the whole tree is reformatted in one commit
— then the real errors get fixed.

## Current situation (as-is)

- [`biome.json`](../../../biome.json) specifies `indentStyle: "tab"` and `quoteStyle: "double"`.
  The committed code is uniformly **2-space indentation with single quotes** — every source file
  was generated that way. `yarn run check` reports ~270 issues across 143 files, the large majority
  formatting.
- Underneath that, `yarn run lint --max-diagnostics=1000` reports **35 errors and 31 warnings**:

  | Rule | Count |
  |---|---|
  | `correctness/useUniqueElementIds` | 14 |
  | `complexity/useLiteralKeys` | 13 |
  | `style/useImportType` | 11 |
  | `suspicious/noExplicitAny` | 10 |
  | `suspicious/noArrayIndexKey` | 7 |
  | `style/noNonNullAssertion` | 3 |
  | `correctness/noUnusedVariables` | 3 |
  | `correctness/noUnusedImports` | 2 |
  | `correctness/noUnusedFunctionParameters` | 2 |
  | `correctness/noSwitchDeclarations` | 2 |

- `useUniqueElementIds` (14) is the one with user-visible consequences — duplicate DOM ids break
  `<label for>` association and assistive tech, which Requirement 22.6 cares about.
  [`FormField`](../../../src/components/ui/FormField/FormField.tsx) derives its id from the label
  text, so two fields labelled "Name" on one page collide.
- `noUnusedVariables` / `noUnusedImports` / `noUnusedFunctionParameters` (7) are dead code.
- There is no pre-commit hook, so nothing stops the gap widening.

## Desired result (to-be)

- **Decision 1 — formatting style.** Either change `biome.json` to `indentStyle: "space"` /
  `quoteStyle: "single"` to match the code (zero diff, keeps history readable), or reformat the
  tree to match the config (one large mechanical commit). **Ask the User; recommend matching the
  config to the code**, since the config was never applied and the reformat would touch every file
  for no functional gain.
- **Decision 2 — if reformatting is chosen**, it lands as its own commit containing nothing else,
  so `git blame` stays usable and no review has to read 143 files of churn mixed with logic.
- After the formatting question is settled, `yarn run check` is clean apart from real lint errors,
  and those 35 are fixed: unique ids derived from a stable unique source rather than label text,
  `import type` where Biome asks, `any` replaced with real types (or justified inline where a
  third-party shape forces it), array-index keys replaced with stable ids, dead code deleted.
- The 31 warnings are triaged: fixed, or explicitly accepted with a reason.
- A pre-commit hook or a CI check keeps it clean — otherwise this ticket gets re-run in six months.

## Acceptance criteria

- [ ] The formatting decision is recorded on this ticket with the User's answer, and applied.
- [ ] If the tree was reformatted, that change is its own commit with no functional edits mixed in.
- [ ] `yarn run check` passes clean on the whole repo.
- [ ] All 14 `useUniqueElementIds` errors are fixed by generating genuinely unique ids (e.g. React's `useId`), not by suppressing the rule — and `<label for>` still points at its control.
- [ ] All `noUnusedVariables` / `noUnusedImports` / `noUnusedFunctionParameters` findings are fixed by deleting the dead code, not by renaming to `_`.
- [ ] Every remaining `noExplicitAny` is either typed properly or carries a one-line comment saying why `any` is unavoidable there.
- [ ] No lint rule is disabled in `biome.json` to make a finding go away, and no `biome-ignore` is added without a reason comment.
- [ ] `npx tsc --noEmit` clean and tests fail no more than the [TEST_STATUS.md](../../../TEST_STATUS.md) baseline — this is a cleanup, not a behaviour change.
- [ ] A pre-commit hook or CI step runs `yarn run check`, so the gap cannot silently reopen.
- [ ] `CLAUDE.md`'s "don't mass-reformat" note and the react-conventions skill's verification section are updated to match the new reality.
- [ ] Verified via the fallow skill.
- [ ] Verified live in the browser: spot-check a form with two same-labelled fields to confirm the id fix didn't break label association.

## Notes

- Do this when the tree is quiet. A whole-repo reformat conflicts with everything in flight, so it
  should not land while a feature ticket is half-built.
- `yarn check` (without `run`) silently does nothing — Yarn v1's builtin shadows the script. If the
  hook or CI step is added, make sure it calls `yarn run check`.
- The 14 duplicate-id findings are the only ones with real user impact; if the ticket has to be
  split, that subset is the part worth doing first.
