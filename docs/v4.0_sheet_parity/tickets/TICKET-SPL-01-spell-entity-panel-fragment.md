# TICKET-SPL-01 — Spells: entity, panel, and the 418-spell fragment

- **Area:** Spells configuration (new area)
- **Type:** Feature (new entity)
- **Traceability:** System [13 · Spells](../systems/13-spells.md) (gap 1); overview plan §11.
  First ticket of the minted **`SPL`** prefix.

## User story

As a User, I want my ruleset to carry a spell compendium — name, mana cost, range/time and effect
text per spell — so the 418 spells the table plays exist in the app.

## Description

The `Spell` entity, its Configuration-mode panel, and the fragment holding all 418 rows. Effect
text lands as raw captured text in this ticket; converting the 326 formula-effects to template
syntax is TICKET-SPL-03's transcription. Learned tracking, the Spellbook and casting are
TICKET-SPL-02.

## Current situation (as-is)

- Nothing — Concept 13 (Spell) was always a later-milestone entity. Mana already exists as a
  resource pool (`isResource`, `currentResourceValues`), which is the whole casting economy this
  will need.
- The optional-array precedent (`constants`, TICKET-CST-01) and the panel pattern
  ([ConfigPanelShell](../../../src/client/components/config/shared/ConfigPanelShell.tsx)) are
  established.

## Desired result (to-be)

- **`Configuration.spells?`** — optional array, absent-means-none:
  `{ id, name, description?, manaCost, rangeTime, effectTemplate }`. `rangeTime` is free text
  (the sheet's spellings are wildly inconsistent and normalising them is the User's edit);
  `effectTemplate` holds the effect text, template semantics arriving in SPL-03.
- **A config panel** through `ConfigPanelShell` — list (418 rows need search/paging that the
  shell's patterns allow), create, edit, guarded delete.
- **`spells.json`** — all 418 rows from the xlsx (`background calculations spells ` A8:E428,
  B name · C mana · D range/time · E effect), anomalies recorded as-is: `mighty fortress`'s
  swapped columns, `Summon Lesser Demons`'s `#VERW!` effect imported as an **empty template with
  a note** (never invented text), mana outliers, the six blank range cells.

## Acceptance criteria

- [ ] A ruleset with no `spells` behaves exactly as today — additive-optional, no version bump
      needed for this field.
- [ ] The panel lists all 418 seeded spells usably (search or paging), edits through the store
      action, and delete is guarded once anything references a spell (the edge lands with
      SPL-02's `learnedSpellIds`; the panel wires the existing surface).
- [ ] The `#VERW!` row imports as an empty effect with its `notes` entry; `mighty fortress`
      imports with its columns swapped **as the sheet has them** — both pinned by import tests
      (the sheet wins, D1).
- [ ] `spells.json` created citing the xlsx sheet name (trailing space intact) and ranges, with
      an `exportedAt`; `yarn run sheet:import` regenerated;
      [README.md](../../imports/README.md) gains the fragment's row. No invented numbers, no
      normalised range text.
- [ ] Feature components compose `components/ui` primitives; persistence through the store
      action; theme tokens only.
- [ ] Unit tests cover: absent default, CRUD through the store, import count 418, and the two
      anomaly rows.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser check of the panel over the full list (ask the User first).

## Notes

- Row 10 of the sheet is a template row (`empty`/0/`0f`/0) — capture metadata, not a spell; the
  import skips it and says so in `notes`.
- The per-player `locked/Learned` column is character state, not ruleset data (overview D5) —
  it lands in SPL-02.
