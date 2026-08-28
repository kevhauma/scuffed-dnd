# 14 · Passives, currency, and the reference tables

**Sheet source:** `Background refernces abilities: passive` B1:D27 ·
`Background refernces abilities: actives` (empty) · `Backpack` F3:F8 ·
`Background References: Naming` K3:K7, BD3:BE9, BG3:BH19, AU3:AX23.

## Passive abilities (new)

26 passives, name + effect text, no other columns. The catalog in brief: resistance tiers for
magic, poison and psychic damage (Low = ¾ damage, plain = ½, Legendary = ¼, immune), a block of
condition immunities (poison, blinded, charmed, deafened, exhaustion, frightened, paralyze,
petrifie), and three senses/traits: Blindsight, darkvision, False appearance. Two of the 26 effect
cells are **formulas** — the xlsx confirms passives template exactly like spells:
Blindsight's range is `perception level × 10` feet and darkvision's is `perception level × 5`
(both reading `Background Charater Sheet Calcu` F30). So the passives catalog uses the same
`spell-effect`-style attachment point as systems/13 — settled, not open. One anomaly as-is: the
poison resistance ladder appears **twice** (rows 7–10 and 15–18, with slightly different immunity
wording).

**Nothing grants a passive.** Setup says "Passive abilites: Coming soon", races don't reference
them, items don't either. So v4.0 builds the *catalog only* (prefix **`PAS`**): an optional
`Configuration.passives` array (`{ id, name, effectText }`), a config panel, a fragment with the
duplicate rows recorded — and an optional `Character.passiveIds?` so a DM can hand one out by
name, which is all the sheet's table can do today. Wiring them to races/items waits for the sheet
(overview D5). The actives tab exists and is empty — record it, build nothing.

## Currency — confirmed unchanged

The Backpack's coin purse lists exactly the app's five tiers (currency-tiers.json): Copper,
Silver, Electrum, Gold, Platinum pieces. **Still no exchange rates anywhere** — v2.0's open
question stands a third time. The purse (`Character.purse`, TICKET-CUR-02) needs nothing.
The one delta is *negative space*: the old sheet priced items in copper; the new one prices
nothing (overview D5), so the currency's main consumer went missing rather than changing.

## Creature sizes and types (new reference lists)

Races cite these (systems/04); a bestiary eventually will. Verbatim:

**Sizes** (BD3:BE9): tiny ¼ square · small ½ square · medium 1 square · large 4 square ·
huge 9 Square · guargantian "larger then 9 squares" · swarm "Size varies".

**Types** (BG3:BH19): humaniod "Generic" · undead "not living" · celestial "Jezus" · construct
"artificial life" · beast "non intelligent life" · Devil "Corrupted soul with inteligents" ·
dragon "O shit a flying lizard" · demon "Corrupted souls for chaos" · fey "Magical creaturs" ·
aberration "ieuw" · monstrosity "designer ieuw" · elemental "Beings made by or/of created using
the elements" · plant "tomatos" · fiend "Fey but evil" · gaint "big humaniods" · Ooze "Slime
creatures" · swarm "A collection of adleast 5 creatures".

These are User data (their spellings, their jokes), not app enums — model as two optional
reference lists on the `Configuration` (or fold into the races ticket as the vocabulary
`Race.type`/`Race.size` validate against; the ticket decides, smallest shape wins).

## Measurements — recorded, not built

Naming AU3:AX23 is a metric-units table (mm → km, g → t, ml → l, °C, m², km/h, J/kWh, s/min/h,
and "Unit :: the amount of somethings"). World reference with no mechanic. It lives in this
capture and nothing else happens.

## Backend note

Everything here is optional arrays inside `ruleset.data` plus one optional character field.

## Open questions

- **The doubled poison-resistance ladder** — two row sets with divergent wording. First
  occurrence wins the fragment; both cited (the `skinning` precedent, again).

*(Whether passive effects scale is settled — two of them do, by formula; see above.)*
