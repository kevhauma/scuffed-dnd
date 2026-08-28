# 01 · The new workbook — source, capture, and the sample character

**Capture of record:** [`../4.1 source sheets.xlsx`](../4.1%20source%20sheets.xlsx) — an export
**with formulas**, checked in beside this milestone on 2026-08-28. Secondary:
[*Copy of 4.1 abilities players*](https://docs.google.com/spreadsheets/d/18fMuQOMK65LVawBedC9R5mNASknJ8V56_QVFDdDa5Yc/edit),
the published Google copy, captured the same day from its public HTML view (values only). **The
two are different revisions** — where they disagree, the xlsx wins (overview D1/D3).

## The xlsx's sheets (the revision of record)

18 sheets. Excel truncates names at 31 characters and strips the Google tabs' colons, so ranges
cited against the xlsx use these exact names:

`Setup` · `Character Sheet` · `Backpack` · **`Spellbook`** · `Background Item selecter` ·
**`Background Archetype calulation`** · **`background Backpack Calculation`** ·
**`Background Setup Calculations `** (trailing space) · `background calculations spells ` ·
`Background Charater Sheet Calcu` · `Background refernces abilities ` (the passives) ·
`Sheet38` (empty — the actives placeholder) · `Background References Character` ·
`Background Reference inlay scal` · `Background Reference items scal` ·
`Background Reference Material s` · `Background References Naming` ·
`Background Referenes Race scali`

The four bolded sheets do not exist as separate tabs in the online copy: `Spellbook` is new (the
learned-spells play view, systems/13), and the three calculation sheets split what the online
copy's single `Background Charater Sheet: Calculations` tab folds together. Column layouts also
shift between revisions — the spells sheet is `B:E` (name/mana/range/effect) in the xlsx but
`B/D/E/F` online. **A fragment cites the xlsx layout.**

## The online copy's tabs (secondary)

| Tab (sheet's own spelling) | gid | Rows used | Holds |
|---|---|---|---|
| `Setup` | 1257070590 | 2–21 | Player inputs: name, races, archetype, focus skills — plus the final-build stat readout |
| `Character Sheet` | 1451394279 | 1–31 | The play view: identity, combat rolls, stats in three groups, the 48-skill grid |
| `Backpack` | 502430887 | 3–9 | The six gear slots, the coin purse (5 coins), a free-text item list |
| `Background Item: selecter` | 604276357 | 2–20 | Item builder: pick Materiaal + Inlay + item, 18 rows of "empty" placeholders |
| `background calculations spells: list` | 700474538 | 8–428 | **418 spells** — learned flag, name, mana cost, range/time, effect text |
| `Background Charater Sheet: Calculations` | 587109414 | 1–50 | The engine tab: ability calculator, base-stat assembly, combat calculator, point totals |
| `Background refernces abilities: passive` | 954840616 | 1–27 | **26 passive abilities** with effect text |
| `Background refernces abilities: actives` | 476290381 | — | **Empty.** A placeholder for active abilities |
| `Background References Character: Scaling` | 1150531882 | 2–55 | Per-skill stat scaling, focus constants, archetype point table, ATP/combat/points constants |
| `Background Reference inlay: scaling` | 466675890 | 1–253 | **25 gem families × 10 tiers** of stat grants |
| `Background Reference items: scaling` | 1634964595 | 1–1055 | **973 item rows × 48 skill columns** of bonuses, in 40 `###` shop categories |
| `Background Reference Material: scaling` | 114020050 | 4–250 | **24 material families × 10 tiers** of stat grants |
| `Background References: Naming` | 1684140310 | 2–431 | The glossary: every name list, coin, unit, size, creature type, and term definition |
| `Background Referenes Race: scaling` | 1915303761 | 3–26 | **25 races** × stats, six-core total, challenge rate, type, size |

Three capture caveats a later ticket must respect:

- **The HTML view lazy-renders rows.** The spells tab first reported 200 rows and actually holds
  428; extraction had to re-read until stable. Anyone re-capturing by eye should scroll each tab to
  the bottom before trusting a count.
- **The HTML view shows *formatted* values.** The archetype point table displays as integers
  online while the xlsx holds the underlying decimals (`0.75`, `4.64285714…`). Numbers captured
  from the HTML view are rounded until the xlsx agrees — this bit systems/05 once already.
- **Sheet names carry typos** (`Charater`, `refernces`, `Referenes`, `selecter`). Ranges must be
  cited with the typo intact or they will not resolve.

## The sample character

Every background tab is computed for one character, and the capture verified enough of the
arithmetic to make him this milestone's golden fixture (plan §15), the way DX-04's fixtures closed
v2.0:

**Thomas the test more** — races Ducklets + Ducklets, archetype Science, focus skills
Arcane / Summening / Arcane (a duplicate is legal and stacks), level 1, Dream level 1, ATP 1,
points spend 3.

Verified end to end from captured values (all cells named in the system docs):

- **Race blend**: Ducklets + Ducklets → the Ducklets block unchanged (8/9/8/8/12/14, H3, M210,
  S20) — consistent with the existing `roundup((a+b)/race_blend_divisor)`.
- **Gear**: right hand holds *Iron Ore 10 Battleaxe with Diamond 4 inlay*. Its stat grant is the
  material row plus the inlay row — Str 10+8=18, Con 10+8=18, Char 0+8=8, Health 5+0=5, Mana
  0+4000=4000 — exactly the calculation tab's gear column. **Composition arithmetic confirmed.**
- **Final stats**: Str 26, Dex 9, Con 26, Int 11, Wis 13, Char 22, Health 8, Mana 4211, Speed 20 —
  race + gear + archetype-bonus column, no unexplained residue except the archetype column itself
  (systems/05, open question).
- **Rolls**: Mele 26 = final Str → `1D20 + 0D12 + 1D6 + 0`; Ranged 9 = final Dex →
  `0D20 + 0D12 + 1D6 + 3`; Evasion 13 = Dex + Speed/5 → `0D20 + 1D12 + 0D6 + 1`; Endurance 22.4 =
  (Str+Con)/2.5 + Health/5 → `1D20 + 0D12 + 0D6 + 2`. Ladder unchanged from v2.0.
- **ATP**: Speed 20 with the same constant 30 → `max(1, round(20/30))` = 1. The old `apt_value`
  formula still holds under the new name.
- **Skills**: all 48 levels and bonuses captured from `Character Sheet` rows 16–31 (three columns
  of 16), e.g. Arcane 11 / bonus 3, intimidation 8 / bonus 5 (of which +3 is gear).

## What this capture did *not* transcribe

- **The full 973×48 item bonus matrix** — structure, categories, names and samples are captured
  (systems/11); the matrix itself lives in the checked-in xlsx for the ticket that imports it.
- **The 418 spell effect texts** — names, mana and range are captured in full; effect texts are
  sampled (systems/13) and live in the xlsx (326 of them are formulas, the rest plain text).

Formulas, by contrast, **are** captured: the xlsx settled every mechanic these docs state — see
overview D3. Where a `systems/` doc still says *inferred*, that is deliberate (the cell genuinely
under-determines intent, e.g. a suspected off-by-one — systems/06).
