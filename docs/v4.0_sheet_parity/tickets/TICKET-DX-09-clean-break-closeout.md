# TICKET-DX-09 — The clean break, proven complete

- **Area:** Developer experience / milestone closeout
- **Type:** Feature (verification closeout)
- **Traceability:** System [01 · Sheet source and capture](../systems/01-sheet-source-and-capture.md);
  overview [D6](../overview.md#d6--no-backwards-compatibility-v40-is-a-clean-break-user-2026-08-29)
  / [D7](../overview.md#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29).
  **Last of the shape pass — needs every other v4.0 ticket.**

> **Scope (overview [D7](../overview.md#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29)):**
> the corpus audit and the golden suite move to the data pass, because the numbers they pin are the
> numbers that pass lands. What that pass owes this milestone, when it closes: every v4-touched
> fragment citing the new workbook with a post-2026-08-28 `exportedAt` and its ranges (typos and
> truncations intact); a README naming the fragments deliberately *not* brought forward; and a
> golden suite on **Thomas the test more** — races Ducklets + Ducklets, archetype Science, focus
> Arcane/Summening/Arcane, level 1, Dream level 1 — pinning the race blend, the composed-gear
> arithmetic, the final stats, all four roll decompositions including the fractional
> Endurance 22.4, the archetype residue, the points readout and the resolved spell effects, with
> **duo-skill levels pinned from the corrected arithmetic** and each divergence citing its note.

## User story

As a developer, I want the old shape to be genuinely gone — one version bump, one honest error
path, a green suite — so v4.0 closes as a milestone rather than trailing half-migrated data behind
it.

## Description

The shape pass's closeout. Every reshaping ticket in this milestone claimed the D6 break; this one
proves the claim as a whole: the version rose exactly once, an old-shape file meets
`IncompatibleDataNotice` with its backup offer rather than a shape error, no conversion code was
smuggled in, and the documentation the milestone invalidated has moved.

## Current situation (as-is)

- [sheetImport.test.ts](../../../src/shared/services/sheetImport.test.ts) asserts the corpus
  regenerates and imports clean — the test that will fail loudest if a reshape left the corpus
  behind, and the reason the data pass has a safety net waiting for it.
- `RETIRED_FIELDS` in [importExport.ts](../../../src/shared/services/importExport.ts) turns a
  retired key into a sentence naming its replacement; several v4.0 tickets add entries.
- The golden pattern exists — [golden/fixtures.ts](../../../src/shared/engine/golden/fixtures.ts)
  and its [README](../../../src/shared/engine/golden/README.md) (TICKET-DX-04) pin v2.0's sheet
  arithmetic. It stays green through this milestone or its divergences are recorded, whichever the
  reshapes actually did.

## Desired result (to-be)

- **One bump, provable**: `SUPPORTED_SCHEMA_VERSION` moved exactly once across the milestone, with
  the git history recorded here.
- **The old shape errors honestly**: a v3-shape ruleset and a v3-shape character each meet
  `IncompatibleDataNotice` with a backup offer, and every retired key produces its sentence — not a
  shape error, not a silent drop. Asserted, not assumed.
- **No conversion code exists** anywhere in the tree (D6): no dual-read, no key adapter, no
  "if old shape" branch — a review pass plus a grep, recorded.
- **The docs the milestone invalidated have moved**: [TEST_STATUS.md](../../../TEST_STATUS.md)'s
  counts, the `data-model` skill's stored shapes and sanctioned-exceptions list, and
  [CLAUDE.md](../../../CLAUDE.md) where a hard rule changed.

## Acceptance criteria

- [x] `SUPPORTED_SCHEMA_VERSION` moved exactly once across the milestone — git history check
      recorded in the ticket. (`git log --format="%h %s" -L 15,15:src/shared/types/config.ts`: the
      only change inside v4.0 is `b0a0ad1 TICKET-INV-05`, `9 → 10`; the one before it is
      `2206017 TICKET-ROLL-06`, a v2.0 commit. Nothing was raised here. Full output in the Closeout
      record below.)
- [x] An old-shape ruleset and an old-shape character each meet `IncompatibleDataNotice` with the
      backup offer; every `RETIRED_FIELDS` entry added this milestone renders its sentence —
      one test per entry. (New `src/client/integration/cleanBreak.test.tsx`, 6 cases, nothing
      mocked: *meets the notice with its backup offer rather than a shape error*, *loads nothing and
      deletes nothing*, *hands the stored bytes back exactly as they are*, the character-side pair,
      and the current-shape negative. Confirmed live in the browser — see the Closeout record.
      The one retirement this milestone added is the items entity's fused `materialId`/`materialLevel`
      pair, covered per field by the five cases in
      `src/shared/services/importExport.items.test.ts`'s *a field retired from an entity* block.)
- [x] No conversion path exists: a grep for old keys outside `RETIRED_FIELDS` and the fragments is
      empty, and the review says so explicitly. (Six greps recorded in the Closeout record; every
      hit is prose, a comment, or a fixture asserting the refusal. **One real conversion path was
      found and deleted**: `purseFromStoredWallet` + `characterStore.adoptStoredWallets` +
      `useAppHydration`'s migration block — see the record for the reachability argument.
      `ensureReferenceIds` was examined and deliberately kept, with its JSDoc corrected.)
- [x] The existing golden suite (TICKET-DX-04) is green, or every divergence it now has is
      recorded with the ticket that caused it — a silently-updated golden is a bug. (Green — the
      whole suite passes. Three v4.0 commits touched the goldens and the audit is in the Closeout
      record; the two whose record was missing from `src/shared/engine/golden/README.md` are written
      in now as settlement 5 and a paragraph on settlement 1. **No fixture value was edited.**)
- [x] `yarn run sheet:import` regenerates byte-identically from the checked-in fragments
      (`git status` clean after a run), and the corpus still imports clean at the new shape.
      (Ran it; `docs/imports/ducklets.json` does not appear in `git status --porcelain`.
      `npx vitest run src/shared/services/sheetImport.test.ts` passes. Under D7 no fragment was
      re-sourced, and that test's header now says so.)
- [x] [TEST_STATUS.md](../../../TEST_STATUS.md), the `data-model` skill and CLAUDE.md name what
      this milestone changed — including that D7 suspended the sheet-data rule and when it returns.
      (TEST_STATUS: new count-setter at 3715 with the −1 explained, plus **five** hotspot rows —
      `characterStore.ts`, `importExport.ts`, `references.ts`, `characterStore.test.ts` and
      `useAppHydration.test.tsx`, the last two added by the review on this diff's own standard that
      the rule is *over every touched file rather than every meaningful one*.
      `data-model`: the deleted wallet conversion, the one-bump proof, and the D7 suspension on the
      corpus rule. CLAUDE.md: D7's suspension with what still binds and when the rule returns.
      Full Step 6.5 walk in the Closeout record.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser pass over a character built on the new shapes (ask the User
      first). (**The four verifier commands were run directly rather than through the subagent** —
      this ticket was itself built by the `work-ticket` subagent, which is the leaf and does not
      spawn: `npx vitest run` **3715/3715, 0 failing, 0 skipped, 224 files, five consecutive clean
      runs** (see the review pass below — the fifth was needed); `npx tsc --noEmit` at
      the documented **2-error** baseline, unchanged; `yarn run lint --max-diagnostics=1000` clean;
      `yarn run check` clean, including `depcruise` at 0 violations over 768 modules.
      `fallow audit --base main` verdict **pass** over 22 changed files: `dead_code_introduced: 0`,
      `complexity_introduced: 0`, `duplication_introduced: 0` — the one inherited dead-code finding
      is the `fallow` dependency itself. `coding-conventions` was loaded and followed, and its
      *Testing* section is one of the things this ticket writes. The `conventions-reviewer` pass on
      the diff is the caller's, before the commit. The User authorized the browser pass up front and
      it ran in full — evidence in the Closeout record.)

## Notes

- **The milestone closes twice**: here for the shapes, and again when the data pass lands the
  corpus and the goldens. Say so when closing this ticket — "v4.0 shape pass complete" is the
  honest sentence, not "v4.0 complete".
- The two questions the sheet has never answered — the `point_buy` anomalies and the missing XP
  table — remain open and remain the User's.
- If any earlier ticket left a capture caveat (the ladder's `.5` rounding, the tail
  reconciliation), this is where the recorded answer is checked against the xlsx one last time
  before the data pass pins anything on it.
- ~~**Settle whether the no-nested-calls rule applies to test assertion arguments**~~
  **Settled by the User, 2026-09-01: keep the rule whole. Tests are in scope, and a matcher's
  argument counts too.** Written into the `coding-conventions` skill's *Testing* section (with the
  two non-nestings restated, so `expect(() => …).toThrow()` and `vi.mocked(…)` are visibly
  untouched) and mirrored in one sentence on CLAUDE.md's hard rule. The existing sites are swept in
  **one mechanical change under [TICKET-DX-10](./TICKET-DX-10-assertions-bind-their-subject.md)**,
  never opportunistically per ticket; until it lands, new test code follows the rule and old code is
  left alone. Measured for that ticket rather than estimated: **3,016 nested subjects across 208
  files** and **61 nested matcher arguments across 34 files**, with both commands recorded on it.
  DX-10 sits in its own section of [`overview.md`](../overview.md) after the D7-deferred block —
  it is neither a shape line nor a data line and depends on nothing, so the shape pass's build order
  still ends here.

## Closeout record

### AC 1 — the version moved once

```
$ git log --format="%h %s" -L 15,15:src/shared/types/config.ts
b0a0ad1 TICKET-INV-05 Composed items: the record and the engine
-export const SUPPORTED_SCHEMA_VERSION = 9;
+export const SUPPORTED_SCHEMA_VERSION = 10;
2206017 TICKET-ROLL-06 Sheet rolls the definitions; combat skills removed
-export const SUPPORTED_SCHEMA_VERSION = 8;
+export const SUPPORTED_SCHEMA_VERSION = 9;
```

One change inside v4.0, and the previous one is two milestones back. D6's *one bump, not fifteen*
held for fifteen tickets — INV-06 deleted `Inventory.miscItems` under the same 10, which is the rule
working rather than an exception to it.

### AC 3 — the conversion-path review

Greps run from the repository root over `src/`, `*.ts` and `*.tsx`:

| Key | Hits | Reading |
|---|---|---|
| `miscItems` | 15 | All prose, comments, or fixtures asserting it is *ignored* (INV-06). No code reads it. |
| `wear-item` / `stow-item` | 5 | All comments recording the retirement, in `api.ts` and the two route modules that replaced them. |
| `MAX_RACE_COUNT` | 4 | Comments plus `races.test.ts`'s guard, which **fails if the constant comes back**. |
| `wallet` | 6 | Prose defending the `purse` decision, plus one fixture proving a stray key is inert. No code branches on it. |
| `Item.materialId` / `materialLevel` | 0 | The `Item` type carries neither; every hit belongs to `ComposedItem` or `Material`. |
| `migrat` / `legacy` / `backwards.?compat` / `old shape` | 0 relevant | Everything matching is SQL migrations, test-harness prose, or `LEGACY_CODE_SCOPES` — see below. |

**One real conversion path existed and is deleted.** `purseFromStoredWallet` (CUR-02) read a retired
per-tier `wallet` off a stored character and rewrote it as a base-tier `purse`;
`characterStore.adoptStoredWallets` called it and `useAppHydration` fired it after every successful
load. It could not run:

- `isReadableCharacter` has required `inventory.composedItems` since TICKET-INV-05, and a character
  old enough to carry a `wallet` predates that field — so the roster is refused before the adapter
  is reached;
- its ruleset is refused a step earlier anyway, because `loadConfiguration` gates on
  `schemaVersion === 10`;
- and the **server path never called it at all** — `uploadedCharacterErrors` applies the same
  `composedItems` requirement, and `adoptStoredWallets` only ever ran on LocalStorage hydration.

Deleted rather than kept behind a footnote, which is what D6's *no conversion code* means. The
requirement it implemented, **v3 Req 43.6**, is amended in place in
[v3.0's requirements.md](../../v3.0_backend/requirements.md) — a requirement change outranks a
ticket, and shipping code that contradicts a `SHALL` would have been the worse outcome.

**Two things were examined and deliberately kept**, both recorded so the next reader does not
re-open them:

- **`ensureReferenceIds`** (`shared/engine/formula/references.ts`) mints an `id` for an entity that
  has none. Its JSDoc justified itself by *files predating TICKET-REF-01*, which the version gate has
  made unreachable — so the comment was corrected rather than the function deleted. The live reason
  is **import leniency about an authored document**: a hand-written or generated ruleset may omit
  ids, which is why `ENTITY_SPECS` does not require one. It branches on no retired key and reads no
  superseded shape.
- **`LEGACY_CODE_SCOPES`** (`shared/engine/formula/scoping.ts`) is not compatibility code despite the
  name: it is the current rule that a formula may name a stat by its bare abbreviation (`STR * 10`),
  which is what the source sheet's own formulas look like. Renaming it is out of scope here.

### AC 4 — the golden audit

`git log d651b42^..HEAD -- src/shared/engine/golden/ src/client/integration/golden.test.ts` returns
three commits:

| Ticket | What moved | Was it recorded? |
|---|---|---|
| `5e3c119` ARC-04 | fixtures + `golden.test.ts` + README | **Yes** — settlement 4, written at the time. |
| `5a720b5` SKL-04 | **eight expected values**, each re-cited to `V4_SKILL_ROUNDING` | Recorded at length in `fixtures.ts`, **but not in the README**, whose settlement 2 still quoted the superseded `13.2 / bonus 3`. Fixed here: **settlement 5** added, settlement 2's numbers corrected. |
| `18a94f1` RACE-04 | the harness only — the sample character carries its race twice | Recorded inline, not in the README. Fixed here as a paragraph under settlement 1. **No expected value moved**, because a blend of one block with itself is that block. |

The rule the file states — *a failing fixture is never fixed by editing the fixture; change the
fixture and its citation together* — was honoured by SKL-04 in the code. What had gone stale was the
README's index of settlements, and **no fixture value was touched by this ticket**.

### AC 7 — the live browser pass

Driven against `.claude/launch.json`'s `dev` entry. Run on the **`http://[::1]:3000`** origin (the
`dev-second-account` entry), because LocalStorage is per-origin and that keeps the User's own
`localhost` ruleset untouched — the same trick GAM-03 used for two accounts, applied to sandboxing.
Seeded with `examples/demo-ruleset.json`, then an inlay, a spell and a passive were **built through
the real panels**.

| What | Observed |
|---|---|
| Spell effect preview (SPL-03, FORM-08) | `Deals {STR * 2} fire damage at range.` previewed live as *"Deals 20 fire damage at range."* against the editable `STR 10` sample, beneath the field. |
| Shared point pool (RES-05) | 2 points into a stat + 1 into a skill read **3/3 POINTS SPENT · 0 POINTS TO USE** — one budget, both sides. |
| Composed item built (INV-06) | Backpack read **"Battle Metal 3 Longsword with Ruby 1 inlay"** — the phrase rebuilt from the links, no stored name. |
| Worn (INV-05) | STR 2 → **13** (`equipment +11`), Health 14 → 36, Melee input 3 → 16.5 and its ladder re-decomposed to `1D12 + 5`. **Backpack then read "Nothing built and unworn"** — derived, not stored. |
| Spell cast (SPL-02) | Learned Emberbolt; its effect resolved to *"Deals 26 fire damage at range."* against the **equipped** STR of 13. Cast from the Player-named Mana pool: 8 → 4 → 0. |
| Unaffordable cast refused | *"Emberbolt costs 4 and Mana is at 0 — 4 short. Nothing was spent."* |
| Passive handed out (PAS-01) | Embersense granted; `{STR * 5}` resolved to *"You sense heat out to 65 feet."* |
| **Old-shape ruleset (this ticket)** | Stored `schemaVersion` set to 9 → **"Saved Data Cannot Be Opened … it has not been loaded — and nothing has been deleted"**, with **Download backup** and **Start fresh**. Both keys byte-identical afterwards (9,670 and 797 bytes), character still named. |
| **Old-shape character (this ticket)** | `inventory.composedItems` removed beside a current ruleset → **"This browser holds 1 of 1 saved character in a shape this version of the app cannot read"**, same two options, nothing deleted. |

### The `conventions-reviewer` pass, and the one thing it uncovered

Nine findings, all fixed. Three are worth carrying forward rather than just closing:

1. **The new test file broke the rule this ticket settled.** `cleanBreak.test.tsx` seeded storage
   with `localStorage.setItem(KEY, JSON.stringify(config))` — a nested call in *arrangement*, in the
   flagship file of the ticket that wrote the rule. Fixed with a `seedStorage(config, characters)`
   helper that binds the bytes. **The rule now reads the same in all three places it is stated**:
   whole-rule scope in CLAUDE.md and the `coding-conventions` skill, with TICKET-DX-10 sweeping the
   *assertion* forms and converting arrangement sites in any file it opens, and one shared
   three-item non-nesting list instead of two lists of different lengths.
2. **The prose sweep was half done.** Correcting two *"a file predating TICKET-REF-01"*
   justifications left four more in `importExport.ts`, one in `rulesetPayloads.ts`, one in
   `references.ts` and one in `characterShape.ts` — all the same dead reason, all now stating the
   live one (a collection is optional because a ruleset need not define it; an id may be missing
   because a *hand-authored* file omitted it). Half a sweep reads as complete to the next grep, which
   is the same failure the `REFERENCE_TARGET_KIND` conversion recorded one ticket earlier.
3. **An intermittent `Errors 1 error` on the full run, with no test attached** — two runs in five.
   The file was clean in isolation six times and `main` clean four times, which placed it: the backup
   download's anchor click starts a happy-dom navigation that settles *after* its own test, in
   whichever file the worker runs next. Neutralised the way `configFiles.test.ts` already did it, and
   the reasoning is in TEST_STATUS.md. **A green suite with a non-zero `Errors` count is not noise.**

Two observations, neither a regression and neither caused by this ticket:

- **The empty-state route flashes before the notice.** Hydration is an effect, so a route renders
  once before `incompatibleData` is set and the refusal replaces it. Pre-existing, and the reason the
  new test uses `findByText` rather than a synchronous read.
- **A React `removeChild` `NotFoundError` on the `<link>` component** appears once at start-up in
  dev, on a page this ticket cannot affect (it touches no route, no `__root.tsx` and no CSS —
  `git diff --name-only` confirms), and does not appear on the second origin. Recorded, not chased.
