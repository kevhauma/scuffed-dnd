/**
 * Character Types
 *
 * Type definitions for player characters and their state.
 */

import type { StatModifier } from './config';
import type { FormulaResult } from './formula';

/**
 * One weight row's share of a skill's level (Concept 02, TICKET-SKL-03)
 *
 * The engine's own terms rather than the sheet's: a caller gets the stat id, the weight and the
 * stat's value, and spells them however it renders. The **multiplication is done in the
 * calculator**, because `weight × statValue` is the derivation and a component that recomputed it
 * could disagree with the level it sits beside.
 */
export interface SkillStatContribution {
  statId: string;
  weight: number;
  /** The stat's composed value at the time the level was computed */
  statValue: number;
  /** `weight × statValue` — this row's share of the level */
  contribution: number;
}

/**
 * What a skill's focus multiplier did to its weighted sum (TICKET-SKL-05)
 *
 * Both halves, because neither answers the question alone: the **multiplier** is what the Player
 * chose (0.9 unchosen, 2.1 chosen once, 3.3 chosen twice at the sheet's dials) and the
 * **contribution** is what that did to this particular skill, which is the only form a breakdown row
 * can add up. A surface renders `focus ×2.1  +5.7` from the pair and multiplies nothing itself —
 * `weighted × multiplier` is the derivation, and a component that recomputed it could disagree with
 * the level it sits beside, exactly as {@link SkillStatContribution} argues one row up.
 */
export interface SkillFocusContribution {
  /** The summed per-slot factor — 0.9, 2.1, 3.3 at `focus_chosen` 1.5 / `focus_other` 0.3 */
  multiplier: number;
  /** `weighted × multiplier − weighted` — this multiplier's share of the pre-rounding total */
  contribution: number;
}

/**
 * Character - player's in-game persona with stats, skills, and equipment
 */
export interface Character {
  id: string;
  name: string;
  configurationId: string;
  raceIds: string[];
  /**
   * Points the Player has put into each stat, keyed by **stat id** (TICKET-STAT-01).
   *
   * Keyed by id rather than by a spelling, so renaming a stat cannot orphan an allocation — the
   * same reason a formula stores ids. A derived stat never appears here; an invested stat the
   * Player has not touched reads 0 through the calculator rather than being absent, which is
   * TICKET-CALC-02's invariant carried across.
   *
   * **These are points *spent*, not levels gained** (TICKET-ARC-02). The `point_buy` curve is the
   * exchange rate between the two, selected by the archetype's affinity for that stat: 15 points
   * buy 12 on a main-type stat and 5 on a non-type one. Never read an entry as a stat's value —
   * ask `statGain`, or read `validateStatAllocation(...).gains`.
   *
   * **Nor is the gain a function of these points alone** (TICKET-ARC-04): Dream level multiplies a
   * main-tagged stat's gain and adds to a sub-tagged one's, so a stat with no entry here still
   * moves when the DM raises {@link Character.dreamLevel}.
   */
  investedStatPoints: Record<string, number>; // statId -> points spent
  /**
   * The archetype this character grows along, by **id** (Concept 03).
   *
   * Replaces the focus stat outright (TICKET-ARC-03): that was a flat adder on one stat, which the
   * spec does not recognise, where an archetype is a shape across the whole sheet. ARC-01 added the
   * field, ARC-02 made it change a number, and this ticket is what sets it and deletes what it
   * replaced.
   *
   * **Optional rather than required, which diverges from the ticket's to-be.** The *wizard* requires
   * a pick — but only when the ruleset defines archetypes at all, and a ruleset may define none, the
   * same way TICKET-RACE-02 kept a raceless character legal. A required field would make every such
   * ruleset unusable to satisfy a rule about rulesets that have archetypes.
   */
  archetypeId?: string;
  /**
   * Points the Player has put into each skill, keyed by **skill id** (TICKET-SKL-02).
   *
   * Replaces v1's `specialitySkillBaseLevels`, which was keyed by a mutable 3-letter code — so a
   * rename orphaned the Player's investment and needed a store action to chase it. An id cannot.
   * The contribution to `level` is 1:1 and stays that way: Concept 02 leaves the real conversion
   * open (`+1.5` for one starting pick), and TICKET-ARC-02 routed **stats** through the point-buy
   * curve while deliberately leaving skills alone — whether skill investment follows is an
   * unanswered spec question, not an oversight.
   */
  investedSkillPoints: Record<string, number>;
  /**
   * Where each **resource** stat currently stands against its maximum, keyed by stat id.
   *
   * Only `isResource` stats appear: a stat you cannot spend has no "current" distinct from its
   * value, and v1 gave every stat one. This is the one sanctioned piece of derived-looking state
   * that is genuinely stored — it is player state, not a derivation.
   */
  currentResourceValues: Record<string, number>; // statId -> current value
  /**
   * Total experience the character has accumulated (Concept 20, TICKET-RES-01).
   *
   * The **second** sanctioned piece of stored player state, beside `currentResourceValues`. It is
   * stored rather than derived because nothing else in the app knows it: XP is awarded at the
   * table, and `level` is what derives *from* it through the `xp_thresholds` curve.
   *
   * Accumulate-only in spirit — there is no maximum and it never resets — but deductions are
   * allowed (the sheet's `exp.gs` has both), floored at 0 by the store action rather than by this
   * type. A fresh character starts at 0, which the seeded curve reads as level 1.
   *
   * **This inverts v1.0**, where level was the *sum of points spent*. The chain now runs
   * `XP → level → budget → spend` (TICKET-RES-02 closes the budget half).
   */
  experience: number;
  inventory: Inventory;
  /**
   * What the character is carrying in coin — **one amount, in the ruleset's base tier**
   * (Concept 16, TICKET-CUR-02, v3 Req 43).
   *
   * The sheet has a purse (`Charactersheet!Q18:S23`) and the app had nowhere to put it, so a
   * ruleset could define gold and silver and a Player could never hold any.
   *
   * ## Why one number and not a tier-by-tier breakdown
   *
   * This replaced a `wallet?: Record<tierId, number>` that arrived without a ticket and which
   * TICKET-CUR-02 exists to argue against. A per-tier purse makes every payment a change-making
   * problem, makes *"do I have 3 gold"* a conversion, and makes two representations of the same
   * wealth possible — 1 gold and 100 copper are the same money and would be different objects.
   * `normalizeCurrency` already answers *which tier should I show this in*, and that display
   * question is the only one worth asking: what the Player is **shown** follows the ruleset's rates
   * and is re-derived every render, so retuning gold-to-silver rewrites nobody's savings.
   *
   * The **base** tier (`order: 0`, the least valuable) because it is the only one every amount can
   * be written in without inventing a fraction — see `engine/currency.ts`'s `baseTier`.
   *
   * **Optional, and absent means none.** A purse nobody has touched is not the same as a purse with
   * nothing in it, so `isReadableCharacter` does not require it and a stored roster from before
   * this field round-trips without growing one — the `constants?` pattern.
   *
   * **Player state, not a derivation** — money is spent at the table and computed from nothing. It
   * is the fourth sanctioned exception to *derived values are never stored*, beside
   * `currentResourceValues`, `experience` and DM-01's `grantedStatPoints`
   * ([D9](../../../docs/v3.0_backend/overview.md#d9--level-stays-derived-points-to-spend-becomes-a-grant)).
   *
   * Fractional amounts are allowed: a tier rate may be fractional, so rounding here would quietly
   * lose money. Round for display only.
   */
  purse?: number;
  /**
   * Spendable stat points the DM has handed out on top of the derived pool
   * (TICKET-DM-01, v3 Req 42.3,
   * [D9](../../../docs/v3.0_backend/overview.md#d9--level-stays-derived-points-to-spend-becomes-a-grant)).
   *
   * ## Why a grant rather than a writable budget
   *
   * The User asked for a DM who can edit a player's *points to spend*, and that is not a field: the
   * budget is `level × const.points_per_level` and the level is read out of `xp_thresholds`, so a
   * stored budget would be a derived value with a second writer — award experience and the two
   * disagree in silence. *"The DM gave you three points"* is not derivable from anything, so it is
   * genuinely new information, and it is an **input** to the pool rather than a replacement for it:
   * `validateStatAllocation` prices the budget as `derived pool + grants`.
   *
   * That makes it the **third** sanctioned exception to *derived values are never stored*, beside
   * `currentResourceValues` and `experience`, with `purse` the fourth.
   *
   * ## One number, not one per stat
   *
   * Points are fungible in this system — the archetype decides what they *buy*, per stat, through
   * the `point_buy` curve (TICKET-ARC-02) — so a per-stat grant would be a second exchange rate
   * sitting beside the ruleset's own and contradicting it.
   *
   * **Optional, and absent means none**, for `purse`'s reason: a roster stored before this field
   * round-trips without growing one, and `isReadableCharacter` does not require it. Whole and
   * non-negative — a revocation that would leave the character overspent is refused rather than
   * clamped (v3 Req 42.4).
   */
  grantedStatPoints?: number;
  /**
   * How far the character stands in their dream — the new workbook's identity block
   * (TICKET-RES-04, v4 systems/02 gap 2).
   *
   * *"Hoe ver je staat in je dream"*, and it is not decoration: the archetype gain formulas read it,
   * a **main**-affinity stat multiplying its point-table value by it and a **sub**-affinity stat
   * adding it, even at zero points (TICKET-ARC-04).
   *
   * ## Why it is stored at all
   *
   * The same test that admitted `experience`: **nothing derives it.** How far somebody is into their
   * dream is decided at the table and computed from no other field — it is an *input* to derivation
   * rather than a derivation, exactly as `grantedStatPoints` is an input to the point budget. That
   * makes it the **fifth** sanctioned exception to *derived values are never stored*, beside
   * `currentResourceValues`, `experience`, `purse` and `grantedStatPoints`.
   *
   * **The DM raises it, as an action** (User ruling, 2026-08-29), on the surface that already awards
   * experience and sets level: `setDreamLevel` in
   * [`dmActions.ts`](../services/dmActions.ts), refusing below the floor rather than clamping.
   *
   * **Optional, and absent means 1** — `purse`'s pattern, and 1 rather than 0 because the role is
   * multiplicative. The default is the *reader's* rule rather than a stored backfill: read it with
   * [`dreamLevelOf`](../engine/dreamLevel.ts), never `character.dreamLevel ?? 1` at a call site.
   */
  dreamLevel?: number;
  /**
   * The skills this character has made their focus — three slots, duplicates legal
   * (TICKET-SKL-05, v4 systems/06 gap 2).
   *
   * The new workbook's Setup form has three **Focus skill** slots and the sample character picked
   * Arcane, Summening and *Arcane again*: each slot contributes `const.focus_chosen` to the skill it
   * names and `const.focus_other` to every other, and the sum multiplies that skill's weighted stat
   * total. At the sheet's 1.5 / 0.3 that is 0.9 unchosen, 2.1 chosen once, **3.3 chosen twice** —
   * duplicates stack, which is why this is a list of ids and not a set.
   *
   * ## Why it is stored, and why the *reader* owns the default
   *
   * Nothing derives it: which three skills a Player specialised in is a choice made at the table, an
   * *input* to derivation rather than a derivation — the same test that admitted `dreamLevel`. It is
   * not a sixth exception to *derived values are never stored*, though, because it is not a number
   * anything else computes; it is a pick, like {@link Character.raceIds} and
   * {@link Character.archetypeId} beside it.
   *
   * **Optional, and absent means none** — `purse`'s and `dreamLevel`'s pattern. A roster written
   * before this field round-trips without growing one and computes every skill at the *unchosen*
   * multiplier (0.9 at the sheet's dials), which is the sheet's own arithmetic for a Setup form
   * nobody filled in rather than a neutral 1. Read it with
   * [`focusPicksOf`](../engine/focusSkills.ts), never `character.focusSkillIds ?? []` at a call site.
   *
   * **Slot order is meaningful and empties are not stored.** The list holds the picks that were made,
   * in slot order; a Player part-way through choosing has fewer than three and the missing slots
   * count as *other*, which is what makes the sheet's picker usable one slot at a time. More than
   * three, or an id this ruleset does not define, is refused by the write rather than trimmed by the
   * reader (`focusPickRefusal`).
   */
  focusSkillIds?: string[];
  /**
   * The spells this character has unlocked, by **id** (TICKET-SPL-02, v4 systems/13 gap 2).
   *
   * The workbook's spells tab carries a per-player `locked`/`Learned` flag beside every one of its
   * 418 rows, and its `Spellbook` sheet is one `FILTER` of that table down to the `learned` ones.
   * This is that flag, stored the way the app stores every pick — as the ids that are *on*, rather
   * than as a state per compendium row, so a ruleset that grows a spell does not grow a field on
   * every character who will never cast it.
   *
   * **Spells unlock manually** (User ruling, 2026-08-29): no rule derives this, nothing gates it on
   * a level or a skill. It is a hand-set flag, which is exactly what the sheet does — and it is why
   * this is not a sixth exception to *derived values are never stored*, any more than
   * {@link Character.focusSkillIds} is: it is a **pick**, not a number something else computes.
   *
   * **Optional, and absent means none** — `purse`'s and `focusSkillIds`' pattern, and it is the
   * sheet's own default (`locked`). A roster written before this field round-trips without growing
   * one. The default belongs to the *reader*: read it with
   * [`learnedSpellIdsOf`](../engine/spellbook.ts), never `character.learnedSpellIds ?? []` at a call
   * site.
   *
   * **A stale id is a state to report, not a crash.** Deleting a learned spell is refused by the
   * dependency walker, so an id naming nothing arrives only from a force-delete or a hand-edited
   * file; `spellbookOf` resolves it to a row with no spell behind it, which the Spellbook draws as a
   * finding the Player can unlearn. Nothing prunes the list on read — silently dropping an id would
   * be a repair nobody asked for and nobody could see.
   *
   * The Setup tab's *Chosen abiltie* box is deliberately **not** modelled here or anywhere: it is a
   * placeholder the workbook has not filled in (User ruling, same date).
   */
  learnedSpellIds?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * One thing a Player has built, as **links to what it is made of** (v4 systems/12, TICKET-INV-05)
 *
 * The sheet's Item selecter picks three columns — a template, a material tier, an optional inlay
 * tier — and the thing that comes out is what goes in the Backpack. This is that thing, and the
 * User's ruling (overview *Rulings 2026-08-29*) is where it lives: **in the Player's inventory**,
 * not in the ruleset's catalog.
 *
 * ## Nothing about its bonuses is stored
 *
 * Not a stat row, not a skill row, not the display phrase. Every number it is worth is read from the
 * parts at calculation time (`calculateEquipmentBonuses` /`calculateEquipmentSkillBonuses`), which is
 * the whole reason the record holds references rather than values: retuning Iron Ore tier 10
 * relabels every axe made of it on the next read instead of rewriting none of them. That is
 * *derived values are computed, never stored* applied to an aggregate rather than to a field.
 *
 * ## Why the material is optional when the sheet always picks one
 *
 * The triple's third column is optional by the sheet's own hand — "with empty inlay" is a row it
 * writes — and the **first two are optional here too**, which diverges from TICKET-INV-05's to-be
 * and is recorded on that ticket. Two reasons: `Item.materialId` and `Item.materialLevel` were
 * *already* optional on the template this record inherits them from, so keeping them optional moves
 * the fields without also changing what a ruleset may say; and a rope is a legal thing to carry,
 * with no metal in it and no tier to name.
 *
 * The split is `Character.focusSkillIds`' exactly: **the field tolerates, the action insists.** Three
 * focus picks are optional on the type and required by `characterCreationErrors`; a material tier is
 * optional here and **required by [`buildItem`](../services/playerActions.ts)** (TICKET-INV-06),
 * which is the surface that actually offers the picker. A record that names no material is therefore
 * something an *older* build minted or an import carried, not something the app writes.
 *
 * ## A part the ruleset no longer defines contributes nothing
 *
 * A `materialLevel` naming no tier, an `inlayLevel` naming a rung the family skips (the sheet's
 * Zircon has no tenth — TICKET-INL-01), a `templateId` the User deleted: each contributes zero
 * rather than throwing or inventing a target, which is the rule every dangling reference in this
 * model already follows. *Reporting* an absent rung to the Player is TICKET-INV-06's picker refusal,
 * where the Player can act on it.
 */
export interface ComposedItem {
  /**
   * Stable identity, minted by whoever builds it — **this is what the inventory names**.
   *
   * `equippedItems` holds these ids rather than `Item.id`s, which is what makes two Battleaxes at
   * different tiers two different things a Player can wear and drop independently.
   * Minted by the caller rather than here or in a Kernel rule, for `CharacterIdentity`'s reason: the
   * browser mints its own and the server mints its own, and `shared/` reaches for no global.
   */
  id: string;
  /** Which `Item` template this was built from — the shape of the thing */
  templateId: string;
  /** Which `Material` family it is made of, when it is made of one */
  materialId?: string;
  /** Which rung of that family — a `MaterialLevel.level`, not an index into `levels` */
  materialLevel?: number;
  /** Which `Inlay` family is socketed into it; absent is the sheet's "with empty inlay" */
  inlayId?: string;
  /** Which rung of that family — an `InlayTier.tier`, unique within the family (TICKET-INL-01) */
  inlayLevel?: number;
}

/**
 * Inventory — what the character has built, and which of those things are worn
 *
 * **Two collections since TICKET-INV-06, where INV-05 left three.** `composedItems` is everything the
 * Player has made; `equippedItems` says which of them are on the body. **The Backpack is neither of
 * them — it is the difference**, derived at read time by
 * [`backpackOf`](../engine/composedItems.ts), which is exactly the `FILTER` the sheet's own Backpack
 * tab is (v4 systems/12: "built but not worn").
 *
 * ## Why `miscItems` is gone
 *
 * It was a *stored derivation*, and the house rule against those is the first hard rule in
 * [CLAUDE.md](../../../CLAUDE.md). Once every build was either worn or carried — INV-05's invariant —
 * the carried list held precisely `composedItems − worn`, maintained by hand in five separate
 * actions. INV-05's own review caught one of those five leaving a build in neither list, which is the
 * failure mode a stored derivation always has: two answers to one question, kept in step by
 * discipline.
 *
 * Deleting it removes the failure mode rather than guarding against it. There is no "carried" place a
 * record can fail to be in, `equipToSlot` has nothing to stow, and *unequipped* and *discarded* are
 * different things again — the first clears a slot, the second deletes the record.
 *
 * ## Worn means worn in a slot the ruleset still defines
 *
 * `backpackOf` walks `config.equipmentSlots` rather than the keys of `equippedItems`, so a build left
 * in a slot the User force-deleted comes back to the Backpack instead of vanishing into a slot no
 * surface can show — the same rule `equippedCompositions` applies when deciding what grants bonuses,
 * so what the sheet counts and what the bag shows cannot disagree.
 *
 * A **dangling** id is a different matter and stays tolerated: the engine drops what it cannot
 * resolve, for the reason `equippedItems` never enforced that its items existed — a rule that refused
 * would turn a stale id into an unopenable sheet.
 */
export interface Inventory {
  equippedItems: Record<string, string>; // equipmentSlotType -> ComposedItem.id
  /** Everything the character has built, worn or not — see {@link ComposedItem.id} */
  composedItems: ComposedItem[];
}

/**
 * Calculated character - extends Character with computed values
 * These values are not persisted, computed on demand from base character data
 *
 * The three formula-derived maps hold a `FormulaResult` per entry — a number, or an error value
 * explaining why that one entry could not be calculated (Concept 00 §7). A broken formula never
 * blanks the rest of the sheet. Read them with `numberOr(result, fallback)` where a number is
 * structurally required, or `asNumber(result)` where absence matters (rendering an error chip,
 * skipping a clamp); both live in `engine/formula/errors.ts`.
 *
 * `statValues` replaced v1's `totalMainSkillLevels` + `maxStatValues` when the two entities
 * became one (TICKET-STAT-01). It is one map because there is one concept: the composed value of
 * every configured stat, keyed by stat id. For a **resource** stat that number is the maximum,
 * which `currentResourceValues` is measured against; for every other stat it is just the value.
 * It holds `FormulaResult` rather than `number` because a derived stat's formula can fail.
 */
export interface CalculatedCharacter extends Character {
  statValues: Record<string, FormulaResult>; // statId -> composed value (the max, for resources)
  /** Sum of the `countsTowardTotal` stats — stats that failed to compute contribute nothing */
  statTotal: number;
  /** Each skill's level — `Σ(weight × stat) + invested` — keyed by skill id (Concept 02) */
  skillLevels: Record<string, FormulaResult>;
  /** Each skill's **bonus**, the integer a Player adds to a roll: `round(level / bonus_divider)` */
  skillBonuses: Record<string, FormulaResult>;
  /**
   * The weight rows behind each level, so the sheet can label a breakdown without redoing the
   * multiplication (TICKET-SKL-03). Derived like the rest — never persisted.
   */
  skillContributions: Record<string, SkillStatContribution[]>;
  /**
   * Each skill's focus multiplier and what it contributed, keyed by skill id (TICKET-SKL-05)
   *
   * Beside {@link skillContributions} rather than inside it because it is a different kind of term:
   * a weight row *adds* and this one *multiplies*, and the two only read as one list once the
   * calculator has spelled the multiplication out. Absent for a skill whose level failed, for
   * `skillContributions`' reason — half a breakdown is more misleading than none.
   */
  skillFocus: Record<string, SkillFocusContribution>;
  /**
   * Each roll's **input** — the number fed to its dice ladder — keyed by roll id (Concept 08).
   *
   * Replaced `combatSkillBonuses` in TICKET-ROLL-06, and the swap is the entity's whole argument:
   * that was a bonus added to a hand-typed pool, this is the value a pool is *derived* from. Both
   * the sheet's button label and `rollRollDefinition` read this map, which is what makes "a roll
   * can never disagree with the sheet" structural rather than a promise.
   */
  rollInputs: Record<string, FormulaResult>;
  equipmentBonuses: StatModifier[]; // From equipped items, keyed by stat id (TICKET-MAT-02)
}

/**
 * Character creation data - used during character creation wizard
 */
export interface CharacterCreationData {
  name: string;
  raceIds: string[];
  investedStatPoints: Record<string, number>;
  /** The archetype the Player picked — the wizard's third step (TICKET-ARC-03) */
  archetypeId?: string;
  investedSkillPoints: Record<string, number>;
  /**
   * The focus skills the Player picked — the wizard's fourth step (TICKET-SKL-05)
   *
   * Optional here as it is on {@link Character}: a ruleset with no skills has none to pick, and a
   * ruleset that states neither focus dial has three picks that would change nothing. What the
   * *wizard* insists on is `characterCreation.ts`'s `focusErrors`, so the step and the server refuse
   * the same character.
   */
  focusSkillIds?: string[];
}

/**
 * Character summary - lightweight character info for list display
 */
export interface CharacterSummary {
  id: string;
  name: string;
  raceIds: string[];
  /**
   * Derived from accumulated XP through the `xp_thresholds` curve (TICKET-RES-01).
   *
   * A `FormulaResult` rather than a number because that curve is the User's data like any other:
   * they can delete it, or set `outOfRange: 'error'` and leave a character's XP outside the table.
   * A level that cannot be read says so rather than showing a confident 1 (Concept 00 §7).
   */
  level: FormulaResult;
  createdAt: string;
}
