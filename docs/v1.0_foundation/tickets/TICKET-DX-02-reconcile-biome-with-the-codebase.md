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

**Decision (User, 2026-08-01): the config matches the code, not the other way round** — and a
pre-commit hook guards it.

**The decision was taken on a premise that turned out wrong, and was re-put to the User.** It was
first described as a zero-diff change: only indentation and quotes differed. In fact the code was
also written at ~100 columns with no trailing commas, against Biome's defaults of 80 with them, so
the formatter still wanted 193 files. Measured alternatives, all with the same 33 lint errors
underneath:

| Config | Files the formatter rewrites |
|---|---|
| Biome defaults (80 cols) | 193 |
| `lineWidth` 100 + es5 trailing commas | **142 — chosen** |
| Formatter disabled entirely | 0, but no formatting enforced |

The User chose `lineWidth` 100 + es5 on the corrected information, and chose to apply import
sorting (121 files) in the same pass.

- [x] The formatting decision is recorded on this ticket with the User's answer, and applied. (Above. `biome.json`: `indentStyle: space` / `indentWidth: 2` / `lineWidth: 100`, `quoteStyle: single`, `trailingCommas: es5`.)
- [x] If the tree was reformatted, that change is its own commit with no functional edits mixed in. (Commit `a84badb`, 173 files. The write pass ran with `--linter-enabled=false`, so no rule fix could ride along — formatting and import order only. Tests and typecheck were identical either side of it, which is the evidence it changed no behaviour.)
- [x] `yarn run check` passes clean on the whole repo. (`Checked 208 files. No fixes applied.` — zero errors, zero warnings, down from 347 errors / 23 warnings at the start.)
- [x] All 14 `useUniqueElementIds` errors are fixed by generating genuinely unique ids (e.g. React's `useId`), not by suppressing the rule — and `<label for>` still points at its control. (`useId()` in `ConversionCalculator`, `CurrencyFormDialog`, `FocusStatConfig`, `EquipmentSlotFormDialog` and `ItemFormDialog` — 14 hardcoded literals replaced. Each `htmlFor`/`id` pair was rewritten together to the same const, so association is preserved by construction; the 646 tests, several of which find controls by label text, still pass.)
- [x] All `noUnusedVariables` / `noUnusedImports` / `noUnusedFunctionParameters` findings are fixed by deleting the dead code, not by renaming to `_`. (`BaseSkillPanel`'s `isDialogOpen` and `onCloseDialog` were accepted and silently dropped — removed from the props type and from all three panel call sites. Unused `React` / `FormulaAST` imports deleted. Two "omit a key by destructuring" bindings in `characterStore` and `useCombatRoller` were rewritten as `Object.fromEntries(...filter(...))`, which states the omission instead of naming a variable it never uses.)
- [x] Every remaining `noExplicitAny` is either typed properly or carries a one-line comment saying why `any` is unavoidable there. (**Both were typed properly, neither needed the escape hatch.** `SkillFormFields` takes `UseFormReturn<FieldValues>`; a generic bounded on the three shared fields was tried first and rejected because it fights react-hook-form's `Path<T>` inference — recorded in the file's comment. `FormField`'s error prop uses `FieldErrorsImpl<FieldValues>`.)
- [x] No lint rule is disabled in `biome.json` to make a finding go away, and no `biome-ignore` is added without a reason comment. (`biome.json`'s `rules` block is untouched: still `"recommended": true` and nothing else. Two `biome-ignore`s exist, both with reasons, both where a base primitive cannot see across its own boundary: `Dialog`'s backdrop, and `Label`, whose control association is the caller's `htmlFor` at ~20 call sites.)
- [x] `npx tsc --noEmit` clean and tests fail no more than the [TEST_STATUS.md](../../../TEST_STATUS.md) baseline — this is a cleanup, not a behaviour change. (**Not clean, but better: 9 → 4.** Fixing the unused-code lint errors cleared five typecheck errors as a side effect, since both tools were pointing at the same dead code. The remaining 4 are unrelated to this ticket and are re-documented in TEST_STATUS.md. Tests: 646 passing, 0 failing, 0 skipped, unchanged throughout.)
- [x] A pre-commit hook or CI step runs `yarn run check`, so the gap cannot silently reopen. ([`.githooks/pre-commit`](../../../.githooks/pre-commit), enabled with `git config core.hooksPath .githooks`. Deliberately dependency-free — husky would have meant a new devDependency for a nine-line shell script. It runs `yarn run check` only (~200ms); tests and typecheck are too slow to sit in front of every commit. Verified by running it: it passes on the current tree. The script's own comment warns that `yarn check` without `run` silently does nothing.)
- [x] `CLAUDE.md`'s "don't mass-reformat" note and the ~~react-conventions~~ **coding-conventions** skill's verification section are updated to match the new reality. (Both rewritten: `yarn run check` is now described as clean and enforced rather than as a hazard to avoid, and the skill's step 3 changed from "no new errors" to "must be completely clean". The skill's "suite is not currently green" paragraph was also stale since TICKET-DX-01 and was corrected in passing.)
- [x] Verified via the fallow skill. (`fallow audit --base HEAD` → `"verdict": "pass"`, 0 introduced findings. One was fixed rather than accepted: giving the two bonus-badge blocks in `ItemCard` and `MaterialCard` the same stable key made them byte-identical, so fallow flagged a clone it had previously missed. Extracted as `components/shared/SkillModifierBadge` — an item and the material it is made of now describe a modifier through the same component.)
- [ ] Verified live in the browser: spot-check a form with two same-labelled fields to confirm the id fix didn't break label association. — **left open at the User's request** (2026-08-01: "don't browser check"). The `useId` change is the one part of this ticket that touches what a User sees, and label/control association is exactly what an automated test can assert structurally but not prove for assistive tech.

## Notes

- Do this when the tree is quiet. A whole-repo reformat conflicts with everything in flight, so it
  should not land while a feature ticket is half-built.
- `yarn check` (without `run`) silently does nothing — Yarn v1's builtin shadows the script. If the
  hook or CI step is added, make sure it calls `yarn run check`.
- The 14 duplicate-id findings are the only ones with real user impact; if the ticket has to be
  split, that subset is the part worth doing first.
