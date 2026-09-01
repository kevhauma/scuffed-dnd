# TICKET-DX-10 — Assertions bind their subject: the test-suite sweep

- **Area:** Developer experience / convention adoption
- **Type:** Refactor
- **Traceability:** No numbered requirement — this is a house convention, stated in
  [CLAUDE.md](../../../CLAUDE.md)'s *Never call a function as the argument of another call* and in
  the [`coding-conventions`](../../../.claude/skills/coding-conventions/SKILL.md) skill's *Testing*
  section. **Independent of both v4.0 passes** — see the Notes.

## User story

As a developer, I want the test suite to obey the same no-nested-calls rule the production code
does, so a convention stops being argued one ticket at a time and a reviewer stops having to ask
which half of a file is current.

## Description

One mechanical sweep binding every assertion's subject to a named intermediate variable, so
`expect(f(x)).toBe(n)` becomes `const value = f(x); expect(value).toBe(n)`. Behaviour-preserving by
construction: no test is added, removed, renamed or re-expected.

> **Scope: the assertion forms, and the arrangement sites in the files it opens.**
> The rule the User settled at TICKET-DX-09 is **whole** — all test code is in scope, arrangement
> and act as much as assert, which is how CLAUDE.md words it and how the
> [`coding-conventions`](../../../.claude/skills/coding-conventions/SKILL.md) skill words it. **This
> ticket sweeps the assertion forms**, because they are what a grep can measure and they are the
> dominant bulk. The two are reconciled by one rule rather than by two debts: **an arrangement site
> in a file this sweep touches is converted in the same pass** — `localStorage.setItem(KEY,
> JSON.stringify(config))` in a file being swept becomes two lines like everything else — so no file
> is left half-converted, which is the failure this ticket exists to end. A file the sweep never
> opens keeps its arrangement nesting until something else touches it, and that is not a finding.

## Current situation (as-is)

- CLAUDE.md's hard rule has never carried a test exemption, and the
  [`conventions-reviewer`](../../../.claude/agents/conventions-reviewer.md) agent says so
  explicitly — *"Applies everywhere, tests included (`expect(compute(input)).toBe(…)` → bind the
  result first)"*.
- It is nonetheless **half-applied**. TICKET-RACE-04, TICKET-SKL-05 and TICKET-INV-04 each converted
  a handful of sites while adding ten to thirty more, because `expect(f(x))` is the suite's
  pervasive existing form and converting one file's new cases makes it disagree with its own
  neighbours. TICKET-INV-04's review raised it; TICKET-DX-09's Notes carried it; the User settled it
  there — **the rule stays whole and the sweep is its own ticket**, which is this one.
- The measured size, at TICKET-DX-09 (2026-09-01), from the repository root:

  | What | Sites | Files | Command |
  |---|---|---|---|
  | Nested **subject** | 3,016 | 208 | `rg -c 'expect\([A-Za-z_$][A-Za-z0-9_$.]*\(' -g '*.test.ts*' src` |
  | Nested **matcher argument** | 61 | 34 | `rg -c '\.(toBe\|toEqual\|toStrictEqual\|toContain\|toContainEqual\|toMatch\|toHaveLength\|toBeCloseTo\|toHaveBeenCalledWith\|toHaveBeenNthCalledWith\|toThrow)\([A-Za-z_$][A-Za-z0-9_$.]*\(' -g '*.test.ts*' src` |

  Both patterns over-count slightly — they match the exempt forms below as well — so the numbers are
  the sweep's **upper bound** and its starting measurement, not its target.

## Desired result (to-be)

- **Every assertion in `src/**/*.test.ts(x)` binds its subject first**, with a name that says what
  the value *is* — `const level = …`, not `const result = …`, wherever the value has a better name.
- **A matcher's argument is in scope too** (User, TICKET-DX-09): `expect(a).toEqual(build(x))` binds
  `build(x)` first. The rule is about arguments and a matcher takes one; an ambiguous sweep is worse
  than a large one.
- **Every file the sweep opens comes out fully converted**, arrangement included — a
  `localStorage.setItem(KEY, JSON.stringify(config))` or a
  `useCharacterStore.setState({ characters: [build()] })` in a swept file is bound like everything
  else. The sweep is *scoped* by the assertion forms; it is not *limited* to them within a file it
  has already opened, because a half-converted file is the exact state this ticket ends.
- **Three forms are explicitly untouched** — the same three the `coding-conventions` skill and
  CLAUDE.md list, because there is one list and it does not vary by document:
  1. a **method chain** — `vi.mocked(useConfigStore).mockReturnValue(…)`, `items.filter(…).map(…)`,
     an awaited `screen.findByRole(…)` whose result is then asserted;
  2. a **function passed by reference or as an inline callback** — `expect(fn).toHaveBeenCalled()`,
     `expect(() => cast(…)).toThrow()`, `it.each(rows)`, `useMemo(() => …, [])`;
  3. **JSX as an argument** — `render(<Component … />)`, which is an element rather than a call.
- **No production file is touched**, and no test file changes anything but its variable bindings.

## Acceptance criteria

- [ ] The two counts above are re-measured after the sweep and are zero once the exempt forms are
      excluded, with the exclusion stated rather than assumed — the closing measurement and its
      command are recorded in this ticket.
- [ ] **No file in the diff is half-converted**: a spot check of three swept files finds no
      remaining nested arrangement call in them, per the Scope line.
- [ ] The sweep is **behaviour-preserving**, evidenced by an **unchanged test count**
      (see [TEST_STATUS.md](../../../TEST_STATUS.md)) with 0 failing and 0 skipped, and by no
      changed expected value in the diff.
- [ ] No file outside `src/**/*.test.ts(x)` and the test-only helpers under `src/server/testing/`
      appears in the diff.
- [ ] `npx tsc --noEmit` sits at its documented baseline and `yarn run check` is clean — the bound
      intermediates are typed by inference, so a new annotation anywhere is a smell worth reading.
- [ ] The golden fixtures' expected values are untouched: `git diff --stat` shows no change under
      `src/shared/engine/golden/`.
- [ ] Verified via the `verifier` subagent, the `fallow` skill and the `conventions-reviewer`
      subagent — the last of which should report **zero** nested-call findings for the first time.
- [ ] The `coding-conventions` skill's *Testing* bullet drops its "until that lands" clause once the
      sweep is in, so the interim rule does not outlive the interim.

## Notes

- **Why it is not a v4.0 shape line, and not a data-pass line either.** v4.0's shape pass closes at
  TICKET-DX-09 and its build-order list ends there; this ticket is neither a shape nor a sheet
  number, so appending it to that list would reopen a pass that is closing. It is cut here because
  this is where the decision was made, it **depends on nothing**, and it can ship at any point —
  which is why it sits in its own section of [`overview.md`](../overview.md) rather than in the
  build order.
- **One commit, mechanically.** A file half-converted disagrees with its own neighbours, which is
  the exact failure this ticket exists to end. Until it lands, new test code follows the rule and
  old test code is left alone; pre-existing nesting is not a review finding.
- **Do it file by file with the suite running.** The risk is not the rule, it is the fingers: a
  binding hoisted out of a `beforeEach` scope, or lifted above the `act(…)` that has to precede it,
  changes *when* the value is read. A subject bound before the state change it is meant to observe
  is the one way this sweep can silently invert a test.
- A follow-up worth considering rather than assuming: whether a Biome lint rule can hold the line
  afterwards. If one exists, adding it here makes the convention self-enforcing; if not, the
  `conventions-reviewer` remains the check and that is not a reason to widen the ticket.
