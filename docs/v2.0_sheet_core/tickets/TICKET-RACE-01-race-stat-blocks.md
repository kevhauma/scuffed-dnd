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

## Acceptance criteria

- [ ] `statValues` replaces `skillModifiers` in type, store actions, and shape validation; export → import round-trips.
- [ ] The panel edits absolute values per stat and gains a column when a stat is added (component test).
- [ ] Absent-stat-reads-0 semantics tested; dangling stat id reported by the validator.
- [ ] Persistence via store actions; components compose `ui/` primitives, theme tokens only.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.
- [ ] Verified live in the browser: edit a race's stat block, see the columns. (Ask the User first per CLAUDE.md.)

## Notes

- Character stat values don't move until TICKET-RACE-02 wires the base term — landing shape and
  editor first keeps each ticket small.
- This is the playable-race sliver of Concept 04; `type`/`size`/`playable`/CR belong to the
  creature milestone, and `Race` folds into Creature there — keep this schema thin.
