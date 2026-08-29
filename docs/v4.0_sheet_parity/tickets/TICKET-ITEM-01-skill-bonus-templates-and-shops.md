# TICKET-ITEM-01 — Item templates target skills, grouped into shops

- **Area:** Items configuration / engine
- **Type:** Feature
- **Traceability:** System [11 · Items and shops](../systems/11-items-and-shops.md) (gaps 1, 2,
  4); system [06](../systems/06-skills-and-focus.md) (gap 5 — the gear term in the skill level).
  **Needs TICKET-SKL-04** — the gear term sits beside its ceil, so the rounding settles first.
  First ticket of the **`ITEM`** prefix.

> **Scope (overview [D7](../overview.md#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29)):**
> every item's vector and every category's shop are seeded values, so they are the data pass's
> (TICKET-ITEM-02 is that lift, deferred with it). It owes this ticket the Battleaxe row it was
> going to seed here — +2 Athletics, +3 intimidation, −1 Assassination and the rest — and the shop
> tag on all 40 categories.

## User story

As a Player, I want a wielded Battleaxe to make me better at Athletics and intimidation and worse
at Sneaking — so what I hold changes what I can do, the way the sheet's item matrix says.

## Description

An item template becomes a per-skill bonus vector: small signed integers over the ruleset's
skills, no stat columns and no prices (an item's stat side comes entirely from its material and
inlay — systems/12). Categories gain their shop tagging. The engine learns to sum equipped
templates' skill bonuses into skill levels — the shape `statCalculator` already has for equipment.

## Current situation (as-is)

- [items.json](../../imports/items.json) holds 191 v1.0-shape templates: name, description,
  `categoryId?`, `materialId?`, `materialLevel?`, `equipmentSlotType?` — **no bonuses of their
  own** (the old sheet's item stat columns were all zero).
- [skillCalculator.ts](../../../src/shared/engine/calculators/skillCalculator.ts) knows nothing
  of equipment; only stats get gear bonuses
  ([equipmentBonusCalculator.ts](../../../src/shared/engine/calculators/equipmentBonusCalculator.ts),
  TICKET-MAT-02).
- Categories exist (`categoryId` points at them); nothing models a shop.

## Desired result (to-be)

- **`Item.skillBonuses?: [{skillId, modifier}]`** — sparse (only nonzero entries), keyed by skill
  **id** (the same id-keyed treatment `MaterialModifier` got in TICKET-MAT-01: a rename cannot
  orphan a bonus). Additive-optional.
- **Shops**: a category can name its shop — whether as a field on `ItemCategory` or as shop records
  holding categories is this ticket's call (the sheet writes `category (shop)` on one line;
  smallest shape wins). A ruleset that names no shops groups by category as it does today.

  > **Implementation note (2026-08-29) — the call made, and a correction to the as-is above.** Both
  > options this line offers presuppose an **`ItemCategory` entity, and there is none**: `categoryId`
  > is a *free User string* typed into the item form, with no record behind it and nothing on
  > `Configuration` holding categories (the as-is's "Categories exist (`categoryId` points at them)"
  > is wrong about that). So the smallest shape that says *this template is sold in that shop* is
  > **`Item.shop?: string`** — the same kind of free User word one level up, with `Stat.group`'s and
  > `Inlay.group`'s rules exactly: validated against nothing, headings are the distinct values
  > present, absent means none. Minting a category entity to hold the tag would be a second reshape,
  > a new `Configuration` collection and a conversion of every stored `categoryId` — INV-05/ITEM-02
  > ground, and it breaks *one reshape per ticket*. It is also the *existing* decision followed
  > rather than a new one: v1.0 Requirement 7's note (2026-07-30) settles that **item categories are
  > free text on the Item, not a configured entity** — a category exists as long as an item names it
  > — and a shop is that rule one level up. **Consequence for the data pass: the shop is
  > tagged per template, not on 40 category rows.**
- **The engine term**: per equipped slot, the item's `skillBonuses` sum into the skill's
  **bonus** — `bonus = ceil(level / 5) + Σ(gear skill bonuses across the equipped slots)`, exactly
  as read from the calculation tab (systems/06). One calculator, no inline recomputation, and no
  assumption about how many slots there are.

## Acceptance criteria

- [x] An equipped template's vector moves the skill bonus; an unequipped one moves nothing;
      negatives subtract — engine tests through `calculateCharacter` against a fixture of the
      ticket's own.
      (`shared/engine/calculator.test.ts` → *an equipped templates skill vector*: *should move the
      skill bonus when the template is worn* (Stealth's bonus 2 → **5** with a `+3` sword in
      `main_hand`), *should move nothing while the template is only carried* (the same sword in
      `miscItems`, bonus stays **2**), and *should subtract a negative row* (`-1` → bonus **1**). All
      three run the real `calculateCharacter` over `createFixtureConfig`, whose sword gains the
      vector through a local `withSwordVector` helper rather than a new fixture file.)
- [x] The gear term lands in the **bonus**, not the level, and survives the ceil ordering — pinned
      against systems/06's formula.
      (`shared/engine/calculators/skillCalculator.test.ts` → *the equipped templates skill bonus*:
      *adds to the bonus and leaves the level alone* (level 12, bonus 5), *lands outside the round-up
      rather than inside the divide* — the comment carries the number the wrong ordering would give,
      `ceil(14 / 5) = 3` against the right `ceil(12 / 5) + 2 = 5` — and *is not multiplied by the
      focus picks, which belong to the level* (focus 2.1 → level 25, bonus `ceil(25/5) + 2` = 7).
      Also *reports a failed level rather than a confident total resting on nothing*. The production
      line is `bonuses[skill.id] = rounded + gear` in
      [skillCalculator.ts](../../../src/shared/engine/calculators/skillCalculator.ts), with the
      ordering argued in that module's *The gear term is added to the bonus* section.
      End-to-end, `calculator.test.ts`'s *should leave the level alone while the bonus moves*
      asserts the level unchanged and the bonus changed in one case.)
- [x] A skill rename orphans no bonus (id-keyed, TICKET-MAT-01's precedent) — pinned.
      (Two pins, one per boundary. Engine: `calculator.test.ts` *should survive a skill rename,
      because the vector holds the id* — Stealth renamed to *Skulking*, bonus still 5. Wire:
      `shared/services/importExport.test.ts` → *item templates* → *should keep the vector pointing at
      the skill after it is renamed* and *should keep a bonus spelled in skill ids on the wire, not
      in names*, which reads the serialised JSON directly. `references.ts` translates nothing here,
      exactly as it translates no material tier modifier.)
- [x] Shop tagging renders in the config panel's grouping
      ([ItemsConfigPanel.tsx](../../../src/client/components/config/items/ItemsConfigPanel.tsx))
      without a new top-level route; categories keep working for rulesets with no shops.
      (`config/items/ItemsConfigPanel.test.tsx` → *shops and skill vectors*: *should list templates
      under the shop headings the ruleset names*, *should head a shop the app has never heard of,
      because the headings are the data* (`Grandma's Cauldron`), *should give a ruleset that names no
      shops the flat list it always had* (no `h3` rendered at all), and *should keep the category
      filter working alongside the shops* — narrowing to `Bakery` leaves that category's shop heading
      and no other. No route was added: `/config/items` is unchanged.)
- [x] [items.json](../../imports/items.json) is **not** touched here (D7) — a ruleset whose items
      carry no `skillBonuses` computes exactly as it does today, pinned.
      (`git status` shows no file under `docs/imports/` changed, and `yarn run sheet:import` was not
      run. The behaviour is pinned three ways: `calculator.test.ts` *should compute a ruleset whose
      templates carry no vectors exactly as it did before* — the sword still supplies its material's
      `STR +2` and the skill bonuses are `{ STL: 2, ARC: 3 }`; `skillCalculator.test.ts` *computes a
      ruleset whose templates carry no vectors exactly as it did before*; and
      `importExport.test.ts` *should leave a plain template plain after a round-trip*, which asserts
      neither key grows. `sheetImport.test.ts`'s 25 cases still pass untouched.)
- [x] Unit tests cover: sparse storage (zero entries absent), per-slot summation over however many
      slots the ruleset has (TICKET-INV-04), negative bonuses, and validation of `skillId` targets.
      (**Sparse storage**: `ItemsConfigPanel.test.tsx` *should store only the skills a template
      actually moves* — two rows added in the dialog, one left at 0, and the store holds one; *should
      drop a row whose number box was cleared, not store NaN* (the review's find — an emptied
      `{ valueAsNumber: true }` box is `NaN`, which a `!== 0` filter passes and this app's own import
      gate then refuses); *should leave a template that moves nothing without a vector key at all*;
      *should delete the vector key when the User removes every bonus row*; *should delete the shop key
      when the User clears the field*. The rule itself is `sparseSkillBonuses` in
      [useItemManager.ts](../../../src/client/components/config/items/useItemManager.ts), and
      `configStore.addItem` now runs `mergeClearingAbsent` so an unset key is dropped rather than
      stored as `undefined`.
      **Per-slot summation**: `equipmentBonusCalculator.test.ts` →
      *calculateEquipmentSkillBonuses*: *should sum across a one-slot ruleset and a twelve-slot one
      alike (TICKET-INV-04)*, plus *should ignore an entry keyed to a slot the ruleset has since
      deleted*; end-to-end in `calculator.test.ts` *should sum across every slot the ruleset has,
      whatever their names*. Nothing names a slot key: the walk is over `config.equipmentSlots`, and
      since the review **both** equipment terms use it — *an item worn in a slot the ruleset no longer
      has* pins that the stat axis grants nothing there either, so a force-deleted slot can no longer
      leave one item half-counted.
      **Negative bonuses**: *should read an equipped templates vector, positives and negatives alike*
      and *should let a negative row cancel a positive one to nothing*.
      **`skillId` validation**, in the three places the model's rules live: the import gate
      (`importExport.test.ts` *should reject a bonus that is not { skillId, modifier }*, *should
      reject a skillBonuses that is not an array*, *should accept a stored zero rather than insisting
      the vector is sparse*), the referential report (`validator.test.ts` *should detect a skill bonus
      naming a skill the ruleset does not define*, *should report each dangling row*), and the
      delete guard (`dependencies.test.ts` *should find an item template whose vector grants the
      skill*, *should report a template once however many of its rows name the skill*).
      The engine drops a dangling row rather than inventing a target:
      *should drop a bonus naming a skill the ruleset no longer defines*.)
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus ~~a live browser check of an equip moving a skill bonus~~ (ask the User first).
      (Left open for its **browser** clause only, INV-04's precedent. **Browser check skipped by
      User instruction for this run** — the equip was not seen live; the
      behaviour is pinned end-to-end through `calculateCharacter` instead, and the panel through
      component tests driving the real store. The rest is done, re-measured after the
      `conventions-reviewer` round: `npx vitest run` **3379/3379**, 0 failing, 0 skipped, **199**
      files (3320 at INL-01, **+59**); `npx tsc --noEmit` at its documented 2-error baseline;
      `yarn run check` clean including `yarn run arch` (706 modules, 0 violations);
      `fallow audit --base main` **pass** with `dead_code_introduced: 0`,
      `complexity_introduced: 0`, `duplication_introduced: 0` — the one introduced complexity finding
      (`itemIssues`, cyc 13 / cog 21) was split in this same change, see the implementation notes.
      `fallow dead-code`'s two rows are inherited and untouched. `fallow health --hotspots --since
      6m` puts ten touched files on the accelerating list, all recorded in TEST_STATUS.md, plus
      `useCharacterSheet.ts` which this ticket touched with a two-line JSDoc pointer and deliberately
      does **not** claim — that row stays SKL-05's, and TEST_STATUS says why.
      **The review found two real defects and both are fixed here** — a `NaN` the panel could store
      and its own importer would refuse, and an equipment-term divergence reachable through
      `deleteEquipmentSlot`'s force path — with four smaller findings addressed beside them.)

## Notes

- Consumables carry vectors like equipment; nothing marks them consumable. The app's rule stays:
  bonuses apply when **equipped** — kept, with the gap noted (systems/11's open question).
- The old `materialId`/`materialLevel` fused-instance fields retire in TICKET-INV-05, not here —
  one reshape per ticket.
- **A shop is the third caller of two patterns, if it is spelled the obvious way** (TICKET-INL-01's
  handoff). Grouping templates under a free-string shop name is a copy of `groupStats`
  (`play/sheet/statGroups.ts`) and `groupInlays` (`config/inlays/useInlayManager.ts`), and a panel
  offering *the stats a bonus may target* is a copy of `useMaterialManager`'s and
  `useInlayManager`'s `modifiableStats`. Both are at **two** instances, left standing by the
  no-abstraction-before-the-third-caller rule — so if this ticket adds either, it owes the
  extraction rather than a third copy.

## Implementation notes (2026-08-29)

- **No `SUPPORTED_SCHEMA_VERSION` bump, and none owed — this is not the milestone's first reshaping
  ticket.** Both new fields are **additive-optional**: `Item.shop?` and `Item.skillBonuses?` are
  absent on every stored template, absent means none, and a build without them ignores the keys.
  Nothing moved and nothing was retired, so there is no `RETIRED_FIELDS` entry either. D6's single
  milestone-wide bump still belongs to the first ticket that genuinely reshapes a document, or to
  TICKET-DX-09 — and `Item`'s fused `materialId`/`materialLevel` retirement, which *is* such a
  reshape, is still INV-05's.
- **The shop shape is `Item.shop?`, and the to-be's `ItemCategory` does not exist.** Argued in full
  in the implementation note under *Desired result* above. What the data pass inherits from it: tag
  the shop **per template**, not on 40 category rows.
- **Both extractions the INL-01 handoff named were owed, and only one of them was.**
  - **Grouping was the third caller and is now shared.**
    [`client/components/shared/labelledGroups.ts`](../../../src/client/components/shared/labelledGroups.ts)
    holds `LabelledGroup<T>`, `groupByLabel(entries, labelOf)` and `hasNamedGroups`. It replaced
    `play/sheet/statGroups.ts` (deleted, with its barrel line) and `useInlayManager`'s private
    `groupInlays`; the items panel is the third caller. Generic over the *member* with the label read
    by a caller-supplied function, because `group` and `shop` are different fields on different
    entities and a shared string key would be a third spelling of the same fact. `StatGroup` survives
    as `LabelledGroup<StatBreakdown>` on `StatGroupColumns`, so that component's props read the same.
    `statGroups.test.ts`'s six cases moved to `labelledGroups.test.ts` unchanged in substance, with
    three shop cases added beside them.
  - **`modifiableStats` gained no third caller, so it stays at two.** The handoff's second pattern is
    *the **stats** a bonus may target* — `stats.sort(order).filter(formula === undefined)`, which
    exists because a derived stat takes its value from its formula. This panel offers the **skills** a
    bonus may target, which is every skill the ruleset has: skills carry no `order` and no `formula`,
    so there is nothing to sort or filter and the expression is `config.skills`. Not a copy, so no
    extraction is owed and the two instances are left standing. `fallow` agrees — the one clone group
    it reports between `useInlayManager` and `useMaterialManager` is **inherited**, not introduced.
- **A fourth caller did land on `StatValueRowsField`, and it was renamed rather than copied.** The
  item dialog's vector is the same *sparse rows the User adds* block the skill weights, the material
  tier and the inlay tier use — but over skills. The component took `availableStats: Stat[]`, which
  the fourth caller makes a lie, so it is now
  [`ValueRowsField`](../../../src/client/components/config/shared/ValueRowsField.tsx) taking
  `options: RowOption[]` plus a `targetLabel`, with `statRowOptions(stats)` exported beside it so the
  three stat callers still spell a stat one way. Three call sites changed mechanically; no markup was
  duplicated.
- **`SkillBonusBadges` ships with its own colocated test**, added in the review round: its sibling has
  one, and the behaviour its JSDoc argues hardest — an unknown skill id shown **raw rather than
  hidden**, because a chip nobody can see is a number nobody can fix — was asserted nowhere, the
  panel's own suite covering only vectors whose skills all exist. Seven cases: both tones, a zero
  reading as a bonus, the unknown-id fallback, two rows on one skill, two skills sharing a spelling,
  and the empty vector.
- **`SkillBonusBadges` is a sibling of `StatModifierBadges`, not a generalisation of it.** The two
  persisted rows name different entities (`statId` / `skillId`), and one generic
  `{ targetId, modifier }` would be a shape that lets a material tier point at a skill. What must not
  differ is how a bonus *looks*, so the style module was renamed `StatModifierBadges.style.ts` →
  [`modifierBadges.style.ts`](../../../src/client/components/shared/modifierBadges.style.ts) and both
  components import it. That is `StatRowsField` / `ValueRowsField`'s own precedent — *different
  shapes, two components*.
- **Both equipment terms walk `config.equipmentSlots`, and the build was wrong to leave them apart.**
  `calculateEquipmentSkillBonuses` reads `equippedItems[slot.type]` per slot the ruleset defines,
  which is what makes the count follow the ruleset (INV-04). The build shipped
  `calculateEquipmentBonuses` still walking `Object.values(equippedItems)` on the argument that the
  difference is *"a state `equipToSlot` cannot create"* — **true of `equipToSlot` and false of the
  app**, as the `conventions-reviewer` pass found: `deleteEquipmentSlot` is a *guarded* delete, and
  `useGuardedDelete` hands the User a **Delete anyway** button that re-runs it with `force: true`. One
  click leaves a character holding `equippedItems: { retired: 'item-sword' }`, and that sword kept
  granting its material's `STR +2` while granting none of its skill vector — the same item,
  half-counted, on one sheet. Both terms read `equippedTemplates` now, which also deleted a duplicated
  `config.items.find`. **Six fixtures in `equipmentBonusCalculator.test.ts` had to gain slots**, and
  that is the finding under the finding: they declared `equipmentSlots: []` while equipping a helmet,
  a ruleset the app cannot produce, and they only passed because of the walk being fixed.
- **`sparseSkillBonuses` filters on `Number.isFinite`, not only on `!== 0`.** The other
  `conventions-reviewer` find, and the blocking one: the modifier box registers
  `{ valueAsNumber: true }`, so clearing it yields **`NaN`** — not `0` — which a `!== 0` test passes.
  It then reaches the store, sums into the wielder's bonus as `NaN` on the sheet, and serialises as
  `"modifier": null`, which **this ticket's own** `itemSkillBonusShapeErrors` refuses on re-import.
  That is INL-01's asymmetry in a new place. The rule, now in the function's JSDoc: *which* rows are
  worth keeping is a storage convention the gate need not share, but **finiteness is the gate's own
  rule and both ends must state it**. `useMaterialManager` and `useInlayManager` have the same hole
  (`bonuses: data.bonuses`, unfiltered) and are **deliberately left alone** — pre-existing drift this
  ticket did not create, and a ticket of its own.
- **`calculateSkills` grew a required fourth parameter**, on `statGain`'s precedent: a defaulted `{}`
  would let a second caller quietly grow a character with no gear. Both callers became compile errors
  and were answered honestly — `calculator.ts` passes the computed map, `FormulaPreview` passes a
  named `NO_GEAR` beside its existing `UNINVESTED`, because *this preview has no equipment* is a claim
  about what the number means rather than an omission.
- **`itemIssues` was split in the same change that grew it.** `fallow audit` reported it as the one
  *introduced* complexity finding (cyclomatic 13, cognitive 21) once the skill-vector check joined the
  slot and material checks in one loop body. It is now three checkers over three independent questions
  — `itemSlotIssues` (where an item is worn), `itemMaterialIssues` (what it is made of),
  `itemSkillBonusIssues` (what it makes you better at) — with `itemEntity` holding the shared
  reporting fields. The audit verdict went `fail` → **pass** with `complexity_introduced: 0`. *The
  build shipped only two of the three*: the slot check stayed inline as a ternary building a
  one-element array inside the `flatMap`, which the review flagged as the one thing the JSDoc promised
  and did not deliver. Extracted on its siblings' pattern; the body is now three named calls and a
  spread.
- **No identity rule was added, so none was owed a pairing.** A skill bonus's modifier is
  `isFiniteNumber` like a `StatModifier`'s — not an integer rule — and a vector may name one skill
  twice, exactly as a material tier may name one stat twice (`StatModifierBadges`' own note). What
  *is* new is the **sparse** convention, and that is deliberately storage rather than identity: the
  editor prunes zeros, and the import gate accepts a stored zero rather than refusing a file that
  plays identically. `importExport.test.ts` states both halves.
- **No `FormulaPreview` is owed.** Nothing this ticket adds is a formula field: a skill bonus is a
  typed integer and a shop is a free word.
- **`dependencies.ts` gained the config→config arm the handoff predicted.**
  `itemSkillBonusReferences` folds into `skillEntityReferences`, so deleting a skill that item
  templates grant is refused and names the templates. It is `inlayBonusReferences`' shape pointing the
  other way.
