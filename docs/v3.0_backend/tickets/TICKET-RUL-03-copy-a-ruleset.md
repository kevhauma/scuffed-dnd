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

- [ ] A copy of a real corpus ruleset is deep-equal to the source in every field except `id`, `name`
      and the timestamps, and `revision` is 1.
- [ ] Mutating any nested array or record in the copy leaves the source untouched — asserted by
      walking the document for shared object identity, not by spot-checking three fields.
- [ ] Entity ids are **preserved**, not regenerated, so formulas inside the copy still resolve —
      and a test proves a formula in the copy evaluates to the same number as in the source.
- [ ] Copying a ruleset the Account does not own is refused indistinguishably from a missing id.
- [ ] `copyConfiguration()` lives in the Kernel and is what GAM-01's Snapshot calls — one
      implementation, not two.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check (ask the User first).

## Notes

- **Entity ids are kept rather than regenerated**, which is the interesting decision here.
  Regenerating them would mean rewriting every id-resolved formula reference, every `statValues`
  key, every `statWeights` row and every material modifier — a re-implementation of
  `references.ts` with nothing to gain, since ids only ever have to be unique *within* a document.
- Deep-copying via `structuredClone` is fine and is the shortest correct answer. The reason this is
  a helper rather than an inline call is the fifth criterion: GAM-01 must not reach for its own.
- The name default should be visibly a derivative rather than clever. "Ducklets (copy)" is right;
  silently reusing the name is wrong, because the list is how a User tells them apart.
