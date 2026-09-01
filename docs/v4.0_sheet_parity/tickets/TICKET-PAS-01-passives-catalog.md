# TICKET-PAS-01 — Passive abilities: the entity and the handout

- **Area:** Passive abilities (new area)
- **Type:** Feature (new entity)
- **Traceability:** System [14 · Passives and reference tables](../systems/14-passives-and-reference-tables.md);
  overview [D5](../overview.md#d5--what-is-deliberately-not-parity) (nothing grants a passive
  yet). **Needs TICKET-SPL-03** (the templating attachment point two effects use). First ticket
  of the minted **`PAS`** prefix.

> **Scope (overview [D7](../overview.md#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29)):**
> the 26 passives are the data pass's. It owes this ticket a new `passives.json` citing
> `Background refernces abilities: passive` (typo intact) B1:D27, the doubled poison-resistance
> ladder handled first-occurrence-wins with both row sets cited (the `skinning` precedent), the two
> templated effects (Blindsight and darkvision, perception level × 10 / × 5 feet) written in
> SPL-03's syntax, the empty actives tab noted, and its row in
> [README.md](../../imports/README.md).

## User story

As a DM, I want a catalog of passive abilities — resistances, immunities, senses — that I can
hand to a character by name, so the sheet's reference table exists in the app before anything
automates it.

## Description

Name + effect text, and nothing else. Nothing grants a passive — Setup says "Passive abilites:
Coming soon", races and items reference nothing — so v4.0 builds the entity, a config panel, and a
DM handout field, and stops there. Wiring passives to races or items waits for the sheet to do it
first. Some effects are formulas (Blindsight and darkvision scale with perception), templating
exactly like spells.

## Current situation (as-is)

- Nothing — no passive entity anywhere.
- The templating surface exists after TICKET-SPL-03: the `spell-effect`-style attachment point in
  [scoping.ts](../../../src/shared/engine/formula/scoping.ts), with
  [FormulaPreview](../../../src/client/components/config/shared/FormulaPreview.tsx) on every
  User-authored formula field.
- The sheet's actives tab exists and is empty — recorded, built into nothing.

## Desired result (to-be)

- **`Configuration.passives?`** — optional array, absent-means-none: `{ id, name, effectText }`,
  with `effectText` templated through the SPL-03 attachment point (its own `FormulaOwner` if the
  reference set differs; reuse if not — smallest shape wins) and previewed like every formula
  field.
- **A config panel** through
  [ConfigPanelShell](../../../src/client/components/config/shared/ConfigPanelShell.tsx) — list,
  edit, guarded delete.
- **`Character.passiveIds?`** — an optional character field, absent-means-none, so a DM can hand a
  passive out by name and take it back. All the sheet's table can do today.

## Acceptance criteria

> **Implementation note (2026-09-01) — what *"a Player cannot self-grant"* means.** It means **at a
> table**. There is no player route to `Character.passiveIds` at all, so a Player asking the server
> is refused by `requireCharacterDM`, and the local store action refuses the same write the moment
> the character sits at a session. **On a purely local sheet the Player writes it themselves**,
> because signed out there is no DM and the person keeping their own sheet plays both parts — which
> is `Character.dreamLevel`'s split exactly (TICKET-RES-04) and experience's before it. Reading the
> criterion as *nobody but a DM, ever* would have left the whole feature dead in local mode, which
> [CLAUDE.md](../../../CLAUDE.md)'s *nothing about that path degrades* forbids.

- [x] A ruleset with no `passives` behaves exactly as today; a character with no `passiveIds`
      likewise — both additive-optional, no version bump of their own.
      → `Configuration.passives?` and `Character.passiveIds?` are optional and absent-means-none,
      read through `heldPassiveIdsOf` ([passives.ts](../../../src/shared/engine/passives.ts)) rather
      than a `?? []` at any call site. `SUPPORTED_SCHEMA_VERSION` stays **10** (D6's one bump, spent
      at INV-05). Pinned by *"should accept a file with no passives key — absent means none"* and
      *"should leave a ruleset with no passives without one after a round-trip"* in
      [importExport.passives.test.ts](../../../src/shared/services/importExport.passives.test.ts), by
      *"should mint a fresh ruleset with no passives key at all"* in `configStore.test.ts`, and by
      four `heldPassiveIdsOf` cases in
      [passives.test.ts](../../../src/shared/engine/passives.test.ts).
- [x] A templated effect resolves per character through the one engine — no second evaluator — and
      a plain-text effect renders verbatim; both pinned against fixtures shaped like Blindsight
      (perception level × 10 feet) and a resistance line.
      → [templateContext.test.ts](../../../src/shared/engine/templateContext.test.ts): *"computes a
      sense whose range scales off a skill level — the Blindsight shape"* (50 feet at level 5),
      darkvision at `× 5`, and *"renders a plain-prose effect verbatim — the resistance shape"*. The
      engine is `resolveTemplate` at the **`spell-effect`** owner — SPL-03's, reused rather than
      duplicated — reached through the new
      [templateContext.ts](../../../src/shared/engine/templateContext.ts), which `useSpellbook` now
      calls too. Browser: *"You have blindsight out to 30 feet."* for a character whose Perception
      skill level is 3.
- [x] The DM hands a passive out and takes it back through the DM action surface
      ([dmActions.ts](../../../src/shared/services/dmActions.ts)) with an Event, and the sheet
      lists the character's passives with resolved text; a Player cannot self-grant.
      → `addHeldPassive` / `removeHeldPassive` in `dmActions.ts` (named for what they do to the
      document; `dm-grant-passive` / `dm-revoke-passive` name the act), behind
      `routes/dm/dmGrantPassive.ts` and `dmRevokePassive.ts` with `requireCharacterDM`. `dm.test.ts`
      pins the Event's `target` and before/after for both directions, and *"refuses the character's
      own Player with the same 404 a stranger gets"* is the self-grant refusal **through a request**;
      `characterStore.table.test.ts` pins that the local pair is refused at a table. The sheet lists
      through [PassivesPanel](../../../src/client/components/play/passives/PassivesPanel.tsx) with
      `ResolvedTemplate` — the same component the config preview draws.
- [x] Deleting a passive a character holds is refused by the walker
      ([dependencies.ts](../../../src/shared/engine/dependencies.ts)) naming the holder.
      → The `passive` kind and its `passiveReferences` arm, plus a third row in
      `referenceArms.test.ts`. Pinned in `dependencies.test.ts` (*"finds a character who has been
      handed a passive"*) and end-to-end in `configStore.test.ts` (*"should refuse to delete a
      passive a character holds, naming the holder"*). **A passive's effect is also a formula
      holder**, so deleting the skill Blindsight reads is refused too — three more cases there.
      Browser: *"Passive Blindsight cannot be deleted — it is referenced by: Character: Quackers
      (passiveIds)"*.
- [x] Unit tests cover: absent defaults, a templated and a plain effect, grant/revoke with Events,
      and the delete guard.
      → **+116 tests (3600 → 3716)** across seven new files and nine existing ones; the split is in
      [TEST_STATUS.md](../../../TEST_STATUS.md). Beyond the four rows above,
      `usePassiveHandout.test.ts` pins *which actor* may write (three readers, three answers) and
      `PassivesPanel.test.tsx` pins the loop a hook test cannot show — grant, read the resolved
      sentence, revoke, and the force-deleted leftover staying clearable.
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser check of a handout appearing on the sheet (ask the User first).
      → `npx vitest run` **3716/3716**, `npx tsc --noEmit` at its documented 2-error baseline,
      `yarn run check` clean (lint, format, and dependency-cruiser's three-root boundary).
      `fallow audit --base main`: **no dead code introduced**, and — after two extractions — **no
      complexity finding on a function this ticket added or grew** (`CharacterSheet` and
      `useSheetActions` were both over threshold on the first pass; see *Decisions*). One
      **duplication** finding is declined with cause, below. No touched file changed hotspot velocity
      into Accelerating except `useConfigDashboard.ts`, which earns its first row in TEST_STATUS.md.
      Verification ran in this session rather than through the subagent; the conventions pass is a
      read of the diff against the house rules. Browser check: below.

## Decisions this ticket made

- **`FORMULA_OWNER.SPELL_EFFECT` is reused rather than a `passive-effect` row being minted.** The
  ticket says *"its own `FormulaOwner` if the reference set differs; reuse if not — smallest shape
  wins"*, and it does not differ: systems/14 records both templated passives reading a **skill
  level**, which is inside the set `spell-effect` already scopes (`stats`, `skills` with `.bonus`,
  `const`, `curve`, plus stat abbreviations in the flat space). A second row would say the same
  thing under a different name. If a later ticket narrows one of the two, that is when they split.
- **Two DM actions, not one `dm-set-passives` carrying the whole list.**
  `learn-spell`/`unlearn-spell`'s shape, and the reason is correctness rather than symmetry: **the
  revoke consults no ruleset**, so a passive the User force-deleted stays clearable. A whole-list
  write validating every id would refuse the very edit that clears the stale one — the trap
  `focusPickRefusal` sets for `set-focus-skills`, which `characterFocusReferences` exists to guard.
- **The field is `effectText`, not `effectTemplate`.** The ticket and systems/14 both write it that
  way, and it is the same kind of field as a spell's going through the same three functions;
  matching `Spell`'s spelling was not worth a reshape.
- **Two extractions, both deduplicating rather than anticipating**, and `fallow` asked for both:
  `shared/engine/templateContext.ts` (the `calculateCharacter` + `namespacesFor` + **`statVariables`**
  trio that `useSpellbook` owned — the third call is CR-02's fix, and copying it by hand into a
  second hook is how a subtlety gets lost), and `play/passives/usePassiveHandout.ts` (*which actor
  may write*, which had been spread across the sheet, `useSheetActions` and `useDmControls`).
- **`describeAdjustment`'s `statNames` became one `names` map.** A granted passive is named by id on
  the wire and by name on the page, so the log needed a second lookup; every id in this app is a
  UUID, so one map cannot confuse a stat with a passive, and a second parameter would have existed
  only because two panels minted them.

## Findings declined, with cause

- **`fallow dupes` reports `dmGrantPassive.ts` / `dmRevokePassive.ts` as a clone group
  (`dup:16cbd4ba`, 14 lines).** Declined, on TICKET-SPL-02's recorded precedent for
  `learnSpell`/`unlearnSpell`: every module in `routes/dm/` is a guard, a body read and one Kernel
  call, and **`dmRules.test.ts` asserts one write module per `DM_ACTION` value**. Collapsing the
  pair would break that assertion and let one `requireCharacterDM` stand for two handlers, which is
  exactly what `routeGuards.test.ts` exists to prevent. The duplication is the convention rather
  than a lapse in it.
- **`fallow dead-code` reports the `fallow` dependency and `RulesetHomeKind`.** Both **inherited** —
  `fallow audit` attributes `dead_code_introduced: 0` — and neither sits in a file this ticket
  touched.

## Browser check

Driven on a fresh browser ruleset: one stat (`Perception`/`PER`), one skill (`Perception`, with no
governing stats, so its level is what the Player invests), two passives, one character with 3 points
in that skill.

1. **The route, the nav entry and the panel are real.** `/config/passives` renders
   `PassivesConfigPanel` with its empty state and an *Add Passive* button; **Passives** sits beside
   **Spells** in the configuration nav and on the dashboard's card index.
2. **The preview resolves while typing.** `You have blindsight out to {skills.perception.level * 10}
   feet.` drew *"You have blindsight out to 0 feet."* beneath the box — the placeholder computed at
   the preview's own sample, the prose untouched. A **plain-prose effect draws no preview at all**,
   which is right: there is nothing to resolve.
3. **Both round-trip through the store** and list with the template drawn **as written**, braces
   included — the authoring list shows an author their own text.
4. **The sheet resolves it for the holder.** Granting Blindsight to Quackers drew *"You have
   blindsight out to **30** feet."* — 3 × 10 off that character's own skill level, a different
   number from the preview's sample and the whole of what D4 promises. `Charm immunity` drew *"You
   cannot be charmed."* verbatim.
5. **The picker is the list's complement.** Granting took the row out of the picker in the same
   render; with both handed out the picker read *"Every passive in this ruleset has already been
   handed out."*
6. **The delete guard names the holder.** Deleting Blindsight was refused with *"Passive Blindsight
   cannot be deleted — it is referenced by: Character: Quackers (passiveIds)"*, and the catalog was
   unchanged.
7. **A force-deleted passive is still clearable.** *Delete Anyway* left the row reading *"A passive
   this ruleset no longer has"* with its *Revoke* button — reachable because `hasPassives` is a
   catalog **or** a held row, which is SPL-02's browser finding applied one entity over.
8. **Revoking the last one removes the field entirely** rather than storing `[]`: `'passiveIds' in
   character` reads `false` in LocalStorage afterwards.
9. **The validation report says nothing** about a sound template — the dashboard read *"This ruleset
   is valid. 0 error(s)"* with the templated passive saved.

Zero console errors on a fresh tab. (The session's own long-lived tab held one React `removeChild`
on a `<link>` — an HMR artifact of the many hot reloads while this ticket was written; a clean load
has nothing to say, the same shape SPL-03 recorded.)

## Notes

- **Build no granting mechanism** beyond the DM handout — no race wiring, no item wiring, no
  effect *mechanics* (a resistance is text; damage math does not exist to hook into). That is
  D5's line, held on purpose.
- The measurements table (Naming AU:AX) stays recorded-not-built — it belongs to no ticket.
