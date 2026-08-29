/**
 * Creation Step 4 — Focus skills
 *
 * The source workbook's Setup form names three **Focus skill** slots (`Setup` A14:B17), and this is
 * where a new character names them (TICKET-SKL-05). Each slot multiplies the skill it names and,
 * less, every skill it does not; the same skill in two slots **stacks**, which is what the sample
 * character does with Arcane.
 *
 * **A picker per slot rather than a checkbox list**, exactly as `IdentityStep`'s races: duplicates
 * are the point, so *is this skill picked* is not a question with an answer. The placeholder is
 * `Select`'s disabled one rather than an explicit *no focus*, because here an empty slot is a step
 * error — the sheet's own picker offers the clear, where a Player is changing a choice rather than
 * making one.
 *
 * The multipliers are not previewed here. They are the *review* step's business — it renders the
 * composed character through the one calculator — and a second, hand-rolled statement of what a pick
 * is worth is the drift the engine exists to prevent.
 *
 * **Validates: Requirements 11.1, 21.1-21.5; v4 systems/06 gap 2**
 */

import type { Skill } from '#shared/types/config';
import { Card } from '../../ui/Card/Card';
import { Label } from '../../ui/Label/Label';
import { Select, type SelectOption } from '../../ui/Select/Select';
import { Text } from '../../ui/Text/Text';

export interface FocusStepProps {
  skills: Skill[];
  /** One entry per slot the ruleset asks for — a skill id, or `''` for an unfilled one */
  focusSlots: string[];
  /**
   * Whether this ruleset states either focus dial
   *
   * With neither set every multiplier is exactly 1, so the picks are remembered and change nothing —
   * and the step says so rather than letting a Player infer it from a review page that did not move.
   * It is also why the step does not *insist* on three there (`useCharacterCreation.focusStepError`).
   */
  isDialled: boolean;
  onSelectFocusSkill: (index: number, skillId: string) => void;
}

export function FocusStep({ skills, focusSlots, isDialled, onSelectFocusSkill }: FocusStepProps) {
  const options: SelectOption[] = skills.map((skill) => ({ value: skill.id, label: skill.name }));

  return (
    <Card className="p-6">
      <Text variant="h4" as="h2" className="mb-4">
        Focus Skills
      </Text>

      {skills.length === 0 ? (
        <Text variant="body-small-secondary">This ruleset defines no skills.</Text>
      ) : (
        <>
          <Text variant="body-small-secondary" className="mb-3">
            {isDialled
              ? 'Three slots. Each one multiplies the skill it names — and the same skill twice stacks.'
              : 'Three slots. This ruleset sets no focus dials, so these picks are remembered but change no number yet.'}
          </Text>

          <div className="flex flex-col gap-3">
            {focusSlots.map((skillId, index) => {
              const fieldId = `focus-slot-${index}`;

              return (
                <div key={fieldId} className="flex flex-col gap-1">
                  <Label htmlFor={fieldId}>Focus {index + 1}</Label>
                  {/* No `error` flag on an empty slot, for `IdentityStep`'s reason: every slot
                      starts empty, and the step's own message is where a Player being stopped is
                      already looking */}
                  <Select
                    id={fieldId}
                    className="w-64"
                    options={options}
                    placeholder="Choose a skill"
                    value={skillId}
                    onChange={(event) => onSelectFocusSkill(index, event.target.value)}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}
