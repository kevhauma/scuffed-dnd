# Sheet imports

Real ruleset data, lifted from the source spreadsheet, in the shape the app's **Import** button
accepts.

**Source (v4.0 data pass, 2026-09-01):** the new workbook —
[*Copy of 4.1 abilities players*](https://docs.google.com/spreadsheets/d/18fMuQOMK65LVawBedC9R5mNASknJ8V56_QVFDdDa5Yc/edit)
— read from the capture of record checked in beside the spec,
[`docs/v4.0_sheet_parity/4.1 source sheets.xlsx`](../v4.0_sheet_parity/4.1%20source%20sheets.xlsx),
exported 2026-08-28. **Every fragment here is now sourced from it**; the old workbook and
[`docs/excel export summary/`](../excel%20export%20summary/ttrpg-app-spec.md) remain the record of
where the v2.0 shapes came from, and of nothing else.

Every built feature owns **one fragment** here carrying that feature's slice of the sheet.
[`ducklets.json`](./ducklets.json) is the merge of all of them — a whole `Configuration`, which is
the only thing the importer accepts — and it is **generated**, never hand-edited.

## Both halves are generated now

The fragments themselves used to be hand-transcribed. Since the v4.0 data pass they are **read out
of the checked-in workbook by a script**, so the whole corpus regenerates from a clone with no
network and no credentials, and re-reading the sheet is a command rather than a week:

```bash
yarn run sheet:source   # rewrite the fragments from the workbook
yarn run sheet:import   # merge them into ducklets.json
```

[`scripts/build-fragments.mjs`](../../scripts/build-fragments.mjs) is where every fragment's rows,
provenance and notes are authored — **edit it, not the JSON**, because the next run overwrites
whatever a hand-edit put there. It reads the `.xlsx` through
[`scripts/xlsx.mjs`](../../scripts/xlsx.mjs), a 330-line ZIP-and-XML reader written rather than
depended on (CLAUDE.md: no new dependencies inside a ticket).

**Values, and where it matters, formulas.** A spell's effect cell is
`"…hit by " & Calcu!R7`, whose *cached value* is the number the sample character happens to have;
what the corpus wants is the reference. So spell effects are transcribed from the formula source
into the app's `{placeholder}` grammar, and everything else is read as values.

## Why fragments instead of one hand-maintained file

A feature and its data land together. When TICKET-SKL-02 replaces `bonusFormula` with weighted
`stat_weights`, exactly one file changes and its notes explain the move; nothing else in the corpus
is touched, and the diff is reviewable. The merged file is a build product, so it can never drift
from the fragments without the suite saying so.

## The fragments

Fifteen, and the ranges are the **new** workbook's tabs. Tab names are the file's own, truncated as
the workbook truncates them (`Background Reference Material s`, not `… Material: scaling`) — a name
spelled the online copy's way fails the build rather than silently reading the wrong sheet.

| File | Feature | Tickets | System | Sheet ranges | Rows |
|---|---|---|---|---|---|
| [`stats.json`](./stats.json) | Stats | STAT-01, STAT-04 | 03 | `Naming!H3:I11`, `Character Sheet!A8:N12` | 10 |
| [`skills.json`](./skills.json) | Skills | SKL-02…05 | 06 | `References Character!A4:E51` | 48 |
| [`constants.json`](./constants.json) | Constants | CST-01/02, RES-02/05, SKL-05 | 05 | `References Character!F3:H7`, `!O2:P3`, `!S2:U4`, `!X2:Y3` | 10 |
| [`curves.json`](./curves.json) | Curves | CRV-01…03 | 05 | `References Character!J3:M55` | 2 |
| [`archetypes.json`](./archetypes.json) | Archetypes | ARC-01, ARC-04 | 05 | `Naming!D3:E8`, `Archetype calulation!B2:M12` | 6 |
| [`races.json`](./races.json) | Races | RACE-01…04 | 04 | `Race scali!B3:AA17`, `Naming!BD3:BD9`, `!BG3:BG19` | 25 |
| [`materials.json`](./materials.json) | Materials | MAT-01, MAT-03 | 09 | `Material s!A4:H250` | 24 · 240 tiers |
| [`inlays.json`](./inlays.json) | Inlays | INL-01 | 10 | `inlay scal!A1:J253` | 25 · 249 tiers |
| [`items.json`](./items.json) | Items | ITEM-01, ITEM-02 | 11 | `items scal!A1:AX1055` | 830 |
| [`equipment-slots.json`](./equipment-slots.json) | Equipment slots | INV-03, INV-04 | 08 | `Backpack!C4:D9`, `Naming!BA12:BA17` | 6 |
| [`dice-ladders.json`](./dice-ladders.json) | Dice ladder | ROLL-03 | 07 | `Calculator!I16:L16`, `!G17:N20` | 1 |
| [`roll-definitions.json`](./roll-definitions.json) | Roll definitions | ROLL-05/06/08 | 07 | `Charater Sheet Calcu!AB2:AG8` | 4 |
| [`currency-tiers.json`](./currency-tiers.json) | Currency | CUR-01, CUR-02 | 16 | `Naming!K2:K7` | 5 |
| [`spells.json`](./spells.json) | Spells | SPL-01…03 | 13 | `calculations spells !A8:E428` | 418 |
| [`passives.json`](./passives.json) | Passive abilities | PAS-01 | 14 | `refernces abilities !B2:D27` | 26 |

`dice-ladders.json` is the one fragment the data pass left alone: the ladder is `20 | 12 | 6` in both
workbooks and is still hand-written here rather than generated.

Not here, because the sheet does not have it: **XP thresholds** — `curves.json` carries the table's
shape and one placeholder row, and neither workbook fills it in.

## Fragment format

```jsonc
{
  "feature": "curves",                    // kebab slug, matches the filename
  "title": "Curves",                      // what a human calls it
  "tickets": ["TICKET-CRV-01"],           // what shipped this shape
  "concept": "05 · Archetypes and point buy",   // the systems doc it traces to
  "source": {
    "spreadsheet": "https://docs.google.com/…",
    "workbook": "docs/v4.0_sheet_parity/4.1 source sheets.xlsx",  // what was actually read
    "exportedAt": "2026-08-28",
    "ranges": ["Background References Character!J3:M55"]          // re-checkable by eye
  },
  "confidence": "confirmed",              // see below
  "notes": ["…"],                         // every caveat, anomaly and shape mismatch
  "data": { "curves": [ /* Configuration entities */ ] }
}
```

`data` keys are `Configuration` array fields and nothing else. Two fragments never write the same
key, so merge order cannot change the result.

**Confidence** uses the concept pages' markers: *confirmed* (read from the sheet's formulas or
cached values), *inferred* (consistent with the data, not proven), *absent* (the sheet does not
have it). Where a fragment is mixed, the field says which part is which.

## Rules

- **The sheet wins.** A fragment records what the spreadsheet says, not what would be tidier. The
  typo `Strenght`, the `4.64285714285714` at 9 points, `aasimar `'s trailing space, `guargantian`,
  the sheet's own `#REF!` errors — all preserved, all noted. (The `skinning`/`Skinning` duplicate
  this line used to cite is gone: the creator resolved it in the new workbook, so the corpus has.) Renaming is safe (TICKET-REF-01), so cleaning up is the User's edit to
  make, not ours to smuggle in.
- **Never invent a number to fill a required field.** Where the sheet has nothing — currency
  exchange rates, XP thresholds, a skill's max base level — the field takes a neutral value and a
  note says so. A plausible guess in the User's ruleset is worse than an obvious gap.
- **Where the current shape cannot hold the sheet's data, say so in `notes`** and put in what
  fits. `spells.json` writes an effect fragment it cannot express as the sheet's own source text,
  and `items.json` leaves `equipmentSlotType` absent because the workbook never says which slot a
  template goes in. The note is what lets the later ticket lift the data across.
- **A reconciliation is stated, never silent.** The item matrix's un-headed tail repeats 135 names
  with different vectors; which copy wins was the User's call (2026-09-01: the tail), and the
  fragment's `notes` carries the raw row count, the reconciled count and every row dropped.
- **The fragments are generated too.** Edit `scripts/build-fragments.mjs`, run `yarn run
  sheet:source` then `yarn run sheet:import`, commit all three. A hand-edit to a `.json` here is
  lost on the next run.
- **A failing `sheetImport.test.ts` is never fixed by editing the corpus to match the code** unless
  the sheet actually says so. It usually means the merge was not regenerated, or a persisted shape
  changed and a fragment has to be brought forward with it.

## Verifying

[`src/shared/services/sheetImport.test.ts`](../../src/shared/services/sheetImport.test.ts) runs in the normal
suite. It checks every fragment's envelope, re-runs the merge and fails on drift, puts the result
through the same `validateConfigurationShape` the Import button uses, runs the **referential**
report over it, and re-asserts the derivations the sheet confirmed — the six-core stat totals, the
point-buy column, the v4 skill weights, the labelled constants, and the two catalogs' own counts.

The referential check earns its keep: regenerating the coin ladder from the workbook's own spellings
moved every currency tier's id, and 240 material tiers went on naming the one it replaced. Nothing
else in the suite noticed.

Two golden suites sit beside it and prove a different thing — that the **engine** computes the
sheet's numbers *from* this data:

- [`golden.test.ts`](../../src/client/integration/golden.test.ts) — the **old** workbook's sample
  character against the concept pages that reverse-engineered it (TICKET-DX-04).
- [`thomasGolden.test.ts`](../../src/client/integration/thomasGolden.test.ts) — **Thomas the test
  more**, the *new* workbook's own sample character, rebuilt on this corpus through the public
  actions and read back cell by cell against his Character Sheet. That is the parity question in its
  bluntest form: import `ducklets.json`, build the sheet's character on it, get the sheet's numbers.

## Open questions this corpus surfaced

- ~~**Persuasion's weights.**~~ **Settled by
  [TICKET-DX-04](../v2.0_sheet_core/tickets/TICKET-DX-04-golden-fixtures-from-the-sheet.md).** The
  sheet wins, as the rules above say it must: `Skills!D31:G31` is `Char × 0.2 + Strenght × 0.1`,
  which is 8.8 at Char 39, and the golden suite pins that with the range cited. Concept 02's
  `13.2 → bonus 3` is a real derivation whose 11.7 is **Charm's** number copied a row down, so it
  is pinned on Charm with the inferred `+1.5`. Both halves kept, neither invented.
- **Currency exchange rates.** Absent from both workbooks. `conversionToNext` is 0 on every tier and
  the new sheet prices nothing at all, so there is no longer even an inference to hang a base unit
  on — the ladder is the shape of money with the amounts still to come.
- ~~**Evasion and endure inputs.**~~ **Settled by the data pass.** The old sheet's 18 and 16 carried
  a term nothing explained, and v2.0 shipped both rolls honestly short rather than fitting a
  constant nobody could source. The new workbook writes both out
  (`Charater Sheet Calcu` AB5:AB6): evasion is `Dex + Speed/5` and Endurance is
  `(Strenght + Con)/2.5 + Health/5`. All four rolls now run end to end in `thomasGolden.test.ts`.
- **Which slot a template goes in.** The item matrix has no such column — the sheet composes it at
  the point of use — so all 830 templates arrive with `equipmentSlotType` absent and a User assigns
  them. It is the one thing a Player has to do by hand before the corpus plays.
- **What the effect templates cannot say.** 25 spell effect cells are `#REF!` in the sheet itself and
  two read a skill's *secondary scaling term*, which the formula namespace has no name for. Both are
  written as the sheet's own text and listed in `spells.json`'s notes.
