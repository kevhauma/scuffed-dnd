# TICKET-RACE-01 — Races as stat blocks

- **Area:** Races configuration
- **Type:** Refactor (breaking change to `Race`)
- **Traceability:** Concept [04 · Creature](../../excel%20export%20summary/concepts/04-creature.md) (playable subset); Concept [01 · Stat](../../excel%20export%20summary/concepts/01-stat.md) ("races supply the base")

## User story

As a User, I want each race to be a stat block — absolute values per stat, like the sheet's
creature rows — so races define what a member of that race *is*, not a bag of bonuses.

## Description

In the sheet a race supplies the base value of every stat (dwarf: Str 14, Dex 3, Con 15). The
app's `Race` is delta modifiers over skill codes. This ticket changes the shape and the editor;
the blend math and cardinality are TICKET-RACE-02.

## Current situation (as-is)

- [`Race`](../../../src/types/config.ts) is `{ id, name, description, skillModifiers }` — deltas
  on main-skill codes ("Only Main_Skills"), edited as ± rows in
  [`RaceFormDialog`](../../../src/components/config/races/RaceFormDialog.tsx).
- The base term of the stat composition is missing entirely; STAT-01 computes with `race base = 0`.

## Desired result (to-be)

- `Race` becomes `{ id, name, description, statValues: Record<statId, number> }` — absolute
  values; a stat absent from the record reads 0 (additive safety for stats added later).
- The races panel becomes a stat-block editor that grows a column per configured stat,
  defaulting 0 (the concept page's editing scenario).
- Export/import shape validation covers the new `Race`; `engine/validator.ts` reports dangling
  stat ids; REF-02 guards stat deletion against race blocks.

## Implementation notes

1. **`SUPPORTED_SCHEMA_VERSION` is now 3, by a User decision made while building this (2026-08-09.)**
   The reshape is *within* v2, so the existing v2 LocalStorage had `skillModifiers`-shaped races and
   `/config/races` white-screened on `race.statValues[stat.id]`. The decision: **bump the version on
   every reshape for the rest of this milestone** — the persisted shape is not stable until v2.0
   lands, and a build that cannot read stored data must say so through TICKET-IO-03's notice rather
   than crash on a field that moved. MAT-01, SKL-02, RES-01, ARC-01 and ROLL-05 should each expect
   to bump it again. Recorded on the `Configuration.schemaVersion` doc block.
2. **The race branch is gone from `references.ts`, not rewritten.** A stat block is keyed by stat
   id, so its display and stored forms are the same thing; translating it would only create a way
   for the two to disagree. `dependencies.ts` splits the old `modifierReferences` in two for the
   same reason — `raceStatBlockReferences` matches by id and cannot be defeated by a rename,
   `materialBonusReferences` still matches the `skillCode` spelling.
3. **The composition keeps its arithmetic.** `calculateRacialSkillModifiers` became
   `calculateRaceStatBases` and is keyed by stat id, but races still combine *additively* into the
   same slot rather than into `base` — so no character's numbers move. Both halves are RACE-02's:
   the blend, and the move into the base term.
4. **`handleSave` reads the block against the ruleset at save time, and prunes zeros.** A stat
   added while the dialog was open renders a row but has no form value behind it, so the save has
   to read the current stat list rather than the dialog's defaults — the panel test caught it being
   dropped. The pruning is the more important half, and was a **regression the convention review
   caught**: a *dense* block (every stat, zeros included) makes `raceStatBlockReferences` report a
   reference for every stat, so `deleteStat` would refuse for every stat any race had ever been
   saved over. A guard that always fires tells the User nothing. Both ends are fixed — the block is
   stored sparse, and the walker matches on a **non-zero** value rather than on the key's presence.
   Sparse is also the form `docs/imports/races.json` writes, so the two representations agree.
5. **The sheet's section speaks in absolutes now.** `RacialModifiersSection` became
   [`RaceStatBlockSection`](../../../src/components/play/sheet/RaceStatBlockSection.tsx): a dwarf
   *has* Strength 14, so rendering `STR +14` was the one place still saying delta. The per-stat
   breakdown row keeps its sign (`race +9`), because there the number really is a term being added.
   `StatBreakdown.racial` is `StatBreakdown.race` to match.
6. **A derived stat still gets a row in the editor**, per the to-be's "a column per configured
   stat" — APT reads 0 for every race in the sheet corpus. `calculateStatValues` ignores a race
   base for a derived stat entirely, so that row is dead data. Left as the to-be specifies rather
   than diverging; **RACE-02 should decide it**, since that is where the base term becomes
   load-bearing.

## Acceptance criteria

- [x] `statValues` replaces `skillModifiers` in type, store actions, and shape validation; export → import round-trips. ([`types/config.ts`](../../../src/types/config.ts) `Race`; `useRaceManager` builds and saves the block through `addRace`/`updateRace`; `importExport.ts` gained a per-race shape check. Tests: `importExport.test.ts` → "race stat blocks (TICKET-RACE-01)" (4 cases: id-keyed block accepted, empty block accepted, a v1 `skillModifiers` race rejected, a non-numeric entry rejected) and "race stat block round-trip (TICKET-RACE-01)" (export → import unchanged, and the wire form stays spelled in stat ids).)
- [x] The panel edits absolute values per stat and gains a column when a stat is added (component test). (New [`RacesConfigPanel.test.tsx`](../../../src/components/config/races/RacesConfigPanel.test.tsx), 6 cases — the block renders over every configured stat, the counted total honours `countsTowardTotal`, an absolute edit persists through the store, adding a stat grows the block and the save picks it up, a zero is pruned rather than stored, and a stats-less ruleset says why there is nothing to edit.)
- [x] Absent-stat-reads-0 semantics tested; dangling stat id reported by the validator. (`statCalculator.test.ts` → "should read a stat the race block says nothing about as 0" and "should ignore a race block entry naming a stat the ruleset no longer defines"; `validator.test.ts` → "should detect a race stat block naming a stat id the ruleset does not define" plus its converse, that a partial block is not an error. The delete guard is `dependencies.test.ts` → "finds a stat in formulas, modifiers and characters" and "does not count a zero in a race stat block as a reference".)
- [x] Persistence via store actions; components compose `ui/` primitives, theme tokens only. (`RaceFormDialog`/`RaceCard` compose `Dialog`/`FormField`/`Input`/`Label`/`Button`/`Card`/`Text`; colours are `parchment-*`, `stone-200`, `forest`, `ink-700`. No component touches `localStorage` — the save goes through `updateRace`/`addRace`.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill. (`npx vitest run` 1227 passing / 0 failing / 0 skipped; `npx tsc --noEmit` at the documented 2-error baseline; `yarn run check` clean. `fallow audit` — 0 dead code and 0 complexity introduced; its `warn` is the pre-existing config-panel header boilerplate shared by all seven panels, which this ticket's header edit merely re-touched, spun off as its own ticket. The `conventions-reviewer` found a real regression — the dense-block delete guard, implementation note 4 — plus two stale JSDoc headers, the delta-shaped section wording and a hand-rolled field state in the dialog; all fixed, and the guard gained the test that would have caught it.)
- [x] Verified live in the browser: edit a race's stat block, see the columns. (Ducklets corpus on `localhost:3000`. Stale v2 data hit the IO-03 notice rather than the crash; after loading the regenerated corpus, `/config/races` listed all ten blocks with the sheet's own six-core totals — human 60, elf 64, dwarf 60, Raccoon 59, Demon 90 — and dwarf reading Str 14 / Dex 3 / Con 15 exactly as the Description cites. Editing dwarf's Strength 14 → 16 persisted through the store and moved its counted total to 62; the value was restored afterwards. The character sheet's numbers are unchanged by the reshape, confirming note 3, and after the review fixes its section reads `Race Stat Block — STR 9 DEX 12 …` in absolutes.)

## Notes

- Character stat values don't move until TICKET-RACE-02 wires the base term — landing shape and
  editor first keeps each ticket small.
- This is the playable-race sliver of Concept 04; `type`/`size`/`playable`/CR belong to the
  creature milestone, and `Race` folds into Creature there — keep this schema thin.
