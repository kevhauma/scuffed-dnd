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

**Amendment (2026-08-29, TICKET-RES-04 — the first invocation).** *A new `DM_ACTION` value costs
one handler module and one `PATTERN_ROUTES` line, and that is not the escape hatch.* The third
bullet above reads as if a new DM action were free; it is not, because
`src/server/routes/dm/dmRules.test.ts` asserts **one write module per `DM_ACTION` value**. Adding
`dm-set-dream-level` therefore obliged `routes/dm/dmSetDreamLevel.ts`, its barrel line and a route
pattern — the handler being nothing but `requireCharacterDM` plus a call into `dmActions.ts`, where
the rule actually lives. This is the *existing* route surface being extended by its own convention
rather than a new surface, so it is recorded as a named exception rather than a new decision:
**`db/schema.ts` and the migrations are still untouched, and no socket message is added.** A ticket
that needs more than a guard-plus-service handler under `src/server/` is still the escape hatch and
still owes a decision here first.

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
  the tree is briefly unreadable to old data either way. **That ticket was TICKET-INV-05
  (2026-08-29), which took `SUPPORTED_SCHEMA_VERSION` from 9 to 10** retiring `Item.materialId` /
  `Item.materialLevel`; everything after it inherits 10, and TICKET-DX-09 proves the break complete
  rather than raising it again. **TICKET-INV-06 then deleted `Inventory.miscItems` under the same
  10**, which is the rule working as written rather than an exception to it: one milestone, one
  bump, however many shapes move inside it.
- **`RETIRED_FIELDS` still earns its keep** — it turns "your file has `wallet`" into a sentence
  naming the replacement instead of a shape error. Retiring a field is documentation, not
  compatibility.
- **The corpus is the regression test.** If `docs/imports/` regenerates and imports clean at the
  new shape, the break is complete; that is what `sheetImport.test.ts` already asserts.

### D7 — Seeded values and formula text are a separate issue (User, 2026-08-29)

**No v4.0 ticket ships sheet data.** Every ticket below builds *shapes, panels, engine terms and
behaviour*; the numbers themselves — the fragment rows in [`docs/imports/`](../imports/README.md),
the seeded ruleset's values, and the formula text those seeds carry — land in **one later data
pass**, cut as its own issue. What that means concretely:

- **No ticket carries a "re-source the fragment / `yarn run sheet:import`" criterion**, and none is
  closed on a seeded number being right. A ticket that needs data to test against builds its own
  fixture or uses whatever the corpus already holds.
- **This suspends [CLAUDE.md](../../CLAUDE.md)'s "Every feature ships its sheet data" rule for this
  milestone only.** The rule exists so a shape never ships without data proving it; here the whole
  corpus is being re-sourced at once, and honouring the rule per ticket would rewrite the same
  fragments a dozen times over. The rule returns the moment the data pass closes.
- **Two lines are pure data and move wholesale into that pass**: TICKET-MAT-03 (the materials
  catalog) and TICKET-ITEM-02 (~700 item templates). Their files stay where they are as the
  specification the data pass implements; they are not built in the shape pass.
- **What each ticket owes the data pass is named in its own Scope line**, so the pass can be cut
  from the tickets rather than re-read out of the workbook.

D1 still governs *when* the data lands: the new workbook is the source, and the sheet still wins.
This decision moves the work, not the standard.

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

## Rulings (User, 2026-08-29 — ticket review)

Three corrections made reading the cut tickets back. Each **overturns** a ruling or a gap statement
above; where they disagree, these win.

| Question | Ruling |
|---|---|
| Are the sheet's six body slots the app's slot set? ([08](./systems/08-equipment-slots.md)) | **No.** The equipment-slot builder (TICKET-INV-03) stays the one authority: a ruleset's slots are User-built and variable in count. The sheet's six are *seed data*, nothing the app fixes. |
| How many races does a character have? ([04](./systems/04-races.md)) | **As many as the ruleset says.** The count is a per-Configuration setting, not a constant in the engine; two is the sheet's answer and the default, not the rule. Supersedes "exactly two". |
| Does APT become ATP? ([02](./systems/02-progression-and-identity.md)) | **No — the app keeps `APT`.** The sheet writes ATP and the sheet is simply wrong there. This is the milestone's one deliberate exception to D1's *the sheet wins*, and it is an exception because it is a mistake rather than an anomaly. |

The first two are the same shape of correction, and worth stating as a principle: **a number the
sheet happens to have is a default, not a rule.** Where v4.0 was about to hard-code the workbook's
count of something, the count becomes ruleset data and the workbook's value becomes the seed.

## Build order

Every plan line is ticketed (2026-08-29). Several lines split under the three-to-be-items limit:
§4 into RACE-03/04, §5 into SKL-04/05, §9 into ITEM-01/02, §10 into INV-05/06, §11 into
SPL-01/02, and §14 into RES-04 (Dream level, pulled forward) and RES-05 (the point pool). The
detail behind every ticket lives in its linked system document.

**Every line below is a shape line.** Under [D7](#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29)
the sheet's own numbers — catalog rows, weights, taglines, constants, effect text — are not part of
any of them; they land together in the data pass, and each ticket's Scope line says what it owes
that pass.

- [x] [TICKET-ROLL-08](./tickets/TICKET-ROLL-08-ladder-fractional-remainder.md) — The dice ladder's fractional remainder (systems/07) — **first**: the scalers arrive fractional, and the ladder has never seen a fraction. The scalers themselves are the data pass's
- [x] [TICKET-STAT-04](./tickets/TICKET-STAT-04-stat-groups-and-flavour.md) — Stat groups on the character sheet (systems/03) — `Stat.group?` and the grouped columns; **APT is not renamed** (ticket-review ruling), the Temp column is not built and Speed stays a plain stat
- [x] [TICKET-RES-04](./tickets/TICKET-RES-04-dream-level-state-and-dm-action.md) — Dream level: player state, raised by the DM (systems/02) — **before ARC-04**, whose gain formula reads the field; the split that answers the first dependency the rulings introduced
- [x] [TICKET-ARC-04](./tickets/TICKET-ARC-04-dream-amplified-gains.md) — Dream-amplified archetype gains (systems/05) — needs RES-04; the dream term in the gain formula and the fractional `main(0)` it exposes. Renames, taglines and the affinity matrix are the data pass's; the `point_buy` curve is untouched
- [x] [TICKET-RES-05](./tickets/TICKET-RES-05-shared-point-pool-and-readout.md) — One point pool for stats and skills, with the readout (systems/02) — independent of ARC-04; behavioural: skill investment stops being free
- [x] [TICKET-RACE-03](./tickets/TICKET-RACE-03-race-identity-and-blend-floor.md) — Race identity fields and the blend floor (systems/04, 14) — `type`/`size`/`challengeRate` over two Configuration reference lists, plus the `MAX(1, …)` floor; the 25-race catalog is the data pass's
- [x] [TICKET-RACE-04](./tickets/TICKET-RACE-04-configurable-race-count.md) — The race count is ruleset data (systems/04) — needs RACE-03; `MAX_RACE_COUNT` becomes a per-ruleset dial defaulting to 2, and a character carries exactly that many (ticket-review ruling)
- [x] [TICKET-SKL-04](./tickets/TICKET-SKL-04-ceil-rounding.md) — Skill levels and bonuses round with ceil (systems/06) — the engine half, landed before the data pass re-weights 48 skills against the wrong rounding. The list and the weights (and with them the sheet's two formula bugs, fixed not reproduced) are the data pass's
- [x] [TICKET-SKL-05](./tickets/TICKET-SKL-05-focus-skills.md) — Focus skills multiply growth (systems/06) — needs SKL-04; chosen 1.5 / others 0.3, duplicates stack
- [x] [TICKET-INV-04](./tickets/TICKET-INV-04-variable-equipment-slots.md) — Equipment slots stay User-built and variable (systems/08) — before INV-05. The builder is the authority (ticket-review ruling); this line seeds the sheet's spellings onto the figure and proves the count is free
- [x] [TICKET-INL-01](./tickets/TICKET-INL-01-inlay-entity-panel-catalog.md) — Inlays: the entity and its panel (systems/10) — the new entity; the other ingredient of composition. The gem catalog is the data pass's
- [x] [TICKET-ITEM-01](./tickets/TICKET-ITEM-01-skill-bonus-templates-and-shops.md) — Item templates target skills, grouped into shops (systems/11) — needs SKL-04; the shape and the engine term
- [x] [TICKET-INV-05](./tickets/TICKET-INV-05-composed-items-record-and-engine.md) — Composed items: the record and the engine (systems/12) — needs INV-04, INL-01, ITEM-01; `Item`'s fused `materialId`/`materialLevel` fields retire here, and **this is the ticket that landed D6's one `SUPPORTED_SCHEMA_VERSION` bump (9 → 10)** — every v4.0 ticket after it inherits the number
- [x] [TICKET-INV-06](./tickets/TICKET-INV-06-item-builder-and-backpack.md) — The item builder and the Backpack (systems/12) — needs INV-05; the sheet's Item selecter as a player action, and "in the bag" derived as built-but-not-worn. **`Inventory.miscItems` is deleted** (a stored derivation) and the `wear-item` / `stow-item` player actions retire with it — still no second schema bump, D6's 10 stands
- [x] [TICKET-SPL-01](./tickets/TICKET-SPL-01-spell-entity-panel-fragment.md) — Spells: the entity and its panel (systems/13) — casting needs only Mana, already a resource; the 418-row fragment is the data pass's, templating waits for SPL-03
- [ ] [TICKET-SPL-02](./tickets/TICKET-SPL-02-learned-spells-spellbook-casting.md) — Learned spells, the Spellbook, and casting (systems/13) — needs SPL-01; spells unlock **manually** and "Chosen abiltie" is built into nothing (rulings above)
- [ ] [TICKET-SPL-03](./tickets/TICKET-SPL-03-spell-effect-templating.md) — Spell effect templating (systems/13, D4) — needs SPL-01/02; the `spell-effect` attachment point and its preview. The 326-formula transcription is the data pass's
- [ ] [TICKET-PAS-01](./tickets/TICKET-PAS-01-passives-catalog.md) — Passive abilities: the entity and the handout (systems/14) — needs SPL-03's attachment point; nothing grants a passive yet, by the sheet's own admission
- [ ] [TICKET-DX-09](./tickets/TICKET-DX-09-clean-break-closeout.md) — The clean break, proven complete (systems/01) — **last of the shape pass**: one `SUPPORTED_SCHEMA_VERSION` bump, the old shape meeting `IncompatibleDataNotice`, TEST_STATUS refreshed. The corpus audit and the golden suite move to the data pass, which is where the numbers to pin come from

### Deferred to the data pass (D7)

Cut, specified, and **not built in this milestone's shape pass** — they are nothing but sheet
values, so they belong with the rest of the data:

- [TICKET-MAT-03](./tickets/TICKET-MAT-03-materials-catalog-v4.md) — Materials catalog replaced (systems/09) — 24 families × 10 tiers, no shape change at all
- [TICKET-ITEM-02](./tickets/TICKET-ITEM-02-item-catalog-fragment.md) — The v4 item catalog: 40 categories, ~700 templates (systems/11) — the biggest lift, scripted against the checked-in xlsx

The 2026-08-29 rulings' two cross-line dependencies are answered in the ordering above: RES-04
lands the `dreamLevel` field before ARC-04's gain formula reads it, and RACE-04 gives the race-count
reshape its own room instead of riding the identity ticket. INV-05 no longer waits on MAT-03: the
`Material` shape it composes from already exists, and which materials the corpus holds is the data
pass's business.

Prefixes minted by this version, as expected: **`SPL`** (spells and casting), **`INL`** (inlays),
**`PAS`** (passive abilities) — plus **`ITEM`**'s first numbered tickets (the area existed, but
no `TICKET-ITEM-*` had ever been cut). Everything else reuses existing prefixes (`STAT`, `RACE`,
`ARC`, `SKL`, `ROLL`, `INV`, `MAT`, `RES`, `DX`).
