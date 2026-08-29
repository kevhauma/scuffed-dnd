/**
 * Modifier Badge Styles
 *
 * The two tones are the whole visual argument: forest reads as "this helps", crimson as "this
 * costs you", so a tier's trade-offs are legible without reading a single number.
 *
 * Shared by both badge lists — `StatModifierBadges` over a material or inlay tier's stat rows, and
 * `SkillBonusBadges` over an item template's skill vector (TICKET-ITEM-01). Two components because
 * the two persisted shapes name two different entities; **one** style module because a bonus is a
 * bonus, and a template's `+2` must not read differently from a material's.
 */

export const containerStyles = ['flex', 'flex-wrap', 'gap-2'].join(' ');

export const badgeStyles = ['text-xs', 'px-2', 'py-1', 'rounded', 'border'].join(' ');

export const bonusToneStyles = ['bg-forest/10', 'text-forest', 'border-forest'].join(' ');

export const penaltyToneStyles = ['bg-crimson/10', 'text-crimson', 'border-crimson'].join(' ');
