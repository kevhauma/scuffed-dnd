# TICKET-IO-04 — Import creates a ruleset; upload this browser's to your account

- **Area:** Import/export and storage
- **Type:** Feature
- **Traceability:** v3 [Req 35](../requirements.md#requirement-35-ruleset-import-and-export),
  [Req 36](../requirements.md#requirement-36-local-mode-and-uploading); overview
  [D6](../overview.md#d6--local-mode-stays-sign-in-gates-connected-play-only)

## User story

As a User, I want import and export to keep working signed out, to **create** a ruleset when I am
signed in rather than replacing one, and to be able to put this browser's ruleset on my account
whenever I decide to.

## Description

Import gains a second meaning without losing its first. Signed out it is exactly what it is today —
replace the browser's one `Configuration`. Signed in it **creates** an account ruleset, which is only
possible now that RUL-01 made those plural. And the upload path is D6's bridge between the two homes:
explicit, repeatable, and a copy rather than a move.

## Current situation (as-is)

- `importConfiguration()` gates on `schemaVersion` (`SchemaVersionError`), then
  `validateConfigurationShape()`, then `engine/validator.ts`'s referential report, and only then
  `replaceConfig` (CR-03). Every one of those steps is right and is reused unchanged, on both paths.
- `RETIRED_FIELDS` refuses a file carrying a field that was removed (TICKET-RES-02) — also reused.
- `downloadStoredBackup()` reads the raw stored bytes for the incompatible-data notice
  (TICKET-IO-03). The upload flow offers the same backup before doing anything.
- `replaceConfig` remains exactly right for local mode and is **not** retired. What it must not
  become is a way to overwrite an *account* ruleset's contents — that is RUL-02's save path.

## Desired result (to-be)

- Signed out: import and export unchanged, end to end, with no request issued and no account
  required (v3 Req 35.0).
- Signed in: `POST /api/rulesets/import` running the same gate → shape check → referential report
  chain server-side, persisting **nothing** on a gate or shape failure, and **creating** a Ruleset —
  returning it with the referential report, which is reported rather than fatal, exactly as in the
  browser.
- An **upload** action — "put this browser's ruleset on my account" — offering a backup download
  first, acting only on an explicit choice, creating one Ruleset plus one Character per stored
  Character, and leaving both LocalStorage keys byte-identical afterwards. Offered once unprompted on
  first sign-in; reachable on demand forever after.

## Acceptance criteria

- [ ] Signed out, import and export work end to end with the network stubbed to throw — local mode
      provably needs no server.
- [ ] Signed in, importing a corpus file creates a new Ruleset and leaves every existing one
      untouched, including the local one; the response carries the created ruleset and the report.
- [ ] A v1 file, a wrong `schemaVersion`, a shape failure and a retired field each produce their
      existing distinct message on **both** paths, and each persists nothing.
- [ ] A referentially broken but structurally valid file **is** created, with its errors reported —
      the v1.0 rule that a repairable ruleset reaches the User, not a refusal.
- [ ] Export → import through the server reproduces an equivalent Ruleset, formulas included; the
      existing round-trip test is extended to the server path rather than duplicated.
- [ ] An upload copies: after it, both LocalStorage keys are byte-identical and the account holds a
      new Ruleset and the claimed Characters (v3 Req 36.5).
- [ ] Uploading twice creates two independent account rulesets rather than erroring or silently
      updating the first — it is a copy each time, and the User is told what already exists.
- [ ] The first-sign-in prompt appears once per Account and never again, while the action stays
      reachable from the ruleset list (v3 Req 36.6).
- [ ] Unsupported stored data meets the existing `IncompatibleDataNotice` rather than a new message,
      and is never uploaded.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check (ask the User first).

## Notes

- **An upload copies rather than moves**, which is the decision to hold on to. Moving would mean
  clearing LocalStorage — destroying the thing that makes local mode work — on an action a User might
  take to *try* having an account. Copying leaves them nothing to regret, at the cost of two
  divergent copies, which the ruleset list makes visible (v3 Req 36.8) rather than reconciling.
- **The "already prompted" flag is per Account and server-side.** Two Accounts on one machine must
  each be asked, and a LocalStorage flag would be cleared by exactly the browser maintenance that
  makes people sign in fresh.
- Uploaded characters land **in no Game_Session** — they were built against a local ruleset, not a
  Snapshot. They belong to the Account and are stated as not being at a table. CHAR-04 decides
  whether one can later be brought into a session; say what is true in the wording rather than
  implying they joined something.
- Resist a "sync" affordance. Two homes with an explicit copy between them is comprehensible; a
  bidirectional sync needs a merge rule for a document this app deliberately treats as atomic (D4).
