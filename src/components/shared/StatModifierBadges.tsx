/**
 * Stat Modifier Badges
 *
 * A material tier's modifiers as coloured chips — forest for a bonus, crimson for a penalty. Used
 * wherever a tier's bonuses are listed, so an item and the material it is made of describe the
 * same modifier the same way.
 *
 * It takes the ruleset's stats as well as the modifiers because since TICKET-MAT-01 a modifier
 * names its target by **id**, and an id is not something to show a User. Resolving one to its
 * abbreviation lives here rather than in each card, so the two cannot disagree — the same split
 * the sheet's `RaceContribution` makes. Callers pass **every** stat, not only the ones a modifier
 * may target: a derived stat can still be named by an imported modifier, and it should read as
 * `APT: +2` rather than as a raw id.
 *
 * A modifier naming a stat the ruleset no longer defines is shown with its raw id rather than
 * hidden: the validator reports it as a dangling reference, and a chip nobody can see is a number
 * nobody can fix.
 *
 * **Validates: Concept 09; Requirements 7.6, 21.1-21.5, 22.1-22.4**
 */

import type { Stat, StatModifier } from '../../types/config';
import {
  badgeStyles,
  bonusToneStyles,
  containerStyles,
  penaltyToneStyles,
} from './StatModifierBadges.style';

export interface StatModifierBadgesProps {
  modifiers: StatModifier[];
  /** The ruleset's stats, for spelling each modifier's target */
  stats: Stat[];
  className?: string;
}

export function StatModifierBadges({ modifiers, stats, className = '' }: StatModifierBadgesProps) {
  const abbreviationById = new Map(stats.map((stat) => [stat.id, stat.abbreviation]));

  return (
    <div className={`${containerStyles} ${className}`.trim()}>
      {modifiers.map((bonus, index) => {
        const isBonus = bonus.modifier >= 0;
        const tone = isBonus ? bonusToneStyles : penaltyToneStyles;

        return (
          // Two modifiers may name the same stat — the level dialog permits it — so the id alone
          // is not a key. The list is display-only and never reorders, so the position completes it.
          <span key={`${bonus.statId}-${index}`} className={`${badgeStyles} ${tone}`}>
            {abbreviationById.get(bonus.statId) ?? bonus.statId}: {isBonus ? '+' : ''}
            {bonus.modifier}
          </span>
        );
      })}
    </div>
  );
}
