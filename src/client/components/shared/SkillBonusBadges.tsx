/**
 * Skill Bonus Badges
 *
 * An item template's skill vector as coloured chips — forest for a bonus, crimson for a penalty (v4
 * systems/11, TICKET-ITEM-01). `StatModifierBadges`' counterpart one entity over: a wielded
 * Battleaxe reads `Athletics: +2` and `Sneaking: -1`, the way a material tier reads `STR: +2`.
 *
 * **Two components sharing one style module**, rather than one component over a generic
 * `{ targetId, modifier }`. The two persisted shapes name different entities — a `StatModifier` a
 * stat, a `SkillModifier` a skill — and collapsing them would be a shape that lets a material tier's
 * row point at a skill. What must not differ is how a bonus *looks*, and that lives once, in
 * [`modifierBadges.style.ts`](./modifierBadges.style.ts).
 *
 * It takes the ruleset's skills as well as the bonuses because a bonus names its target by **id**,
 * and an id is not something to show a User. A bonus naming a skill the ruleset no longer defines is
 * shown with its raw id rather than hidden: the validator reports it as a dangling reference, and a
 * chip nobody can see is a number nobody can fix — `StatModifierBadges`' rule, and the reason it is
 * repeated here rather than assumed.
 *
 * A skill has no abbreviation (TICKET-SKL-02 took the code with the entity), so the chip carries the
 * skill's **name**. Two skills may share a spelling — the sheet genuinely has `skinning` and
 * `Skinning` — and that is the ruleset's business rather than this component's.
 *
 * **Validates: v4 systems/11; Requirements 7.6, 21.1-21.5**
 */

import type { Skill, SkillModifier } from '#shared/types/config';
import {
  badgeStyles,
  bonusToneStyles,
  containerStyles,
  penaltyToneStyles,
} from './modifierBadges.style';

export interface SkillBonusBadgesProps {
  bonuses: SkillModifier[];
  /** The ruleset's skills, for spelling each bonus's target */
  skills: Skill[];
  className?: string;
}

export function SkillBonusBadges({ bonuses, skills, className = '' }: SkillBonusBadgesProps) {
  const nameById = new Map(skills.map((skill) => [skill.id, skill.name]));

  return (
    <div className={`${containerStyles} ${className}`.trim()}>
      {bonuses.map((bonus, index) => {
        const isBonus = bonus.modifier >= 0;
        const tone = isBonus ? bonusToneStyles : penaltyToneStyles;

        return (
          // Two rows may name the same skill — the dialog permits it, as the material one does — so
          // the id alone is not a key. The list is display-only and never reorders, so the position
          // completes it.
          <span key={`${bonus.skillId}-${index}`} className={`${badgeStyles} ${tone}`}>
            {nameById.get(bonus.skillId) ?? bonus.skillId}: {isBonus ? '+' : ''}
            {bonus.modifier}
          </span>
        );
      })}
    </div>
  );
}
