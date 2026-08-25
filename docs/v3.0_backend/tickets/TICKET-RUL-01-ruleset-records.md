# TICKET-RUL-01 — Ruleset records: list, create, rename, delete

- **Area:** Rulesets (new area — the server-owned successor to Configuration)
- **Type:** Feature
- **Traceability:** v3 [Req 33](../requirements.md#requirement-33-ruleset-ownership-and-lifecycle);
  v1.0 [Req 1](../../v1.0_foundation/requirements.md#requirement-1-user-configuration-management)

## User story

As a User, I want several named rulesets under my account, so that I can develop more than one game
system instead of exporting and re-importing to keep two.

## Description

The first owned resource, and the template every guard after it copies. It also retires v1.0's
standing decision that the app holds **one** configuration at a time — the plural in v1.0 Req 1 was
about exported files, and it now means what it says.

Editing a ruleset's *contents* is TICKET-RUL-02; this is the record and its lifecycle.

## Current situation (as-is)

- One `Configuration` per browser, in `dnd_builder_config`. `useConfigStore.replaceConfig` is what
  "apply an import" means precisely because there is nowhere to put a second one.
- v1.0 Req 1's decision note (2026-07-30) states the one-configuration rule explicitly. That note
  needs superseding, not deleting.
- AUTH-03 gave us `requireAccount` and `requireOwner`; DB-01 gave us the `ruleset` table and its
  repository.

## Desired result (to-be)

- Routes for list / create / rename / delete under `/api/rulesets`, each behind AUTH-03's guards,
  each returning the record without its `data` document on the list endpoint (a ruleset list should
  not ship fourteen entity arrays per row).
- Create seeds through **`createFreshConfiguration()`** — the same function the browser calls — so a
  server-created ruleset and a browser-created one are indistinguishable. Delete is refused while a
  Game_Session exists from it unless the Owner confirms, and confirming leaves those sessions
  playable on their Snapshots.
- A ruleset list surface at `/rulesets` replacing the app's implicit single configuration as the
  entry point to Configuration mode. It shows **two homes** (D6): *this browser* — the LocalStorage
  ruleset, present and editable signed out — and, when signed in, *your account*. Signed out, the
  page is the local row alone plus a sign-in prompt, never an empty state or a redirect.

## Acceptance criteria

> **Implementation note (2026-08-25), on the fifth criterion.** RUL-01 has no route that *submits* a
> `Configuration` — the create route seeds one and RUL-02 brings the `PUT` that accepts one. The gate
> is therefore built and proven where RUL-01 genuinely meets a document it may not understand: a
> **stored** ruleset whose `schema_version` column this build does not read, met on the rename path,
> which is the state every ruleset lands in the next time `SUPPORTED_SCHEMA_VERSION` is bumped. The
> criterion is ticked against that, and RUL-02's `PUT` reuses the same
> `assertSupportedSchemaVersion` rather than adding a second gate.

- [x] Create, rename, list and delete round-trip through the repository; the list endpoint's payload
      carries no `data` document, asserted on a real corpus ruleset.
      (`src/server/repositories/rulesetRepository.test.ts` → *"the lifecycle a route drives"* — six
      cases covering `listRulesetsByOwner` / `updateRulesetName` / `removeRuleset`, including
      *"lists an owner's rulesets without their documents, on the real corpus"*, which asserts
      `'data' in listed === false`. The route-level half is
      `src/server/routes/rulesets/rulesets.test.ts` → *"carries no document, on a real corpus
      ruleset"*, which first asserts the seeded row's `data` is over 100 KB so the check cannot pass
      on a toy ruleset. The column list is named once, as `SUMMARY_COLUMNS`.)
- [x] A created ruleset equals `createFreshConfiguration()`'s output field for field, including the
      seeded constants, curves and roll definitions — one assertion against the function, not a
      copied literal.
      (`rulesets.test.ts` → *"seeds exactly as createFreshConfiguration does, field for field"*:
      `crypto.randomUUID` and the clock are pinned, the route is called, and the stored document is
      compared with `JSON.parse(serializeConfiguration(createFreshConfiguration('Ducklets')))` —
      the function itself, not a transcription of it. A second case,
      *"arrives with the seeded constants, curves and rolls rather than empty"*, names what would
      go missing. `src/shared/services/freshConfiguration.test.ts` covers the function's own seven
      properties, which had two lines of coverage while it was private to `configStore`.)
- [x] Anonymous, non-owner and owner each get the documented outcome on all four routes
      (Definition of Done rule 2).
      (`rulesets.test.ts` — 401 / 404 / 200 on `PATCH` and `DELETE` in *"refuses anonymous,
      non-owner and owner in the documented three ways"*, and 401-and-nothing-persisted on the two
      collection routes, which name no id and so are scoped by `requireAccount` rather than by
      `requireOwner`. *"answers a ruleset that never existed exactly as it answers a stranger"* is
      v3 Req 32.5 stated as a test. The live 401 was also confirmed in the browser:
      `fetch('/api/rulesets', { credentials: 'omit' })` → `401 unauthenticated`.
      `src/server/routes/routeGuards.test.ts` walks the new `routes/rulesets/` subfolder and finds
      a guard call in each module that reads a `rulesetId` — which is why the four routes are four
      files rather than one.)
- [x] A ruleset with a Game_Session created from it refuses deletion; the same call with the Owner's
      confirmation deletes it and the session remains readable and playable on its Snapshot.
      (`rulesets.test.ts` → *"refuses while a game session was created from it"* (409, the message
      naming *1 game session*, the row still there) and *"deletes on confirmation and leaves the
      session playable on its snapshot"*, which reads the session row back and asserts
      `rulesetId === null` while `JSON.parse(snapshot)` still deep-equals the whole Ducklets corpus.
      `countSessionsFromRuleset` in `gameSessionRepository.ts` is the lookup.)
- [x] A submitted `schemaVersion` other than `SUPPORTED_SCHEMA_VERSION` is refused with the version
      stated, reusing the import path's message rather than a new one.
      (See the implementation note above. `assertSupportedSchemaVersion` was extracted from
      `importConfiguration` in `src/shared/services/importExport.ts`, so there is exactly one copy
      of the sentence; `documentOf` in `routes/rulesets/rulesetPayloads.ts` reuses it and appends
      the version. `rulesets.test.ts` → *"refuses a ruleset stored at another schema version,
      stating it"*: 409 `conflict`, the body containing both *"exported by an older version of the
      app"* and *"schema version 3"*, and the document unchanged afterwards.)
- [x] Signed out, `/rulesets` shows the browser's local ruleset and opens it for editing — no
      redirect, no sign-in wall, no empty state (D6, v3 Req 36.1).
      (`src/client/components/rulesets/RulesetsPanel.test.tsx` → *"shows the browser's ruleset to a
      signed-out visitor, with a way to open it"* (the row plus an `Open` link to `/config`) and
      *"offers a sign-in prompt rather than a wall or an empty state"*. That there is no redirect is
      `protectedRoutes.test.ts`, which enumerates the generated route tree and now lists
      `/rulesets` among the local-mode routes it asserts are open. `useRulesetManager.test.ts` →
      *"issues no request at all while nobody is signed in"*, with `fetch` stubbed to **throw**
      rather than counted. **Browser check note:** the live pass ran signed in, because signing out
      of the dev deployment would have needed a password to get back in; the signed-out branch is
      covered by the three tests above rather than by an eyeball.)
- [x] Every row states which home it lives in, and the two are never mixed into one undifferentiated
      list (v3 Req 36.8).
      (`RulesetCard.tsx` takes `home` as a prop rather than inferring it from which callbacks
      arrived; `RulesetCard.test.tsx` → *"states its home with no actions on it at all"*, which is
      the case a badge rendered beside a button would miss and is exactly the row local mode is made
      of. `RulesetsPanel.test.tsx` → *"names both homes and keeps them apart"* asserts two headings
      and two badges. Observed live at `http://localhost:3000/rulesets`: a **THIS BROWSER** row and
      a **YOUR ACCOUNT** row under separate headings.)
- [x] v1.0 Req 1's one-configuration decision note is superseded in place, pointing at this ticket:
      the *account* holds many, while **this browser still holds exactly one**, which is what keeps
      local mode identical to v2.0. The **data-model** skill's "One `Configuration` per browser" line
      is qualified rather than deleted.
      (`docs/v1.0_foundation/requirements.md` — the 2026-07-30 note keeps its text and gains a
      *"superseded in part (2026-08-25)"* heading and a **What changed** paragraph linking here.
      `.claude/skills/data-model/SKILL.md` now opens that section with *"One `Configuration` per
      browser — **and many per Account**"* and names the shared seeder.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check (ask the User first).
      (Verifier: full suite green, 0 failing / 0 skipped, typecheck at the documented 2-error
      baseline, `yarn run lint` and `yarn run arch` clean — the count is recorded in
      [TEST_STATUS.md](../../../TEST_STATUS.md). fallow: `audit --base main` ends
      *"No issues in 44 changed files"*; its three findings against the first draft were all fixed
      rather than accepted — the `deleteRuleset`/`renameRuleset` duplicate exports (repository
      functions renamed `removeRuleset`/`updateRulesetName`, so no call site aliases an import),
      `useRulesetManager`'s cognitive complexity of 22 (the account half split out into
      `useAccountRulesets.ts`) and `RulesetsPanel`'s 140 lines (`BrowserRulesetHome`,
      `AccountRulesetHome` and `DeleteRulesetConfirmation` extracted, leaving composition).
      Accelerating hotspots this ticket touched are recorded in TEST_STATUS.md. Browser check: the
      User asked for one per ticket — create, rename and delete driven through the UI at
      `/rulesets`, with `GET 200 / POST 200 / PATCH 200 / DELETE 204` in the network log and no
      server-side errors.
      **`conventions-reviewer` found ten things and all ten were acted on**, the four that mattered
      being: the **wire contract was duplicated across the roots** — `ERROR_CODE`, `ErrorBody` and
      the ruleset payload shapes now live in `#shared/types/api`, and the client's
      `const CONFLICT = 'conflict'` is gone in favour of `ERROR_CODE.CONFLICT`, which is the
      no-bare-literals rule doing exactly what it exists for; `ApiError.code` was a bare `string`
      minting two new members inline, now `ApiErrorCode`; `RulesetCard.updatedAt` was
      `string | number` because the two homes store a moment differently, now normalised in
      `useRulesetManager` so the card takes one type; and the delete confirmation was a **card at
      the foot of the page**, which could put the answer off-screen for the top row — now a
      `ui/Dialog`, modal and focus-trapped like every other confirm in the app. The review also
      caught a real user-visible grammar bug — *"1 game session **were** started"* — now a whole
      clause from the helper with a test in each number.)

## Notes

- **Deleting a ruleset must never break a running game**, which is what D7's Snapshot buys and what
  the fourth criterion proves. Without the Snapshot this delete would have to cascade or be refused
  forever; with it, the session simply stops having a source.
- The list-without-`data` rule is not an optimisation. A list endpoint that returns whole documents
  invites a client that renders from the list and then edits the copy it happens to hold, which is
  how RUL-02's revision guard gets bypassed by accident.
- Name uniqueness per Owner is deliberately **not** enforced. Two rulesets called "Ducklets" is the
  User's business; the id is the identity, as everywhere else in this codebase.
