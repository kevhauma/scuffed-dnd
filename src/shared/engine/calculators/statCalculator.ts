/**
 * Stat Calculator
 *
 * The composition calculator (Concept 01, TICKET-STAT-01). One function answers "what is this
 * stat worth on this character", for all three kinds of stat, because there is one kind of stat:
 *
 * - **invested** — `race stat block + what the invested points bought + equipment`, where the
 *   points are converted through the archetype's `point_buy` column (Concept 03, TICKET-ARC-02);
 * - **resource** — the same sum, read as a *maximum* the character spends against;
 * - **derived** — its `formula`, evaluated over `stats.*` / `const.*` / `curve.*`.
 *
 * Either way the result is then clamped to `min`/`max` and rounded per `rounding`, so the two
 * paths differ only in where the raw number comes from.
 *
 * **Every configured stat has a value; absence is not a state** — TICKET-CALC-02's invariant,
 * carried across from main skills. Every stat in `config.stats` is seeded before anything is
 * applied, so a stat nobody has invested in reads 0 rather than reaching a formula as an
 * undefined variable. The converse holds too (TICKET-REF-02): the ruleset alone decides what
 * exists, so an allocation, race stat block entry or equipment bonus naming a stat the
 * configuration no longer defines contributes nothing rather than answering for a deleted stat.
 *
 * **Validates: Concepts 01, 03, 04; Concept 00 §7; Requirements 3.4, 3.6, 16.6**
 *
 * (Requirement 8.4 — "combine racial bonuses additively" — is deliberately *not* validated here
 * any more: Concept 04's blend supersedes it, TICKET-RACE-02.)
 */

import type { Character } from '../../types/character';
import type { Archetype, Constant, Curve, Race, Stat, StatModifier } from '../../types/config';
import type { FormulaContext, FormulaResult } from '../../types/formula';
import { dreamLevelOf } from '../dreamLevel';
import { namedConstant } from '../formula/constants';
import { asNumber, isFormulaError, withSource } from '../formula/errors';
import { evaluateFormulaString } from '../formula/evaluator';
import { roundAwayFromZero } from '../formula/functions';
import type { NamespaceSource } from '../formula/namespaces';
import { namespacesFor } from '../formula/namespaces';
import { FORMULA_OWNER } from '../formula/scoping';
import { raceCount } from '../races';
import { affinityFor, statGain } from './pointBuy';

/** What the composition needs beyond the stats themselves */
export interface StatCompositionOptions {
  /** The character's races, for their stat blocks */
  races?: Race[];
  /** Aggregated bonuses from equipped items, keyed by stat id (TICKET-MAT-02) */
  equipmentBonuses?: StatModifier[];
  /** The ruleset's constants and curves, backing `const.*` and `curve.*(x)` */
  source?: NamespaceSource;
  /** The character's archetype, whose affinities pick a `point_buy` column (TICKET-ARC-02) */
  archetype?: Archetype;
  /** The `point_buy` curve; absent falls the invested term back to 1:1 — see `pointBuy.ts` */
  pointBuy?: Curve;
}

/** The constant the blend divides by */
const RACE_BLEND_DIVISOR_NAME = 'race_blend_divisor';

/**
 * What a blend that supplies nothing supplies instead — the sheet's `MAX(1, …)` (TICKET-RACE-03)
 *
 * The v4.0 workbook's chain is `ROUND( MAX(1, ROUNDUP(race1 + race2, 0) / 2), 0)`
 * (`Background Setup Calculations ` H33:H41, rounded into `Background Charater Sheet Calcu` S3:S11),
 * which is the divisor blend above plus this one term. A stat neither parent supplies reads **1** in
 * the sheet and read 0 here.
 *
 * A **module constant rather than a second ruleset dial.** The divisor is `const.race_blend_divisor`
 * because the sheet's own chain divides by a number a ruleset might reasonably retune; the floor is
 * one term of the same formula and nobody has asked to move it, so introducing a
 * `race_blend_floor` constant now would be an option before its first caller (the house rule's
 * third-caller test). It is one `namedConstant` call away the day a ruleset wants it.
 */
const RACE_BLEND_FLOOR = 1;

/**
 * The sheet's floor, applied to one blended stat
 *
 * **Deliberately narrower than a blanket `Math.max(1, …)`, and this is the ticket's contract**: only
 * a pairing that comes to *nothing* moves, from 0 to 1. A blend cannot land on 0 any other way —
 * the divisor is positive, so a positive sum rounds away from zero to at least 1 and a negative sum
 * to at most −1 — which makes "the result is 0" and "neither race supplied this stat" the same
 * statement, and leaves a deliberately **negative** stat block alone.
 *
 * That last part is the one place this parts company with the workbook's literal `MAX(1, …)`, which
 * would raise −2 to 1 as well. The sheet has no negative creature row to say what it means there,
 * the app has always let a ruleset write one, and TICKET-RACE-03's criteria ask for a non-zero blend
 * to be bit-for-bit what it was. Widening the floor is a decision, not a tidy-up.
 *
 * @param value - The blended, rounded value for one stat
 * @returns The value, or the floor when the pairing supplied nothing
 */
function withBlendFloor(value: number): number {
  return value === 0 ? RACE_BLEND_FLOOR : value;
}

/**
 * The ruleset's blend divisor, defaulting to how many races the ruleset blends
 *
 * The **first** engine code to read a constant by name rather than through `const.*` in a User
 * formula: the blend is system arithmetic (Concept 04), not something the User writes, so there is
 * no formula for `references.ts` to re-spell. The consequence is that renaming the constant makes
 * the engine stop finding it — the fallback is what keeps that a retuning rather than a breakage,
 * and the constants panel shows the name that matters.
 *
 * Resolved through `namedConstant` rather than a second `find`, so a duplicate name imported
 * into a ruleset means the same constant here as it does in every formula.
 *
 * A zero, negative or non-finite divisor would turn every base into `Infinity` or `NaN`, which is
 * a worse answer than the seed (TICKET-FORM-07's rule, applied outside the evaluator).
 *
 * ## The divisor defaults to the count, and stays a dial (TICKET-RACE-04)
 *
 * The ticket asked which of the two the divisor should be, and this is the answer: **an independent
 * constant whose default is `race_count`.** The seeded `2` it used to fall back to was only ever the
 * count wearing another name — the sheet divides by two because it blends two — and hard-coding it
 * meant a ruleset that raised the count to three got a blend that inflated every base by half, for no
 * reason it could see. Defaulting to the count keeps the property the whole model rests on true at
 * any count: **picking the same race in every slot changes nothing**, which is what a pure-blood is.
 *
 * Nothing about the sheet's ruleset moves — a count of 2 defaults the divisor to 2, exactly as
 * before. And the dial itself is untouched, which is the half worth keeping: a three-race ruleset
 * that wants its parents *summed* rather than averaged writes `race_blend_divisor` 1 and gets it.
 *
 * **The unstated consequence, stated: raising `race_count` re-values every existing character.** A
 * stored two-pick blend that divided by 2 divides by 3 the moment the ruleset says three, because
 * the divisor followed the count — and lowering it truncates the picks the blend reads. That is the
 * ruleset being the authority working as designed (`race_blend_divisor` and `bonus_divider` have
 * always had it), but the count is the first dial that moves what a character *is* rather than what
 * a number is worth, and a User turning it mid-campaign should be told rather than surprised.
 *
 * @param constants The ruleset's constants; absent is the same as none
 * @param count The ruleset's race count, already read by the caller
 * @returns The divisor to blend by
 */
function raceBlendDivisor(constants: Constant[] | undefined, count: number): number {
  return namedConstant(constants, RACE_BLEND_DIVISOR_NAME, count, (value) => value > 0);
}

/**
 * Blend the stat blocks of a character's races into one base per stat (Concept 04)
 *
 * Kept separate from the totals so the UI can show the racial contribution on its own
 * (Requirement 8.4, 13.4) without recovering it from a difference. Keyed by **stat id** since
 * TICKET-RACE-01 made a race a stat block.
 *
 * Not a sum — TICKET-RACE-02 replaced v1's additive stacking with the sheet's hybrid:
 *
 * - **no races** — nothing, so every base is 0;
 * - **one race** — its block. A lone block is itself, whatever the ruleset's count and divisor:
 *   that is the answer for a `race_count` of 1, for the wizard's half-made pick, and for a roster
 *   written before the count was ruleset data. {@link withBlendFloor} still applies, because it has
 *   to: without it "picking the same race twice changes nothing" would stop being true the moment a
 *   block carried an explicit 0;
 * - **two or more** — `max(1, roundup(Σ / const.race_blend_divisor))` per stat, rounding away
 *   from zero exactly as a User formula spelling `roundup` would, then floored the way the workbook
 *   floors it (TICKET-RACE-03). A stat absent from one block counts as 0 in
 *   the blend, which is the whole point of picking a race that lacks it.
 *
 * **The floor reaches the stats the blocks mention, and no others.** The key set is the union of
 * both blocks' keys, and a block stores no zeros by convention (TICKET-RACE-01 prunes them, so a
 * stored 0 would read as a reference and make `deleteStat` refuse) — so a stat *neither* race names
 * is not in this map at all and reaches the composition as `?? 0`. Making every configured stat come
 * out at the floor would mean handing this function the ruleset's stat list, which changes what four
 * call sites display; it is a reshape of what a blend *is* rather than one engine term, and is
 * recorded on TICKET-RACE-03 as such.
 *
 * Picking the same race in every slot therefore changes nothing, and past the ruleset's own
 * `race_count` the blend has no meaning: an over-long pick is refused where characters are written,
 * and truncated here rather than distorting the divisor. **The count is read from the ruleset, not
 * held here** (TICKET-RACE-04) — this function and the creation rules ask {@link raceCount} the same
 * question and cannot drift.
 *
 * The truncation is **a defence rather than the truncation that matters**: every caller that starts
 * from a `Character` resolves its picks through `engine/races.ts`'s `resolveRaces`, which caps the
 * list before anything sees it, so what the sheet *names* and what this blends are one list. This
 * slice only catches a caller handing over a bare array — a test, or a future surface that builds
 * races some other way.
 *
 * @param races - The character's races, in pick order and duplicates included
 * @param constants - The ruleset's constants, for the count and the blend divisor
 * @returns Record of stat id to the base value the races supply
 */
export function calculateRaceStatBases(
  races: Race[],
  constants: Constant[] = []
): Record<string, number> {
  const count = raceCount(constants);
  const blended = races.slice(0, count);

  // A count of 0 lands here, which is also what keeps the divisor below from ever seeing that 0
  const [only] = blended;
  if (only === undefined) return {};

  if (blended.length === 1) {
    const entries = Object.entries(only.statValues);
    const floored = entries.map(([statId, value]) => [statId, withBlendFloor(value)] as const);
    return Object.fromEntries(floored);
  }

  const divisor = raceBlendDivisor(constants, count);
  const bases: Record<string, number> = {};
  const mentioned = blended.flatMap((race) => Object.keys(race.statValues));

  for (const statId of new Set(mentioned)) {
    const sum = blended.reduce((total, race) => total + (race.statValues[statId] ?? 0), 0);
    const rounded = roundAwayFromZero(sum / divisor);
    bases[statId] = withBlendFloor(rounded);
  }

  return bases;
}

/**
 * Clamp to the stat's bounds, round the way it asks, then clamp again (CR-41)
 *
 * The second clamp is what keeps a **fractional** bound honest: `max: 10.6` with `rounding:
 * 'nearest'` clamped a raw 12 to 10.6 and then rounded it *up* to 11, which is outside the range
 * the ruleset declared. Rounding before clamping would be the other way round — it would pull a
 * value that legitimately sits at the bound off it — so the conservative order is clamp, round,
 * clamp, and a fractional bound simply wins over the rounding mode.
 *
 * A ruleset with integer bounds, which is nearly all of them, cannot tell the difference.
 */
function finish(value: number, stat: Stat): number {
  const clamp = (input: number): number => {
    let bounded = input;
    if (stat.min !== undefined) bounded = Math.max(stat.min, bounded);
    if (stat.max !== undefined) bounded = Math.min(stat.max, bounded);
    return bounded;
  };

  const bounded = clamp(value);

  switch (stat.rounding) {
    case 'nearest':
      return clamp(Math.round(bounded));
    case 'up':
      return clamp(Math.ceil(bounded));
    case 'down':
      return clamp(Math.floor(bounded));
    default:
      return bounded;
  }
}

/**
 * The invested side of the composition, before clamping
 *
 * `base` is what the character's races make them (TICKET-RACE-02) — the blend, not a sum of
 * modifiers — and everything else is added to it: what the points they spent *bought*, and what
 * they carry. **Three terms, not four** since TICKET-ARC-03 deleted the focus bonus: a flat adder
 * on one stat is not something the spec recognises, and the archetype it was standing in for now
 * shapes the whole sheet through the invested term.
 *
 * **The invested term is curve-routed since TICKET-ARC-02.** It is no longer the points themselves
 * but what the archetype's affinity converts them into, which is why this returns a `FormulaResult`:
 * the `point_buy` table is User data and can refuse an input (the seed's `outOfRange` is `error`
 * past 15 points), so a stat whose spend cannot be priced chips rather than answering with a number
 * nobody derived.
 *
 * **Since TICKET-ARC-04 the term also carries the character's Dream level** — main-tagged stats
 * multiply by it, sub-tagged stats add it — which is what makes a stat move when the DM raises the
 * dream and nothing else about the character is written. It is also where the composition first
 * meets a **fractional** invested term (`main(0)` is 0.75): `finish` rounds only when the stat's own
 * `rounding` asks it to, so the fraction reaches the total and every formula reading `stats.*`.
 */
function investedValue(
  stat: Stat,
  character: Character,
  raceBases: Record<string, number>,
  equipmentBonuses: StatModifier[],
  archetype: Archetype | undefined,
  pointBuy: Curve | undefined
): FormulaResult {
  const base = raceBases[stat.id] ?? 0;

  const pointsSpent = character.investedStatPoints[stat.id] ?? 0;
  const affinity = affinityFor(archetype, stat.id);
  // RES-04's one reader owns the absent-means-1 default; the gain adds none of its own (ARC-04)
  const dreamLevel = dreamLevelOf(character);

  const gain = statGain(pointsSpent, affinity, pointBuy, dreamLevel);
  if (isFormulaError(gain)) {
    return withSource(gain, { kind: 'stat', id: stat.id, name: stat.name });
  }

  // Matched by **id** since TICKET-MAT-02, which is what deleted STAT-01's abbreviation bridge:
  // a bonus follows the stat it was attached to, not the spelling it had at the time
  const equipment = equipmentBonuses
    .filter((bonus) => bonus.statId === stat.id)
    .reduce((sum, bonus) => sum + bonus.modifier, 0);

  return base + gain + equipment;
}

/**
 * Compose every stat's value for a character
 *
 * Invested stats resolve immediately; derived stats are resolved in **passes**, because one may
 * read another (`stats.apt` over `stats.speed`). Each pass evaluates whatever is still
 * outstanding against the values found so far and keeps what succeeded. When a pass resolves
 * nothing new, what remains cannot be resolved at all — a cycle, or a chain hanging off one — and
 * each gets its own error value naming itself rather than a thrown exception (Concept 00 §7).
 * `engine/validator.ts` is what reports the cycle properly; this only has to not hang.
 *
 * @param stats - The configuration's stats — the complete set of what exists
 * @param character - The character whose investment and equipment are being applied
 * @param options - Races, equipment, the archetype's point-buy routing, and the ruleset behind
 *   `const.*` / `curve.*`
 * @returns Record of stat id to composed value, or the error explaining why there isn't one
 */
export function calculateStatValues(
  stats: Stat[],
  character: Character,
  options: StatCompositionOptions = {}
): Record<string, FormulaResult> {
  const { races = [], equipmentBonuses = [], source = {}, archetype, pointBuy } = options;

  const raceBases = calculateRaceStatBases(races, source.constants);
  const values: Record<string, FormulaResult> = {};

  // Seed the invested stats — they depend on nothing, so they are done in one pass
  const derived: Stat[] = [];
  for (const stat of stats) {
    if (stat.formula === undefined) {
      const composed = investedValue(
        stat,
        character,
        raceBases,
        equipmentBonuses,
        archetype,
        pointBuy
      );
      // A spend the point-buy table could not price is the stat's value now — clamping and
      // rounding an error would be answering a question that has no answer
      values[stat.id] = isFormulaError(composed) ? composed : finish(composed, stat);
    } else {
      derived.push(stat);
    }
  }

  /**
   * Evaluate the outstanding derived stats once, keeping whatever succeeded
   *
   * @param keepErrors - On the final pass, write each failure's own error value rather than
   *   leaving it outstanding, so a stat in a cycle reports its own reason
   * @returns The ones still without a value
   */
  const pass = (outstanding: Stat[], keepErrors: boolean): Stat[] => {
    const context: FormulaContext = {
      // The flat space is stat abbreviations now that stats are the invested atom. It is still
      // deprecated: TICKET-SKL-02 and TICKET-ROLL-05 move the last callers onto `stats.*`.
      variables: statVariables(stats, values),
      namespaces: namespacesFor({ ...source, stats, statValues: values }, FORMULA_OWNER.STAT),
    };

    const remaining: Stat[] = [];
    for (const stat of outstanding) {
      const value = evaluateFormulaString(stat.formula as string, context);

      if (!isFormulaError(value)) {
        values[stat.id] = finish(value, stat);
      } else if (keepErrors) {
        values[stat.id] = withSource(value, { kind: 'stat', id: stat.id, name: stat.name });
      } else {
        remaining.push(stat);
      }
    }

    return remaining;
  };

  // …then the derived ones, in as many passes as it takes to stop making progress
  let outstanding = derived;
  while (outstanding.length > 0) {
    const remaining = pass(outstanding, false);

    // No progress means everything left is genuinely unresolvable — a cycle, or a chain hanging
    // off one. One more pass writes each stat's own reason and ends it.
    if (remaining.length === outstanding.length) {
      pass(remaining, true);
      break;
    }

    outstanding = remaining;
  }

  return values;
}

/**
 * The composed values as the flat variable map, keyed by abbreviation
 *
 * Uppercased because the parser normalises bare identifiers that way, so `str` and `STR` are the
 * same reference. A stat with no value yet is left out, which is what makes an unresolved
 * dependency report as undefined during a pass rather than reading as 0.
 */
export function statVariables(
  stats: Stat[],
  values: Record<string, FormulaResult>
): Record<string, FormulaResult> {
  const variables: Record<string, FormulaResult> = {};

  for (const stat of stats) {
    const value = values[stat.id];
    if (value === undefined) continue;
    const spelling = stat.abbreviation.toUpperCase();
    if (!(spelling in variables)) variables[spelling] = value;
  }

  return variables;
}

/**
 * Sum the stats flagged as counting toward the character's total (Concept 01)
 *
 * A stat whose value could not be computed contributes nothing rather than poisoning the total:
 * one broken formula should cost the reader that one number, not the whole figure (Concept 00 §7).
 *
 * @param stats - The configuration's stats
 * @param values - Composed values from {@link calculateStatValues}
 * @returns The total
 */
export function calculateStatTotal(stats: Stat[], values: Record<string, FormulaResult>): number {
  return stats
    .filter((stat) => stat.countsTowardTotal)
    .reduce((total, stat) => total + (asNumber(values[stat.id]) ?? 0), 0);
}
