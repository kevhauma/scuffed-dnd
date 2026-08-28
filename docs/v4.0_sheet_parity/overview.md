# Custom DnD Builder — v4.0 Sheet Parity (Overview)

The fourth milestone: the creator of the source spreadsheet has **replaced the workbook**. The new
one — [*Copy of 4.1 abilities players*](https://docs.google.com/spreadsheets/d/18fMuQOMK65LVawBedC9R5mNASknJ8V56_QVFDdDa5Yc/edit)
— restructures nearly every system the app imported from the old sheet and adds three the app has
never had: **spells**, **inlays**, and **passive abilities**. This version brings the app back to
parity with what the sheet's table actually plays.

v2.0 reverse-engineered the *old* workbook cell by cell and closed clean. This milestone does the
same job against the new one, but it starts from a working app rather than from nothing: most
systems are *revisions* of entities that already exist (skills, races, archetypes, materials,
items, rolls), and the sheet finally **answers questions v2.0 recorded as open** — the evasion and
endure inputs, the sub/non point-buy anomalies — while opening a few new ones of its own.

**Spec source for this version:** the [`systems/`](./systems/) folder — one document per changed
system, each carrying what the new sheet says (with ranges and captured data), what the app has
today (with ticket citations), the parity gap, and its open questions.
[`systems/01-sheet-source-and-capture.md`](./systems/01-sheet-source-and-capture.md) is the map of
the workbook itself and the record of how and when it was read.

## Decisions (2026-08-28)

Made when this milestone was scoped. Settled — don't re-open without a new decision here.

### D1 — The new workbook replaces the old one as the source of truth

The old workbook stays linked from `docs/imports/` fragments that have not yet been brought
forward, because it is what those fragments were read from. But **every v4.0 ticket reads the new
workbook**, and a fragment touched by a v4.0 ticket re-sources to it with a new `exportedAt`. The
v2.0 rule is unchanged and still binding: **the sheet wins** — typos, anomalies, one blank Zircon
row and one `#VERW!` spell error are recorded, never repaired in the corpus.

**The capture of record is checked in**: [`4.1 source sheets.xlsx`](./4.1%20source%20sheets.xlsx)
(added 2026-08-28) is an export of the workbook **with its formulas**, and is a slightly newer
revision than the published Google copy — it adds a `Spellbook` tab and three calculation tabs the
online copy folds together. Where the two disagree, the xlsx wins; systems/01 maps both.

### D2 — The backend does not change

All parity work lands in `shared/` and `client/`. This holds because of decisions already made:

- A ruleset and a character are stored as **JSON documents** (v3.0 D4) — `ruleset.data`,
  `game_session.snapshot`, `character.data` are TEXT columns. Every new entity this milestone adds
  (spells, inlays, passives) and every reshape it makes lives *inside* those documents, so
  **`src/server/db/schema.ts` is untouched and no SQL migration exists in this milestone.**
- The engine is the shared Kernel and the server re-derives through it (v3.0 D5). Extending
  `shared/engine/` extends what the server enforces without editing a line under `src/server/`.
- Player and DM actions already flow through shared services (`playerActions.ts`, `dmActions.ts`)
  called by existing routes. A v4.0 action that fits that surface (learn a spell, spend mana,
  set a temp vital) is a shared-service change.

**The escape hatch is named, not silent:** if a ticket finds an action that genuinely cannot ride
the existing route surface, that is a new decision recorded here first — not a judgement call made
mid-ticket. Nothing scoped below is expected to need it.

Document-shape changes follow the `data-model` skill's standing rule: **bump
`SUPPORTED_SCHEMA_VERSION` or ship a conversion, never both.** Each ticket says which and why.
Additive-optional fields (most of this milestone) need neither.

### D3 — Formulas are captured, and one display trap is on record

The workbook was read twice on **2026-08-28**: first through the public HTML view (values only),
then from the checked-in `.xlsx`, whose **formulas settled every mechanic this milestone states**
— the skill-level formula, the focus multiplier, the archetype gain routing (including Dream
level's role), both combat scalers, the item-composition lookups, and the spell/passive text
templating are all read from live formulas, not inferred. The confidence markers from
`docs/imports/README.md` still apply where a `systems/` doc says so.

One capture hazard is load-bearing enough to record here: **the HTML view shows *formatted*
values.** The archetype point table looked like a new integer table online; the xlsx shows the
same old decimal table (`4.64285714…` intact) behind a 0-decimal cell format. Any future
re-capture from the HTML view must treat displayed numbers as rounded until the xlsx agrees.

### D4 — Spell effect text goes through the formula engine

Spell effects in the sheet are prose with **computed numbers embedded** ("regains hit points equal
to 5", "a 55-foot-radius sphere … takes 11 fire damage" — both scale with the caster). The app
models that as **template text with formula placeholders**, evaluated by the one engine
(`parseFormula` → `validateFormula` → `evaluateFormula`) at a new attachment point. No second
evaluator, no regex arithmetic — and every field a User types a formula into ships a
`FormulaPreview` (TICKET-FORM-08), spell templates included.

### D5 — What is deliberately *not* parity

- **The sheet's per-player columns are character state, not ruleset data.** `locked/Learned` on the
  spells tab, the Setup tab's picks, the Backpack — these map to `Character`, not `Configuration`.
- **The measurements table** (`Background References: Naming` AU:AX) is a metric-units reference —
  world flavour with no mechanic attached. Recorded in systems/14, built into nothing.
- **Prices are gone from the sheet.** The old workbook priced every item; the new one prices
  nothing. Currency and the purse stay as they are; item values keep the old sheet's numbers only
  as historical notes. No number is invented to fill the gap.
- **The actives tab is empty** and the passives are referenced by nothing yet ("Coming soon").
  v4.0 builds the passives *catalog*; wiring passives to races/items waits for the sheet to do it.
- **`shop.html`** (checked into this folder beside the workbook) is the DM's shop-order tool —
  building purchase orders from the ruleset's items. It is **next-version scope** by the User's
  own word, kept here as reference; no v4.0 plan line covers it, and the absence of prices in the
  sheet (above) is part of why.

### D6 — No backwards compatibility: v4.0 is a clean break (User, 2026-08-29)

**Stored data is not carried across this milestone.** Where the `data-model` skill's standing rule
offers *bump `SUPPORTED_SCHEMA_VERSION`* **or** *ship a conversion*, v4.0 always **bumps**. No
migration path, no retired-key adapters, no dual-read code — a ruleset built on the old sheet and
the characters built against it meet `IncompatibleDataNotice`, which offers a backup and a fresh
start.

This is v2.0's precedent applied again (TICKET-IO-03) and it rests on the same fact: **the seed
ruleset is regenerable** from [`docs/imports/`](../imports/README.md), so nothing unique is lost.
It is what makes the rest of the milestone cheap — slot keys can be renamed, `Empty` can be
deleted, skill weights can move, and no ticket spends its budget on a conversion nobody will run
twice.

Three consequences worth stating outright, because they are the tempting exceptions:

- **One bump, not fifteen.** The version rises once for the milestone rather than per ticket;
  whichever ticket lands first raises it, and the rest inherit it. Landing v4.0 in pieces means
  the tree is briefly unreadable to old data either way.
- **`RETIRED_FIELDS` still earns its keep** — it turns "your file has `wallet`" into a sentence
  naming the replacement instead of a shape error. Retiring a field is documentation, not
  compatibility.
- **The corpus is the regression test.** If `docs/imports/` regenerates and imports clean at the
  new shape, the break is complete; that is what `sheetImport.test.ts` already asserts.

## Rulings (User, 2026-08-29)

Answers to the questions the system docs raised. Each is settled where it stands; the linked doc
carries the detail and its consequences.

| Question | Ruling |
|---|---|
| The two skill-formula bugs ([06](./systems/06-skills-and-focus.md)) | **Fix them.** Build the reference table's intent — the secondary *stat* is read, Summening scales off its own row. |
| Does `Empty` survive? ([04](./systems/04-races.md)) | **No.** Two race slots, both real; "pure Ducklets" is Ducklets twice, as the sample character does. |
| Sub-affinity `+dreamLevel` at zero points? ([05](./systems/05-archetypes-and-point-buy.md)) | **Yes**, as the formulas have it. |
| The Temp box on Vitals ([03](./systems/03-stats-and-vitals.md)) | **Nothing.** Not modelled, not rendered. |
| Does Speed become a resource? ([03](./systems/03-stats-and-vitals.md)) | **No.** |
| Where do composed items live? ([12](./systems/12-item-composition-and-backpack.md)) | **In the Player's inventory**, as an item carrying links to the material, template and inlay it is made of. |
| Accessory retirement ([08](./systems/08-equipment-slots.md)) | Clean break — see D6. Slot keys are rewritten, no conversion. |
| Who raises Dream level? ([02](./systems/02-progression-and-identity.md)) | **The DM, as an action** — the same surface that awards experience and sets level. |
| How do spells unlock? ([13](./systems/13-spells.md)) | **Manually.** |
| What is "Chosen abiltie"? ([13](./systems/13-spells.md)) | **Nothing yet** — a placeholder box, like "Passive abilites: Coming soon" and the empty actives tab. Build nothing. |

**Every question these docs raised about intent is now answered.** What remains open is listed per
system doc and is of one kind: choices a ticket makes as it plans (which fragment default, which
rounding surface), plus the two the sheet itself has never answered — the `point_buy` anomalies
and the missing XP table, both carried over from v2.0 and both still the User's to fill in.

## Build order

No tickets exist yet. Each line below is a **plan line** — expand it with the `story-ticket` skill
before building (a ticket carries at most three to-be items, so several lines will split). The
detail behind every line lives in its linked system document.

- [ ] *(plan §1)* **Combat scalers and roll inputs** — the sheet finally shows evasion and
  endurance whole: three new constants and two corrected roll formulas close v2.0's oldest open
  question. → [systems/07-combat-rolls.md](./systems/07-combat-rolls.md)
- [ ] *(plan §2)* **Archetype refresh with a proven affinity matrix** — six renamed archetypes
  with new taglines; the sub/non tagging v2.0 could not prove is now read from formulas, and the
  `point_buy` curve turns out to be **unchanged** (the "new integer table" was display rounding).
  Dream level joins the gain formula (see §14).
  → [systems/05-archetypes-and-point-buy.md](./systems/05-archetypes-and-point-buy.md)
- [ ] *(plan §3)* **Stat identity pass** — APT becomes **ATP** ("Actions per turn"), stats gain the
  sheet's flavour descriptions and Physical/Mental/Vitals grouping. The Temp column is not built
  and Speed stays a plain stat (rulings above).
  → [systems/03-stats-and-vitals.md](./systems/03-stats-and-vitals.md)
- [ ] *(plan §4)* **Races ×25, `Empty` deleted, two races required** — the picker grows from 10 to
  25 real races, each carrying creature type, size and challenge rate; a character now has
  **exactly two** (a single race is that race picked twice), and the blend gains the sheet's
  `MAX(1, …)` floor. → [systems/04-races.md](./systems/04-races.md)
- [ ] *(plan §5)* **Skills re-scaled, focus skills return** — every skill gets a primary (0.35 or
  0.2) and optional secondary (0.1) stat; three chosen **focus skills** multiply growth (chosen 1.5
  / others 0.3, stacking); the skill list itself shifts (−sewing, −duplicate Skinning, +Summening,
  +woodcrafting). Builds the table's **intent**, so the sheet's two formula bugs are fixed rather
  than reproduced. → [systems/06-skills-and-focus.md](./systems/06-skills-and-focus.md)
- [ ] *(plan §6)* **Equipment slots become the six-slot body** — Head/Upperbody/Lowerbody/Foot
  gear plus right and Left hand; the accessory box is gone and the slot keys are rewritten
  outright (D6). → [systems/08-equipment-slots.md](./systems/08-equipment-slots.md)
- [ ] *(plan §7)* **Materials catalog replaced** — 24 families × 10 hand-authored tiers across
  three groups, harvested creature parts included.
  → [systems/09-materials.md](./systems/09-materials.md)
- [ ] *(plan §8)* **Inlays** — a new entity: 25 gem families × 10 tiers of stat grants (linear in
  tier for 23 of them), socketed into items. → [systems/10-inlays.md](./systems/10-inlays.md)
- [ ] *(plan §9)* **Item templates target skills, and shops arrive** — an item template is a
  per-skill bonus vector over all 48 skills, grouped into 40 shop categories.
  → [systems/11-items-and-shops.md](./systems/11-items-and-shops.md)
- [ ] *(plan §10)* **Item composition** — a carried thing is *material tier + template + inlay
  tier* ("Iron Ore 10 Battleaxe with Diamond 4 inlay"), and it lives in the **Player's inventory**
  as a record linking those three; its stat side is the material's vector plus the inlay's, its
  skill side is the template's — arithmetic confirmed against the sample character. `Item`'s v1
  fused `materialId`/`materialLevel` fields retire here.
  → [systems/12-item-composition-and-backpack.md](./systems/12-item-composition-and-backpack.md)
- [ ] *(plan §11)* **Spells: entity and compendium** — 418 spells with mana cost, range/time and
  effect text; learned-per-character tracking (unlocked **manually**, a hand-set flag) and the
  sheet's own Spellbook view; casting spends the existing Mana pool.
  → [systems/13-spells.md](./systems/13-spells.md)
- [ ] *(plan §12)* **Spell effect templating** — the D4 attachment point: placeholders in effect
  text evaluated per caster, previewed like every other formula field.
  → [systems/13-spells.md](./systems/13-spells.md)
- [ ] *(plan §13)* **Passive abilities catalog** — 26 passives (resistances, immunities, senses)
  as a reference entity; nothing grants them yet, by the sheet's own admission.
  → [systems/14-passives-and-reference-tables.md](./systems/14-passives-and-reference-tables.md)
- [ ] *(plan §14)* **Progression additions** — Dream level as new player state **that amplifies
  archetype gains** (main × dream, sub + dream, the latter even at zero points), raised by the
  **DM as an action** beside experience and level; plus one shared point pool (level × 3) covering
  stat *and* skill investment, and the Points to Use / Points Spend readout.
  → [systems/02-progression-and-identity.md](./systems/02-progression-and-identity.md)
- [ ] *(plan §15)* **Sheet corpus v4 and golden fixtures** — every touched fragment re-sourced to
  the new workbook, and a golden suite pinned on the sample character *Thomas the test more*, whose
  gear, stat and roll arithmetic the capture verified end to end.
  → [systems/01-sheet-source-and-capture.md](./systems/01-sheet-source-and-capture.md)

Ordering reasons: §1 and §3 are data and constant revisions that unblock fragment work. §5 reworks
the skill engine before anything that grants skill bonuses exists (§9–§10 target skills). §6 must
land before §10 because composed items hang off the six slots. §7–§8 are the ingredients of §10's
composition. §11–§12 need Mana (already a resource) and the §5 skill list. §13 is additive and
independent. §15 closes the milestone the way DX-04 closed v2.0.

Two dependencies the 2026-08-29 rulings introduced, worth catching before the tickets are written:

- **§14's `dreamLevel` field is a prerequisite of §2's gain formula**, which reads it. Either
  split §14 so the field and its DM action land first, or let §2 carry the field — but they cannot
  be planned as independent lines.
- **§4 is no longer a data-only line.** Deleting `Empty` makes `raceIds` exactly two, which
  touches character creation and the allocation path, so it needs the room a reshape deserves.

New ticket prefixes this version expects to mint: **`SPL`** (spells and casting), **`INL`**
(inlays), **`PAS`** (passive abilities). Everything else reuses existing prefixes (`STAT`, `RACE`,
`ARC`, `SKL`, `ROLL`, `INV`, `MAT`, `ITEM`, `CHAR`, `IO`).
