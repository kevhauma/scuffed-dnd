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
export const SUPPORTED_SCHEMA_VERSION = 9;

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
   * last bump the milestone plans — DX-04 is a parity gate, not a reshape.
   */
  schemaVersion: typeof SUPPORTED_SCHEMA_VERSION;
  stats: Stat[];
  skills: Skill[];
  materials: Material[];
  materialCategories: MaterialCategory[];
  items: Item[];
  equipmentSlots: EquipmentSlot[];
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
 * Item - object with optional material and equipment slot
 */
export interface Item {
  id: string;
  name: string;
  description: string;
  categoryId?: string;
  materialId?: string;
  materialLevel?: number;
  equipmentSlotType?: string;
}

/**
 * Equipment slot - designated place where items can be equipped
 */
export interface EquipmentSlot {
  type: string; // e.g., "helmet", "main_hand", "off_hand"
  name: string;
  description: string;
}

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
}

/**
 * How much an archetype favours one stat (Concept 03)
 *
 * The three values are not a scale the app interprets — they are **column names in the `point_buy`
 * curve**, which is what makes "flatten the archetype advantage" a table edit rather than a code
 * change. TICKET-ARC-02 is what routes a spent point through the matching column.
 */
export type StatAffinity = 'main' | 'sub' | 'non';

/** Every affinity, in the order an editor offers them — least favoured last */
export const STAT_AFFINITIES: readonly StatAffinity[] = ['main', 'sub', 'non'];

/**
 * What a stat an archetype says nothing about is worth (Concept 03)
 *
 * Lives with the type rather than with the editor because it is a property of the **stored shape**,
 * not of any one surface: a tagging is sparse, so every reader resolves an absent stat through this.
 */
export const DEFAULT_STAT_AFFINITY: StatAffinity = 'non';

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
