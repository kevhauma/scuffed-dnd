/**
 * Skill Modifier Badge
 *
 * One skill modifier as a coloured chip — forest for a bonus, crimson for a penalty. Used wherever
 * a material level's bonuses are listed, so an item and the material it is made of describe the
 * same modifier the same way.
 *
 * **Validates: Requirements 7.6, 21.1-21.5, 22.1-22.4**
 */

import type { SkillModifier } from '../../types/config';

export interface SkillModifierBadgeProps {
  modifier: SkillModifier;
  className?: string;
}

export function SkillModifierBadge({ modifier, className = '' }: SkillModifierBadgeProps) {
  const isBonus = modifier.modifier >= 0;

  const toneStyles = isBonus
    ? 'bg-forest/10 text-forest border-forest'
    : 'bg-crimson/10 text-crimson border-crimson';

  return (
    <span className={`text-xs px-2 py-1 rounded border ${toneStyles} ${className}`.trim()}>
      {modifier.skillCode}: {isBonus ? '+' : ''}
      {modifier.modifier}
    </span>
  );
}
