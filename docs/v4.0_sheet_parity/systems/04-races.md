# 04 · Races — 25 of them, with creature identity

**Sheet source:** `Background Referenes Race: scaling` B3:AA17 (note the tab-name typo
"Referenes"; rows 18–26 repeat the stat block — presumably the mother/father lookup copies) ·
`Setup` A7:B9, A19:B21.

## What the new sheet says

25 races, each a full stat block plus three identity fields the old sheet never gave a race:
**type**, **size**, and **challenge rate** (0 for every playable race). The unlabelled row 13 is
the six-core total, confirming Concept 01's counts-toward-total rule still excludes
Health/Mana/Speed.

| Race | Str | Dex | Con | Int | Wis | Char | Health | Mana | Speed | Total | Type | Size |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| human | 10 | 10 | 10 | 10 | 10 | 10 | 5 | 100 | 20 | 60 | humaniod | medium |
| elf | 9 | 12 | 12 | 10 | 12 | 9 | 7 | 200 | 25 | 64 | humaniod | medium |
| Hamster | 1 | 1 | 1 | 1 | 1 | 15 | 1 | 500 | 20 | 20 | humaniod | small |
| dwarf | 14 | 3 | 15 | 10 | 8 | 10 | 8 | 130 | 15 | 60 | humaniod | small |
| Raccoon | 7 | 16 | 7 | 7 | 7 | 15 | 5 | 70 | 30 | 59 | humaniod | small |
| githyanki | 12 | 12 | 12 | 12 | 12 | 12 | 8 | 300 | 30 | 72 | humaniod | medium |
| halfling | 6 | 10 | 13 | 13 | 10 | 10 | 3 | 130 | 25 | 62 | humaniod | small |
| dragonborn | 14 | 13 | 8 | 10 | 11 | 14 | 6 | 180 | 15 | 70 | humaniod | medium |
| gnome | 6 | 10 | 14 | 10 | 13 | 10 | 3 | 110 | 25 | 63 | humaniod | small |
| aasimar | 13 | 13 | 13 | 13 | 13 | 13 | 7 | 150 | 25 | 78 | humaniod | medium |
| firbolg | 8 | 11 | 8 | 12 | 13 | 14 | 4 | 200 | 15 | 66 | humaniod | small |
| goliath | 18 | 13 | 16 | 10 | 12 | 12 | 8 | 30 | 30 | 81 | humaniod | medium |
| kenku | 8 | 10 | 14 | 10 | 12 | 8 | 5 | 60 | 25 | 62 | humaniod | small |
| tabaxi | 8 | 9 | 16 | 10 | 10 | 11 | 4 | 60 | 30 | 64 | humaniod | medium |
| triton | 10 | 10 | 10 | 10 | 10 | 10 | 5 | 100 | 20 | 60 | humaniod | medium |
| tortle | 15 | 10 | 12 | 11 | 13 | 12 | 4 | 60 | 15 | 73 | humaniod | large |
| warforge | 13 | 10 | 12 | 8 | 7 | 12 | 7 | 100 | 25 | 62 | construct | medium |
| crab folk | 15 | 10 | 17 | 7 | 9 | 9 | 5 | 20 | 40 | 67 | humaniod | large |
| autognome | 13 | 6 | 16 | 4 | 11 | 6 | 6 | 100 | 20 | 56 | construct | small |
| dohwar | 5 | 12 | 11 | 11 | 14 | 13 | 3 | 60 | 20 | 66 | fey | small |
| hadozee | 11 | 16 | 13 | 10 | 13 | 12 | 3 | 80 | 30 | 75 | humaniod | medium |
| plasmoid | 13 | 12 | 12 | 10 | 14 | 10 | 6 | 30 | 30 | 71 | Ooze | large |
| musteval | 3 | 16 | 2 | 8 | 8 | 12 | 2 | 100 | 35 | 49 | celestial | small |
| Loxodon | 12 | 8 | 14 | 12 | 16 | 8 | 8 | 360 | 25 | 70 | humaniod | large |
| Ducklets | 8 | 9 | 8 | 8 | 12 | 14 | 3 | 210 | 20 | 59 | humaniod | medium |

The xlsx shows the blend chain exactly (`Background Setup Calculations ` H33:H41, then rounded
into the final-stat table at `Background Charater Sheet Calcu` S3:S11): per stat,
`base = ROUND( MAX(1, ROUNDUP(race1 + race2, 0) / 2), 0)`. For integer blocks that is the app's
existing `roundup((a + b) / race_blend_divisor)` in different clothes — `ROUNDUP` on an integer
sum is a no-op, the halving produces `.5`s, and the final `ROUND` sends them up — **except one new
term: the `MAX(1, …)` floor.** A stat both races have at 0 reads 1 in the sheet and 0 in the app
today. The divisor is still 2 and keeps its constant. The Setup form's Mothers/Fathers rows
mirror Race 1/Race 2 by formula (`=B8`/`=B9`), so two race slots remain the whole model.

## What the app has today

Ten races from the old sheet (races.json, TICKET-RACE-01/02): human, elf, Hamster, dwarf, Raccoon,
Demon, Demur, **Empty**, Monolith, Gods — absolute stat blocks keyed by stat id, blending capped at
two races, `Empty` as the sheet's own no-race placeholder. No type, size, or challenge-rate field
exists on `Race`.

## Parity gap

1. **Replace the race list**: keep human, elf, Hamster, dwarf, Raccoon (their numbers are
   unchanged — spot-checked human/elf/dwarf/Raccoon against races.json); **drop Demon, Demur,
   Monolith, Gods** from the *race* fragment (they were always Concept 04 bestiary rows the old
   picker happened to include; the new race tab draws the line for us); **add the twenty new
   blocks** above.
2. **`Empty` is deleted** (User ruling, 2026-08-29). A character has **two real races** — the
   sheet's mother and father — and "pure Ducklets" is *Ducklets twice*, which is exactly what the
   sample character does and what the blend formula rewards: `MAX(1, ROUNDUP(8+8)/2) = 8`, the
   block intact. Consequences for the ticket:
   - `Character.raceIds` becomes **exactly the ruleset's race count**, not "at most 2" — and the
     count itself becomes **per-Configuration data**, defaulting to the sheet's 2 (User ruling,
     2026-08-29, ticket review). `MAX_RACE_COUNT` leaves the engine entirely; the wizard renders
     one picker per slot and the creation rules refuse a short pick. Two is the sheet's answer, not
     the app's rule.
   - **Halving is no longer a way to express a single race.** Nothing else changes in
     `calculateRaceStatBases` — the blend already reads two blocks.
   - No conversion for stored characters holding `race-empty` or a single id (overview D6).
3. **Race identity fields** — optional `type?`, `size?`, `challengeRate?` on `Race`. Type and size
   values come from the User's own reference lists (systems/14) — model them as free strings
   validated against those lists, not as hard-coded const objects: they are ruleset data, and the
   sheet's spellings (`humaniod`, `guargantian`) are the User's to fix.
4. **The blend floor** — add the sheet's `MAX(1, …)` to `calculateRaceStatBases` (a one-term
   engine change beside the existing divisor; only all-zero pairings move, from 0 to 1).
5. **Fragment re-source** — races.json to the new tab/ranges, with the duplicate stat block rows
   (18–26) noted.

## Backend note

All inside `ruleset.data`. Nothing server-side.

## Open questions

- **Challenge rate is 0 for every race** — clearly a creature-facing field waiting for a bestiary.
  Store it (it is in the sheet) but build nothing on it.

*(Settled: `Empty` is deleted and a character has exactly as many races as the ruleset says,
defaulting to two — User rulings, 2026-08-29 and the same day's ticket review, gap 2 above.)*
