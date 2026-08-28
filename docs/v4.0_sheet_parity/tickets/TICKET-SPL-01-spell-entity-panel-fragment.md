# TICKET-SPL-01 — Spells: the entity and its panel

- **Area:** Spells configuration (new area)
- **Type:** Feature (new entity)
- **Traceability:** System [13 · Spells](../systems/13-spells.md) (gap 1); overview plan §11.
  First ticket of the minted **`SPL`** prefix.

> **Scope (overview [D7](../overview.md#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29)):**
> the compendium is the data pass's. It owes this ticket a new `spells.json` — all 418 rows from
> `background calculations spells ` A8:E428 (B name · C mana · D range/time · E effect), anomalies
> recorded as-is: `mighty fortress`'s swapped columns kept swapped, `Summon Lesser Demons`'s
> `#VERW!` effect imported as an **empty template with a note** (never invented text), the mana
> outliers, the six blank range cells, and row 10's `empty`/0/`0f`/0 template row skipped as
> capture metadata — plus its row in [README.md](../../imports/README.md).

## User story

As a User, I want my ruleset to carry a spell compendium — name, mana cost, range/time and effect
text per spell, and a panel that stays usable at four hundred of them — so the spells the table
plays have somewhere to live.

## Description

The `Spell` entity and its Configuration-mode panel — a panel that has to stay usable at four
hundred rows, which is the only thing about spells that is harder than any other entity. Effect
text is stored raw; template semantics arrive in TICKET-SPL-03, learned tracking and casting in
TICKET-SPL-02, and the 418 spells themselves in the data pass.

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
- **A config panel** through `ConfigPanelShell` — list, create, edit, guarded delete — with the
  **search or paging** four hundred rows need, built from the shell's existing patterns rather than
  a bespoke list.
- **An empty effect is legal**: a spell whose effect text is absent imports, renders and edits
  without complaint — the shape the data pass's `#VERW!` row lands in.

## Acceptance criteria

- [ ] A ruleset with no `spells` behaves exactly as today — additive-optional, no version bump
      needed for this field.
- [ ] The panel lists 400+ spells usably — search or paging, proven against a generated fixture at
      that scale, not against four rows — edits through the store action, and delete is guarded
      once anything references a spell (the edge lands with SPL-02's `learnedSpellIds`; the panel
      wires the existing surface).
- [ ] A spell with an empty effect and a spell with free-text `rangeTime` both round-trip
      import/export untouched — nothing normalises either.
- [ ] Feature components compose `components/ui` primitives; persistence through the store
      action; theme tokens only.
- [ ] Unit tests cover: absent default, CRUD through the store, the empty-effect case, and the
      round-trip.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser check of the panel over a large fixture (ask the User first).

## Notes

- The per-player `locked/Learned` column is character state, not ruleset data (overview D5) —
  it lands in SPL-02.
- `rangeTime` is free text on purpose: the sheet's spellings are wildly inconsistent and
  normalising them is the User's edit, not the importer's.
