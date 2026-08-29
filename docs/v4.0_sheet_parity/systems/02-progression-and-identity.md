# 02 · Progression and identity — Level, Dream level, ATP, points

**Sheet source:** `Setup` A2:E21 · `Character Sheet` A1:B6, K1:L3 ·
`Background References Character: Scaling` O2:P3, X2:Y3 · `Background References: Naming` BA3:BB9.

## What the new sheet says

The Character Sheet's identity block (`Character Sheet` A1:B6):

| Field | Sample value | Glossary definition (Naming BA:BB, verbatim) |
|---|---|---|
| Race | `Ducklets Ducklets` | "wat waren u ouders" — *what were your parents* |
| Architype | Science | "Waar je level meer naar toe scaled" |
| Level | 1 | "ervaring based levels" |
| **Dream level** | 1 | "Hoe ver je staat in je dream" — *how far you are in your dream* |
| **ATP** | 1 | "Actions per turn" |

**Every `ATP` in this document is the sheet quoting itself.** The app keeps calling the stat `APT`
— the sheet's spelling is a mistake, and following it was ruled against (gap 1 below).

Beside it (`K1:L3`): **Points to Use 0 · Points Spend 3**. The scaling tab carries the constants:
*Points scaling* = **3** (X2:Y3) and *ATP scaling* = **30** (O2:P3). The xlsx formulas settle how
they combine:

- **One shared pool.** `Points to Use = level × 3 − Points Spend`, and Points Spend sums **every**
  Pts box on the Character Sheet — the nine stat boxes *and* all 48 skill boxes
  (`Background Charater Sheet Calcu` AK3:AK4). Stat investment and skill investment draw from the
  same budget. *(One quirk recorded: the SUM lists `D10` twice — `'Character Sheet'!D10,
  'Character Sheet'!D10:D12` — so a point in the Strenght box would be double-counted. A sheet
  bug to surface, not to copy.)*
- **ATP** = `IF(ROUND(Speed/30) <= 0, 1, ROUND(Speed/30))` (Calcu O3) — **exactly the old
  `apt_value` formula** under the new name.
- **Dream level is not inert.** The archetype gain formulas read it (`Background Archetype
  calulation`): a **main**-affinity stat's gain is the point-table value **× Dream level**, a
  **sub**-affinity stat's gain is the table value **+ Dream level** (so every sub stat of your
  archetype gets +dream flat, even at zero points), and a non-affinity stat ignores it. Details
  and the proven matrix: systems/05.

The Setup tab is the character-creation form: name, **Race 1 / Race 2**, one archetype, **Focus
skill 1/2/3**, a **"Chosen abiltie"** box (empty in the sample), and "Passive abilites: **Coming
soon**". The "BASE RACES — Mothers race / Fathers race" block is `=B8` / `=B9`: **a relabelled
mirror of Race 1/Race 2**, not a second concept. That open question is settled by the formulas —
the wizard may caption the two race slots as parents, and there are exactly two.

## What the app has today

- **Level derives from experience** (TICKET-RES-01) via the `xp_thresholds` curve;
  `Character.experience` is stored, level never is. The new sheet's "ervaring based levels" says
  the same thing — and, like the old sheet, **it still has no XP table anywhere**. The curve stays
  shape-only, still waiting on the User (v2.0's open question, unchanged).
- **The point budget is `level × const.points_per_level + grantedStatPoints`** (TICKET-RES-02,
  TICKET-DM-01), with `points_per_level = 3`. The new sheet's Points scaling is the **same 3** —
  confirmed unchanged — but the app budgets **stat** points only, while the sheet's one pool also
  pays for skill investment (parity gap 3 below).
- **APT** is a derived stat, `max(1, round(SPEED / const.apt_value))`, `apt_value = 30`
  (stats.json, constants.json). The new sheet has the same constant (30) and the sample value
  agrees (Speed 20 → 1).
- **Dream level does not exist** anywhere in the app.
- The wizard (TICKET-CHAR-02, ARC-03) collects name, races, archetype, stat allocation — it has no
  focus-skill step (systems/06) and no chosen-ability step (systems/13).

## Parity gap

1. ~~**Rename APT → ATP**~~ — **closed, not a gap** (User ruling, 2026-08-29, ticket review): the
   sheet writes ATP and the sheet is simply wrong there, so **the app keeps `APT`** with the
   glossary's meaning, "Actions per turn". `const.apt_value` keeps its name too. This is the
   milestone's one deliberate exception to D1's *the sheet wins*, and it is an exception because
   this is a mistake rather than an anomaly — recorded in the
   [overview's ticket-review rulings](../overview.md#rulings-user-2026-08-29--ticket-review).
   Nothing about the arithmetic was ever in question: the constant is 30 in both workbooks and the
   sample agrees (Speed 20 → 1).
2. **`Character.dreamLevel?`** — ~~new optional player state~~ **built by TICKET-RES-04**, optional
   and absent-means-1 (the sheet's sample and its multiplicative role both point at 1 as the neutral
   value). **It is an input to derivation, not a derived value**: `statGain` will read it
   (systems/05, TICKET-ARC-04), so it joined the sanctioned stored exceptions on the same test as
   `experience` — nothing derives it. Additive-optional, so **no schema bump**.
   **The DM raises it as an action** (User ruling, 2026-08-29), on the surface that already awards
   experience and sets level: `setDreamLevel` in
   [`dmActions.ts`](../../../src/shared/services/dmActions.ts) beside `addExperience` /
   `setLevelExperience`, reached by `characterStore.dmSetDreamLevel` → `POST
   /api/characters/:id/dm-set-dream-level` at a table, and by `updateDreamLevel` locally (signed out
   there is no DM — `awardExperience`'s precedent, and the browser-only path must not degrade).
   Below 1 is refused with the floor named, never clamped. **The neutral 1 belongs to the reader**,
   `dreamLevelOf` in [`engine/dreamLevel.ts`](../../../src/shared/engine/dreamLevel.ts), rather than
   to a backfill or a `?? 1` at a call site. It has a row in the DM's controls panel and shows in the
   sheet's identity block beside Level.
3. **One pool for stats and skills** — today `validateStatAllocation` budgets stat points only and
   skill investment is unbudgeted. Parity makes `level × points_per_level + grants` the budget for
   the *sum* of `investedStatPoints` and `investedSkillPoints`. The refusal discipline is
   unchanged (refuse an unaffordable spend, never clamp); the fix is where the spend is summed.
4. **Points readout** — surface Points to Use / Points Spend on the sheet header where the sample
   shows them; both come from the widened allocation result, so this is display only.

## Backend note

`dreamLevel` lives inside `character.data`; the rule that moves it is a shared service
(`dmActions.setDreamLevel`). **No schema, no migration and no socket change** — but *one route
module*, because `dmRules.test.ts` requires a write module per `DM_ACTION` value, so
`dm-set-dream-level` costs `routes/dm/dmSetDreamLevel.ts` (a guard plus a call into the service)
and a `PATTERN_ROUTES` line. Recorded as the named exception amending
[D2](../overview.md#d2--the-backend-does-not-change); corrected at TICKET-RES-04's closeout, where
the original "no route" claim turned out to be wrong.

## Open questions

None.

*(Settled by User ruling, 2026-08-29: the **DM raises Dream level as an action**, on the same
surface as experience and level — gap 2 above; and **"Chosen abiltie" is nothing yet**, a
placeholder box that gets no model — systems/13.)*
