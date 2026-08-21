# Sheet imports

Real ruleset data, lifted from the spreadsheet the v2.0 spec was reverse-engineered from, in the
shape the app's **Import** button accepts.

**Source:**
[Ducklets sheet](https://docs.google.com/spreadsheets/d/1Y_KXFpPQTXaPi2oXn-LdZBTPZNLMPZ2xb3iK7wtHum4/edit)
· exported 2026-08-09 · the same workbook
[`docs/excel export summary/`](../excel%20export%20summary/ttrpg-app-spec.md) documents cell by
cell.

Every built feature owns **one fragment** here carrying that feature's slice of the sheet.
[`ducklets.json`](./ducklets.json) is the merge of all of them — a whole `Configuration`, which is
the only thing the importer accepts — and it is **generated**, never hand-edited.

```bash
yarn run sheet:import
```

## Why fragments instead of one hand-maintained file

A feature and its data land together. When TICKET-SKL-02 replaces `bonusFormula` with weighted
`stat_weights`, exactly one file changes and its notes explain the move; nothing else in the corpus
is touched, and the diff is reviewable. The merged file is a build product, so it can never drift
from the fragments without the suite saying so.

## The fragments

| File | Feature | Tickets | Concept | Sheet ranges |
|---|---|---|---|---|
| [`stats.json`](./stats.json) | Stats | STAT-01 | 01 | `Creature stats!A5:A13`, `Charactersheet!E9` |
| [`constants.json`](./constants.json) | Constants | CST-01, CST-02 | 05 | `Calculator!G13:G14`, `!P2:Q2`, `!P5:Q5`, `Setup!Q6` |
| [`curves.json`](./curves.json) | Curves | CRV-01…03 | 06 | `Calculator!B2:E54` |
| [`skills.json`](./skills.json) | Skills | SKL-02, SKL-03 | 02 | `Skills!C12:G59` |
| [`dice-ladders.json`](./dice-ladders.json) | Dice ladder | ROLL-03 | 07 | `Calculator!I16:L16`, `!G17:N20` |
| [`roll-definitions.json`](./roll-definitions.json) | Roll definitions | ROLL-05 | 08 | `Calculator!G17:N20`, `Charactersheet!D12:H14` |
| [`materials.json`](./materials.json) | Materials | MAT-01 | 09 | `Components!A5:L295` |
| [`items.json`](./items.json) | Items | v1.0 shape | 11 | `Equimment!A4:L194` |
| [`equipment-slots.json`](./equipment-slots.json) | Equipment slots | v1.0 shape | 10 | `Charactersheet!M3:O15` |
| [`races.json`](./races.json) | Races | RACE-01, RACE-02 | 04 | `Creature stats!B4:K14` |
| [`currency-tiers.json`](./currency-tiers.json) | Currency | v1.0 shape | 16 | `Charactersheet!Q18:S23` |
| [`archetypes.json`](./archetypes.json) | Archetypes | ARC-01 | 03 | `Calculator!B2:B7`, `!C2:C7` |

Not here yet, because the feature is not built: XP thresholds (RES-01 — the sheet has none either),
and every later-milestone concept (creatures, spells, passives, harvest tables, item templates).

## Fragment format

```jsonc
{
  "feature": "curves",                    // kebab slug, matches the filename
  "title": "Curves",                      // what a human calls it
  "tickets": ["TICKET-CRV-01"],           // what shipped this shape
  "concept": "06 · Curve",                // the concept page it traces to
  "source": {
    "spreadsheet": "https://docs.google.com/…",
    "exportedAt": "2026-08-09",
    "ranges": ["Calculator!B2:E54"]       // exact enough to re-check by eye
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
  typo `Strenght`, the `4.64285714285714` at 9 points, the duplicate `skinning`/`Skinning` — all
  preserved, all noted. Renaming is safe (TICKET-REF-01), so cleaning up is the User's edit to
  make, not ours to smuggle in.
- **Never invent a number to fill a required field.** Where the sheet has nothing — currency
  exchange rates, XP thresholds, a skill's max base level — the field takes a neutral value and a
  note says so. A plausible guess in the User's ruleset is worse than an obvious gap.
- **Where the current shape cannot hold the sheet's data, say so in `notes`** and put in what
  fits. `items.json` keeps base values in the description because `Item` has no value field, and
  `roll-definitions.json` ships evasion and endure short of the sheet. The note is what lets
  the later ticket lift the data across.
- **`ducklets.json` is generated.** Edit a fragment, run `yarn run sheet:import`, commit both.
- **A failing `sheetImport.test.ts` is never fixed by editing the corpus to match the code** unless
  the sheet actually says so. It usually means the merge was not regenerated, or a persisted shape
  changed and a fragment has to be brought forward with it.

## Verifying

[`src/services/sheetImport.test.ts`](../../src/services/sheetImport.test.ts) runs in the normal
suite. It checks every fragment's envelope, re-runs the merge and fails on drift, puts the result
through the same `validateConfiguration` the Import button uses, and re-asserts the derivations the
concept pages confirmed — the six-core stat totals, the point-buy column, the seed skill weights,
the labelled constants.

That overlaps with [TICKET-DX-04](../v2.0_sheet_core/tickets/TICKET-DX-04-golden-fixtures-from-the-sheet.md)
on purpose but does not replace it: this proves the **data** is faithful and importable, DX-04
proves the **engine** computes the sheet's numbers from it.

## Open questions this corpus surfaced

- ~~**Persuasion's weights.**~~ **Settled by
  [TICKET-DX-04](../v2.0_sheet_core/tickets/TICKET-DX-04-golden-fixtures-from-the-sheet.md).** The
  sheet wins, as the rules above say it must: `Skills!D31:G31` is `Char × 0.2 + Strenght × 0.1`,
  which is 8.8 at Char 39, and the golden suite pins that with the range cited. Concept 02's
  `13.2 → bonus 3` is a real derivation whose 11.7 is **Charm's** number copied a row down, so it
  is pinned on Charm with the inferred `+1.5`. Both halves kept, neither invented.
- **Currency exchange rates.** Absent from the sheet entirely (Concept 16). Every value in the
  corpus is quoted in Copper on the inference that item prices are large integers.
- **Evasion and endure inputs.** 18 and 16 for the sample character, against Dex 11 and Con 12
  (Concept 08). The fragment carries the raw stat only. **Still open** — TICKET-DX-04 deliberately
  left it open rather than closing it by fiat: pinning those inputs in the golden suite would pin a
  *gap* as though it were a derivation, so only `mele` and `Ranged` run end to end there. The two
  decompositions are pinned, since the ladder is confirmed whatever produces the number.
