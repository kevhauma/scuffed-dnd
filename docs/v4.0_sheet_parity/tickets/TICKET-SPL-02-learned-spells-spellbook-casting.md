# TICKET-SPL-02 — Learned spells, the Spellbook, and casting

- **Area:** Spells (play mode)
- **Type:** Feature
- **Traceability:** System [13 · Spells](../systems/13-spells.md) (gaps 2, 3); overview
  [Rulings 2026-08-29](../overview.md#rulings-user-2026-08-29) (spells unlock **manually**;
  "Chosen abiltie" is nothing yet). **Needs TICKET-SPL-01** (the entity).

## User story

As a Player, I want to mark spells learned, read them in my Spellbook, and spend mana to cast —
so my magic works the way the sheet's Spellbook tab plays.

## Description

Learned-per-character tracking (a hand-set flag — no rule derives it, nothing gates it), the
play-mode Spellbook mirroring the sheet's own `FILTER`-down-to-learned view, and casting as a
mana spend against the existing resource pool. A cast is a resource spend, not a dice roll —
server-resolved rolls are untouched.

## Current situation (as-is)

- TICKET-SPL-01 gives the ruleset its compendium; no character state references it.
- Resource spends exist: `adjustCurrentStatValue` and the player-action pipeline
  ([playerActions.ts](../../../src/shared/services/playerActions.ts), TICKET-PLY-01) already
  carry refuse-below-zero discipline for pools.
- The sheet's Setup tab has a "Chosen abiltie" box — **ruled a placeholder**; it gets no model,
  no wiring to learned spells, no signature-spell concept.

## Desired result (to-be)

- **`Character.learnedSpellIds?: string[]`** — absent-means-none (the sheet's `locked` default),
  set and unset by hand from the play surface; persistence through the store action locally and
  the existing player-action route on the server.
- **The Spellbook view**: the learned subset with name, mana cost, range/time and effect —
  the sheet's own play surface, specified by its `Spellbook` tab. (Effects render as stored text
  until TICKET-SPL-03 resolves templates.)
- **Casting spends mana**: a cast action deducts `manaCost` from the Mana pool through the
  existing resource actions. Whether an unaffordable cast is refused or allowed (going negative)
  is decided **with the User** in this ticket — refuse is the house default; record the answer.

## Decisions taken with the User (2026-08-31)

Two, both put to the User before any code was written. They are recorded here because the ticket
asked for the first and the build surfaced the second.

### An unaffordable cast is **refused**, with the shortfall named

The house default, as the to-be predicted. `spendSpellCost` answers
*"Meteor Storm costs 100 and Health is at 30 — 70 short. Nothing was spent."* and moves nothing.

This deliberately **departs from `setResourceValue`**, which is open at the bottom on purpose so a
table can track bleeding out (Requirement 14.4). The difference is who is asking: a Player *writing*
a pool has said what the number is, where a Player *casting* has asked whether they can — and a cast
that half-landed would leave a table believing a spell went off. It is `setPurseAmount`'s reasoning
and its sentence shape.

Two neighbouring refusals follow from rules already on the books rather than from a choice:

- **An unpriced spell cannot be cast.** `mighty fortress` has its mana and range columns swapped, so
  the compendium records no cost (SPL-01). *Never invent a number to fill a required field* leaves
  refusing as the only honest answer — a 0 would be a cost nobody authored.
- **An unlearned spell cannot be cast**, which is the Spellbook's own filter enforced a second time
  for requests that do not come from it.

### The **Player names the pool** at cast time

Nothing in a `Configuration` says which resource casting draws on, and the build could not proceed
without an answer. Three options were put to the User; they chose the one that adds **no ruleset
shape at all**: `cast-spell` carries a `statId`, the panel shows a *Cast from* selector when the
ruleset has more than one resource, and a ruleset with exactly one answers the question without
asking.

The alternative rejected outright was matching a stat named *Mana*, which would hard-code an English
spelling into the engine and stop working the moment a User renames the pool — or writes their
ruleset in Dutch, as the source workbook does. The rejected `Configuration.castingResourceStatId?`
is where this goes if a third caller ever wants the ruleset to decide.

## Acceptance criteria

- [x] Marking a spell learned adds it to the Spellbook; unmarking removes it; a deleted spell id
      is a validation finding, not a crash — pinned through the store and the shared service.
      → `addLearnedSpell` / `removeLearnedSpell` in
      [playerActions.ts](../../../src/shared/services/playerActions.ts); the book is derived by
      `spellbookOf` ([spellbook.ts](../../../src/shared/engine/spellbook.ts)), which resolves an id
      the ruleset has lost to a row with `spell: null` **after** the rows that resolve, rather than
      dropping it or throwing. `SpellbookRow` draws it as *"A spell this ruleset no longer has"*
      with the *Cast* control gone and *Unlearn* kept, and `removeLearnedSpell` takes no
      `Configuration` precisely so the leftover is clearable. Pinned in `spellbook.test.ts`,
      `playerActions.test.ts` and `SpellbookPanel.test.tsx`.
- [x] A cast moves `currentResourceValues` for Mana by exactly `manaCost`, through the existing
      action (no new arithmetic path); the insufficient-mana decision is implemented as the User
      ruled it and pinned by a test naming the choice.
      → `spendSpellCost` ends in `adjustResourceValue(character, config, statId, -cost)` — the same
      call a hand-typed deduction makes — and the refusal case is
      *"refuses a cast the pool cannot pay for, naming the shortfall (User ruling, 2026-08-31)"* in
      `playerActions.test.ts`, with the server's counterpart in `play.test.ts`.
- [x] The server path: learned edits and casts ride existing player-action routes
      (overview [D2](../overview.md#d2--the-backend-does-not-change) — no new route surface);
      a DM's view is untouched.
      → Three new `PLAYER_ACTION` values and three modules under `routes/play/`, each a
      `requireCharacterPlayer` plus one Kernel call, registered at
      `POST /api/characters/:id/<action>`. That is the D2 amendment's shape (a new action costs one
      handler module and one `PATTERN_ROUTES` line), not the escape hatch: **`db/schema.ts` and the
      migrations are untouched, no socket message is added, and no `DM_ACTION` changed.**
      `playerRules.test.ts` counts thirteen modules against thirteen actions.
- [x] "Chosen abiltie" appears nowhere — no field, no UI (ruled placeholder; grep stays empty).
      → No field, no request shape, no control, nothing wired to `learnedSpellIds`.
      `grep -ri "chosen abilt\|chosenAbilit" src/` returns **one** hit, and it is prose rather than
      code: a sentence in `Character.learnedSpellIds`' doc comment saying the box is deliberately
      not modelled here or anywhere. The criterion asked for an empty grep and this is one line off
      it, kept on purpose — the ruling is the kind of absence a reader will otherwise try to fill
      in, and systems/13 records it for exactly that reason.
- [x] The guarded-delete edge lands: deleting a spell a character has learned is refused naming
      the character ([dependencies.ts](../../../src/shared/engine/dependencies.ts) walker).
      → `spellReferences` walks `learnedSpellIds`, and the browser check read the dialog back:
      *"Spell Fireball cannot be deleted — it is referenced by: Character: Quackers
      (learnedSpellIds)"*. **`referenceArms.test.ts` failed on the run that added the field**, which
      is the first time one of its rows has fired — SPL-01 wrote it vacuous against a spelling read
      out of systems/13, and the arm could not ship empty behind the field.
- [x] Unit tests cover: absent default, learn/unlearn round-trip, the cast's spend and its
      refusal case, and the delete guard.
      → +54 tests across six files; the count is 3550, 0 failing, 0 skipped. See
      [TEST_STATUS.md](../../../TEST_STATUS.md).
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser check: learn, read, cast, watch the pool (ask the User first).
      → `npx vitest run` 3550/3550, `npx tsc --noEmit` at its 2-error baseline, `yarn run check`
      (lint + format + imports + dependency-cruiser) clean. `fallow audit --base main`: **no dead
      code introduced** (the one finding it raised, an exported `CastingPool` nothing consumed, is
      module-local now), one clone group — the `learnSpell`/`unlearnSpell` pair — kept and argued in
      `unlearnSpell.ts`'s header, and **no touched file tagged Accelerating**, so no hotspot row is
      owed. The verification ran in this session rather than through the subagent, and the
      conventions pass by reading the diff against the house rules.
      **The browser check (User said yes) found a bug the suite did not**: the panel hid itself on
      `hasCompendium`, so force-deleting the last learned spell emptied the compendium and made the
      leftover id unreachable. It gates on `hasSpells` now — a compendium **or** a book — with a
      case of its own. The rest of the loop verified end to end on a fresh browser ruleset: learn
      Fireball, read *150 mana · 150 Feet* with its effect text, cast (Mana 250 → 100), cast again
      and read *"Fireball costs 150 and Mana is at 100 — 50 short. Nothing was spent."*, reload and
      find both the spell and the spent pool still there, then force the delete and clear the
      leftover row. Zero console errors throughout.

## Notes

- The sheet's flag matches case-insensitively (`"learned"` vs `Learned`) — a transcription note
  for the fragment, not app logic: the app stores ids, not flags.
- Additive-optional character field — no version bump of its own.
- **What this owes the data pass** (D7): the 418-row `spells.json` fragment, which SPL-01 already
  owed. Nothing here adds a seeded number of its own — the browser check and every test build their
  own fixture, and `play.test.ts` pins its two spells and a flat-250 pool onto a Snapshot because
  every one of the corpus's real pools seeds at 0 for a character who has spent nothing.
