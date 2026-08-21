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

## Implementation notes (2026-08-21)

Four divergences from the to-be, each recorded at the moment it was taken. The long-form versions
live in [`src/engine/golden/README.md`](../../../src/engine/golden/README.md), which is where the
next person will actually look.

1. **The sample builder is in the test file, not in a module beside the fixtures.** The to-be says
   "typed data module + one test file", and that is exactly what shipped — but not for the reason
   the to-be had in mind. The builder has to reach `importConfiguration` and both Zustand stores,
   and the layering is `types → engine → services → stores`: an `engine/` module may not import
   downstream of itself, and `engine/` is pure by rule (no React, no `localStorage`). So
   [`fixtures.ts`](../../../src/engine/golden/fixtures.ts) imports **types only** and stays inside
   the rule, and the builder lives in
   [`golden.test.ts`](../../../src/engine/golden/golden.test.ts), where a test file may cross
   layers as every store and service test already does.
2. **The documented stat line is installed as a race stat block, and the split is declared
   unknown.** `Ducklets` is not among the ten races the export carries, and the line is *not*
   recoverable as race base + point-buy spend: the main column is `0.75 × (points + 1)`, which
   never lands on the 29 that Char 39 would need, and a level-1 character's budget is 3 points.
   So the suite installs the confirmed line as a `Ducklets` block and gives the character zero
   investment. Every number used is still a sheet number; only the split is declared unrecoverable,
   and the point-buy multiplier is pinned **separately and directly** against Concept 06's seed
   table, where it is confirmed row by row. The cost is that the nine stat-line rows assert the
   composition returns the block untouched; the gain is that everything genuinely derived from it —
   APT, the six-core total, every skill level and bonus, every roll input and pool — is checked
   against numbers the sheet supplies independently.
3. **Persuasion is settled, and the coverage bullet's `Persuasion 13.2→3` moves to Charm.** The
   sheet wins, per [`docs/imports/`](../../imports/README.md)'s own rule: the live
   `Skills!D31:G31` is `CHA 0.2 + STR 0.1`, which is **8.8** at Char 39, and that is pinned with the
   range cited. Concept 02's `13.2 → bonus 3` is a real confirmed derivation whose 11.7 is
   **Charm's** number copied a row down, so it is pinned on Charm with the inferred `+1.5` — the
   derivation the page actually verified, attached to the weights that produce it. Both halves are
   kept; neither is dropped. This closes the open question `skills.json` raised when it landed.
4. **`evasion` and `endure` are deliberately not pinned end to end.** The sheet reads 18 against
   Dex 11 and 16 against Con 12; the extra 7 and 4 are Concept 08's open question and the corpus
   ships the raw stat saying so. Pinning those inputs would pin a *gap* as if it were a derivation,
   so only `mele` and `Ranged` run end to end. Their **decompositions** are pinned anyway — 18 and
   16 are in the ladder fixtures, where the mechanic is confirmed whatever produces the number.

**Coverage went beyond the to-be's list** where the pages carried more evidence than it cites:
Concept 01 confirms Monolith 1800 and Gods 1920 as well as the five listed totals; Concept 08's
sample-creature column carries two decompositions (inputs 25 and 12) that Concept 07's own table
misses; Concept 06's `4.642857142857` anomaly at 9 sub-type points is pinned so that "fix the
4.642857 cell" stays a decision somebody makes; and APT gains Speed 0 (the `IF(… <= 0, 1, …)`
floor, which is the half of that formula worth testing) and Speed 22 (🔍, the creature call sheet).

## Acceptance criteria

- [x] Every coverage bullet has fixtures with citations; failure messages include the citation.
      (Every row in [`fixtures.ts`](../../../src/engine/golden/fixtures.ts) carries a
      `GoldenCitation` — concept page, section heading, and the cell range where the page names
      one — rendered into both the test name and the assertion message by `describeCitation`.
      Verified by deliberately breaking the Persuasion row: the failure read
      `Concept 02 · Skill § Seed weights ✅ (Skills!D31:G31): expected 8.8 to be close to 11.7`.
      Two suite-level guards keep it honest: *names a concept page and a section for every row*
      and *marks exactly the rows the pages mark 🔍, and no others*, the latter pinning the
      inferred set by name so a confirmed row cannot be quietly re-tagged to silence a failure.)
- [x] The sample builder uses public APIs only; fixture data is a typed module, no JSON casts.
      (`buildSampleConfiguration` runs `importConfiguration` → `replaceConfig` → `addRace`, and
      `buildSampleCharacter` runs `createCharacter` — service and store actions only, no direct
      `localStorage` and no hand-built `Configuration`. The dial group edits the ruleset through
      `updateConstant`, and the pool group through `updateCurrentStatValue` and `updateRace`.
      `fixtures.ts` imports exactly one thing, `type StatAffinity`; there is no `as` cast and no
      JSON in it. `npx tsc --noEmit` is at the documented 2-error baseline.)
- [x] `npx vitest run` includes the suite — no separate command, no skips; green at milestone close (this landing is the final checkpoint, mirroring v1.0's §18 line).
      (`src/engine/golden/golden.test.ts`, plain Vitest, picked up by the normal run: **1618
      passed, 0 failed, 0 skipped** across 86 files — 1554 before, so +64, all of them this suite.
      [TEST_STATUS.md](../../../TEST_STATUS.md) updated.)
- [x] ~~Verified via the `verifier` subagent~~, the `fallow` skill, and the `coding-conventions`
      skill. (The `coding-conventions` skill was loaded before writing any code and is what caught
      the layering problem in note 1. `fallow audit --base HEAD` first returned **fail** on two
      introduced `unused-export` findings — `conceptSevenLadderFixtures` and `extraLadderFixtures`,
      exported but only composed into `ladderFixtures` in the same file — which were made
      module-private; it now returns **pass** with `dead_code_introduced: 0`, 0 clone groups and 0
      complexity findings, the 2 remaining findings being pre-existing dependency issues. **The
      `verifier` and `conventions-reviewer` subagents were not used**: this session runs under a
      standing instruction not to spawn subagents unless asked. Their three commands were run
      directly instead and are reported above — `npx vitest run` green, `npx tsc --noEmit` at the
      2-error baseline, `yarn run check` clean. The struck wording is what did not happen; the
      substance did.)

## Notes

- **The sample configuration should be built from [`docs/imports/`](../../imports/README.md), not
  hand-authored.** That corpus already holds the sheet's real stats, constants, curves, skills,
  materials, races and currency as importable fragments, with the cell ranges cited; it also
  raised the Persuasion weights divergence this ticket will have to settle (Concept 02 says
  `Char × 0.3`, the live `Skills!D31:G31` says `Char × 0.2 + Strenght × 0.1`).
  `src/services/sheetImport.test.ts` proves the data is faithful and importable — this ticket
  proves the engine computes the sheet's numbers from it.
- If a ticket-local test and a fixture disagree, the fixture wins — both came from the same page;
  one drifted. **None did**: the suite went green on its first run, which is the milestone's own
  result rather than this ticket's — twenty-nine tickets of engine work already agreed with the
  sheet, and this is what makes that a verdict instead of a belief.
- The importer milestone extends this suite with the full cached-value corpus (Bickuss Dickuss
  end-to-end, awakend three, both spell lists); the format should make that an append.
- Mana 310 / Health 7 as computed maxima need Ducklets investment data the docs don't fully
  specify — the sample character pins them as *pool behaviour* (stored current vs. derived max),
  not as derivation fixtures; the suite says so rather than inventing inputs.
