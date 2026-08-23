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

- [ ] Create, rename, list and delete round-trip through the repository; the list endpoint's payload
      carries no `data` document, asserted on a real corpus ruleset.
- [ ] A created ruleset equals `createFreshConfiguration()`'s output field for field, including the
      seeded constants, curves and roll definitions — one assertion against the function, not a
      copied literal.
- [ ] Anonymous, non-owner and owner each get the documented outcome on all four routes
      (Definition of Done rule 2).
- [ ] A ruleset with a Game_Session created from it refuses deletion; the same call with the Owner's
      confirmation deletes it and the session remains readable and playable on its Snapshot.
- [ ] A submitted `schemaVersion` other than `SUPPORTED_SCHEMA_VERSION` is refused with the version
      stated, reusing the import path's message rather than a new one.
- [ ] Signed out, `/rulesets` shows the browser's local ruleset and opens it for editing — no
      redirect, no sign-in wall, no empty state (D6, v3 Req 36.1).
- [ ] Every row states which home it lives in, and the two are never mixed into one undifferentiated
      list (v3 Req 36.8).
- [ ] v1.0 Req 1's one-configuration decision note is superseded in place, pointing at this ticket:
      the *account* holds many, while **this browser still holds exactly one**, which is what keeps
      local mode identical to v2.0. The **data-model** skill's "One `Configuration` per browser" line
      is qualified rather than deleted.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check (ask the User first).

## Notes

- **Deleting a ruleset must never break a running game**, which is what D7's Snapshot buys and what
  the fourth criterion proves. Without the Snapshot this delete would have to cascade or be refused
  forever; with it, the session simply stops having a source.
- The list-without-`data` rule is not an optimisation. A list endpoint that returns whole documents
  invites a client that renders from the list and then edits the copy it happens to hold, which is
  how RUL-02's revision guard gets bypassed by accident.
- Name uniqueness per Owner is deliberately **not** enforced. Two rulesets called "Ducklets" is the
  User's business; the id is the identity, as everywhere else in this codebase.
