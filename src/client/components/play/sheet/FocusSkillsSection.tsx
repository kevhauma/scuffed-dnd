/**
 * Focus Skills Section
 *
 * The sheet's half of the source workbook's Setup form (`Setup` A14:B17): three slots naming the
 * skills this character focuses on, each multiplying that skill's growth (TICKET-SKL-05).
 *
 * **A picker per slot rather than a checkbox list**, which is `IdentityStep`'s shape and the same
 * reasoning one entity over: duplicates are legal and *stack*, so *is this skill picked* is not a
 * question with an answer. Picking Arcane twice is what the sample character does, and the two slots
 * then both read `×3.3` — which is where the stacking is visible, rather than being a rule stated in
 * prose beside a control that hides it.
 *
 * Every number is the engine's. The multiplier beside a slot is `calculated.skillFocus`, the same map
 * the skills grid's `focus ×` breakdown row reads, so a slot and the level it moved cannot disagree.
 *
 * **The picker is optional since TICKET-DM-05.** `set-focus-skills` is behind
 * `requireCharacterPlayer`, so the table's DM reads the three picks and their multipliers as text
 * rather than being offered three dropdowns whose writes 404. Which skills a character focuses is a
 * choice about who they are, and it stays the Player's.
 *
 * **Validates: Requirements 21.1-21.5; v3 Req 42.7, 49.10; v4 systems/06 gap 2**
 */

import { FOCUS_CHOSEN_NAME, FOCUS_OTHER_NAME } from '#shared/engine/focusSkills';
import { Card } from '../../ui/Card/Card';
import { Label } from '../../ui/Label/Label';
import { Select, type SelectOption } from '../../ui/Select/Select';
import { Text } from '../../ui/Text/Text';
import { NoControlsNotice } from '../shared/NoControlsNotice';
import { readable } from '../shared/readableNumber';
import type { FocusSlotView, SkillBreakdown } from './useCharacterSheet';

export interface FocusSkillsSectionProps {
  /** The ruleset's skills, in the order the grid lists them — the options each slot offers */
  skills: SkillBreakdown[];
  /** One entry per slot, filled or not */
  slots: FocusSlotView[];
  /** Whether the ruleset states either focus dial — see {@link caption} */
  isDialled: boolean;
  /**
   * Put a skill in one slot; the empty option clears it. Absent when this reader may not
   * (TICKET-DM-05) — the slots then read as text, naming what was picked and what it multiplies by.
   */
  onSelectFocusSkill?: (slot: number, skillId: string) => void;
}

/** What a reader with no picker is told instead — the section's half of `ResourcesSection`'s line */
const NO_CONTROLS = 'Only the Player chooses what their own character focuses on.';

/** What an unfilled slot reads as — the dropdown's clearing option, and the text beside it */
const NO_FOCUS = 'No focus';

/** The value that option carries, and what the character stores for a slot nobody filled */
const NO_FOCUS_VALUE = '';

/**
 * What the section says about what a pick is worth here
 *
 * A ruleset that states neither dial multiplies every skill by exactly 1, so a pick made on it is
 * stored and changes no number. Saying so is the honest thing: the alternative is a Player choosing
 * three skills, watching nothing move, and concluding the sheet is broken.
 */
function caption(isDialled: boolean): string {
  if (!isDialled) {
    // The two constants are **named** from the engine rather than spelled again here: they are the
    // thing a User has to go and set, so a rename that did not reach this sentence would send them
    // looking for a constant the ruleset no longer has
    return (
      'This ruleset sets no focus dials, so a pick is remembered but changes no number yet — ' +
      `const.${FOCUS_CHOSEN_NAME} and const.${FOCUS_OTHER_NAME} are what give the slots their weight.`
    );
  }

  return (
    'Each slot multiplies the skill it names and, a little, every skill it does not. The same ' +
    'skill in two slots stacks.'
  );
}

/**
 * What one slot is holding, spelled for a reader who cannot change it (TICKET-DM-05)
 *
 * Looked up rather than carried on the slot for the reason `raceContributions` pairs an id with an
 * abbreviation in the hook: the slot stores the pick, and *what to call it* is the ruleset's, read
 * fresh — so renaming a skill relabels every sheet focusing on it.
 *
 * @param skills The ruleset's skills, as the section already has them
 * @param skillId What the slot names, or `''` for an empty one
 * @returns The skill's name, or the same *No focus* the dropdown's empty option reads
 */
function pickName(skills: SkillBreakdown[], skillId: string): string {
  const picked = skills.find((skill) => skill.id === skillId);

  return picked ? picked.name : NO_FOCUS;
}

export function FocusSkillsSection({
  skills,
  slots,
  isDialled,
  onSelectFocusSkill,
}: FocusSkillsSectionProps) {
  /**
   * An explicit *no focus* entry rather than `Select`'s placeholder, which is a disabled option: a
   * slot on the sheet has to be **clearable**, because a Player who focused a skill they no longer
   * care about would otherwise be able to swap it but never to give it up. The creation wizard uses
   * the placeholder instead, where an empty slot is a step error rather than a choice.
   */
  const options: SelectOption[] = [
    { value: NO_FOCUS_VALUE, label: NO_FOCUS },
    ...skills.map((skill) => ({ value: skill.id, label: skill.name })),
  ];

  return (
    <Card className="p-6">
      <Text variant="h4" as="h2" className="mb-3">
        Focus Skills
      </Text>

      {skills.length === 0 ? (
        <Text variant="body-small-secondary">This ruleset defines no skills.</Text>
      ) : (
        <>
          <Text variant="body-small-secondary" className="mb-3">
            {caption(isDialled)}
          </Text>

          {onSelectFocusSkill === undefined && <NoControlsNotice message={NO_CONTROLS} />}

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {slots.map((slot, index) => {
              const fieldId = `focus-slot-${index}`;
              const heading = `Focus ${index + 1}`;

              return (
                <div key={fieldId} className="flex flex-col gap-1">
                  {onSelectFocusSkill ? (
                    <>
                      <Label htmlFor={fieldId}>{heading}</Label>
                      <Select
                        id={fieldId}
                        className="w-64"
                        options={options}
                        value={slot.skillId}
                        onChange={(event) => onSelectFocusSkill(index, event.target.value)}
                      />
                    </>
                  ) : (
                    /* The pick as a reading (TICKET-DM-05). `Label` with no control to name would be
                       a label pointing at nothing, so the slot's heading is plain text here. */
                    <>
                      <Text variant="caption" as="span">
                        {heading}
                      </Text>
                      <Text variant="body-small" as="span" className="w-64">
                        {pickName(skills, slot.skillId)}
                      </Text>
                    </>
                  )}
                  {/* Only for a filled slot: an empty one has no skill whose multiplier to state,
                      and `×0.9` under a box reading *No focus* would be attaching a number to a
                      choice nobody made */}
                  {slot.multiplier !== null && (
                    <Text variant="caption" as="span">
                      {`× ${readable(slot.multiplier)}`}
                    </Text>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}
