/**
 * Focus skills — the three picks that multiply a skill's growth (TICKET-SKL-05)
 *
 * The new workbook's Setup form has three **Focus skill** slots, and the ability calculator turns
 * them into one factor per skill: each slot contributes `const.focus_chosen` to the skill it names
 * and `const.focus_other` to every other skill, summed
 * ([systems/06](../../../docs/v4.0_sheet_parity/systems/06-skills-and-focus.md) gap 2, read verbatim
 * from `Background Setup Calculations ` B4:E51 as one `IF(slot = this skill, chosen, others)` per
 * slot). At the sheet's 1.5 / 0.3 that is:
 *
 * ```
 * unchosen      0.3 + 0.3 + 0.3 = 0.9
 * chosen once   1.5 + 0.3 + 0.3 = 2.1
 * chosen twice  1.5 + 1.5 + 0.3 = 3.3
 * ```
 *
 * **Duplicates stack**, which the sample character does on purpose (Arcane, Summening, Arcane), so
 * the picks are a *list* rather than a set and slot order is what makes the third slot's 0.3 visible.
 *
 * This is a different concept from the **focus stat** v2.0 retired in TICKET-ARC-03 — that was a flat
 * adder on one stat, replaced by the archetype. They share a word and nothing else, and none of that
 * machinery comes back here.
 *
 * ## Absent means neutral, per dial, and the neutral value is a third of a slot
 *
 * The two constants are the User's dials beside `bonus_divider` (systems/06's open question, answered
 * here), and under v4
 * [D7](../../../docs/v4.0_sheet_parity/overview.md#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29)
 * the engine names them while their *values* — 1.5 and 0.3 — are the data pass's. So the engine needs
 * a neutral reading for a ruleset that states neither, and it has one that needs no special case:
 * **a slot's neutral share is `1 / FOCUS_SLOT_COUNT`**, so three neutral slots multiply by exactly 1
 * and every skill computes as it did before focus existed. One rule, no branch, and a ruleset that
 * states only `focus_chosen` gets the reading that follows from it — a chosen skill gains, an
 * unchosen one is untouched — rather than a silently ignored constant or a zeroed sheet.
 *
 * **The exactness is checked, not assumed, and it depends on the count.** `1/3 + 1/3 + 1/3` summed
 * left to right lands exactly on the IEEE-754 midpoint below 1, and ties-to-even rounds it up to
 * `1.0` — so three neutral slots multiply by 1 with no epsilon anywhere. That is a fact about **3**
 * and about this loop's summation order, not a general one: if `FOCUS_SLOT_COUNT` ever becomes a
 * dial (see below), the neutral case needs re-checking per count rather than inheriting this one.
 * `focusSkills.test.ts` asserts it with `toBe(1)` rather than `toBeCloseTo` for that reason.
 *
 * **What is *not* neutral is having no picks.** A character with no `focusSkillIds` against a ruleset
 * that states 1.5 / 0.3 computes every skill at **0.9**, because that is what the workbook's own
 * arithmetic does with three empty slots. Absent picks and absent dials are two different absences
 * and only the second one is neutral.
 *
 * ## Three slots is the engine's number, for now
 *
 * `FOCUS_SLOT_COUNT` is 3 because the sheet's Setup form has three slots and this ticket's rule is
 * three. RACE-04's ruling — *a number the sheet happens to have is a default, not a rule* — would
 * make it `const.focus_slots` the day a ruleset asks for four, and the change is one `namedConstant`
 * call here plus the wizard reading the count it already renders. It is not made today because no
 * ruleset asks: an option before its caller exists is the abstraction the house rules refuse, and the
 * neutral share above is derived from the count rather than written as `0.3333`, so the dial has a
 * seat when it is wanted. **The one thing that ticket must not inherit is the exactness note above.**
 *
 * ## One honest consequence of reading a half-stated ruleset literally
 *
 * A ruleset stating **only** `focus_other: 0.3` gives a chosen skill `⅓ + 0.3 + 0.3 = 0.933` against
 * an unchosen `0.9` — a focus that barely does anything. That is the rule followed rather than a
 * bug, and it is preferable to the alternatives (ignoring a constant the User set, or zeroing the
 * sheet); it is recorded here so the next reader meets it as a decision rather than as a surprise.
 *
 * **Validates: v4 systems/06 gap 2, gap 4**
 */

import type { Character } from '../types/character';
import type { Constant, Skill } from '../types/config';
import { optionalConstant } from './formula/constants';

/** The constants a ruleset states its two focus factors in, as a formula would spell them */
export const FOCUS_CHOSEN_NAME = 'focus_chosen';
export const FOCUS_OTHER_NAME = 'focus_other';

/**
 * How many focus slots a character fills — the sheet's Setup form, `Setup` A14:B17
 *
 * Exported because the creation rule counts against it, the wizard draws one picker per slot and the
 * refusal names it: *"three focus skills"* is this constant rather than a literal typed in four
 * places.
 */
export const FOCUS_SLOT_COUNT = 3;

/**
 * What one slot contributes when the ruleset states no dial for it
 *
 * A third, so that {@link FOCUS_SLOT_COUNT} neutral slots multiply a weighted sum by exactly 1 —
 * see the module header. Written as the division rather than as `0.3333…` so it stays true if the
 * slot count ever becomes a dial, and because the two numbers mean the same thing only by accident
 * of the count.
 */
const NEUTRAL_SLOT_SHARE = 1 / FOCUS_SLOT_COUNT;

/**
 * Whether a number can be a focus factor — every finite one can
 *
 * There is no unusable focus factor the way there is an unusable divisor: `0` turns a slot off, a
 * negative one makes a focus a penalty, and a ruleset is entitled to both. The predicate exists
 * because {@link optionalConstant} asks each caller to state its rule, and *no further rule* is a
 * statement worth making explicitly — the alternative reads as an omission.
 */
function isFocusFactor(value: number): boolean {
  return Number.isFinite(value);
}

/**
 * What a ruleset says about focus — the two factors, and whether it said anything at all
 *
 * `stated` is the half a defaulted number cannot carry: {@link focusMultiplier} needs the values and
 * the *creation* rule needs to know whether this ruleset plays with focus at all, because demanding
 * three picks that multiply everything by 1 is a rule nobody could act on.
 */
export interface FocusDials {
  /** What a slot naming this skill contributes */
  chosen: number;
  /** What a slot naming some other skill contributes */
  other: number;
  /** Whether the ruleset states either factor — false for a ruleset focus does nothing in */
  stated: boolean;
}

/**
 * Read a ruleset's focus dials
 *
 * Read from the constants alone rather than from a whole `Configuration`, like `raceCount` and for
 * the same reason: the caller that needs them most is the calculator, which is handed a ruleset's
 * pieces rather than its whole.
 *
 * @param constants The ruleset's constants; absent is the same as none
 * @returns Both factors, defaulted to the neutral share, and whether either was stated
 */
export function focusDials(constants: Constant[] = []): FocusDials {
  const chosen = optionalConstant(constants, FOCUS_CHOSEN_NAME, isFocusFactor);
  const other = optionalConstant(constants, FOCUS_OTHER_NAME, isFocusFactor);

  return {
    chosen: chosen ?? NEUTRAL_SLOT_SHARE,
    other: other ?? NEUTRAL_SLOT_SHARE,
    stated: chosen !== undefined || other !== undefined,
  };
}

/**
 * The skills this character has made their focus, in slot order
 *
 * The one reader of the optional field, so *absent means none* is answered in a single place —
 * `dreamLevelOf`'s pattern, and for its reason: the calculator, the sheet's picker and the creation
 * rule must not each decide what an untouched character picked.
 *
 * **A stored list is returned as it stands, never trimmed.** More than {@link FOCUS_SLOT_COUNT} picks
 * is refused at every write ({@link focusPickRefusal}), so a longer list came from a hand-edited file;
 * the multiplier is a sum over the slots that exist either way, and silently dropping the extra here
 * would make a surface show picks the arithmetic ignores.
 *
 * @param character The character whose picks are being read
 * @returns The picks, or an empty list when there are none to read
 */
export function focusPicksOf(character: Pick<Character, 'focusSkillIds'>): readonly string[] {
  const stored = character.focusSkillIds;

  return Array.isArray(stored) ? stored : [];
}

/**
 * One skill's focus multiplier — the sum over the slots
 *
 * `Σ over FOCUS_SLOT_COUNT slots of (slot names this skill ? chosen : other)`, which is the sheet's
 * per-slot `IF` summed into its *Final modifier*. A slot nobody has filled counts as *other*, so a
 * character part-way through choosing sits between 0.9 and 2.1 rather than at a neutral 1 — the
 * empty Setup cell's own reading.
 *
 * @param skillId The skill being multiplied
 * @param picks What the character picked, in slot order — duplicates are what stack
 * @param dials The ruleset's two factors
 * @returns The multiplier this skill's weighted stat sum is scaled by
 */
export function focusMultiplier(
  skillId: string,
  picks: readonly string[],
  dials: FocusDials
): number {
  let multiplier = 0;

  for (let slot = 0; slot < FOCUS_SLOT_COUNT; slot += 1) {
    multiplier += picks[slot] === skillId ? dials.chosen : dials.other;
  }

  return multiplier;
}

/**
 * The picks as one entry per slot — `''` where a slot is empty
 *
 * The **form** of the picks, which is not how they are stored: a character carries the picks that
 * were made and nothing for the ones that were not, because an empty-slot sentinel on the document
 * would be a value every reader had to know to skip. A picker draws a fixed number of boxes, so it
 * needs the empties, and this is where the two shapes meet — once, rather than in the sheet's picker
 * and the wizard's step separately.
 *
 * @param picks What the character (or the form) has named so far, in slot order
 * @returns Exactly {@link FOCUS_SLOT_COUNT} entries
 */
export function toFocusSlots(picks: readonly string[]): string[] {
  return Array.from({ length: FOCUS_SLOT_COUNT }, (_, slot) => picks[slot] ?? '');
}

/**
 * The picks as a field to spread onto a character — **absent when there are none**
 *
 * *None* has exactly one spelling on the document: the field is not there. `focusSkillIds: []` would
 * be a second one for every reader to know about, and an export of a character who cleared their
 * last pick would differ from one who never made any. Stated here rather than at each write, because
 * the two writes had it differently until the review caught them: creation dropped an empty list and
 * the sheet's picker stored it.
 *
 * A **caller replacing** picks has to drop the old key before spreading this — `{}` spread over a
 * character that already has the field leaves it exactly as it was, which is the one way this helper
 * can be used wrongly. `chooseFocusSkills` shows the shape.
 *
 * @param picks The picks being stored, if any
 * @returns `{ focusSkillIds }`, or nothing at all
 */
export function focusPicksField(picks: readonly string[] | undefined): {
  focusSkillIds?: string[];
} {
  return picks && picks.length > 0 ? { focusSkillIds: [...picks] } : {};
}

/** What {@link focusPickRefusal} needs of a ruleset — the skills a pick may name */
interface FocusRuleset {
  skills?: Skill[];
}

/**
 * Why these picks may not be stored, or null when they may
 *
 * **The rule both writes share**: character creation and the sheet's picker ask this same question,
 * so a wizard and a live edit cannot disagree about what a legal set of picks is. Two things are
 * refused, and both are refusals rather than repairs — a trimmed fourth pick or a dropped phantom id
 * would leave a Player believing a choice landed (v3 Req 41.5's discipline, applied to a list):
 *
 * - **More than {@link FOCUS_SLOT_COUNT}**, because the multiplier is a sum over exactly that many
 *   slots and a fourth pick would be stored, shown, and read by nothing.
 * - **An id the ruleset does not define**, which raises the multiplier of no skill at all — the same
 *   rule `characterCreationErrors` applies to a race id and to a skill an allocation names.
 *
 * **Fewer than three is not refused here**, and that is this ticket's decision rather than an
 * omission: a character created before focus existed has none, and the sheet's picker is how they
 * fill the slots *one at a time* — a rule demanding all three would make the affordance the ticket
 * asks for unreachable. Creation is the act that insists on three, because the sheet's Setup form
 * always names three, and that rule lives with the act rather than with the field
 * (`characterCreation.ts`'s `focusErrors`).
 *
 * @param picks The picks being stored, in slot order
 * @param config The ruleset they are stored against
 * @returns One sentence, or null when the picks may be stored
 */
export function focusPickRefusal(picks: readonly string[], config: FocusRuleset): string | null {
  if (picks.length > FOCUS_SLOT_COUNT) {
    return `A character has ${FOCUS_SLOT_COUNT} focus skill slots, and ${picks.length} were named.`;
  }

  const skills = config.skills ?? [];
  const known = new Set(skills.map((skill) => skill.id));
  const unknown = picks.find((skillId) => !known.has(skillId));

  return unknown === undefined ? null : 'That is not a skill this ruleset has.';
}
