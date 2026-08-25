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

- [x] An edit in one browser is visible in another after reload; the second browser's stale-revision
      write is refused rather than clobbering the first.
      (`src/server/routes/rulesets/rulesetEditing.test.ts` → *"refuses a write whose base revision is
      behind, and says what it is now"* (409 `conflict`, `currentRevision: 2` on the body) and
      *"lets the loser succeed once it has re-read the ruleset"*. The *visible in another* half is
      `GET /api/rulesets/:id` — *"hands back the whole document, in display form"*. Confirmed live:
      a second writer was simulated from the browser console, and the open tab's next save came back
      409 with the banner on screen.)
- [x] A refused write leaves the User's in-memory edit intact and shows a conflict surface — a test
      asserts the store state after a 409, not just the response.
      (`src/client/stores/configStore.homes.test.ts` → *"leaves the User's edit in memory when the
      server refuses it, and says so"*: after the 409 the store still holds the renamed ruleset,
      `useUIStore.saveConflict` carries the server's sentence, and `source.revision` is **not**
      advanced, so a retry stays the User's decision. `SaveConflictBanner.test.tsx` covers the
      surface itself. Observed live in the screenshot on this ticket's report: the banner and
      *"Configure your custom game system: Edited in this tab"* on screen together.)
- [x] The server persists id-resolved formulas and returns display-form ones; a round-trip through
      the server leaves a ruleset that renames a stat and re-spells every formula naming it, exactly
      as the LocalStorage path does.
      (`rulesetEditing.test.ts` → *"stores id-resolved references and gives back spelled-out ones"*,
      which asserts the column holds `toStoredConfiguration(display)` and specifically does **not**
      contain `round(SPEED / const.apt_value)`; and *"survives a round-trip well enough for a rename
      to still re-spell every reader"*, which saves, reads back, renames `SPEED` → `ZIP` through the
      same Kernel pair `applyRenameSafely` uses, saves again, and gets
      `max(1, round(ZIP / const.apt_value))` back. **A first draft of that test asserted the wrong
      thing** — that the *server* would re-spell a document whose formula still named the old
      abbreviation. It will not, and should not: resolving-then-renaming is the client's translation
      and the server's job is only to round-trip it losslessly.)
- [x] A document failing `validateConfigurationShape` persists nothing, and the response names the
      failing fields (CR-03's discipline, applied to the wire).
      (`rulesetEditing.test.ts` → *"persists nothing when the document is not a shape the server can
      read"*: 400, `fields` containing the validator's own words about `stats`, and both `data` and
      `revision` unchanged afterwards. `AppError` gained an `ErrorDetails` payload for this — kept
      deliberately narrow to *what the caller must act on*, since what a stack trace would say is
      still never sent.)
- [x] Editing the **local** ruleset persists to LocalStorage and issues no request — asserted with
      the network stubbed to throw, so local mode provably needs no server (D6).
      (`src/client/services/rulesetSync.test.ts` → *"writes LocalStorage and touches no network at
      all"*, and `configStore.homes.test.ts` → *"persists a browser ruleset to LocalStorage and
      issues no request"*, both with `fetch` stubbed to **throw** rather than counted — a path that
      fetched and ignored the answer would satisfy a call-count assertion. Also
      *"lets a storage failure out, exactly as it did before this ticket"*, so CR-11's roll-back is
      still reached.)
- [x] Signing in does not alter, move or clear either LocalStorage key, and signing out leaves the
      local ruleset exactly as it was (v3 Req 36.2).
      (`configStore.homes.test.ts` → *"gives no auth surface a way to touch either LocalStorage
      key"*: a source scan over every module in `components/auth/` plus `/signin` and `/signup`,
      comments stripped, failing on any mention of `localStorage`, `services/storage` or
      `clearAllData` — with a floor assertion so the scan cannot pass by looking at nothing. A
      promise about code that does not exist can only be checked by looking.)
- [x] Opening an account ruleset never reads the local one and vice versa; a test with divergent
      documents in both homes proves neither shadows the other.
      (`configStore.homes.test.ts` → *"opens an account ruleset without reading LocalStorage"*
      (`loadConfiguration` **not called at all**, not merely called correctly) and *"goes back to
      the browser's own ruleset, and the account's does not shadow it"*, with different names in the
      two homes so a wrong read shows as a wrong name. Confirmed live: with the account ruleset open
      and edited, `dnd_builder_config` still read `My Custom Game System`.)
- [x] Saves are debounced and coalesced: a burst of edits produces one request carrying the last
      state, asserted with a fake timer.
      (`rulesetSync.test.ts` → *"coalesces a burst of edits into one request carrying the last
      state"*: three edits, `fetch` not called at all before the timer, one call after it, carrying
      `three`, and every caller resolved. A seventh case covers the related hazard the ticket did
      not name — *"never has two writes in flight for one ruleset at once"*, because two overlapping
      PUTs would race the revision guard against each other and manufacture a conflict the User
      could not act on.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check (ask the User first).
      (See the ticket's report. fallow's findings — unused type exports `SaveOutcomeKind`,
      `SaveConflict`, `LocalSummary` — were all un-exported rather than left, matching
      `StorageFailure`'s module-local precedent. Browser: created an account ruleset, opened it into
      Configuration mode, renamed it and watched `PUT → 200`, then simulated a second writer and
      watched the next save come back 409 with the edit still on screen.
      **`conventions-reviewer` found four defects that tests had not, and all four are fixed:**
      (a) `rulesetSync` captured the base `revision` when an edit was *scheduled*, so an edit made
      while a save was in flight went out one behind and was refused — **a conflict the module
      caused, with nobody else having edited anything**, which is exactly what its
      one-write-in-flight rule claimed to prevent. A `confirmedRevision` map now supplies the base at
      send time, and two tests hold it: the coalescing case asserts the second request's `revision`,
      and *"does not manufacture a conflict out of its own successful save"* drives it end to end.
      (b) A save outcome was adopted onto whatever `source` happened to be by the time it resolved —
      an in-flight request cannot be aborted, so opening a second ruleset first would point it at the
      first one's revision. `SaveOutcome` now carries `rulesetId` and the store checks it.
      (c) **`/rulesets` showed the *account's* ruleset under the heading "This browser"** once one
      had been opened, because the local row read `config`. The store keeps a `localSummary`,
      refreshed in `autoSave` — the one place all thirty CRUD actions already funnel through, so no
      action signature changed. Verified live: open the account ruleset, navigate back client-side,
      and the browser row still reads *My Custom Game System*.
      (d) **A data-loss path**: with an account ruleset open, *Import Configuration* called
      `replaceConfig`, `autoSave` read `source`, and the imported document went out as a `PUT` over
      the Account's ruleset — no upload asked for, and the button says it replaces *this* ruleset.
      `initializeConfig`, `loadConfig`, `replaceConfig` and `discardStoredData` now switch to the
      browser home first, each with a test. Also fixed: a failed *open* raised a banner headed
      *"This Change Was Not Saved"* (now `RULESET_ALERT.LOAD_FAILED`, with its own heading); the
      version gate on a **submitted** body was a 409, which the client reads as *somebody else
      wrote* (now a 400); `ErrorDetails` was `Record<string, unknown>` on the server rather than the
      shared shape, so a typo would have compiled; `RulesetDocument.configuration` was `unknown`,
      forcing an unchecked cast into the config store; and `openLocalRuleset` called
      `loadConfiguration()` unguarded from a `<Link>`'s `onClick`, so a throw left the User in
      Configuration mode editing the Account's ruleset believing it was the browser's.)

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
