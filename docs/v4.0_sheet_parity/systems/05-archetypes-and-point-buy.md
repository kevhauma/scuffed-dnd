# 05 · Archetypes — new names, a proven affinity matrix, and Dream level in the gains

**Sheet source (xlsx):** `Background References Naming` D3:E8 ·
`Background References Character` J3:M55 (the point table) ·
`Background Archetype calulation` B2:M12 (the routing formulas) · `Setup` B12.

## What the new sheet says

Six archetypes, renamed, with new taglines (verbatim):

| New name | Tagline | Replaces (matched by tagline/main stat) |
|---|---|---|
| Muscels | Strenght above all | Strong |
| thieving | now you see me | Sneaky |
| Science | magic and science is where you excel | Smart |
| Advisor | nature and advice is where your heart lays | Wise |
| Wall | Shielding the weak | Tanky |
| Leader | Charisma is on point | Funny |

### The point table is the old one — unchanged

The online HTML view *displays* the "point verdeling" table as integers, which first read as a new
integer table. **The xlsx shows that was cell formatting**: the underlying values are the old
decimals — `main = 0.75 × (points + 1)` exactly (0.75, 1.5, 2.25 … 38.25 at 50), `sub` at 9
points still `4.64285714285714`, `non` at 50 still `12.0665306122449`. That is **byte-identical
to the app's existing `point_buy` curve** (curves.json), anomalies included. **No curve change in
this milestone**, and v2.0's "decide about the anomalies" question stays with the User.

### The affinity matrix is finally proven

v2.0 could only prove each archetype's main stat. The xlsx's `Background Archetype calulation`
writes a distinct formula per (stat × archetype) cell, which *is* the matrix:

| Archetype | main | sub | non |
|---|---|---|---|
| Muscels | Strenght | Con, Health | the rest |
| thieving | Dex | Mana, Speed | the rest |
| Science | Int | Wis, Mana | the rest |
| Advisor | Wis | Int, Mana | the rest |
| Wall | Con | Strenght, Health | the rest |
| Leader | Char | Dex, Mana | the rest |

### Dream level enters the gain formula

Per stat, with `p` = the points the Player put into *that stat* (the app's existing per-stat
routing, confirmed):

- **main**: `gain = point_buy.main(p) × dreamLevel`
- **sub**:  `gain = point_buy.sub(p) + dreamLevel` — so every sub stat gains `+dreamLevel` flat,
  points or no points
- **non**:  `gain = point_buy.non(p)`

That explains the sample completely: Science at dream 1 with 3 points on Int shows Int +3
(`main(3)=3 × 1`), Wis +1 and Mana +1 (`sub(0)=0 + 1` each) — the residue the value-only capture
could not attribute. Note `main(0) = 0.75`, so gains (and final stats) can be **fractional**; the
final-stat sum applies no rounding (systems/03).

## What the app has today

- Six archetypes (archetypes.json, TICKET-ARC-01) with the old names and only `main` tagged —
  the sub/non split was deliberately not invented.
- `point_buy` (curves.json) — **already exactly the sheet's table.**
- `statGain` routes each stat's spent points through the curve column named by the archetype's
  affinity (TICKET-ARC-02) — the same per-stat routing the formulas confirm. No dream term.

## Parity gap

1. **Rename the six archetypes** and replace descriptions with the new taglines — renames are
   safe (TICKET-REF-01); ids and `Character.archetypeId` do not move.
2. **Complete the affinity matrix** in archetypes.json from the table above — two `sub` tags per
   archetype, everything else absent (`non` stays sparse; the data-model rule). The validator's
   "does not tag" warning finally retires for the imported set.
3. **The dream term in `statGain`** — main gains multiply by the character's `dreamLevel`
   (systems/02), sub gains add it. Where the dial lives (hard-wired shape vs two constants) is the
   ticket's design call; the sheet hard-wires it.
4. **No curve work.** The `point_buy` rows and generator stay untouched.

## Backend note

Data plus one shared-engine change (`statGain`); the server re-derives through it.

## Open questions

- The old anomalies (`4.642857…`, `12.0665…`) remain the User's decision, unchanged since v2.0.

*(Settled by User ruling, 2026-08-29: sub-affinity stats **do** gain `+dreamLevel` at zero points,
as the formulas have it. So every archetype grants a small passive block over its two sub stats
that grows with Dream level, and a character's stats move the moment the DM raises it — pin that
in the fixtures.)*
