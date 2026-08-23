# TICKET-RUL-02 — Server-backed ruleset editing

- **Area:** Rulesets
- **Type:** Feature
- **Traceability:** v3 [Req 33.5–33.8](../requirements.md#requirement-33-ruleset-ownership-and-lifecycle),
  [Req 46.6](../requirements.md#requirement-46-persistence); overview
  [D6](../overview.md#d6--local-mode-stays-sign-in-gates-connected-play-only)

## User story

As a User, I want my ruleset edits saved to my account, so that I can build on my laptop and keep
building on my desktop.

## Description

The largest client-side change in the milestone: `useConfigStore` gains a **second destination**.
Its thirty-odd CRUD actions keep their signatures and keep patching state — what changes is where
the patch is persisted, which follows from which ruleset is open. A local ruleset still goes to
LocalStorage through `saveConfiguration()`, unchanged; an account ruleset goes to the server,
guarded by `revision`.

**LocalStorage is not demoted** (D6). It remains the source of truth for local mode, and a visitor
who never signs in cannot tell this ticket happened.

## Current situation (as-is)

- Every config mutation is a `useConfigStore` action that patches state and calls
  `saveConfiguration()` — the hard rule in [CLAUDE.md](../../../CLAUDE.md) that persistence belongs
  to the store action. That rule is right and stays; only its destination moves.
- Persisted formulas are **id-resolved** at exactly two boundaries,
  [`services/storage.ts`](../../../src/services/storage.ts) and `importExport.ts`
  (TICKET-REF-01). The server is a third boundary of the same kind and must use the same pair.
- `revision` and the compare-and-set update already exist in DB-01's repository.

## Desired result (to-be)

- A save pipeline selected by the open ruleset's home: local → `saveConfiguration()` exactly as
  today; account → debounced `PUT /api/rulesets/:id` carrying the whole document and the base
  `revision`, the server validating shape, gating `schemaVersion` and incrementing `revision`, the
  client adopting what comes back. The store action still owns persistence; only the service beneath
  it branches, in **one** place.
- The server writes the **stored** (id-resolved) form and returns the **display** form, using
  `toStoredConfiguration`/`toDisplayConfiguration` — so the third boundary behaves exactly like the
  other two and a rename stays harmless.
- A refused write is a **conflict surfaced to the User** with what to do about it, never a silent
  overwrite and never a silent loss of their edit.

## Acceptance criteria

- [ ] An edit in one browser is visible in another after reload; the second browser's stale-revision
      write is refused rather than clobbering the first.
- [ ] A refused write leaves the User's in-memory edit intact and shows a conflict surface — a test
      asserts the store state after a 409, not just the response.
- [ ] The server persists id-resolved formulas and returns display-form ones; a round-trip through
      the server leaves a ruleset that renames a stat and re-spells every formula naming it, exactly
      as the LocalStorage path does.
- [ ] A document failing `validateConfigurationShape` persists nothing, and the response names the
      failing fields (CR-03's discipline, applied to the wire).
- [ ] Editing the **local** ruleset persists to LocalStorage and issues no request — asserted with
      the network stubbed to throw, so local mode provably needs no server (D6).
- [ ] Signing in does not alter, move or clear either LocalStorage key, and signing out leaves the
      local ruleset exactly as it was (v3 Req 36.2).
- [ ] Opening an account ruleset never reads the local one and vice versa; a test with divergent
      documents in both homes proves neither shadows the other.
- [ ] Saves are debounced and coalesced: a burst of edits produces one request carrying the last
      state, asserted with a fake timer.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check (ask the User first).

## Notes

- **Sending the whole document per save is a deliberate choice.** A patch protocol would need a
  second representation of every entity and a merge rule, and D4 already decided the document is the
  unit. A `Configuration` with the full corpus in it is tens of kilobytes; debouncing is what makes
  that fine.
- The store's action signatures deliberately do not change. Every panel hook, every dialog and every
  test that calls `addStat`/`updateCurve`/`reorderStats` keeps working, which is what keeps this
  ticket to the save path rather than to thirty call sites.
- Two Owners editing one ruleset is **out of scope** — the revision guard refuses the second write
  rather than merging it, and [overview.md](../overview.md#not-in-this-milestone-deliberately) says
  so. This is the ticket that makes that refusal exist, so the User meets a conflict rather than a
  disappearance.
