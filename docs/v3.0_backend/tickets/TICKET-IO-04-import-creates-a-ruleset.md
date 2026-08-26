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

## Implementation notes (2026-08-26)

**One server route serves both paths, and the second one was never written.** The to-be describes
`POST /api/rulesets/import` and an upload action as two things, and they are two things *on the
client* — where the bytes came from is a fact about the browser. Server-side they are one operation:
gate → shape-check → referential report → create, never overwrite. A second route would have been a
second copy of that chain to keep in step, so the upload posts to the same route with a `characters`
array the file path never sends. Criterion 6 is unchanged by this; only the number of routes is.

**`character.session_id` became nullable, which is a real migration** (`0003_uploaded_characters`).
An uploaded character was built against a *local* ruleset, so no Snapshot exists for it to be at a
table against — the ticket's own notes say so — and inventing a session to hold one would put people
at a game nobody started. The generated SQL is the table recreate the schema file warns about
(`PRAGMA foreign_keys=OFF` is a no-op inside drizzle's transaction), so it ships with a test that
applies it to a 0002 database holding a seated character behind a live foreign key.

**The once-per-Account prompt is claimed, not read.** `POST /api/account/upload-prompt` is an
`INSERT … ON CONFLICT DO NOTHING` whose answer is whether it inserted, so two tabs restoring one
session cannot both be told yes — a `GET` that reported and left the marking to a second request
could. It is deliberately not offered when this browser holds nothing to upload, because spending
the one offer on an empty dialog would mean the Account never gets it.

**`insertUnseatedCharacter` exists partly because of `routeGuards.test.ts`.** That detector is a text
scan over handler modules and flags any that names `sessionId` without calling a resource guard —
which a handler writing `sessionId: null` does. Naming the repository function for the domain state
instead of weakening the detector is the trade: the one thing worse than it flagging this would be it
learning enough exceptions to miss a real one.

### What the `conventions-reviewer` pass changed (2026-08-26)

Eight findings, all reachable, each landing with the test that reproduces it. The two worth reading
are the first and the fourth, because neither was visible from the tests as written:

1. **A failed upload was invisible.** The confirmation stays open over a refusal — correct, the
   decision is still the User's — but the reason was rendered on the page *behind* it, under
   `Dialog`'s `fixed inset-0` blurred overlay with the page scroll locked. *Copying…* flipped back to
   *Copy to my account* and nothing else happened. `UploadToAccountDialog` now carries its own
   refusal, and `RulesetsPanel` renders the page-level one **only while the dialog is closed**.
2. **A stale listing error masked every later one.** `RulesetsPanel` coalesced the two with `??`,
   and `useAccountRulesets` never cleared its error except on a write — so one failed load on page
   open (offline, an expired session) hid every import refusal after it. Two alerts now, and `load`
   clears on success.
3. **The failing fields were thrown away.** The server attaches them to a shape refusal so a client
   can say *which part could not be read*; the client read only `error.message`, which made the
   account path vaguer than the config dashboard's for the same file. `TransferFailure` carries both.
4. **`uploadedCharacterErrors` was the browser's predicate doing an untrusted-boundary job.**
   `isReadableCharacter` is `!== undefined` on two fields — which accepts `null` and accepts a
   scalar — and nothing checked `raceIds`, `inventory` or the timestamps. A `Character` stored that
   way is a `TypeError` for whichever surface reads it first, the server's own re-derivation
   included. The server-facing half now checks every field a reader dereferences; the browser's own
   predicate is unchanged, because the bytes it guards are ones this app wrote.
5. **The ruleset and its roster were not one write.** A failure part-way through the loop left the
   Account holding the ruleset and half the characters while the client was told the whole thing
   failed. `insertRulesetWithCharacters` wraps both in a transaction.
6. **Uploaded characters have no surface and no way out** — recorded on
   [TICKET-CHAR-04](./TICKET-CHAR-04-characters-per-session.md) as a criterion rather than fixed
   here: `removeRuleset` deletes only the ruleset, and the cascade from `game_session` cannot reach
   a row at no table, so uploading and deleting repeatedly accumulates invisible rows. Nothing reads
   them today; the ticket that gives a character a home is the one that owes them a delete.
7. **A 120-character cap refused a file the app itself could have exported.** `nameFrom` is the rule
   for a request *body*; a document's name is data the User already has, and
   `validateConfigurationShape` imposes no cap, so the import path truncates instead.
8. **The file-import path had no busy guard**, so picking twice quickly created two rulesets from one
   intention. It now matches `confirmUpload`, and the button says *Adding…*.

Plus three housekeeping items: `types/index.ts` gained the new `validation` line, `useUploadPrompt`
gained the colocated test it was missing, and `insertCharacter` — a module-private wrapper with one
caller and a `sessionId` no reachable caller could set — collapsed into `insertUnseatedCharacter`.
`useRulesetTransfer` was 96 lines doing four things; the request half is now
[`useAccountImport`](../../../src/client/components/rulesets/useAccountImport.ts).

## Acceptance criteria

- [x] Signed out, import and export work end to end with the network stubbed to throw — local mode
      provably needs no server.
      (`ConfigTransferPanel.test.ts`'s *"exports and imports end to end with the network
      unreachable"* — `fetch` stubbed to **throw**, export reaches `downloadConfiguration`, a file
      import lands in the store, and `fetch` was never called. `useRulesetManager.test.ts`'s *"issues
      no request at all while nobody is signed in"* covers the list page unchanged. Live: signed out,
      `/rulesets` offers only *Start one in this browser* and *Sign in* — no import, no upload.)
- [x] Signed in, importing a corpus file creates a new Ruleset and leaves every existing one
      untouched, including the local one; the response carries the created ruleset and the report.
      (`importRuleset.test.ts` *"leaves every existing ruleset exactly as it was"* reads the
      pre-existing row back and `toEqual`s the whole row; *"names the created ruleset after the
      document, at revision 1"*. Live: importing `broken-ruleset.json` added *Imported From A File*
      beside three untouched rulesets, the browser's included.)
- [x] A v1 file, a wrong `schemaVersion`, a shape failure and a retired field each produce their
      existing distinct message on **both** paths, and each persists nothing.
      (`importRuleset.test.ts`'s four *"the four refusals, each persisting nothing"* cases — each
      asserts the message **and** `allRulesets(database)` is empty. The messages are the browser's
      because `importedDocument` calls the Kernel's own `importParsedConfiguration`, the function
      `importConfiguration` now also calls. Live: a `schemaVersion: 1` file produced *"This file was
      exported by an older version of the app… (That ruleset states schema version 1; this build
      reads version 9.)"* and added nothing.)
- [x] A referentially broken but structurally valid file **is** created, with its errors reported —
      the v1.0 rule that a repairable ruleset reaches the User, not a refusal.
      (`importRuleset.test.ts` *"creates a referentially broken but structurally valid ruleset, and
      says what is wrong"* — 200, one row, `report.isValid` false, the missing ladder named. Live:
      the banner read *"…added to your account. It was kept as it is; the checks below found problems
      to fix."* above *Roll "Melee" uses a dice ladder that does not exist: no-such-ladder*.)
- [x] Export → import through the server reproduces an equivalent Ruleset, formulas included; the
      existing round-trip test is extended to the server path rather than duplicated.
      (`importRuleset.test.ts` *"gives back a ruleset equivalent to the one exported, formulas
      included"* — the Ducklets corpus through `serializeConfiguration`, posted, read back out of the
      `data` column and compared field-for-field against the export minus the three identities an
      import deliberately replaces.)
- [x] An upload copies: after it, both LocalStorage keys are byte-identical and the account holds a
      new Ruleset and the claimed Characters (v3 Req 36.5).
      (`rulesetUpload.test.ts` *"leaves both stored keys byte-identical"* compares the raw strings
      before and after; `importRuleset.test.ts` *"creates one row per stored character, owned by the
      Account and at no table"* and *"points every uploaded character at the ruleset it just
      created"*. Live: after *Copy to my account*, `dnd_builder_config` and `dnd_builder_characters`
      were both `=== ` their captured values, and the banner read *"…and 2 characters added to your
      account"*.)
- [x] Uploading twice creates two independent account rulesets rather than erroring or silently
      updating the first — it is a copy each time, and the User is told what already exists.
      (`importRuleset.test.ts` *"makes the same file twice into two independent rulesets"* — two
      200s, different ids, two rows, and neither id is the one the file carried. Live: two
      *My Custom Game System* rows under *Your account*, each with its own timestamp, beside the
      browser's own.)
- [x] The first-sign-in prompt appears once per Account and never again, while the action stays
      reachable from the ruleset list (v3 Req 36.6).
      (`uploadPrompt.test.ts` — *"never offers it again to that Account"*, *"asks each Account on the
      same machine separately"*, and *"hands the offer to exactly one of two calls made at once"*,
      which is the case a read-then-write would fail. `useRulesetTransfer.test.ts` *"does not spend
      the one prompt on a browser holding nothing"*. Live: the dialog opened unprompted on first
      sign-in, and did not reappear on reload while *Copy to my account* stayed on the row.)
- [x] Unsupported stored data meets the existing `IncompatibleDataNotice` rather than a new message,
      and is never uploaded.
      (`rulesetUpload.test.ts` *"refuses stored data this build cannot read rather than uploading
      it"* — `readBrowserUpload` throws the **same** `StorageSchemaError` the notice is built around,
      because it reads through `loadConfiguration`/`loadCharacters` rather than off the keys. No new
      message exists to test; `useAppHydration` renders the notice instead of the app, so the upload
      affordance is unreachable in that state.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check (ask the User first).
      (`npx vitest run` 2474 passed / 0 failed / 0 skipped; `npx tsc --noEmit` at the documented
      2-error baseline; `yarn run check` clean **and `yarn run lint --max-diagnostics=1000` reporting
      nothing** — the `verifier` found four info-severity diagnostics that `check` exits 0 on, now
      recorded in TEST_STATUS.md as a limit of the gate; `fallow audit --base main` verdict **pass**
      with 0 introduced dead code, complexity or duplication. Everything it *did* find was removed
      rather than suppressed: an unused `insertCharacter` export, two unread type re-exports, an
      unused `failureOf`, and an `inventoryErrors` over the complexity threshold.
      `conventions-reviewer` found eight defects, every one fixed with the test that reproduces it —
      see the section above. Browser check run at the User's request against `yarn dev`, evidence in
      the criteria above, plus a re-check of the refused path afterwards: the reason now renders
      **inside** the dialog with the failing field named, and `GET /api/rulesets` still answered 3.)

      One thing the browser check surfaced that is **not** this ticket's: `/rulesets` logs a React
      hydration mismatch. Reproduced on `main` with this work stashed, so it predates IO-04 and is
      left for a ticket of its own rather than quietly fixed here.

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
