# TICKET-DX-01 — Fix the React 19 + Vitest hooks-dispatcher failures

- **Area:** Developer experience / test infrastructure
- **Type:** Bug fix
- **Traceability:** none directly — this unblocks the Definition of Done and plan §18
- **Replaces plan items:** prerequisite for tasks.md §18

## User story

As a Developer, I want the test suite to reflect whether the code works, so that "tests pass" is a
statement about the app instead of a statement about a documented list of exceptions.

## Description

48 tests fail and 11 are skipped for one reason: in the Vitest environment, React's internal hooks
dispatcher is null, so any component calling `useState`/`useEffect` throws on render. It has
nothing to do with the code under test — every hook-using component fails, every hook-free one
passes. Until it's fixed, every ticket is verified against a "no *new* failures" bar, the §18
checkpoint is unreachable, and each new hook-using component quietly adds to the pile.

## Current situation (as-is)

- 420 tests: 361 pass, 11 skipped, **48 fail** — see [TEST_STATUS.md](../../../TEST_STATUS.md) for
  the per-file breakdown. Failing: all seven task-11 config panels. Skipped: `Dialog` and
  `FormulaEditor`, disabled earlier for the same reason.
- Symptom: `Cannot read properties of null (reading 'useState')` — `ReactSharedInternals.H` is null
  when the component renders.
- Environment: React 19.2, Vitest 3, `@testing-library/react` 16,
  [`vite.config.ts`](../../../vite.config.ts) with `environment: 'happy-dom'` and the plugin order
  `devtools() → tsconfigPaths() → tailwindcss() → tanstackStart() → viteReact()`.
- [`vitest.setup.ts`](../../../vitest.setup.ts) sets `global.IS_REACT_ACT_ENVIRONMENT = true` and
  runs `cleanup()` after each test.
- Already tried and recorded as not working: removing `useEffect` from FormulaEditor, adding the
  setup file, switching jsdom → happy-dom, reordering plugins, `import * as React`, the
  `IS_REACT_ACT_ENVIRONMENT` flag. The remaining suspect the notes never chased: **more than one
  copy of React in the test graph** — `tanstackStart()` and `viteReact()` both process JSX, and a
  duplicate `react`/`react-dom` instance is the classic cause of a null dispatcher.

## Desired result (to-be)

- Component tests that use hooks run and pass. The root cause is identified and named in
  TEST_STATUS.md, not worked around per-file.
- Likely candidates, in the order worth trying: dedupe React in the Vitest config
  (`resolve.dedupe: ['react', 'react-dom']` and/or an alias to a single copy), verify with
  `npx vitest run --debug` or a one-line spec asserting `React === require('react')` identity
  across the test and the component module, then revisit the plugin set — `tanstackStart()` may not
  belong in the test pipeline at all.
- The 11 skipped `Dialog` / `FormulaEditor` tests are re-enabled once the cause is fixed.
- TEST_STATUS.md is rewritten to describe a green suite, or — if some subset genuinely cannot be
  fixed — an accurate, much smaller exception list with the reason per file.
- The Definition of Done in [overview.md](../overview.md) and `CLAUDE.md` moves from "no new
  failures" back to "the suite passes".

## Acceptance criteria

- [ ] The root cause is identified and stated in one or two sentences with the evidence that proves it (not "it seems to be").
- [ ] All 48 currently-failing tests pass.
- [ ] The 11 skipped tests in `Dialog.test.tsx` and `FormulaEditor.test.tsx` are un-skipped and pass.
- [ ] No test is fixed by removing the hook it exercises, weakening the assertion, or adding `.skip()`.
- [ ] `npx vitest run` reports 0 failures and 0 skips (or a documented, justified exception list that is strictly smaller and explains each entry).
- [ ] `npx tsc --noEmit` and `yarn run lint` are unaffected (no new errors).
- [ ] `yarn dev` and `yarn build` still work — a config change that fixes tests but breaks the dev server or the production build is not a fix.
- [ ] TEST_STATUS.md is updated to match reality, including what the cause turned out to be.
- [ ] `CLAUDE.md`, `overview.md`, and the `verifier` subagent's brief are updated to the stricter bar once the suite is green.
- [ ] Verified via the fallow skill.

## Notes

- Worth taking early: every UI ticket after it is verified honestly rather than against a baseline,
  and each new hook-using component otherwise widens the exception list (TICKET-CHAR-01 and -02
  both say as much).
- If the cause really is a duplicated React, the fix is likely a few lines of Vitest config — the
  cost here is the diagnosis, not the change.
- Downgrading React 19 → 18 is the last resort, not the first move; it would contradict the
  project's stated stack and should only be considered with the User's agreement after the
  dedupe/plugin avenues are exhausted.
- If the suite turns out to be green after the fix, the §18 checkpoint becomes reachable and the
  note about it in overview.md's Definition of Done can go.
