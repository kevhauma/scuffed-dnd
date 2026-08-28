# 07 · Combat rolls — evasion and endurance, finally whole

**Sheet source (xlsx):** `Character Sheet` F1:G5 · `Background Charater Sheet Calcu` AB2:AG8 ·
`Background References Character` S2:U4 · `Background References Naming` BA8:BB11.

## What the new sheet says

Four rolls, same ladder, one rename, and — read from the xlsx's formulas
(`Background Charater Sheet Calcu` AB2:AG8) — **confirmed inputs for all four**:

| Roll | Input formula (verbatim mechanics) | Sample | Decomposition |
|---|---|---|---|
| Mele | final Strenght (`R3`) | 26 | `1D20 + 0D12 + 1D6 + 0` |
| Ranged | final Dex (`R4`) | 9 | `0D20 + 0D12 + 1D6 + 3` |
| Evasion | `Dex + Speed / 5` (`R4 + R11/S4`) | 13 | `0D20 + 1D12 + 0D6 + 1` |
| **Endurance** | `(Strenght + Con) / 2.5 + Health / 5` (`(R3+R5)/U4 + R9/T4`) | 22.4 | `1D20 + 0D12 + 0D6 + 2` |

The *Combat scaler* block (`Background References Character` S3:U4) holds the three constants:
**Speed 5** · **Healt 5** · **strengt/con 2.5** (labels verbatim).

The ladder is the old one with its exact arithmetic now on record: `INT(value/20)` D20s, `INT`
D12s, `INT` D6s, and the remainder **`ROUND(…, 0)`-ed** into the flat term — so Endurance's 22.4
becomes `1D20 + 2` (2.4 rounds to 2; a `.5` remainder would round *up*, which the app's
flat-remainder ladder must match before fixtures pin it). Zero terms are written out, as before.

Glossary (Naming BA:BB): Mele "Mele damage", Ranged "Ranged damage", Evasion "hoe goed je dodged",
**Endurance** "hoe goed je het tanked" — the roll the old sheet called `endure`.

## What the app has today

Four `RollDefinition`s (roll-definitions.json, TICKET-ROLL-05/06) over one ladder
(dice-ladders.json, TICKET-ROLL-03). Melee and ranged read the raw stat — **still correct**.
Evasion and endure ship *deliberately short*: the old sheet's inputs (18 at Dex 11, 16 at Con 12)
carried unexplained extra terms, so the fragments read the bare stat and said so. That was
Concept 08's open question, held open by TICKET-DX-04 rather than closed by fiat.

Check the old numbers against the new formulas: old evasion 18 at Dex 11 → Speed would need to be
35; old endure 16 at Con 12 — the old character's Str/Health aren't in the fragment's notes, so
the new formulas *may* also explain the old cells. Nice if true; not required.

## Parity gap

1. **Three new constants** — `evasion_speed_divisor` 5, `endurance_health_divisor` 5,
   `endurance_body_divisor` 2.5 (names ours; the sheet labels them `Speed`, `Healt`,
   `strengt/con`). Ordinary `Constant` rows in constants.json and the seeds.
2. **Two formula edits** — roll inputs are already user-authored formula text at the `roll-input`
   attachment point, so this is exactly the "formula edit once the live rows are read" the
   fragment predicted:
   - evasion: `stats.dex + stats.speed / const.evasion_speed_divisor`
   - Endurance: `(stats.strenght + stats.con) / const.endurance_body_divisor + stats.health / const.endurance_health_divisor`
3. **Rename** `endure` → `Endurance` (display data; ids stable).
4. **Fragment updates** — roll-definitions.json loses its two "honestly short" notes and gains the
   new citations; dice-ladders.json is re-sourced unchanged. The golden suite (plan §15) pins all
   four decompositions from the sample character, including the fractional-input case.

## Backend note

Dice are rolled on the server (TICKET-ROLL-07) *through the shared engine* — richer inputs change
no route. Confirm the fractional-input behaviour (22.4) matches between `diceLadder.ts` and the
sheet before pinning.

## Open questions

None — the formulas are read from the xlsx, so the two inputs graduate from v2.0's
"honestly short" to **confirmed**. The one check left to the ticket is behavioural: the app's
remainder handling versus the sheet's `ROUND` on a fractional input (above).
