# TICKET-RUL-03 — Copy a ruleset

- **Area:** Rulesets
- **Type:** Feature
- **Traceability:** v3 [Req 34](../requirements.md#requirement-34-ruleset-copying)

## User story

As a User, I want to copy a ruleset, so that I can try a rebalance without risking the one my table
is playing on Thursday.

## Description

Small, and it proves something the rest of the milestone assumes: that a `Configuration` document
survives being duplicated without the two copies sharing anything. GAM-01's Snapshot is the same
operation with a different destination, so getting it right here is worth a ticket.

## Current situation (as-is)

- Copying a ruleset today means export → rename the file → import, which replaces the one
  configuration you had.
- RUL-01 gave us the record and its guards; RUL-02 gave us the save pipeline and the stored/display
  boundary.
- The document contains nested arrays throughout — curve `rows[].values` and `rows[].overridden`,
  `statWeights`, `statValues` records, `dieSizes`. A shallow copy would leave the two rulesets
  sharing them.

## Desired result (to-be)

- `POST /api/rulesets/:id/copy` producing an independent Ruleset owned by the same Account, with a
  new id, `revision` reset to 1, and a default name derived from the original.
- The copy shares **nothing** by reference with the source: a `copyConfiguration()` helper in the
  Kernel, tested structurally, that GAM-01 reuses for the Snapshot.
- A copy action in the ruleset list surface, letting the User name the copy before it is created.

## Acceptance criteria

- [x] A copy of a real corpus ruleset is deep-equal to the source in every field except `id`, `name`
      and the timestamps, and `revision` is 1.
      (`src/shared/services/copyConfiguration.test.ts` → *"is deep-equal to the source except for id,
      name and the timestamps"*, which asserts against `{ ...source, id, name, createdAt, updatedAt }`
      rather than listing what should match — so a field the copy silently drops fails it.
      `revision` is the row's rather than the document's:
      `src/server/routes/rulesets/copyRuleset.test.ts` → *"gives the copy a new id, its own row and
      revision 1"*.)
- [x] Mutating any nested array or record in the copy leaves the source untouched — asserted by
      walking the document for shared object identity, not by spot-checking three fields.
      (`copyConfiguration.test.ts` → *"shares no object with the source, anywhere in the document"*.
      `sharedPaths` walks both documents in step and reports every path at which they hold the
      **same object**; the expectation is that the list is empty. A shallow copy passes every
      spot-check anybody would think to write and shares `curve.rows[].values`, `statWeights`,
      `statValues` and `dieSizes` — so the test is the walk, not the three fields. A second case,
      *"leaves the source untouched when the copy is mutated"*, states the same thing as the
      behaviour a User would meet.)
- [x] Entity ids are **preserved**, not regenerated, so formulas inside the copy still resolve —
      and a test proves a formula in the copy evaluates to the same number as in the source.
      (`copyConfiguration.test.ts` → *"keeps entity ids"* and *"evaluates a formula in the copy to
      the same number as in the source"* — the corpus's one stat formula,
      `max(1, round(SPEED / const.apt_value))`, evaluated through the real engine against both
      documents and asserted to be **2** rather than merely equal, so two identical errors could not
      pass it. Confirmed live too: copying through the UI and re-reading both documents gave
      identical stat ids.)
- [x] Copying a ruleset the Account does not own is refused indistinguishably from a missing id.
      (`copyRuleset.test.ts` → *"refuses anonymous, non-owner and owner in the documented three
      ways"* (401 / 404 / 200, and **no copy left behind** after either refusal) plus *"answers a
      ruleset that never existed exactly as it answers a stranger"*.)
- [x] `copyConfiguration()` lives in the Kernel and is what GAM-01's Snapshot calls — one
      implementation, not two.
      (`src/shared/services/copyConfiguration.ts`. Half of this criterion is a promise about a
      ticket that has not been built: what is done here is that the function exists in `shared/`,
      is the *only* deep copy of a `Configuration` in the tree, and says in its own header that
      GAM-01 must not reach for its own. GAM-01 ticking its Snapshot criterion against this call is
      what will finish it.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check (ask the User first).
      (2370 tests, 0 failing, 0 skipped; typecheck at the documented baseline; `yarn run check` and
      `fallow audit --base main` clean. Browser: **Copy** on an account row opens a *Copy ruleset*
      dialog pre-filled with `Ducklets (copy)`, and confirming produces a second row. The four
      claims were then checked on the wire — different ruleset ids, identical entity ids, the copy
      at `revision` 1, and the source's constants unchanged after editing the copy's.
      **`conventions-reviewer` found one real defect and four wants, all acted on.** The defect was
      mine and was in the *state type*: `{ mode, ruleset?: RulesetSummary }` made *rename with no
      ruleset* representable, and the only answer the code had for that combination was
      **`account.create(name)`** — a ruleset the User never asked for. It is a discriminated union
      now, so the branch is gone rather than decided. Also: `CopyOptions` lost `id` and `now`,
      which only the tests passed (the third-caller rule — GAM-01 is not a caller until it exists);
      `rulesetIdFrom`'s header still said `/api/rulesets/abc/copy` came back empty, which is now
      exactly the path that does not; `RulesetCard.test.tsx` gained the `onCopy` half of its
      action contract, including that Copy is **absent** on the browser row; and the naming dialog
      moved into its own `useRulesetDialog` hook, because fallow put `useRulesetManager` back over
      its cognitive threshold once the third mode landed. One thing was **not** taken: the reviewer
      asked for a `Record` action table to match `DIALOG_WORDS`, and the three arms need
      *differently narrowed* dialogs — a `Record` cannot express that without a cast per arm, which
      is the union's guarantee thrown away to make two files rhyme. An exhaustive `switch` keeps
      the compile-error-on-a-fourth-mode property the table was wanted for, and the module says so.)

## Notes

- **Entity ids are kept rather than regenerated**, which is the interesting decision here.
  Regenerating them would mean rewriting every id-resolved formula reference, every `statValues`
  key, every `statWeights` row and every material modifier — a re-implementation of
  `references.ts` with nothing to gain, since ids only ever have to be unique *within* a document.
- Deep-copying via `structuredClone` is fine and is the shortest correct answer. The reason this is
  a helper rather than an inline call is the fifth criterion: GAM-01 must not reach for its own.
- The name default should be visibly a derivative rather than clever. "Ducklets (copy)" is right;
  silently reusing the name is wrong, because the list is how a User tells them apart.
