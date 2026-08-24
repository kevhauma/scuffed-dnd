/**
 * Divider Component Styles
 *
 * The container lays out the divider's own three parts (rule, ornament, rule), which the library
 * allows. It imposes no width of its own — a divider is as wide as the caller makes it.
 */

// Base styles - intrinsic only (no margin/positioning)
export const baseStyles = ['flex items-center gap-3'].join(' ');

/** The hairline either side. Two stacked borders read as an engraved line rather than a CSS rule. */
export const ruleStyles = ['h-px grow', 'border-t border-b'].join(' ');

/**
 * Which ink the rule and the ornament are drawn in
 *
 * `ink` for a rule on parchment, `brass` for one on timber — the same shape, lit differently.
 */
export const toneStyles = {
  ink: { rule: 'border-t-ink-700/30 border-b-parchment-50/70', ornament: 'text-ink-700/60' },
  brass: { rule: 'border-t-oak-900/60 border-b-brass/25', ornament: 'text-brass/70' },
};

export type DividerTone = keyof typeof toneStyles;
