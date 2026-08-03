# TICKET-DX-04 — Golden fixtures: pin every confirmed sheet derivation

- **Area:** Tooling & test infrastructure
- **Type:** Feature (verification work — the milestone's parity gate, last in the build order)
- **Traceability:** spec [§12 Golden tests](../../excel%20export%20summary/ttrpg-app-spec.md); every ✅-marked derivation across [`concepts/`](../../excel%20export%20summary/concepts/README.md)

## User story

As a User, I want the engine's numbers proven against the spreadsheet's confirmed values — not
eyeballed — so "the app matches the sheet" is a suite verdict that survives every future
refactor.

## Description

The full golden-test corpus needs the xlsx importer (a later milestone), but the concept pages
already carry a body of ✅-confirmed derivations with exact inputs and outputs. This ticket
encodes all of them as one fixture-driven suite — the milestone's acceptance gate.

## Current situation (as-is)

- The confirmed derivations exist only as prose tables in the concept pages; each v2.0 ticket
  pinned its own cases locally, but nothing collects them or exercises them *together* on a
  sample-character-shaped configuration. There is no fixture format.

## Desired result (to-be)

- A fixture-driven suite in `src/engine/` (typed data module + one test file, plain Vitest in the
  normal run): each row carries inputs, expected output, and its concept-page citation — a
  failure message points at the sheet evidence. 🔍-inferred values (the invested `+1.5`) are
  included but tagged inferred. The suite README states the rule: **a failing fixture is never
  fixed by editing the fixture** — only a new citation justifies a change.
- A shared **sample configuration + character** builder (nine stats with confirmed flags, seed
  constants and curves, the `[20, 12, 6]` ladder; the documented stat line Str 10 / Con 12 /
  Dex 11 / Int 8 / Wis 15 / Char 39 / Health 7 / Mana 310 / Speed 30) built through public
  store/engine APIs only — doubling as an integration test of the whole v2.0 surface.
- **Coverage** (one fixture set, sub-grouped): the skill table (Charm 11.7→2, Trading 11.7→2,
  Brewing 4.5→1, Black smithing 2.0→0, alchemy 1.6→0, Persuasion 13.2→3; boundary 7.5→2); APT
  (Speed 30→1; Speed 75→3, pinning half-away-from-zero); point-buy (`main = 0.75 × (points+1)`
  across rows; the 15-point row 5/7/12); six-core-only stat totals (human 60, elf 64, dwarf 60,
  Raccoon 59, Demon 90); race blend (odd sum, same-race identity); dice decompositions (10 and 39
  with notation strings); `bonus_divider` as a dial (5 → the table; 4 → recomputed).

## Acceptance criteria

- [ ] Every coverage bullet has fixtures with citations; failure messages include the citation.
- [ ] The sample builder uses public APIs only; fixture data is a typed module, no JSON casts.
- [ ] `npx vitest run` includes the suite — no separate command, no skips; green at milestone close (this landing is the final checkpoint, mirroring v1.0's §18 line).
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.

## Notes

- If a ticket-local test and a fixture disagree, the fixture wins — both came from the same page;
  one drifted.
- The importer milestone extends this suite with the full cached-value corpus (Bickuss Dickuss
  end-to-end, awakend three, both spell lists); the format should make that an append.
- Mana 310 / Health 7 as computed maxima need Ducklets investment data the docs don't fully
  specify — the sample character pins them as *pool behaviour* (stored current vs. derived max),
  not as derivation fixtures; the suite says so rather than inventing inputs.
