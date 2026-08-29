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
 * **Validates: Requirements 21.1-21.5; v4 systems/06 gap 2**
 */

import { FOCUS_CHOSEN_NAME, FOCUS_OTHER_NAME } from '#shared/engine/focusSkills';
import { Card } from '../../ui/Card/Card';
import { Label } from '../../ui/Label/Label';
import { Select, type SelectOption } from '../../ui/Select/Select';
import { Text } from '../../ui/Text/Text';
import { readable } from '../shared/readableNumber';
import type { FocusSlotView, SkillBreakdown } from './useCharacterSheet';

export interface FocusSkillsSectionProps {
  /** The ruleset's skills, in the order the grid lists them — the options each slot offers */
  skills: SkillBreakdown[];
  /** One entry per slot, filled or not */
  slots: FocusSlotView[];
  /** Whether the ruleset states either focus dial — see {@link caption} */
  isDialled: boolean;
  /** Put a skill in one slot; the empty option clears it */
  onSelectFocusSkill: (slot: number, skillId: string) => void;
}

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
    { value: '', label: 'No focus' },
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

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {slots.map((slot, index) => {
              const fieldId = `focus-slot-${index}`;

              return (
                <div key={fieldId} className="flex flex-col gap-1">
                  <Label htmlFor={fieldId}>Focus {index + 1}</Label>
                  <Select
                    id={fieldId}
                    className="w-64"
                    options={options}
                    value={slot.skillId}
                    onChange={(event) => onSelectFocusSkill(index, event.target.value)}
                  />
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
