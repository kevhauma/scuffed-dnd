# 06 · Skills — primary/secondary scaling, and focus skills return

**Sheet source (xlsx):** `Background References Character` A2:H51 (per-skill scaling, constants)
· `Background Charater Sheet Calcu` A2:M50 (the ability calculator) ·
`Background Setup Calculations ` A2:E51 (the focus modifiers) · `Character Sheet` A14:N31 ·
`Background References Naming` A3:A50 · `Setup` A14:B17.

## What the new sheet says

### The list itself moved

Still 48 names, but not the same 48. Against the app's list (skills.json):

- **Gone:** `sewing`, and the duplicate `Skinning` (the sheet now has one `skinning` — v2.0's
  deliberate duplicate is resolved by the creator).
- **New:** `Summening` (it was only ever a focus-skill spelling before; now it is a skill) and
  `woodcrafting`.
- **Recapitalised:** alchemy→Alchemy, arcane→Arcane, assassination→Assassination,
  athletics→Athletics, butchering→Butchering, construction→Construction, farming→Farming,
  foraging→Foraging, botany→Botany. Renames are safe (TICKET-REF-01); formulas re-slug.

### Every skill has a primary and at most one secondary stat

Global scales (Scaling F4:H7, labels the sheet's): **mono scale 0.35** (single-stat skills),
**duo scale 0.2** + **Secondary scale 0.1** (two-stat skills), and under *Enhanced scaling*:
**chosen 1.5 / others 0.3** (the focus multiplier), **Bonus scaling 5**.

The full table (Scaling A4:H51) — `skill: primary × scale [+ secondary × 0.1]`:

```
Alchemy: Int×.35            Arcane: Int×.2 + Wis×.1        Assassination: Dex×.35
Athletics: Dex×.2 + Strenght×.1   Black smithing: Strenght×.35   Botany: Wis×.2 + Int×.1
Brewing: Wis×.35            Butchering: Strenght×.35       Charm: Char×.35
Construction: Strenght×.35  Cooking: Wis×.2 + Dex×.1       Dancing: Dex×.35
Farming: Wis×.2 + Dex×.1    Foraging: Wis×.2 + Dex×.1      graple: Strenght×.2 + Dex×.1
hand to hand: Strenght×.2 + Dex×.1   Handeling: Wis×.2 + Dex×.1   Healing: Wis×.35
Hiding: Dex×.35             history: Wis×.2 + Int×.1       intimidation: Strenght×.2 + Char×.1
law: Int×.2 + Wis×.1        linguistics: Int×.35           Lock picking: Dex×.35
Medician: Wis×.2 + Int×.1   Mining: Strenght×.2 + Con×.1   navigation: Wis×.35
perception: Wis×.35         Persuasion: Char×.2 + Strenght×.1   Prefomance: Char×.2 + Dex×.1
riding: Dex×.2 + Strenght×.1     Sailing: Strenght×.2 + Con×.1  Scouting: Dex×.35
skinning: Dex×.35           Sneaking: Dex×.35              Summening: Wis×.2 + Int×.1
Stealing: Dex×.35           Storytelling: Wis×.2 + Char×.1 tailoring: Dex×.35
Taming: Wis×.2 + Strenght×.1     Teaching: Wis×.2 + Int×.1  Tracking: Wis×.35
Trading: Char×.35           white smithing: Wis×.35        woodcrafting: Dex×.35
woodcutting: Strenght×.35   writing: Char×.2 + Wis×.1      zoology: Wis×.2 + Int×.1
```

Persuasion keeps `Char×.2 + Strenght×.1` — the very weights v2.0's golden suite pinned. Several
skills changed stats outright (old alchemy was INT 0.2 → now Int 0.35; old Charm CHA 0.3 → now
Char 0.35; every old 0.3 mono became 0.35).

### Focus skills multiply growth

Setup has three **Focus skill** slots; the sample picked Arcane, Summening, **Arcane again** —
duplicates are legal and stack. The ability calculator's per-skill *Focus skill* factor
(Calculations D3:D50) is the sum over the three slots of **1.5 where the slot names this skill,
0.3 where it does not**:

- not chosen: 0.3 + 0.3 + 0.3 = **0.9** (every unchosen skill shows 0.9)
- chosen once (Summening): 1.5 + 0.3 + 0.3 = **2.1**
- chosen twice (Arcane): 1.5 + 1.5 + 0.3 = **3.3**

The xlsx confirms the mechanism verbatim (`Background Setup Calculations ` B4:E51): one
`IF(slot = this skill, chosen, others)` per slot, summed into the *Final modifier*.

### The level and bonus formulas, read from the cells

`Background Charater Sheet Calcu` rows 3–50, per skill:

```
level = ROUNDUP( (primary + secondary) × focusModifier, 0 ) + investedPoints
bonus = ROUNDUP( level / 5, 0 ) + Σ(gear skill bonuses across the six slots)
```

- **`ROUNDUP` (ceil), not round** — in both places. Today's engine rounds the bonus
  (`round(level / const.bonus_divider)`); the divisor 5 itself is unchanged.
- **Invested points land *after* the focus multiplier** — a bought point is a full point.
- Gear skill bonuses are the equipped items' template vectors, one column per slot, spilled from
  the Backpack calculation (systems/12).

### Two sheet bugs, read from the same cells — recorded, not copied

- **The secondary *stat* is never read.** Both stat lookups in the level formula reference the
  **primary** stat's name cell, so a duo skill computes `primary × 0.2 + primary × 0.1` — the
  Secundary column decides only *that* a 0.1 term exists, not whose stat feeds it (visible in
  values: Athletics secondary term is 0.9 = Dex 9 × 0.1, not Strenght 26 × 0.1). Almost certainly
  a copy-fill slip: the scaling reference lovingly names a secondary stat per skill that the
  formula then ignores.
- **Summening and Stealing share a stat row.** Both level formulas read the reference table's
  row for Stealing (`B40`), so Summening scales off **Dex** instead of its listed Wis/Int — an
  off-by-one visible in the sample (Summening's primary term is 1.8 = Dex 9 × 0.2).

**Ruled 2026-08-29: fix them.** The app builds the reference table's *intent* — the secondary stat
is genuinely read, and Summening scales off its own Wis/Int row. So the weights table above is the
spec, and the two bugs are recorded in the fragment's `notes` as a divergence between what the
sheet computes and what it means. Two knock-on effects to expect when the golden fixtures are
pinned (plan §15): **every duo skill's level changes** for the sample character (Athletics' second
term becomes Strenght 26 × 0.1 = 2.6 rather than Dex 9 × 0.1 = 0.9), and Summening moves off Dex.
The sample's captured levels are therefore *not* the app's expected output for duo skills — pin
fixtures from the corrected arithmetic and cite this note.

## What the app has today

`Skill = { id, name, description, statWeights: [{statId, weight}] }` (TICKET-SKL-02); level =
`Σ(weight × stat) + invested`, bonus = `round(level / const.bonus_divider)`, computed once in
`skillCalculator.ts`. No focus concept (v2.0 *retired* focus stats in TICKET-ARC-03). Equipment
affects stats only — nothing grants a *skill* bonus.

## Parity gap

1. **Re-weight all 48 skills** per the table — the `statWeights` shape already expresses it
   (mono = one row at 0.35; duo = 0.2 + 0.1 rows). Data change plus the list edits above; the
   duplicate-skinning merge note in skills.json retires.
2. **Focus skills** — `Character.focusSkillIds?: string[]` (exactly 3 slots, duplicates allowed,
   absent-means-none → every multiplier 0.9), two new constants (`focus_chosen` 1.5,
   `focus_other` 0.3), and the multiplier applied in `skillCalculator.ts`. A wizard step and a
   sheet affordance to pick them. Additive-optional on the character → no version bump; the
   engine change is behavioural for every ruleset that adopts the new constants.
3. **Rounding moves to `ceil`, twice** — the level (which today has no rounding at all: it is
   `Σ(weight × stat) + invested`, fractional) and the bonus (today `round`). `bonus_divider` = 5
   is unchanged. Decide in the ticket whether the mode becomes ruleset data or the engine's rule
   changes — remembering imported old rulesets keep playing whatever the engine does.
4. **The focus multiplier enters the level formula** exactly as read:
   `ceil((Σ weight × stat) × focus) + invested` — invested after the multiply.
5. **Gear skill bonuses** land with systems/11–12, not here — but `skillCalculator` grows the
   per-slot term in the same shape `statCalculator` already has for equipment.

## Backend note

Engine and document changes only; the server re-derives skill levels through the same
`skillCalculator`.

## Open questions

- **Do the focus constants belong per-ruleset?** They read like `const.focus_chosen` /
  `const.focus_other` beside `bonus_divider`. Assumed yes (they are the User's dials), decided in
  the ticket.

*(Settled: the rounding and invested-points questions, by the xlsx formulas; the two sheet bugs,
by the User's 2026-08-29 ruling to fix them.)*
