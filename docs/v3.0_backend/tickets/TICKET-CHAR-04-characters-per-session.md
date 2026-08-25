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

- [ ] A Player creates a character in a session; the DM and every other Member can read it, and no
      other Account can.
- [ ] A non-member's creation attempt is refused, indistinguishably from a missing session.
- [ ] A submitted body carrying `statValues`, `level`, `statTotal` or a roll result is rejected with
      the offending field named — not silently stripped.
- [ ] Server-side creation applies the same rules the wizard does: race cardinality (`MAX_RACE_COUNT`),
      the archetype requirement when the Snapshot defines archetypes, and `validateStatAllocation`'s
      affordability refusal — each asserted by a rejected request, not by reading the code.
- [ ] `currentResourceValues` is seeded from the Snapshot's calculated maxima at creation, exactly as
      `createCharacter` does today, and only for `isResource` stats.
- [ ] Signed out, the wizard and the sheet work end to end against the local `Configuration` with
      the network stubbed to throw — creating and playing a character needs no account (v3 Req 40.0).
- [ ] An uploaded character from IO-04 that belongs to no session is readable by its owner and is
      stated as not being at a table — it is not silently invisible.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check (ask the User first).

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
