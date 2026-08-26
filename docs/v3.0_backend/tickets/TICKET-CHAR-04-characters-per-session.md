# TICKET-CHAR-04 — Characters are created per session

- **Area:** Characters, sheet, creation
- **Type:** Feature
- **Traceability:** v3 [Req 40](../requirements.md#requirement-40-characters-within-a-game-session);
  v1.0 [Req 11](../../v1.0_foundation/requirements.md#requirement-11-character-creation)

## User story

As a Player, I want to create my character inside the session I am playing, so that it is built on
that table's rules and my DM can see it.

## Description

A character gains a **second home**, mirroring what RUL-02 did for rulesets. A *local* character
still lives in `dnd_builder_characters` against the browser's `Configuration` and works signed out
([D6](../overview.md#d6--local-mode-stays-sign-in-gates-connected-play-only)); a *session*
character is a server row scoped to a Game_Session and built against its Snapshot.

The four-step creation wizard is **kept and shared**. It runs against whichever ruleset is open —
the local `Configuration` or the session's Snapshot — and its submit either calls `createCharacter`
as it does today or posts to the server. One wizard, two destinations.

## Current situation (as-is)

- `useCharacterStore` holds `Character[]` in `dnd_builder_characters`, and `createCharacter(data,
  config)` seeds `currentResourceValues` to the calculated maxima — the one place a derived number is
  written onto a `Character`, and player state from then on.
- A `Character` carries `configurationId` so it is read against the ruleset it was built on. That
  field's meaning changes here: it becomes the *session*, and the ruleset is the Snapshot.
- The wizard (`components/play/creation/`) is four pure step components over `useCharacterCreation`,
  with all state, validation and submit in the hook — so the submit is one function to change.
- IO-04's upload can produce Characters attached to an account Ruleset and no session. This ticket
  decides what those are.

  **IO-04 shipped them and left them with no surface, which its review flagged and this ticket
  owns.** As of IO-04, `POST /api/rulesets/import` writes `character` rows with `session_id IS NULL`
  and `data.configurationId` pointing at the ruleset it created. There is **no route that lists or
  deletes a character**, and `removeRuleset` deletes only the ruleset — the `ON DELETE cascade` from
  `game_session` can never fire for a row that is at no table. So an Account that uploads a roster
  and then deletes the ruleset keeps the character rows permanently, invisible to every surface and
  pointing at an id that no longer resolves. Nothing is *broken* by that today — no read path reaches
  them — but they accumulate, and the fix belongs with the ticket that gives a character a home.

## Desired result (to-be)

- `character` rows scoped to a Game_Session and owned by an Account, created and read through routes
  behind AUTH-03's guards: every Member reads every character in the session, each writes only their
  own.
- Creation validated **server-side against the Snapshot** with the same Kernel calls the wizard
  makes, and a submitted character carrying any derived value — a stat value, a level, a budget — is
  rejected rather than ignored (Definition of Done rule 3).
- The wizard runs against the open ruleset — local `Configuration` or session Snapshot — and submits
  to the matching destination. `useCharacterStore` keeps owning local characters and additionally
  caches a session's; the branch is in one place, as RUL-02's is.

## Acceptance criteria

- [x] A Player creates a character in a session; the DM and every other Member can read it, and no
      other Account can. (`POST` / `GET /api/sessions/:id/characters` →
      [createCharacter.ts](../../../src/server/routes/sessions/createCharacter.ts),
      [listCharacters.ts](../../../src/server/routes/sessions/listCharacters.ts), both behind
      `requireMember`. `characters.test.ts` — *should be open to every Member and to nobody else*
      (which also asserts the **DM** may create one: a DM plays too) and *should show every Member
      all of them, and nobody else any*.)
- [x] A non-member's creation attempt is refused, indistinguishably from a missing session.
      (`characters.test.ts` — the same case sends an identically-shaped request to a real session as
      a stranger and to `no-such-session`, and asserts both are 404.)
- [x] A submitted body carrying `statValues`, `level`, `statTotal` or a roll result is rejected with
      the offending field named — not silently stripped. (`creationDataFrom` in
      [characterPayloads.ts](../../../src/server/routes/characters/characterPayloads.ts).
      `characters.test.ts` — *should reject %s by name rather than stripping it*, run over **seven**
      fields separately, because one case sending all of them would pass against an implementation
      that caught only the first. `currentResourceValues` and `experience` are on the list too: a
      *fresh* character's are seeded and zero by definition. A companion case sends a field that is
      not a derived value and asserts it is **ignored**, so the rule cannot drift into *reject
      anything unexpected*.)
- [x] Server-side creation applies the same rules the wizard does: race cardinality (`MAX_RACE_COUNT`),
      the archetype requirement when the Snapshot defines archetypes, and `validateStatAllocation`'s
      affordability refusal — each asserted by a rejected request, not by reading the code.
      (`characterCreationErrors` in
      [characterCreation.ts](../../../src/shared/services/characterCreation.ts) — the Kernel's, so
      there is one copy. `characters.test.ts`'s *the Kernel's own rules, applied server-side* block:
      four rejected requests against the real Ducklets corpus, each first asserting the corpus
      really has the thing being tested — three races to over-blend with, archetypes to require —
      so none of them can pass by having nothing to check.)
- [x] `currentResourceValues` is seeded from the Snapshot's calculated maxima at creation, exactly as
      `createCharacter` does today, and only for `isResource` stats. (`buildCharacter` is now the
      **only** implementation: `characterStore.createCharacter` calls it, and so does the route.
      `characters.test.ts` — *should seed every resource stat to its maximum, and nothing else*,
      which asserts every seeded key is a resource **and** that each value equals what
      `calculateCharacter` produces for that character against that Snapshot.)
- [x] Signed out, the wizard and the sheet work end to end against the local `Configuration` with
      the network stubbed to throw — creating and playing a character needs no account (v3 Req 40.0).
      (`integration.test.ts`'s *local mode, with the network unavailable* block, with nothing mocked
      underneath and `fetch` replaced by something that **throws** rather than a stub returning an
      error — a stub a `catch` could swallow into a plausible-looking success. Creates, reads the
      sheet through the calculator, and survives a reload. The existing `characterStore` and wizard
      tests also pass **unchanged**, which is the milestone's own cheapest proof.)
- [x] An uploaded character from IO-04 that belongs to no session is readable by its owner and is
      stated as not being at a table — it is not silently invisible.
      (`GET /api/characters` →
      [listMyCharacters.ts](../../../src/server/routes/characters/listMyCharacters.ts), scoped by
      the caller, **and a surface that renders it**:
      [UnseatedCharacters.tsx](../../../src/client/components/rulesets/UnseatedCharacters.tsx) under
      the account home on `/rulesets`, absent rather than empty when there are none. The criterion is
      worded in User terms and the first pass shipped the route only — the review caught that.
      `characters.test.ts` — *should be readable by their owner and by nobody else*, which asserts
      `sessionId` is null and `rulesetId` is not, and *should leave a character that is at a table
      out of that list*; `UnseatedCharacters.test.tsx` — *says in words that they are in no game*.)
- [x] An uploaded character can be **removed**, and deleting the ruleset it was uploaded with does
      not leave it behind. (Closed the **structural** way: `character.ruleset_id` with
      `ON DELETE CASCADE`, migration `0005_uploaded_character_ruleset`, backfilled from
      `data.configurationId`. The SQL is hand-written because `drizzle-kit` emits the `ALTER TABLE`
      **without** the cascade — a column that reads correctly in `schema.ts` and does nothing in the
      database — and `migrate.test.ts` deletes a ruleset and counts what is left, which is the test
      this criterion asks for. `DELETE /api/characters/:id` removes one directly, reached from the
      panel above, and refuses a character at a table with a 409 that says where it lives.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check (ask the User first).

      `npx vitest run` **2827 passed / 0 failed / 0 skipped**; `npx tsc --noEmit` at the documented
      2-error baseline; `yarn run check` clean. The `conventions-reviewer` subagent reviewed the diff
      with `fallow` folded in, and **its three P1s are fixed** — see *Found by the review* below.

      **Verified live at `localhost:3000`**, signed in as one account, on a table it runs:
      *Characters at this table* renders under the lobby with its lead about the pinned copy of the
      rules; *Make a character here* opens that table's Snapshot and lands on the same four-step
      wizard (which reports *This ruleset defines no races* — the Snapshot's own answer, not the
      browser ruleset's); creating posts to `POST /api/sessions/:id/characters` (200) and returns to
      the games list; and re-opening the row shows **Yours — Quackers**, with the lobby's own
      characters line naming it too. Re-checked after the review's refactors. No console errors.

      **One live path could not be reached with this machine's data**: the *Characters at no table*
      panel needs an uploaded character, and uploading this browser's roster is refused by IO-04's
      own shape check — *characters[0].investedStatPoints must be an object of finite numbers keyed
      by stat id*, a v1-shaped character in the dev database. That refusal is IO-04 working, not a
      defect here; the panel is correctly **absent** with nothing to show, and its rendering, its
      wording and its delete are covered by `UnseatedCharacters.test.tsx`.

## Notes

- **Point `seedCharacter` at this ticket's repository when it lands** (TICKET-DX-06).
  `src/server/testing/seeds.ts` writes the `character` table with raw Drizzle and defaults `data`
  to `'{}'`, because nothing had yet decided what a session character's player state is. This
  ticket decides it, and is where the fixture stops guessing.
- **`configurationId` keeps its meaning and gains a sibling.** A local character still names the
  `Configuration` it was built on; a session character needs the Game_Session. Add
  `gameSessionId?` rather than overloading the existing field — a field called `configurationId`
  holding a session id reads correctly for a year and then costs a day. Exactly one of the two is
  present, and which one is what tells the app where the character lives. That is an additive
  optional field, so by ARC-01's refinement of RACE-01's rule it needs **no**
  `SUPPORTED_SCHEMA_VERSION` bump — state that reasoning in the implementation notes either way,
  since the next person will ask.
- The wizard's steps do not change. If a step component needs editing to run against the Snapshot,
  something has leaked out of `useCharacterCreation` and that is the bug to fix.
- Character *deletion* is not in this ticket, deliberately. GAM-04 already decided a departing
  player's characters are retained; who may delete one, and whether the Event log tolerates it, is a
  question worth its own ticket rather than a paragraph here.

### Decided while building

- **`configurationId` kept its meaning and gained no sibling.** The Notes proposed a
  `gameSessionId?` on `Character` for a session character. It is not there: `configurationId` names
  *the ruleset this character is read against*, and for a session character that ruleset **is** the
  session's Snapshot — which is reached by the session's id, so the field already holds it. A second
  optional field would have been a second answer to *where does this character live* that the two
  could disagree about, and the thing that actually needed recording was the **uploaded** case,
  which got a real `ruleset_id` column. No `SUPPORTED_SCHEMA_VERSION` bump either way: nothing about
  the persisted document changed.
- **`characterCreationErrors` is the wizard's and the server's rule set, not the store's.** Pointing
  `characterStore.createCharacter` at it made two existing local-mode tests fail — it is stricter
  than the store ever was, requiring an archetype and a known race — and the milestone's fifth
  Definition-of-Done rule says a ticket that has to edit those has put the branch in the wrong
  place. So the store keeps its own two narrower refusals and shares only `buildCharacter`, and the
  full set runs where there is no wizard standing in front of it.
- **The session home is read-only, and that is enforced in `persistRuleset` rather than per
  surface.** `RULESET_HOME.SESSION` is the third value in a union that answers *where do this
  ruleset's edits go*, and the answer for a Snapshot is *nowhere* (D7). Refused with a sentence
  rather than ignored: a panel that silently discarded an edit would leave somebody retuning a stat
  and wondering why nothing stuck.
- **The wizard's session path opens no sheet afterwards.** It returns to the games list. Nothing can
  write to a session character yet — spending points and moving a resource go through the server
  with a revision guard, which is **TICKET-PLY-01's** — and a sheet whose every control quietly lost
  what it changed would be worse than no sheet. `useCharacterStore` therefore does **not** cache a
  session's characters, which the ticket's to-be anticipated: caching them would put them behind
  actions that write LocalStorage, and that is the shape of the data-loss path this defers instead.
- **Nothing in `docs/imports/` changed.** No `Configuration` entity is added or reshaped;
  `character.ruleset_id` is a column on the server's own model (D4), and the source spreadsheet has
  nothing to say about which server row a character belongs to.

### Found by the review

Three things the `conventions-reviewer` pass caught that were wrong rather than merely improvable:

- **Requirement 40 had six criteria and this ticket cited eight.** `40.7` and `40.8` did not exist,
  and several `40.2`/`40.3` citations pointed at criteria that say something else. The uploaded
  character's read and delete genuinely had no requirement behind them — IO-04 created that state
  and described it nowhere — so **`requirements.md` gained 40.7 and 40.8**, which is the honest
  half to write first; a criterion invented in a JSDoc line is a criterion nobody can find. The
  mis-mapped citations were corrected against the real list.
- **Criteria 7 and 8 were met on the wire only.** Both are worded in User terms and neither route
  had a client caller — an uploaded character was still invisible to every page anybody could
  reach, which is the exact words of criterion 7. `UnseatedCharacters` on `/rulesets` closes it.
- **`investedSkillPoints` was the one input nothing policed, and the server was laxer than the
  browser.** `characterStore.setInvestedSkillPoints` refuses a negative; nothing on the server did,
  and no rule looked at skill ids at all — so points could be spent on a skill the Snapshot does not
  have. That is v3 Req 45.3 exactly backwards, since the server is the authoritative side.
  `pointMap` now refuses a negative and `characterCreationErrors` refuses an unknown skill id.

Also from it: the local-mode integration test was driving `createCharacter` rather than the
`createCharacterHere` the wizard now calls — passing, but not about the path the criterion names —
and `seedCharacter`'s docblock claimed its default `configurationId` was the shape production
writes, which it is not.
