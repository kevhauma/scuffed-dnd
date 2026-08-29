# Golden fixtures

The v2.0 milestone's parity gate ([TICKET-DX-04](../../../docs/v2.0_sheet_core/tickets/TICKET-DX-04-golden-fixtures-from-the-sheet.md),
[spec §12](../../../docs/excel%20export%20summary/ttrpg-app-spec.md)).

Every ✅-confirmed derivation in the [concept pages](../../../docs/excel%20export%20summary/concepts/README.md),
encoded as data and run through the **real engine** over the **real corpus**
([`docs/imports/ducklets.json`](../../../docs/imports/README.md)) on a sample-character-shaped
configuration. It answers one question: *does the app compute the spreadsheet's numbers?*

| File | What it is |
|---|---|
| [`fixtures.ts`](./fixtures.ts) | The rows — inputs, expected outputs, citations. Types and the frozen constants beside them; no engine, no stores. |
| [`golden.test.ts`](../../../client/integration/golden.test.ts) | The suite, plus the sample ruleset/character builder. Lives in `client/integration/` since TICKET-DX-07 — it drives both stores, and the Kernel may not import its callers. |

Runs in the normal `npx vitest run`. No separate command, no skips.

## The rule

> **A failing fixture is never fixed by editing the fixture.**

A red row means the engine changed, not that the sheet did. Fix the engine, or — if the sheet
really does say something else — **change the fixture and its citation together**. A new expected
value with the old citation still attached is the one edit this file exists to prevent: it turns a
parity gate into a record of whatever the code happened to do that day.

The same rule already governs [`docs/imports/`](../../../docs/imports/README.md), for the same
reason. That corpus proves the *data* is faithful and importable; this proves the *engine* computes
the sheet's numbers from it. The overlap is deliberate.

## Confirmed vs. inferred

The concept pages mark ✅ what they read out of the sheet and 🔍 what they inferred from it. Rows
carrying the latter set `inferred: true`, and the suite pins **which** rows those are — so a
confirmed row cannot quietly be re-tagged as inferred to make a failure go away. Two rows are
inferred today:

- Concept 02's `+1.5` for one starting pick (the points→level conversion is that page's open question);
- APT at Speed 22 (Concept 05 cannot tell "the same formula" from "a hardcoded 1" on the creature sheet).

## Four settlements this suite makes

Each of these was an open question the fixtures could not avoid answering.

### 1. The sample character's stat line is installed as a race stat block

Concept 01 confirms Bickuss Dickuss at Str 10 / Con 12 / Dex 11 / Int 8 / Wis 15 / **Char 39** /
Health 7 / Mana 310 / Speed 30, and says the Char outlier is the archetype's point-buy multiplier
at work. What it does **not** say is how the line splits between race base and points spent — and
the split is not recoverable: `Ducklets` is not among the ten races the export carries, the
point-buy main column is `0.75 × (points + 1)` which never lands on 29 exactly, and a level-1
character's budget is 3 points.

So the suite installs the documented line as a `Ducklets` race block and gives the character zero
investment. Every number used is still a sheet number; only the split is declared unknown. The
point-buy multiplier is pinned **separately and directly**, against Concept 06's seed table — where
it is confirmed row by row — rather than being reverse-engineered out of one character.

What that costs: the nine stat-line rows assert that the composition returns the block untouched at
zero investment. What it buys: everything genuinely derived from that line — APT, the six-core
total, every skill level and bonus, every roll input and pool — is checked against numbers the
sheet supplies independently. Settlement 4 is the consequence of "untouched" having become a
stronger claim than it was.

### 4. The sample character is archetype-less, deliberately (TICKET-ARC-04)

`buildSampleCharacter` gives Bickuss Dickuss no `archetypeId`, and **re-adding one breaks the
suite** — twelve rows, with nothing wrong with any of them.

It follows from settlement 1. The whole confirmed stat line is installed as a race block, so *any*
other contribution double-counts it. Until TICKET-ARC-04 an archetype contributed exactly zero at
zero investment, so the tag was free and the fixture carried it. It is not free any more: Dream
level multiplies a main-tagged stat's gain and adds to a sub-tagged one's, so a main-tagged stat
gains `0.75 × dream` and a sub-tagged one `+dream` **with nothing spent**, and every total drifts.

The archetype's routing is not lost by dropping the tag — it is pinned directly instead, in
*routes the archetype's main stat through the main column* and in the `pointBuyFixtures` rows, where
it can be read against the table rather than inferred from one character's total.

**If a later ticket needs the sample character to carry an archetype**, the way through is to stop
installing the line as a race block — i.e. to reopen settlement 1 with a split the sheet supports —
not to adjust the totals until they pass again.

### 2. Persuasion's weights: the sheet wins, and Concept 02's row moves to Charm

Concept 02's derivation table has `Persuasion = Char × 0.3 → 11.7 + 1.5 = 13.2 → bonus 3`. The live
`Skills!D31:G31` has `Char × 0.2 + Strenght × 0.1`, which is **8.8** at Char 39. The page's 11.7 is
Charm's number, copied one row down.

Both halves are pinned rather than one being dropped:

- **Persuasion** at the live weights — 8.8, bonus 2, cited to the range.
- **Charm with one starting pick** — 11.7 + 1.5 = 13.2, bonus 3, tagged inferred. That is the
  derivation Concept 02 actually verified, attached to the skill whose weights produce it.

This closes the open question [`docs/imports/README.md`](../../../docs/imports/README.md) raised
when `skills.json` landed.

### 3. `evasion` and `endure` are deliberately not pinned end to end

Concept 08 reads evasion at input 18 against Dex 11 and endure at 16 against Con 12 — an extra 7
and 4 from somewhere, almost certainly equipment, and that page's open question. The corpus ships
the raw stat and says it is short. Pinning those inputs here would pin a *gap* as though it were a
derivation, so only `mele` and `Ranged` — the two Concept 08 confirms — run end to end.

Their **decompositions** are pinned, though: 18 and 16 appear in the ladder fixtures, where the
mechanic is confirmed regardless of what produces the number.

## Health 7 and Mana 310 are pool fixtures, not derivation fixtures

What *computes* those maxima needs Ducklets investment data the export does not carry. The rows for
them assert the pool contract instead — a stored current value seeded from, and measured against, a
derived maximum, and never silently overwritten when the maximum moves (Concept 20's
non-negotiable). They claim nothing about the arithmetic behind the maximum.

## Extending it

The importer milestone appends the full cached-value corpus (Bickuss Dickuss end to end, the
awakend three, both spell lists). That is an **append**: a new exported array in `fixtures.ts` with
the same `GoldenFixture` shape, plus one `describe` block in `golden.test.ts`. Nothing about the
existing rows has to move.

When you add a row:

1. Read the number out of a concept page, a `systems/` document or the sheet — never out of a test
   run.
2. Give it a `citation` whose `section` matches a real heading on that page, and a `range` only if
   the page names one. **A number a v4.0 `systems/` document states, and the concept pages do not,
   sets `document: 'v4'`** and names the systems doc in `concept` — the concept pages are
   superseded wherever the new workbook changed something (v4 D1), and a citation that leads to a
   page not stating the number is worse than none.
3. Tag it `inferred: true` if the page marks it 🔍, and add its name to the pinned inferred list in
   `golden.test.ts`.
