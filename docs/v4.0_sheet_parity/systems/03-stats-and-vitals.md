# 03 · Stats — three groups, a Temp column, and flavour text

**Sheet source:** `Character Sheet` A8:N12 · `Background References: Naming` H3:I11 ·
`Background Charater Sheet: Calculations` R2:AA11.

## What the new sheet says

The nine stats are unchanged in name and role, but the sheet now presents them in **three groups**
with different columns per group (`Character Sheet` rows 9–12):

| Physical | Base · Pts | Mental | Base · Pts | Vitals | Base · **Temp** · Pts |
|---|---|---|---|---|---|
| Strenght | 26 · 0 | Int | 11 · 3 | Health | 8 · — · 0 |
| Dex | 9 · 0 | Wis | 13 · 0 | Mana | 4211 · — · 0 |
| Con | 26 · 0 | Char | 22 · 0 | Speed | 20 · — · 0 |

- **Only Vitals get a Temp column**, and the xlsx shows it is a **bare input** — no formula writes
  it and no formula reads it (`Character Sheet` M10:M12; the Base column beside it is derived).
  That makes it a tracking box: most plausibly where the Player writes the pool's *current* value
  (which the app already models as `currentResourceValues`), possibly a temporary-bonus scratch
  box. Either way it is player state the engine never consumes.
- ATP sits in the identity block, not in a stat group (systems/02).
- **A final stat may be fractional.** `Final = SUM(race base + gear + archetype gain)` with no
  rounding (`Calcu` R3), and the archetype term can be `0.75 × dreamLevel` (systems/05). The
  sample lands on integers by luck of its picks.
- The Naming tab gives each stat a flavour line, verbatim: Strenght "being able to crush a
  tomato", Dex "…dodge a tomato", Con "…eat a bad tomato", Int "knowing a tomato is a fruit",
  Wis "knowing not to put a tomato in a fruit salad", Char "being able to sell a tomato based
  fruit salad", Health "How many hits you can take", Mana "How many spells you can cast",
  Speed "Kachow".
- The race tab's unlabelled total row (`Background Referenes Race: scaling` B13) is still the
  **six-core-only** total (Ducklets 8+9+8+8+12+14 = 59 ✓) — Concept 01's rule, unchanged.

The calculation tab (R2:AA11) assembles a final stat as
**race base + per-slot gear bonuses + archetype bonus** — six gear columns, one per slot
(systems/08), each fed by material + inlay vectors (systems/12), and one archetype column
(systems/05).

## What the app has today

- Ten stats (the nine above + APT) in one flat ordered list (TICKET-STAT-01); no grouping concept.
- Composition already runs base + investment gains + racial + equipment (`statCalculator.ts`), so
  the *assembly* matches — what changes is where equipment bonuses come from (systems/12).
- `currentResourceValues` holds a resource's *current*; there is no *temporary* bonus state.
  A derived maximum never overwrites a stored current (TICKET-RES-03) — Temp must respect that
  same discipline.
- Stat descriptions exist as a field and hold v2.0's own prose (stats.json).

## Parity gap

1. **Stat grouping** — the sheet's Physical/Mental/Vitals is presentation with one mechanical
   shadow (only Vitals carry Temp). Model as an optional `Stat.group?: string` (User-named, not a
   closed set — it is their ruleset) or as sheet-layout metadata; the ticket decides, but the
   character sheet renders three columns either way. Additive-optional.
2. **The Temp column is not built at all** (User ruling, 2026-08-29: it means *nothing*). No
   `tempStatValues`, no third box on the sheet, no rendering of the column. It stays in this
   document as a record of what the workbook draws, and `currentResourceValues` remains the only
   "current" the app has. **Speed does not become a resource** either (same ruling) — it keeps its
   Temp box in the sheet and no pool in the app.
3. **Refresh the stats fragment** — new descriptions (the tomato ladder), the ATP rename
   (systems/02), `group` values, re-sourced ranges.

## Backend note

Both changes live inside the documents; the calculator change is `shared/engine/`. Nothing
server-side.

## Open questions

- **May a fractional final stat reach the sheet?** The workbook allows it (no rounding on the
  final SUM); the app displays whatever the engine returns. Decide in the ticket whether to mirror
  exactly or surface the ruleset's `rounding` mode — mirroring exactly is the default (the sheet
  wins). Live now that a sub-affinity stat gains `+dreamLevel` and `main(0)` is 0.75.

*(Settled by User ruling, 2026-08-29: the Temp box means nothing and is not modelled; Speed does
not become a resource.)*
