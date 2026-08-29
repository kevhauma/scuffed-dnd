/**
 * Configuration Types
 *
 * Type definitions for the user-defined configuration system.
 * All game rules, skills, materials, items, and races are defined here.
 */

/**
 * The persisted shape this build reads
 *
 * Lives with the type rather than in either service so that `storage.ts` and `importExport.ts`
 * gate on the same number without one importing the other — and so a test that mocks one service
 * cannot change what the other considers current.
 */
export const SUPPORTED_SCHEMA_VERSION = 10;

/**
 * Main configuration object containing all user-defined game rules
 */
export interface Configuration {
  id: string;
  name: string;
  version: string;
  /**
   * Which persisted shape this is (TICKET-STAT-01).
   *
   * `2` was the unified-stat shape, `3` added TICKET-RACE-01's race stat blocks, `4` is
   * TICKET-MAT-01's per-stat material modifiers, `5` is TICKET-SKL-02's weighted Skill, `6` is
   * TICKET-RES-01's stored experience, `7` is TICKET-RES-02 retiring `mainSkillPointBudget`, and
   * `8` is TICKET-ARC-03 retiring the focus stat (`focusStatBonusLevel` here, `focusStatCode` on
   * the character) now that Archetype replaces it, and `9` is TICKET-ROLL-06 retiring
   * `combatSkills` — the last of the v1 core model — now that a `RollDefinition` derives its pool
   * from a formula instead of carrying a hand-typed one.
   * v1 files have no `schemaVersion` at all, which is exactly how they are recognised and refused — the shapes have
   * no faithful mapping between them (a v1 character's focus stat, spend-derived level and
   * speciality base levels have nowhere to go), so they are rejected with a notice rather than
   * converted. TICKET-IO-03 owns that UX and the notice covers every mismatch, not just v1.
   *
   * **The v2.0 milestone bumps this on every reshape**, by the User's decision (2026-08-09): the
   * persisted shape is not stable until the milestone lands, and a build that cannot read stored
   * data must say so through IO-03's notice rather than crash on a field that moved. `9` is the
   * last bump *that* milestone planned — DX-04 is a parity gate, not a reshape.
   *
   * **`10` is v4.0's one bump, raised by TICKET-INV-05** — the milestone's first genuine document
   * reshape, retiring `Item.materialId` / `Item.materialLevel` in favour of the composed record in a
   * character's inventory. v4.0 is a **clean break**
   * ([D6](../../../docs/v4.0_sheet_parity/overview.md#d6--no-backwards-compatibility-v40-is-a-clean-break-user-2026-08-29)):
   * where the `data-model` skill offers *bump* or *ship a conversion*, this milestone always bumps,
   * and it bumps **once** — whichever ticket lands the first reshape raises the number and every
   * later v4.0 ticket inherits it rather than adding its own. TICKET-DX-09 proves the break complete
   * rather than raising it again.
   */
  schemaVersion: typeof SUPPORTED_SCHEMA_VERSION;
  stats: Stat[];
  skills: Skill[];
  materials: Material[];
  materialCategories: MaterialCategory[];
  items: Item[];
  equipmentSlots: EquipmentSlot[];
  /**
   * The grid the equipment slots are laid out on (TICKET-INV-03).
   *
   * Optional, and **absent means never configured** — the equipment page seeds one from the
   * sheet's own figure the first time it is opened, so a ruleset written before the builder
   * existed round-trips unchanged until the User visits it.
   */
  equipmentLayout?: EquipmentLayout;
  races: Race[];
  currencyTiers: CurrencyTier[];
  /**
   * Named tunable numbers, referenced from formulas as `const.<name>` (Concept 05).
   *
   * Optional so a configuration written before TICKET-CST-01 still loads. **Absent means none**
   * and stays absent: readers write `config.constants ?? []`, and a file without the key
   * round-trips without growing one.
   */
  constants?: Constant[];
  /**
   * Named lookup tables, called from formulas as `curve.<name>(x)` (Concept 06).
   *
   * Optional for the same reason `constants` is: absent means none and stays absent, so a
   * ruleset written before TICKET-CRV-01 round-trips without growing an empty array. Readers
   * write `config.curves ?? []`.
   */
  curves?: Curve[];
  /**
   * What a character is good at growing (Concept 03, TICKET-ARC-01).
   *
   * Optional for the same reason `constants` and `curves` are, and **without a schema bump**: this
   * is purely additive, so a ruleset written before archetypes existed reads as having none and a
   * build without them ignores the key. RACE-01's "bump on every reshape" rule is about a field
   * that *moved or was removed*, where a stale file would be misread — see TICKET-ARC-01's
   * implementation note 1.
   */
  archetypes?: Archetype[];
  /**
   * How a number becomes a dice pool (Concept 07, TICKET-ROLL-03).
   *
   * Optional and additive, for the same reason `archetypes` is: a ruleset written before ladders
   * existed reads as having none, and a build without them ignores the key — nothing *moved*, so
   * RACE-01's bump-on-every-reshape rule does not apply. Readers write `config.diceLadders ?? []`.
   */
  diceLadders?: DiceLadder[];
  /**
   * The named rolls a sheet offers — melee, ranged, evasion, endure (Concept 08, TICKET-ROLL-05).
   *
   * Optional and additive like `diceLadders`, so a ruleset written before rolls existed reads as
   * having none. A fresh ruleset seeds four, which is not the same thing: absent means none and
   * stays absent, and only `createFreshConfiguration` puts any there.
   */
  rollDefinitions?: RollDefinition[];
  /**
   * The gems a crafted item can be socketed with (v4 systems/10, TICKET-INL-01).
   *
   * Optional and **absent means none**, like `constants`, `curves` and `archetypes`: a ruleset that
   * has never heard of an inlay round-trips without growing an empty array, and this build reads one
   * that has. Purely additive, so it owes no `SUPPORTED_SCHEMA_VERSION` bump — nothing moved.
   */
  inlays?: Inlay[];
  /**
   * The sizes a creature may be — `tiny`, `small`, `medium`, … (v4 systems/14, TICKET-RACE-03).
   *
   * The vocabulary a {@link Race.size} is picked from, and **the User's own words**: the workbook
   * spells one of them `guargantian`, and that is theirs to keep or fix. Free strings rather than a
   * const object for exactly that reason — a hard-coded set would make the app disagree with the
   * ruleset it is running.
   *
   * Optional and **absent means none**, like `constants` and `curves`: a ruleset that names no
   * sizes round-trips without growing an empty array, and validates nothing.
   */
  creatureSizes?: string[];
  /**
   * The kinds a creature may be — `humaniod`, `construct`, `fey`, … (v4 systems/14, TICKET-RACE-03).
   *
   * {@link creatureSizes}' sibling in every respect, including the misspelling: the sheet's
   * `humaniod` is a User string this app records rather than corrects (overview D1).
   *
   * Two lists rather than one `{ sizes, types }` container, because *absent means none* has to be
   * answerable per list — a ruleset may well name its sizes and never bother with its types.
   */
  creatureTypes?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * How a stat's composed value is rounded, after clamping (Concept 01)
 *
 * `none` keeps the fraction, which is what a stat feeding another formula usually wants;
 * the rest are the three directions a displayed number is taken in.
 */
export type StatRounding = 'none' | 'nearest' | 'up' | 'down';

/**
 * Stat — the one numeric axis a ruleset is built from (Concept 01)
 *
 * v1 split this in two: `MainSkill` was the thing you invested in, `Stat` the thing derived by
 * formula, and nothing could be both. The source sheet has nine stats where Mana is *invested and
 * tracked*, which that split cannot express. So there is one entity now, and the flags say what
 * each stat does:
 *
 * - **invested** — no `formula`; its value is what the Player put into it (plus race and
 *   equipment). Strength.
 * - **resource** — invested *and* `isResource`, so the composed value is a **maximum** and the
 *   character carries a current value against it. Mana.
 * - **derived** — has a `formula`, so it accepts no investment; its value is computed. APT.
 *
 * `id` is the identity (TICKET-REF-01) and everything else is renamable display data.
 * `abbreviation` is the flat spelling a formula uses (`STR + DEX`); `stats.<name-slug>` reaches
 * the same stat by the dotted route.
 *
 * **`APT` keeps its name, deliberately** (TICKET-STAT-04). The v4.0 workbook writes the derived
 * actions-per-turn stat as *ATP*; the app does not follow it, and `const.apt_value` keeps its
 * spelling with it. This is v4.0's **one** named exception to
 * [D1](../../../docs/v4.0_sheet_parity/overview.md)'s *the sheet wins* rule — the sheet is mistaken
 * there rather than idiosyncratic (ticket-review ruling, 2026-08-29) — and it is written here so
 * nobody "fixes" the app's spelling back to the sheet's later.
 */
export interface Stat {
  id: string; // Stable identity — assigned on creation, never shown, never reused
  name: string;
  /** Short spelling used in the flat formula space — `STR`. Renamable display data. */
  abbreviation: string;
  description: string;
  /** Display order on the sheet and in the panels; ties fall back to definition order */
  order: number;
  /** Whether this stat is part of `statTotal` — the sheet's "how big is this character" number */
  countsTowardTotal: boolean;
  /** Whether the composed value is a **maximum** the character spends against (Mana, Health) */
  isResource: boolean;
  /**
   * Which of the sheet's stat groups this stat is listed under — `Physical`, `Mental`, `Vitals`
   * (TICKET-STAT-04).
   *
   * **Presentation only.** Nothing derives from a group and no rule reads one: it decides which
   * column of the character sheet the stat lands in, and that is the whole of it. A group total or
   * a per-group cap would be a new decision, not an extension of this field.
   *
   * A **User-named free string**, validated against nothing — it is their ruleset, so a misspelling
   * is theirs to keep or fix, exactly as `Skill.category` is. Absent means ungrouped, and a ruleset
   * that names no groups renders the flat list it always has.
   */
  group?: string;
  /**
   * Makes the stat **derived**: its value is this expression rather than anything invested.
   *
   * Absent means invested. Present means the stat accepts no points — the two are mutually
   * exclusive by construction rather than by a separate flag that could disagree.
   */
  formula?: string;
  /** Floor for the composed value, applied before rounding */
  min?: number;
  /** Ceiling for the composed value, applied before rounding */
  max?: number;
  rounding: StatRounding;
}

/**
 * Skill — a competence derived from weighted stats plus deliberate investment (Concept 02)
 *
 * v1's `SpecialitySkill` had the right direction but an opaque `bonusFormula` string, which is the
 * disease the concept page opens with: the sheet re-implements the same arithmetic in three tabs,
 * so a global rebalance means editing every one of them. Here the **weights are data** and the
 * arithmetic lives once, in the calculator:
 *
 * ```
 * level = Σ (weight × stat value) + invested
 * bonus = round(level / const.bonus_divider)
 * ```
 *
 * So "make bonuses grow faster" is one constant, and "add a third governing stat" is one more row
 * in `statWeights` — neither is a formula edit.
 *
 * **No `code`.** v1 gave a skill a 3-letter code so a formula could name it in the flat variable
 * space; a skill is reached as `skills.<name-slug>` now (TICKET-SKL-02), and the flat space holds
 * stat abbreviations only. **No `maxBaseLevel`** either: the sheet has no such cap.
 */
export interface Skill {
  id: string; // Stable identity — assigned on creation, never shown, never reused
  name: string;
  description: string;
  /** The stats this skill is derived from, and how much each one counts */
  statWeights: StatWeight[];
  /** Optional grouping — craft / social / physical / lore. The sheet has none (Concept 02) */
  category?: string;
}

/**
 * One stat's contribution to a skill's level (Concept 02)
 *
 * Keyed by stat **id** like every other reference, so renaming a stat cannot orphan a weight row.
 * The sheet's seeds are 0.2 or 0.3 for a single-stat skill and 0.2 + 0.1 for a two-stat one.
 */
export interface StatWeight {
  statId: string; // References Stat.id
  weight: number;
}

/**
 * What a dice ladder does with the value left over after its smallest die (Concept 07)
 *
 * An enum of one on purpose (TICKET-ROLL-03's notes): the sheet's ladder is `flat_bonus` and
 * nothing else is confirmed, so `smallest_die` and `drop` arrive as new members when a ruleset
 * needs them rather than as untested branches now.
 */
export type LadderRemainder = 'flat';

/**
 * Dice ladder — how a single number becomes a rollable pool (Concept 07, TICKET-ROLL-03)
 *
 * The system's signature mechanic, and it is entirely configuration. A value is walked down
 * `dieSizes` greedily, largest first, and whatever will not fill another die becomes a flat bonus:
 * `39` over `[20, 12, 6]` is `1D20 + 1D12 + 1D6 + 1`. Baking the sizes into code — which is what
 * `DiceConfig`'s six fixed keys do — makes the app useless for any other ruleset, including a
 * future revision of this one, so a d100 here is data.
 *
 * `id` is the identity and everything else renamable display data, as everywhere else
 * (TICKET-REF-01). A ladder is **not** reachable from a formula, so `name` is free text rather
 * than an identifier — a roll definition points at one by id (Concept 08, TICKET-ROLL-05).
 *
 * `decomposition` is deliberately absent: greedy is the only strategy the sheet has, and adding
 * `balanced` later is a new field rather than a changed one.
 */
export interface DiceLadder {
  id: string; // Stable identity — assigned on creation, never shown, never reused
  name: string;
  description: string;
  /**
   * The die sizes to walk, **strictly descending** — `[20, 12, 6]`.
   *
   * Descending is what makes the walk greedy; `engine/validator.ts` reports a ladder that is not,
   * rather than silently producing a decomposition nobody would predict.
   */
  dieSizes: number[];
  /** Optional cap per rung — `2` means never more than 2D20, the excess falling down-ladder */
  maxPerDie?: number;
  /** Whether a rung with no dice is still listed — the sheet shows `0D20` (display only) */
  showZeroTerms: boolean;
  remainder: LadderRemainder;
}

/**
 * What a roll is for, which is what a view groups by (Concept 08)
 *
 * Optional on the definition: the sheet's own four rolls are two offence and two defence, but a
 * ruleset may reasonably decline to sort its rolls at all, and a required field would force a
 * meaningless answer.
 */
export type RollCategory = 'offence' | 'defence' | 'utility';

/** Every category, in the order an editor offers them */
export const ROLL_CATEGORIES: readonly RollCategory[] = ['offence', 'defence', 'utility'];

/**
 * Roll definition — a named, rollable line on a sheet (Concept 08, TICKET-ROLL-05)
 *
 * The sheet has four rolls hardwired into two layouts as duplicated formula blocks, so "add
 * initiative" means editing both layouts and both formula sets and keeping them in step forever.
 * Here it is one record: an **input expression** and a **ladder**, and the pool falls out of
 * TICKET-ROLL-03's decomposition.
 *
 * That is the whole difference from `CombatSkill`, which this replaces in TICKET-ROLL-06: a combat
 * skill hand-types six dice counts and bolts a formula on afterwards as a flat bonus, which is a
 * different distribution from the sheet's. Here the formula *is* the roll.
 *
 * `input` is user-authored formula text like a stat's, evaluated at the `roll-input` attachment
 * point (`engine/formula/scoping.ts`) — `stats.*`, `skills.*`, `const.*` and `curve.*` — so
 * "evasion reads Dex and armour" is a formula edit rather than a shape change. It carries no
 * randomness: a formula is deterministic and reproducible, and the dice happen in one auditable
 * place afterwards (spec §5).
 *
 * `applies_to` and `visibility` are Concept 08 fields deferred until there is a creature and a
 * second view to need them; both are additive.
 */
export interface RollDefinition {
  id: string; // Stable identity — assigned on creation, never shown, never reused
  name: string;
  description: string;
  /** Formula producing the number fed to the ladder — `stats.dex + skills.dodging.bonus` */
  input: string;
  /** References `DiceLadder.id`; a roll without a readable ladder is a validation error */
  ladderId: string;
  category?: RollCategory;
  /** Display order on the sheet and in the panel; ties fall back to definition order */
  order: number;
}

/**
 * Material - substance that provides bonuses/penalties and has value
 */
export interface Material {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  levels: MaterialLevel[];
}

/**
 * Material level - tier within a material with scaled bonuses and value
 */
export interface MaterialLevel {
  level: number;
  name: string; // e.g., "Iron", "Steel", "Mithril"
  bonuses: StatModifier[];
  value: CurrencyValue;
}

/**
 * Stat modifier — what a material tier does to a stat (Concept 09, TICKET-MAT-01)
 *
 * The sheet's tier mods are per **stat** ("fur tier 1: Mana 50, Health 1"), which is what v1's
 * `SkillModifier` could not express: it named a code in the flat formula space, so a resource like
 * Mana was unreachable and "+50 Mana" was not a thing a ruleset could say. That shape is gone
 * entirely as of TICKET-MAT-02 — this is the only modifier the app has.
 *
 * Keyed by **stat id**, like a race's stat block (TICKET-RACE-01) and for the same reason: a
 * modifier is a reference to a stat, references are by id (TICKET-REF-01), and renaming a stat
 * therefore cannot orphan one.
 *
 * A modifier belongs on an **invested or resource** stat. A derived stat's formula is its source,
 * so a modifier there is a validation error rather than a term — `engine/validator.ts` reports it
 * and the material-level dialog does not offer it.
 */
export interface StatModifier {
  statId: string; // References Stat.id
  modifier: number; // Positive for bonus, negative for penalty
}

/**
 * Currency value - amount in a specific currency tier
 */
export interface CurrencyValue {
  tierId: string;
  amount: number;
}

/**
 * Material category - user-defined grouping of related materials
 */
export interface MaterialCategory {
  id: string;
  name: string;
  description: string;
}

/**
 * Inlay — a gem family whose tiers grant stats to whatever it is socketed into
 *
 * The new workbook's `Background Reference inlay: scaling` tab (v4 systems/10): 25 families in ten
 * tiers apiece, each tier a vector over nine axes — the six core stats plus Health, Mana and Speed.
 * The **other** ingredient of a composed item beside a {@link Material} (systems/12), and the shape
 * deliberately mirrors that one: a family, and tiers of {@link StatModifier} rows keyed by stat id.
 *
 * Two things it does **not** carry, both on purpose:
 *
 * - **No price.** The new sheet prices nothing
 *   ([D5](../../../docs/v4.0_sheet_parity/overview.md#d5--what-is-deliberately-not-parity)), so a
 *   tier is bonuses and nothing else — where `MaterialLevel` still has a `value` from the old one.
 * - **No generator.** 23 of the 25 families happen to be linear in tier, but that is a property the
 *   capture *verified* rather than a rule to impose: Obsidian is hand-authored across all ten rows
 *   and Zircon's tenth is blank. Every tier a family has is stored, and nothing invents one.
 *
 * The socket on the item (`inlayId` + `inlayLevel`) and the engine term that adds a tier's row to an
 * equipped item's bonuses are TICKET-INV-05's; this is the entity and its panel.
 */
export interface Inlay {
  id: string; // Stable identity — assigned on creation, never shown, never reused
  name: string;
  description: string;
  /**
   * Which family group this gem belongs to — the sheet's `Common Gems` / `Precious Gems`.
   *
   * A **User-named free string** validated against nothing and read by nothing, exactly like
   * {@link Stat.group} (TICKET-STAT-04): it decides which heading the panel lists the family under
   * and that is the whole of it. Absent means ungrouped, which is every family in a ruleset that
   * never bothered to sort its gems.
   */
  group?: string;
  /**
   * The family's ladder — **stored in the order the User added to it**, and a rung may be missing.
   *
   * Insertion order rather than rung order, because nothing here reorders: adding tier 5 to a
   * family holding 1 and 9 appends it. Every surface that *shows* a ladder sorts by
   * {@link InlayTier.tier} (`InlayCard` does), which is the same split `Stat.order` makes — the
   * stored array is not the display sequence, and no reader may assume it is.
   */
  tiers: InlayTier[];
}

/**
 * One tier of an inlay family — what socketing this gem at this rung grants
 *
 * **A family may have a gap, and the shape says so by carrying the rung number on the row.** The
 * sheet's Zircon has tiers 1–9 and a blank tenth, which is a gap rather than a zero: importable,
 * selectable up to 9, and the User's to fill. `Material.levels` is built the same way — a
 * `MaterialLevel` carries its own `level` and nothing indexes the array by rung — so this tolerates
 * a hole for the same reason that one does, rather than by a new rule.
 */
export interface InlayTier {
  /**
   * Which rung of the family this is — a whole number from 1 up, **unique within the family**, and
   * not necessarily contiguous.
   *
   * Unique because it is what a socket will name (TICKET-INV-05): two rows claiming one rung makes
   * *which tier this gem is at* unanswerable. Enforced in the two places the model's identity rules
   * always are — `inlayTierShapeErrors` for untrusted import, and `useInlayManager`'s save path for
   * User input.
   */
  tier: number;
  /** What the tier grants, keyed by stat id like a material tier's (TICKET-MAT-01) */
  bonuses: StatModifier[];
}

/**
 * Skill modifier — what an item template does to one skill (v4 systems/11, TICKET-ITEM-01)
 *
 * {@link StatModifier}'s counterpart one entity over, and deliberately its exact shape: the new
 * workbook's item matrix is a vector of small signed integers over the ruleset's *skills* (a wielded
 * Battleaxe is Athletics +2, intimidation +3, Sneaking −1), where a material tier's vector is over
 * stats. Two shapes rather than one generic `{ targetId, modifier }`, because the two name different
 * entities and a single shape would let a material tier's row point at a skill.
 *
 * Keyed by **skill id**, like every other stored reference (TICKET-REF-01) and for the reason
 * TICKET-MAT-01 moved material bonuses onto ids: renaming a skill cannot orphan a bonus, and there
 * is nothing for `references.ts` to re-spell on the way in or out.
 */
export interface SkillModifier {
  skillId: string; // References Skill.id
  modifier: number; // Positive for bonus, negative for penalty
}

/**
 * Item — a **template**: the shape of a thing, not a thing (v4 systems/12, TICKET-INV-05)
 *
 * **An item template is a per-skill bonus vector since TICKET-ITEM-01** (v4 systems/11). What it is
 * *made of* supplies its stat side — a material tier's modifiers plus an inlay tier's — and that
 * lives on the `ComposedItem` in a Player's inventory ([character.ts](./character.ts)) rather than
 * here: the two halves target different entities and neither can claim the other's share.
 *
 * **The fused `materialId` / `materialLevel` pair is gone** (TICKET-INV-05). v1.0 read the sheet's
 * "iron 1 empty rapier" as a *template naming the instance it is made of*, which made the catalog
 * the cross-product of every template and every tier and made "Battleaxe" unrepresentable without
 * choosing a metal first. A carried thing is a triple — template + material tier + optional inlay
 * tier — and a triple is a fact about what a Player built, so it is stored on the Player. Retiring
 * the pair is a **clean break** with no conversion
 * ([D6](../../../docs/v4.0_sheet_parity/overview.md#d6--no-backwards-compatibility-v40-is-a-clean-break-user-2026-08-29));
 * `SUPPORTED_SCHEMA_VERSION` rose to 10 for it and `importExport.ts` names the replacement for a
 * file that still carries either field.
 */
export interface Item {
  id: string;
  name: string;
  description: string;
  categoryId?: string;
  equipmentSlotType?: string;
  /**
   * Which shop sells this template — the sheet's *Imperial Forge*, *Stones & Ores* (v4 systems/11).
   *
   * A **User-named free string** validated against nothing, exactly like {@link Stat.group} and
   * {@link Inlay.group}: it decides which heading the items panel lists the template under and that
   * is the whole of it. The workbook's nine shop names are seed data rather than a vocabulary the
   * app knows (overview *Rulings — ticket review*: a heading the sheet happens to have is a default,
   * not a rule), so a ruleset that invents a tenth gets a tenth heading.
   *
   * **Stored on the template rather than on a category record**, which is the smallest shape that
   * says it: `categoryId` is itself a free string with no entity behind it, so the shop is the same
   * kind of thing one level up. Minting an `ItemCategory` entity to hold the tag would be a second
   * reshape and a new `Configuration` collection — TICKET-INV-05/ITEM-02's ground, not this
   * ticket's.
   *
   * Absent means the template is in no shop, which is every template in a ruleset that never sorted
   * its catalog — and such a ruleset groups by category exactly as it did before.
   */
  shop?: string;
  /**
   * What wielding this template does to the character's skills (v4 systems/11).
   *
   * **Sparse: only the skills it actually moves.** A zero contributes nothing, so storing one would
   * be 48 rows of noise per template and would make every skill look referenced by every item. The
   * editor prunes them on save; the import gate accepts a stored zero rather than refusing it, since
   * a zero is harmless where a malformed row is not.
   *
   * Additive-optional — absent means none and stays absent, `constants`' rule — so a ruleset written
   * before the item matrix existed round-trips without growing an empty array, and computes exactly
   * as it does today. The bonuses reach the character's **skill bonus** (not the level) through
   * `calculateEquipmentSkillBonuses`, summed across the equipped slots.
   */
  skillBonuses?: SkillModifier[];
}

/**
 * Every silhouette the app can draw in an empty equipment slot
 *
 * This is a **persisted** value — an `EquipmentSlotPlacement` names one — so it lives with the
 * shape rather than with the `Glyph` primitive that draws them, the same reasoning that puts
 * `STAT_AFFINITIES` here. The drawings, their labels and the groups a picker offers them in belong
 * to `components/ui/Glyph/`, and `Glyph.test.tsx` pins the two lists to each other so a name here
 * with no drawing there fails the suite instead of rendering a blank tile.
 *
 * Ordered the way a picker reads: worn from head to foot, then held, then carried, then the
 * generic shapes for a slot no drawing fits.
 */
export const GLYPH_NAMES = [
  'helm',
  'crown',
  'mask',
  'shoulders',
  'chest',
  'cloak',
  'bracers',
  'gloves',
  'belt',
  'legs',
  'feet',
  'main-hand',
  'off-hand',
  'dagger',
  'axe',
  'hammer',
  'staff',
  'bow',
  'wand',
  'accessory',
  'amulet',
  'gem',
  'pack',
  'pouch',
  'quiver',
  'tome',
  'potion',
  'lantern',
  'key',
  'banner',
  'wings',
  'tail',
  'slot',
  'circle',
  'square',
  'diamond',
  'triangle',
  'star',
  'cross',
] as const;

/** One of {@link GLYPH_NAMES} */
export type GlyphName = (typeof GLYPH_NAMES)[number];

/**
 * Where an equipment slot sits on the sheet's equipment grid (TICKET-INV-03)
 *
 * The cell is **1-based**, matching what the builder shows the User and what a CSS grid line
 * numbers from, so a placement reads the same in the JSON as it does on screen.
 */
export interface EquipmentSlotPlacement {
  /** 1-based column, within `EquipmentLayout.columns` */
  column: number;
  /** 1-based row, within `EquipmentLayout.rows` */
  row: number;
  /** What the sheet draws in the box while it is empty */
  glyph: GlyphName;
}

/**
 * Equipment slot - designated place where items can be equipped
 */
export interface EquipmentSlot {
  type: string; // e.g., "helmet", "main_hand", "off_hand"
  name: string;
  description: string;
  /**
   * Where this slot sits on the figure; **absent means unplaced**.
   *
   * An unplaced slot is not a broken one — the sheet renders it in a plain row beneath the figure,
   * which is what a ruleset that has never opened the builder gets for every slot.
   */
  placement?: EquipmentSlotPlacement;
}

/**
 * The grid the User laid their equipment slots out on (TICKET-INV-03)
 *
 * Stored rather than derived from the placements, because an empty row or column is a real design
 * choice: deriving the size from the furthest-placed slot would silently crop the board the moment
 * the User cleared its bottom row.
 */
export interface EquipmentLayout {
  columns: number;
  rows: number;
}

/**
 * How large the equipment grid may be
 *
 * A ceiling rather than a rule about ergonomics: every cell's grid placement is a literal Tailwind
 * class (`col-start-4`), so the set of classes the tree can emit has to be finite and written
 * somewhere a build can see. Six by six is well past the sheet's 3×4 and still one screenful.
 */
export const MAX_EQUIPMENT_GRID_COLUMNS = 6;
export const MAX_EQUIPMENT_GRID_ROWS = 6;

/**
 * Race — a **stat block**: what a member of this lineage is (Concept 04, playable subset)
 *
 * v1 stored deltas over skill codes, which is not what the source sheet holds: its creature tab
 * gives every race an absolute value per stat (dwarf: Str 14, Dex 3, Con 15). The two agreed only
 * because a stat's default base is 0, so "modifier 10" and "base 10" were the same number —
 * an agreement that breaks the moment two races are picked, which is TICKET-RACE-02's blend.
 *
 * Keyed by **stat id**, not by abbreviation: a race's block is a set of references to stats, and
 * references are by id (TICKET-REF-01), so renaming a stat cannot orphan one — and unlike
 * `skillModifiers`, the shape needs no display↔stored translation at all.
 *
 * **A stat absent from the record reads 0.** Adding a stat to the ruleset therefore costs nothing:
 * every existing race is already defined over it, at zero, rather than being invalid until edited.
 */
export interface Race {
  id: string;
  name: string;
  description: string;
  /** Absolute value this race supplies per stat id; absent means 0 */
  statValues: Record<string, number>;
  /**
   * What kind of creature this is — `humaniod`, `construct`, `fey` (v4 systems/04, TICKET-RACE-03).
   *
   * A free string picked from {@link Configuration.creatureTypes}, **not** a reference by id: the
   * reference lists hold the User's own words, so the value *is* the word. A value the ruleset's
   * list does not carry is a validation **finding** (`engine/validator.ts`), never a refusal — a
   * ruleset that names no types at all is entirely valid and validates nothing.
   *
   * Additive-optional: absent means the race says nothing about its kind, which is every race
   * written before this field existed.
   */
  type?: string;
  /**
   * How big this creature is — `small`, `medium`, `large` (v4 systems/04, TICKET-RACE-03).
   *
   * {@link type}'s counterpart over {@link Configuration.creatureSizes}, with the same rules.
   */
  size?: string;
  /**
   * The sheet's challenge rate for this creature (v4 systems/04, TICKET-RACE-03).
   *
   * **Stored, and built on nothing.** It is 0 for every playable race in the workbook — a
   * creature-facing number waiting for a bestiary the app does not have — so it is recorded because
   * the sheet has it (overview D1) and read only by its own plumbing: this declaration, the import
   * shape gate, and the race editor, which puts it in the form and writes it back. No engine term
   * consumes it and no sheet displays it — not even the race card —
   * and `components/config/races/challengeRate.test.ts` fails if a fifth module names it, so the
   * day something *is* built on it is a deliberate day rather than a drift.
   */
  challengeRate?: number;
}

/**
 * How much an archetype favours one stat (Concept 03)
 *
 * The three values are not a scale the app interprets — they are **column names in the `point_buy`
 * curve**, which is what makes "flatten the archetype advantage" a table edit rather than a code
 * change. TICKET-ARC-02 is what routes a spent point through the matching column, and TICKET-ARC-04
 * gives `main` and `sub` a second job: each names the shape Dream level enters the gain in.
 *
 * **A const object since TICKET-ARC-04** — the house rule's conversion-when-touched, earned by that
 * second job: the dream term branches on the tag, so the engine now *spells* two of these values in
 * code rather than only forwarding them to a column lookup. The derived type is the same union it
 * always was, so every existing call site keeps typechecking; new ones reference the constant.
 */
export const STAT_AFFINITY = {
  MAIN: 'main',
  SUB: 'sub',
  NON: 'non',
} as const;

export type StatAffinity = (typeof STAT_AFFINITY)[keyof typeof STAT_AFFINITY];

/**
 * Every affinity, in the order an editor offers them — least favoured last
 *
 * Derived from the constant rather than written out beside it: a hand-written second list of the
 * same three members is one that can be added to in one place and not the other. The declaration
 * order of `STAT_AFFINITY` is what "least favoured last" means, and object key order preserves it.
 */
export const STAT_AFFINITIES: readonly StatAffinity[] = Object.values(STAT_AFFINITY);

/**
 * What a stat an archetype says nothing about is worth (Concept 03)
 *
 * Lives with the type rather than with the editor because it is a property of the **stored shape**,
 * not of any one surface: a tagging is sparse, so every reader resolves an absent stat through this.
 */
export const DEFAULT_STAT_AFFINITY: StatAffinity = STAT_AFFINITY.NON;

/**
 * The curve an archetype's affinity selects a column of (Concept 03, Concept 06)
 *
 * Here rather than in either reader because the engine and the store both need it and the engine
 * cannot import the store: `createSeedCurves()` writes the curve and `validateConfiguration()`
 * checks its columns, and the two spelling it separately is how renaming the seed would silently
 * disable the check. TICKET-ARC-02 reads it a third time.
 */
export const POINT_BUY_CURVE_NAME = 'point_buy';

/**
 * Archetype - what a character is good at growing (Concept 03, TICKET-ARC-01)
 *
 * Replaces the focus stat, which was a flat adder on one stat and nothing the spec recognises;
 * TICKET-ARC-03 retires that. An archetype instead tags **every** stat, so "Strong" is a shape
 * across the whole sheet rather than a single favourite.
 *
 * `statAffinity` is keyed by stat **id**, like `Race.statValues`, so renaming a stat cannot orphan
 * an archetype. It is deliberately **sparse**: a stat the archetype says nothing about is `non`,
 * which is Concept 03's own rule and keeps a ruleset from having to re-save every archetype each
 * time a stat is added. The validator reports the defaulting as an observation rather than
 * silently applying it.
 *
 * `starting_bonus`, `skill_affinity` and `unlock_condition` are deferred (TICKET-ARC-01's notes) —
 * the last needs boolean formulas the engine does not have.
 */
export interface Archetype {
  id: string;
  name: string;
  description: string;
  /** Affinity per stat id; a stat that is absent is `non` (Concept 03) */
  statAffinity: Record<string, StatAffinity>;
}

/**
 * Constant - a named tunable number a formula reaches as `const.<name>` (Concept 05)
 *
 * The point is that a balance lever is referenced once and edited once, instead of the same
 * literal being buried in dozens of formula strings. `description` is required by the concept
 * page's own rule: a constant nobody understands is worse than a literal.
 *
 * `value` is a plain number. The spec allows a constant to derive from other constants via a
 * formula; that is deliberately not modelled yet — no seed needs it, and it brings a cycle-
 * detection problem with it. When it arrives, `value` widens to `number | string` and joins the
 * `formulaChange` guard.
 */
export interface Constant {
  id: string; // Stable identity — what a persisted formula points at
  name: string; // Identifier used in formulas (`bonus_divider`) — renamable display data
  displayName: string;
  description: string; // Required (Concept 05)
  value: number;
  unit?: string; // Display suffix, e.g. "points"
}

/**
 * How a curve reads a key that falls between two rows (Concept 06)
 *
 * `step` holds the last row at or below the input — the threshold reading, which is what makes
 * "you stay level 4 until you cross 3,000 XP" fall out of the table rather than out of a rule.
 * `linear` interpolates between the two rows either side.
 */
export type CurveInterpolation = 'step' | 'linear';

/**
 * What a curve does with an input beyond its first or last row (Concept 06)
 *
 * `error` is the concept page's recommended default: silent clamping is how a level-50 character
 * ends up with a level-15 stat gain and nobody notices.
 */
export type CurveOutOfRange = 'clamp' | 'extrapolate' | 'error';

/**
 * Which axis a curve is read along (Concept 06)
 *
 * `forward` is key → value. `reverse` answers the opposite question — "given this value, which
 * key?" — and exists because some tables are naturally *written* one way and *read* the other:
 * you author "level 5 requires 3,000 XP" and ask "given 3,412 XP, what level am I?".
 */
export type CurveLookupDirection = 'forward' | 'reverse';

/**
 * One output column of a curve
 *
 * `id` is the identity, `name` the identifier a formula spells as `curve.<curve>.<column>(x)`.
 * A single-column curve is called without one.
 */
export interface CurveColumn {
  id: string; // Stable identity
  name: string; // Identifier used in formulas — renamable display data
  /**
   * Formula filling this column, evaluated once per row (Concept 06, TICKET-CRV-02).
   *
   * The row's key is in scope as `key`, alongside `const.*`. Absent means the column is
   * hand-entered — regeneration leaves it alone entirely, which is not the same as a generator
   * that happens to produce the stored numbers.
   */
  generator?: string;
}

/**
 * One row of a curve: an input key and one value per column
 *
 * `values` is positional against `columns`, and so is `overridden` — one addressing rule per row,
 * so adding or removing a column splices both arrays the same way.
 *
 * `overridden[i]` means "this cell was hand-tuned; regeneration must not touch it" (Concept 00
 * §1.1). Absent, or shorter than `values`, reads as `false` — which is what makes the field
 * additive: every curve written before TICKET-CRV-02 loads as fully generated.
 */
export interface CurveRow {
  key: number;
  values: number[];
  overridden?: boolean[];
}

/**
 * Curve - a named lookup table a formula calls as `curve.<name>(x)` (Concept 06)
 *
 * The point is that a progression is *data* — a table you can see and tune — rather than a chain
 * of nested conditionals buried in a formula string. Point-buy, XP thresholds and challenge
 * rating are all the same shape.
 *
 * `id` is the identity and `name` renamable display data, as everywhere else (TICKET-REF-01).
 */
export interface Curve {
  id: string; // Stable identity — what a persisted formula points at
  name: string; // Identifier used in formulas (`xp_thresholds`) — renamable display data
  displayName: string;
  description: string;
  /** What the input axis is called, for the editor's key column header */
  keyName: string;
  columns: CurveColumn[];
  /** Ascending by `key`, with no duplicates — `engine/validator.ts` reports either */
  rows: CurveRow[];
  interpolation: CurveInterpolation;
  outOfRange: CurveOutOfRange;
  lookupDirection: CurveLookupDirection;
}

/**
 * Currency tier - level in the monetary system with conversion rates
 */
export interface CurrencyTier {
  id: string;
  name: string;
  order: number; // 0 = lowest value
  conversionToNext: number; // How many of this tier = 1 of next tier
}
