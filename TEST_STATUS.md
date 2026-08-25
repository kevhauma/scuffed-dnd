# Test Status

_Last verified: 2026-08-25 (`npx vitest run`), after **TICKET-DX-06 — the server test harness**.
The checkpoints before it were **TICKET-DX-08 — the architecture rules as checks** at 1937,
**TICKET-DB-01 — SQLite, Drizzle and migrations** at 1925, **TICKET-SRV-01 — the server layer** at
1883,
**TICKET-DX-07 — three roots** at 1847, the **equipment split and display builder** at 1834, the
**character sheet rebuild** at 1777, the **tavern redesign** at 1732, and the
[v2.1 code review](docs/v2.1_code_review/overview.md)'s **high-priority findings** (CR-01 to CR-07,
CR-08, CR-20) at 1674._

## Summary

- **Total tests**: 1970
- **Passing**: 1970 (100%)
- **Skipped**: 0
- **Failing**: 0

The **+33 over DX-08** is TICKET-DX-06, and it is purely additive — 30 in a new
`src/server/testing/harness.test.ts`, one in `architecture/boundaries.test.ts` for the new
`test-harness-stays-in-tests` rule, one in `apiRouter.test.ts` and three in `pipeline.test.ts`.
**The four outside the harness file are the load-bearing ones.** `defineHandler` now takes an
optional `RequestScope`, which is how `callRoute` says *as this account* — and the entire safety
argument for a pipeline that accepts an injected identity is that almost nothing passes one. Two
tests hold that: `apiRouter.test.ts` swaps a spy into `ROUTES` and drives a request carrying both an
`x-account-id` and an `Authorization` header, asserting the route was handed `undefined`; and
`pipeline.test.ts` scans `src/server/` and asserts that exactly two modules so much as **name**
`RequestScope`. The second exists because the first is about the router, and the router is one
instance of the rule rather than the rule.

**Four of the thirty came out of the `conventions-reviewer` pass, and one of them mattered a lot.**
`setProcessDatabase` — the seam the whole `queries-belong-to-repositories` widening was bought for —
had *no coverage*: deleting both of its calls left the suite green, while every future route test
would silently have read an unmigrated, file-scoped database. It is now asserted through
`/api/health`, which reports an applied migration inside `withTestDatabase` and none outside.

The review also found that two **overlapping** `withTestDatabase` calls did not merely fail, they
left a *closed* connection installed as the process database for the rest of the file — and because
`getDatabase()` is `opened ??=`, a non-null closed handle is never replaced. The restore is now a
compare-and-swap that throws, with a test that overlaps two calls deliberately and then checks the
process database still works.

Three server test files were **migrated, not rewritten**: `rulesetRepository.test.ts`,
`eventRepository.test.ts` and `schema.test.ts` each had their own four-line `migratedDatabase()`
and `afterEach` bookkeeping, which is exactly the triplication the harness exists to remove. Not one
assertion changed and the count is unmoved. `eventRepository.test.ts` also lost a hand-written
`INSERT INTO game_session`, which mattered more than tidiness: it was a second definition of what a
session row looks like, and the next migration would have had to remember it.

`schema.test.ts` deliberately **keeps** its own raw-SQL `seedSession`. The harness's seats a DM in
`session_member`, and the *refuses a second DM* case needs a session with nobody in it — the file's
whole premise is that the database enforces these rules rather than a repository being careful.

**Measured cost of a per-test database: ~2–3 ms**, and no suite regression at all. `schema.test.ts`
reports 2–3 ms per case for open + migrate + close plus its own raw SQL (15 ms for the first, which
carries module init). Whole-suite, three runs each: **before 29.03 / 28.02 / 27.55 s**, **after
27.26 / 27.35 / 24.59 s** — unchanged, inside the noise, with 33 more tests and roughly 70 more
databases opened.

The **+12 over DB-01** is TICKET-DX-08, and all twelve are in
[`architecture/boundaries.test.ts`](architecture/boundaries.test.ts), which goes 9 → 21: one per
new rule (`kernel-is-framework-free`, `types-are-the-bottom-layer`,
`persistence-belongs-to-the-store`, `queries-belong-to-repositories`, `ui-primitives-are-leaves`,
`no-circular`, `no-dev-dep-in-production`, `no-undeclared-dependency`, `no-orphans`) and three
about the rule set as a whole. Those three are the ones worth naming:

- **`no-orphans` reports at `warn`**, asserted on the severity of a real finding rather than on the
  config literal — a warning that never reaches the report is the same as no rule. It stays a
  warning because the class it catches is *tiny*: dependency-cruiser's orphan predicate is "no
  dependencies **and** no dependents", so a dead file that imports anything at all is not an
  orphan. `fallow dead-code` is what judges reachability; this is the cheap first look.
- **A failure message names the decision**, asserted against the `err-long` reporter's actual text
  for the persistence and Kernel-purity rules. `yarn run arch` gained `--output-type err-long` in
  the same change: `err`, the CLI default, prints the edge and drops the `comment`, so every rule's
  explanation was being written and then thrown away.
- **No module that is not a fixture breaks any rule** — the second half of the same cruise. The
  suite now cruises the whole of `src/` with *only* the `boundaryFixtures/` exemption lifted, which
  is what makes a green `yarn run arch` mean "the tree is clean" rather than "the tool is blind".

`libraryConventions.test.ts` was edited and stayed at 5 cases: nothing it checks was import-shaped,
so `ui-primitives-are-leaves` had nothing to take from it (DX-08 criterion 8).

The **+42 over SRV-01** is TICKET-DB-01: the connection (4), migrations (8), schema constraints
(9), the ruleset repository (11) and the event repository (10). Each group answers a criterion
rather than a function: that a failing migration leaves *nothing* behind and does not mark itself
applied; that each cascade rule is the one the schema's prose claims; that a **real**
`Configuration` — the whole 306 KB Ducklets corpus — round-trips a `TEXT` column byte-for-byte,
formulas and curve flags included; and that a stale base revision updates zero rows rather than
overwriting a save it never saw.

Six of those came out of the `conventions-reviewer` pass. The one worth naming pinned a bug that
would have hit **every fresh clone**: `data/` is gitignored and `new Database()` does not create a
missing directory, so the first `yarn dev` on a clean machine died at start-up with a raw
`SqliteError`. `client.test.ts` opens a database in a directory that does not exist yet.

**The suite now opens real databases.** Every one is `:memory:`, opened and closed per test, so
there is no fixture file and no cleanup to forget; `vitest.setup.ts` sets `DATABASE_URL=:memory:`
so a test that merely *imports* a route module does not need one of its own. TICKET-DX-06 folded
the opening and closing into `withTestDatabase` — but **left the `vitest.setup.ts` line where it
is**, which is the opposite of what this paragraph originally predicted: `env.ts` can be asked for
a value at *import* time, before any test body has run, so no harness function could be early
enough.

The **+36 over DX-07** is TICKET-SRV-01: the environment loader (14, including the three contracts
that keep `.env.example` and `env.ts` naming the same set, keep `process.env` to one reader, and
keep any origin out of the environment entirely), the request pipeline (14, most of them about the
one decision that matters — a refusal explains itself, a bug says nothing), and the API router (8,
of which the load-bearing one is that non-API traffic comes back as `null` rather than a 404, which
is what lets one process serve the app and the API from one origin).

Six of those thirty-six came from the `conventions-reviewer` pass and are worth naming, because
each pins a bug that was reachable: a handler returning nothing produced a 200 whose body was the
four characters `undefined`; `AppError` took its status from the caller, so a malformed one would
have thrown inside the pipeline's own catch; the 404/405 bodies echoed the request path back; and
`HEAD` on a known route was answered with a 405.

The **+13 over the equipment checkpoint** is TICKET-DX-07, and **none of it is the move**: the tree
moved at exactly 1834, which is the whole point of a refactor ticket that changes no behaviour.
The thirteen are the checks the ticket adds — 9 in `architecture/boundaries.test.ts`, one per
dependency-cruiser rule plus the legal crossing and a guard that fails when a rule arrives without
a fixture, and 4 in `src/server/sharedKernel.test.ts`, which is the first thing the server root
does and proves the pure half of `services/` is reusable from it. One test file was split in two —
`importExport.test.ts`'s `Blob`/`File` cases became `client/services/configFiles.test.ts` — and one
moved root, `golden.test.ts` to `client/integration/`, because it drives both stores and the Kernel
may not import its callers. Neither changed a count.

The **+57 over the sheet-rebuild checkpoint** is the equipment work. `slotLayout.test.ts` (7) was
replaced by `engine/equipmentLayout.test.ts` (19) when the recognition table stopped being the rule
and became the seed; `Glyph` gained 3 catalogue cases holding the drawings, the labels and the
picker groups to one list; the store gained 7 for the layout actions, the import shape layer 7 for
the grid and its placements, and `engine/validator.ts` 5 for the arrangements it now reports. The
two new panels bring 16, and the inventory suite 3 for a doll that reads the configuration instead
of guessing. Four existing cases changed rather than were added, each because the thing they
asserted moved: `/config/items` now asserts the *absence* of the equipment panel it used to mount,
the dashboard and nav lists gained an Equipment entry, and the items panel's prerequisite note
points at a page rather than down its own.

The **+45 over the tavern-redesign checkpoint** is the sheet rebuild: `Glyph` (4) and `slotLayout`
(7) for the equipment figure, `WalletSection` (8) and `setWalletAmount` (5) for the purse,
`setInvestedSkillPoints` (5), and the rest spread over the sheet's own suite. Six existing cases
changed rather than were added, each because the thing they asserted moved: the invested-points
text field became a stepper, so the commit-on-blur cases became "there is no field to type a
partial number into"; a skill's level is rounded up at the display edge, so `level 1.4` reads
`level 2`; and an equipment slot is a tile rather than a bordered row, so the shared `rowFor`
helper accepts either. None was deleted or loosened.

The **+10 over the high-findings checkpoint** is the redesign, and it is additive: `Ornament` (4)
and `Divider` (5) are the two new SVG primitives, and `Button` gained one case for the `plaque`
variant. Eleven existing cases changed rather than were added — the base-component suites assert
the classes a primitive wears, so retuning the palette necessarily retunes them; each was rewritten
to the new intended value, none was deleted or loosened. Two of those rewrites pin a fix rather
than a colour: `Checkbox` now asserts `appearance-none`, because a native checkbox ignores every
background and border utility in Chrome and the old styling was painting nothing, and
`libraryConventions` now scans `styles.css` alongside the library, because the checkbox's tick had
to move there.

The **+34 over the low-findings checkpoint** is the high-priority pass, all additive except where a
finding's fix made an old expectation wrong: the cycle-detection suites gained the ids-are-UUIDs
cases CR-01 asks for and the phantom-cycle graph CR-08 asks for; `importExport.test.ts` gained the
four collections CR-03 left array-checked and nothing more; `storage.test.ts`'s three
silent-drop cases became refusals (CR-05); a new `useCurrencyManager.test.ts` pins order-0 through
an edit (CR-04); and the `stat` scope losing `skills` (CR-02) flipped four cases from accept to
refuse and retargeted two more at the `roll-input` owner, which is where a skill reference is
actually honoured.

Was 660 at the v1.0 foundation checkpoint (2026-08-01); v2.0's tickets added
+43 (FORM-02), +30 (FORM-03), +29 (FORM-04), +28 (FORM-05), +11 (FORM-06), +7 (CALC-02),
+11 (REF-01), +9 (REF-02), +18 (CST-01), +18 (CST-02), +64 (CRV-01),
+32 (CRV-02), +27 (FORM-07), +3 (STAT-01), +51 (CRV-03), +47 (IO-03), +27 (STAT-02), +15 (FORM-08), +8 (FORM-09), +14 (SKL-02), +36 (SKL-03), +36 (RES-01), +14 (RES-02), +48 (RES-03), +40 (ARC-01), +50 (ARC-02), **−15 (ARC-03)**, +34 (ROLL-03), +9 (ROLL-04), +36 (ROLL-05), **−18 (ROLL-06)** and +64 (DX-04).
**DX-04's +64** is one new file, `src/client/integration/golden.test.ts`, and it is purely additive —
nothing existing was touched, because the milestone's parity gate went green on its first run.
Sixty-two of the sixty-four are fixture rows driven by `it.each` over
`src/shared/engine/golden/fixtures.ts`; the other two are the suite's own guards, one asserting every row
carries a citation and one pinning **which** rows are 🔍-inferred, so a confirmed derivation cannot
be re-tagged as inferred to make a failure go away.
**RES-02's +14 is a net figure**: `StatPointBudget.test.tsx` (6) went with the flat pool it
covered, `configStore.test.ts`'s budget block shrank from 4 cases to 2, and the
`mainSkillPointBudget` round-trip block became a 4-case retired-field refusal — against which
`skillAllocation.test.ts` grew the derived-budget and unavailable-budget groups, `characterStore`
gained 8 for `setInvestedStatPoints`, and the sheet gained 6 for the pool and its spend surface.
**RES-03's +48** is purely additive: two new colocated files (`useNumericDraft.test.ts` at 17,
`pointBudgetView.test.ts` at 5 — both raised by the `conventions-reviewer` on RES-02), 13 more in
`characterStore.test.ts` for the two new pool actions and creation's affordability refusal, and 13
on the sheet for quick entry, refill and kept-and-flagged. Three existing sheet cases were rewritten
rather than added to: commit is on blur now, and `-5` is a delta rather than an absolute.
**ARC-01's +40** is a new entity's full spread: 8 in a new `ArchetypesConfigPanel.test.tsx`, 5 in a
new `StatRowsField.test.tsx`, 10 in `validator.test.ts` for the two new rules, 6 in
`importExport.test.ts` for the shape, 5 in `configStore.test.ts` for CRUD and the export round-trip,
4 in `dependencies.test.ts` for the guarded-delete reference in both directions, and 2 route cases.
Nine of those came from the `conventions-reviewer` pass, which found `deleteStat` blind to archetype
affinities — see the ticket.
**ARC-02's +50** is a new `pointBuy.test.ts` (28, including Concept 03's confirmed 12/7/5 spread
and three `fast-check` properties), 7 in `calculator.test.ts` for the composition, 12 in
`skillAllocation.test.ts` for the reported gains and the new `unpriceable-gain` refusal, and 3 on
the sheet. **The 1:1 fallback is why the suite could not see the sheet's broken breakdown** — no
fixture carried a `point_buy` curve, while `createFreshConfiguration` seeds one, so every real
ruleset hit the bug and no test did. The three sheet cases added for the fix carry a curve
deliberately, and one existing assertion changed with the row's new wording.
**ARC-03 is the first negative delta of the milestone, and that is the point**: retiring the focus
stat deleted `FocusStatConfig.test.tsx` and `useFocusStatManager.test.ts` outright (24 cases) along
with the focus-specific cases in `calculator.test.ts`, `statCalculator.test.ts`, `CharacterSheet.test.tsx`,
`configStore.test.ts` and `importExport.test.ts`. Against that, five new archetype-step cases, two
flat-bonus regressions and five in a new `affinityGroups.test.ts` (the `conventions-reviewer`'s
de-duplication). A ticket whose job is removal should shrink the suite; what matters is that nothing
was skipped and the remaining cases assert the *absence* rather than falling silent.
**ROLL-03's +34** is purely additive: a new `diceLadder.test.ts` (19, including Concept 07's six
confirmed decompositions and two `fast-check` properties — one that the decomposition conserves its
input, one that the flat remainder stays below the smallest die), 8 in `validator.test.ts` for the
ladder rules, 5 in `configStore.test.ts` for CRUD and the export round-trip, and 2 in
`sheetImport.test.ts` — the derivation the new fragment pins, plus one more `it.each(fragments)`
instance, since the provenance check is parameterised over the corpus.
**ROLL-04's +9** all land in the same `diceLadder.test.ts` (19 → 28): four for `rollDecomposition`
— including a property over *generated ladders* rather than a fixed one, which is the gap ROLL-03's
`NaN`-size defect slipped through — and five for `formatLadderNotation`. No existing dice test was
touched.
**ROLL-05's +36** is a new entity's full spread across two new panels: 11 in a new
`RollsConfigPanel.test.tsx` (which covers `DiceLaddersConfigPanel` too — they share a fixture and
are mounted together), 9 in `configStore.test.ts` for roll CRUD, the seeds and the ladder
guard, 6 in `importExport.test.ts` for the shape, 3 in `validator.test.ts`, 2 in
`sheetImport.test.ts` for the new fragment, plus a `scoping.test.ts` case and two route cases.
**Three existing assertions changed, and each was a guard firing correctly**: `scoping.test.ts`
enumerates every attachment point, `sheetImport.test.ts` enumerates every corpus fragment, and
`configStore.test.ts`'s "a fresh ruleset has no diceLadders" was ROLL-03 recording that ROLL-05
would seed one — so it now asserts the seed instead.
**ROLL-06 is the milestone's second negative delta, and the biggest test-layer migration since
SKL-02.** Four files went outright with the entities they covered (36 cases): `CombatRoller.test.tsx`
(12), `combatSkillCalculator.test.ts` (8), `combatRoll.test.ts` (8) and `skillIdentity.test.ts` (4, its
last consumer having been the combat manager) — plus the combat-skill cases
in eight edited files. Against that, **four new files replace what was deleted rather than leaving
the behaviour uncovered**: `rollCalculator.test.ts` (7), `rollDefinition.test.ts` (6),
`useRoller.test.tsx` (8) and `RollsSection.test.tsx` (10) test the same contracts over the modules
that replaced them. The first three were written
**because the `verifier` noticed they were missing**, and the fourth because the
`conventions-reviewer` then noticed nothing rendered a `RollOutcome` at all — the first pass deleted the old tests and
relied on the sheet's integration coverage, which is precisely the "weakened rather than migrated"
failure SKL-02 warned about. Roughly 25 assertions across the suite were rewritten rather than
deleted: `combatSkillBonuses` → `rollInputs`, `Melee (MEL)` → `Melee`, a bonus chip → a pool label,
and every cycle fixture moved onto **derived stats**, which are the only formula nodes left.
**SKL-02's +14 is a net figure across a very large rewrite**: the source-side reshape landed a
session ahead of its tests, so 171 tests were failing when the ticket was picked up. 20 tests were
added in a new `skillCalculator.test.ts` (Concept 02's verified table), a handful more elsewhere,
and roughly as many were deleted or rewritten with the entity they covered — the speciality
attachment point, its formula field, its preview placement, the two speciality-cycle cases and the
`renameSkillCode` / `useSkillCodeRename` suites. See the ticket's implementation notes.
**STAT-02 restored `StatsConfigPanel.test.tsx`**, one of the five panel test files TICKET-DX-01
deleted — it is back, rewritten against the real store, and passing. FORM-02/03/04 only
appended. **STAT-01's +3 is a net figure**: the breaking schema change deleted
`mainSkillCalculator.test.ts` (18) and `MainSkillPointBudget.test.tsx` (6) with the entities they
covered, added `statCalculator.test.ts`, `stats.test.ts` and `StatPointBudget.test.tsx`, and
rewrote assertions across ~30 fixture files. FORM-05 also **rewrote** ~14 assertions that asserted the throwing contract it replaced,
and FORM-06 replaced one sheet test that asserted the whole-sheet error page it removed — see
those tickets' implementation notes.

**The v2.1 review's low-priority findings added +22**, all in existing files except a new
`Text.test.tsx` (4) — the primitive had none: +5 (CR-26 `namedConstant`), +1 (CR-30 clearing an
optional field on skills, +1 more on items), +1 (CR-32 Select error, +1 Textarea error, +4 Text),
+2 (CR-33 prop-driven formula validation, one of them the case TICKET-DX-01 removed over the bug),
+1 (CR-34 static rows), +1 (CR-35 named row controls), +1 (CR-36 the arrow colour pinned to its
token), +1 (CR-38 the duplicate-abbreviation message), +1 (CR-39 `clearAllData` touching only the
app's keys), +1 (CR-41 fractional bounds) and +1 (CR-43 clearing a refused generator).

**The suite is green. The bar is "the suite passes", not "no new failures beyond a documented
list".** Any failing test is a regression.

`npx tsc --noEmit` is **not** clean — see [Typecheck](#typecheck-2-known-errors) below.

## The React 19 hooks-dispatcher failure — resolved

For most of the project's life, 48 tests failed and 11 were skipped with
`TypeError: Cannot read properties of null (reading 'useState')` — React's internal hooks
dispatcher (`ReactSharedInternals.H`) was null, so every component calling `useState`/`useEffect`
threw on render. It was misfiled as a React 19 / Vitest / Testing-Library version incompatibility.
It was not.

### Root cause

**`tanstackStart()` was in the Vitest plugin pipeline.** That plugin wires up TanStack Start's
client/ssr Vite environments for SSR dev and build. Under Vitest, that wiring causes `react` to be
instantiated **twice**: the copy the component tree imports is not the copy `react-dom` binds its
hooks dispatcher to, so `H` is never set on the instance the components actually see.

### Evidence

- `node_modules` contains exactly **one** physical copy of `react` (19.2.4) and `react-dom` — so
  this was never npm-level duplication, which is why `resolve.dedupe` had no effect.
- A probe rendering a hook component through `@testing-library/react` showed the test file's
  `React.__CLIENT_INTERNALS…H === null` *during* the react-dom render, while react-dom itself
  rendered happily — i.e. two `ReactSharedInternals` objects.
- With a byte-identical plugin list otherwise, **removing only `tanstackStart()` made hook
  components render**. Everything else held constant.
- Four other candidate fixes were tried and each still failed, which is what rules out the usual
  suspects: `resolve.dedupe: ['react','react-dom']`; inlining `@testing-library/react` via
  `server.deps.inline`; forcing `react`/`react-dom` external via `server.deps.external`; and
  `tanstackStart({ customViteReactPlugin: true })` to avoid a doubled React plugin.

### Fix

A dedicated [vitest.config.ts](vitest.config.ts) that omits `tanstackStart()`. Vitest prefers
`vitest.config.ts` over `vite.config.ts`, so [vite.config.ts](vite.config.ts) is unchanged and
`yarn dev` / `yarn build` keep the full Start pipeline.

Routing still works under test because `src/client/routeTree.gen.ts` is committed — nothing in the suite
needs the route generator to run. `src/client/routes/config/configRoutes.test.tsx` passes unchanged.

The fix alone took the suite from 48 failing / 369 passing to 14 failing / 403 passing.

**This stays true now that there is a server (TICKET-SRV-01).** The server layer is deliberately
shaped so that it can be: a handler is a function from `Request` to data, `defineHandler` wraps it
into a function from `Request` to `Response`, and `handleApiRequest` is called with a plain
`new Request(...)`. Nothing in `src/server/` needs Nitro, a listener, or a port to be exercised, so
`vitest.config.ts` keeps omitting `tanstackStart()` and server tests keep running in the same pass
as everything else. The one module that *does* touch the framework — `src/server/entry.ts` — holds
two lines of dispatch and nothing worth asserting in isolation; what it does is proven in the
browser instead.

## What else changed in TICKET-DX-01

Once the tests actually executed, they exposed real test-quality bugs the crash had been hiding.

**Five config-panel test files were deleted** (27 tests: 14 failing, 13 passing) rather than
repaired — a deliberate scope decision by the User, recorded in the ticket:

- `src/client/components/config/currency/CurrencyConfigPanel.test.tsx`
- `src/client/components/config/items/EquipmentSlotsConfigPanel.test.tsx`
- `src/client/components/config/materials/MaterialsConfigPanel.test.tsx`
- `src/client/components/config/races/RacesConfigPanel.test.tsx`
- `src/client/components/config/stats/StatsConfigPanel.test.tsx` — **back as of TICKET-STAT-02**,
  rewritten against the real store with storage mocked, which is what avoids the selector-ignoring
  mock that killed the original

Their failures were: store mocks using `mockReturnValue(state)` that ignore the selector passed to
`useConfigStore(s => s.config)`; `getByText(/add race/i)`-style queries matching both a button and
the empty-state prose that names it; and `toBeInTheDocument` in a repo where
`@testing-library/jest-dom` is not a dependency.

**The remaining config-panel tests were untouched and pass**: `FocusStatConfig.test.tsx` (15) and
`ItemsConfigPanel.test.tsx` (6) — both went from fully failing to fully green on the config change
alone. So the config panels still have coverage; `components/ui/*` primitives keep all of theirs.

**`Dialog` and `FormulaEditor` are un-skipped.** Of their 11 tests, 10 now run and pass. One
Dialog test was repaired (it walked two `parentElement` hops from the `<h2>`, landing on the dialog
box — which calls `stopPropagation` — instead of the overlay; it now uses `container.firstChild`).

One FormulaEditor test was **removed, not fixed**: it drove `value` by rerender and expected
`onValidate` to fire, but FormulaEditor only validates inside `handleInputChange`, so prop-driven
value changes leave its `error` stale. That is a genuine component bug, tracked separately — the
fix touches a base primitive used by three form dialogs and needs its own browser check.

## Typecheck: 2 known errors

`npx tsc --noEmit` exits non-zero with 2 errors. **Neither is new.** They predate the ticket
workflow and are documented here so a future regression is distinguishable from this noise:

| File | Error |
| --- | --- |
| `src/client/components/ui/Button/Button.test.tsx:68` | TS2339 — `.disabled` read off `HTMLElement` |
| `src/client/services/configFiles.test.ts:238` | TS2352 — `Blob`-shaped literal cast to `File` |

Both are test-typing noise. The two `evaluator.ts` errors that stood beside them for five tickets
are **gone as of TICKET-FORM-07**: `operator` does not exist on type `never` was the switch
narrowing `ast` itself to nothing in its `default` arm, and adding the `^` operator meant
rewriting that switch anyway. Taking the operator as a *parameter* (`applyBinary`, `applyUnary`)
narrows the parameter instead, so `const _exhaustive: never = operator` compiles — the same
exhaustiveness idiom `dependencies.ts` and `curves.ts` already use. The check got stronger, not
weaker: an unhandled operator is now a compile error rather than a runtime throw.

**Was 9 until TICKET-DX-02**, which cleared five as a side effect of fixing the matching lint
errors: the two dead `BaseSkillPanel` props, the unused `React` and `FormulaAST` imports, and the
type-only import in `ValidationReport.test.tsx`. Fixing dead code once satisfied both tools.

## Hotspots: accelerating files

`fallow health --hotspots --since 6m` scores every file by churn × complexity and tags its
velocity `Accelerating`, `Stable`, or `Cooling`. **Accelerating** is the one worth tracking: the
file is being edited more often *and* getting harder to edit, and that pair is what precedes a
file nobody wants to open.

The rule (see the **coding-conventions** skill's Verification section): a ticket that touches a
file which comes back Accelerating adds a row here, naming the ticket that moved it. A file that
cools off keeps its row with the ticket that cooled it, so the direction of travel stays legible.

| File | Hotspot score | First flagged by | Latest | Status |
| --- | --- | --- | --- | --- |
| _none recorded yet_ | | | | |

**TICKET-DX-08 ran it and is owed no row.** `fallow health --hotspots --since 6m` returns two files
above the threshold — `scripts/build-sheet-import.mjs` (100.0) and `vite.config.ts` (4.8) — both
tagged **stable**, and DX-08 touched neither. 323 files are excluded for having fewer than three
commits, which is DX-07's history reset below still doing its work.

**Not yet populated.** The table was added with the rule; the first ticket to run
**TICKET-DX-07 reset every file's churn history**, and the table is blind for roughly six months
because of it: `fallow health --hotspots --since 6m` scores by commit count per *path*, and every
path under `src/` changed in one commit. Nothing was Accelerating at the move, so nothing is owed a
row — but a quiet table between now and ~2027-02 means "the history restarted", not "the churn
stopped". `--follow`-style rename tracking is not something fallow does today.

`fallow health --hotspots` fills it in. An empty table means "not measured", not "nothing is
accelerating" — don't read it as a clean bill of health until a run has written to it.

Snapshot with `fallow health --save-snapshot` and compare with `fallow health --trend` so the
per-metric deltas (`hotspot_count`, `avg_cyclomatic`, `duplication_pct`, …) are measured rather
than recalled.

## Architecture rules: clean, and they cost nothing

`yarn run arch` reports **zero error-level findings** and zero warnings, over 408 modules and 1835
dependencies. That is the baseline: an error-level finding is yours. `no-orphans` reports at
*warning* severity by design and does not fail the build.

**Measured cost of DX-08's nine extra rules: none.** `depcruise src`, three runs each, same tree:

| Rule set | Runs |
|---|---|
| DX-07's 6 rules | 3.65s / 3.60s / 3.95s |
| DX-08's 15 rules | 3.74s / 3.71s / 3.66s |

The difference is inside the run-to-run noise, and the reason is structural rather than lucky: the
graph is built once and every rule is a pass over a graph that already exists. Building it is the
cost; the rules are not. (Those figures include `npx` start-up; through `yarn run arch` the whole
step is ~2.0s.) It runs in `yarn run check`, which the pre-commit hook runs, and the `verifier`
subagent reports it as its fourth numbered step.

**Five exemptions exist and each is recorded in `.dependency-cruiser.mjs` with its reason**, which
is the honest half of "the existing tree produces no error-level finding":

| Exempted | From | Why |
|---|---|---|
| `boundaryFixtures/` | every rule, as a *source* only | They are the modules that prove the rules fire. Exempted as sources rather than excluded, so an import *pointing at* one is still reported |
| `*.test.ts(x)`, `*.fixtures.ts` | `persistence-belongs-to-the-store`, `no-dev-dep-in-production` | Nothing ships a test; a test mocking the storage service or importing `fast-check` is doing the rule's work rather than breaking it |
| `client/components/shared/useAppHydration.ts` | `persistence-belongs-to-the-store` | Imports `isStorageAvailable` (a capability probe run before anything is read) and `StorageSchemaError` (an `instanceof` discriminant). It loads and saves nothing — each of those is a store action it calls |
| `routeTree.gen.ts` ↔ `router.tsx` | `no-circular` | Generated, type-only, erased before anything runs. Visible only because `tsPreCompilationDeps` is on, which the root boundary needs. The file may not be hand-edited |
| `server/testing/` | `queries-belong-to-repositories` | A harness that seeds rows is doing repository work by definition (DX-06). Widened only because `test-harness-stays-in-tests` locks the door from the other side: nothing that answers a real request may import it |

`.fallowrc.jsonc` drops `src/**/boundaryFixtures/**` from fallow's analysis entirely for the
matching reason: every fixture is a deliberate cycle, orphan, undeclared import or devDependency in
shipped code, so fallow is *right* about all of them and every finding is noise. DX-07's
`dynamicallyLoaded` only answered "is it reachable" and left the dependency findings standing.

## Lint and formatting: clean

`yarn run check` reports **no findings at all** as of
[TICKET-DX-02](docs/v1.0_foundation/tickets/TICKET-DX-02-reconcile-biome-with-the-codebase.md).
There is no baseline to subtract any more — anything it reports is yours.

How it got there: `biome.json` was reconciled with the code (space/2, single quotes, `lineWidth`
100, es5 trailing commas), the tree was formatted to match in one mechanical commit, and the 33
real lint errors were fixed rather than suppressed. `.githooks/pre-commit` runs `yarn run check`
on every commit — enable it in a fresh clone with `git config core.hooksPath .githooks`.

Three suppressions exist, each with a stated reason: two in `Dialog.tsx` and `Label.tsx` where a
base primitive cannot see the association the caller owns. No lint rule is disabled in
`biome.json`.
