// Container styles - intrinsic only; width and placement come from the caller's className
export const containerStyles = '';

// Header styles
export const headerStyles = [
  'flex items-center justify-between',
  'mb-4',
  'pb-3',
  'border-b border-ink-700/25',
].join(' ');

// Summary styles
export const summaryStyles = ['flex gap-4', 'text-sm'].join(' ');

// Issue list styles
export const issueListStyles = ['space-y-2'].join(' ');

// Issue item styles — what every row wears, clickable or not
export const issueItemStyles = [
  'flex items-start gap-3',
  'p-3',
  'bg-parchment-200/60',
  'border border-ink-700/20',
  'rounded',
  'transition-colors duration-150',
].join(' ');

/**
 * What a row wears *in addition* when it can actually be activated (CR-34)
 *
 * Separate because the pointer, hover and focus ring were baked into every row, so a static row
 * advertised a click that does nothing — the visuals disagreeing with the `role`/`tabIndex` the
 * component already withholds.
 */
export const issueItemInteractiveStyles = [
  'hover:bg-parchment-300/70',
  'cursor-pointer',
  'focus:outline-none focus:ring-2 focus:ring-amber',
].join(' ');

// Icon styles, shared by all three severities — only the colour differs
const iconStyles = ['text-xl', 'font-bold', 'flex-shrink-0'].join(' ');

// Section heading styles, shared by all three severities — only the colour differs
const sectionHeadingStyles = ['font-heading', 'font-semibold', 'text-lg', 'mb-2'].join(' ');

// Spacing between the severity sections
export const sectionListStyles = ['space-y-4'].join(' ');

/**
 * Per-severity presentation: heading colour, icon colour, and the glyph.
 *
 * One record rather than three sets of loose constants, so a fourth severity is one entry here and
 * nothing in the JSX. `information` is royal rather than amber (TICKET-SKL-03) — an observation
 * that is not a defect must not borrow the colour of one.
 */
export const severityStyles = {
  error: {
    heading: `${sectionHeadingStyles} text-crimson`,
    icon: `${iconStyles} text-crimson`,
    glyph: '✕',
  },
  warning: {
    // `amber-dark`, not `amber`: the bright dye is a light, and reads at 2.6:1 against parchment
    heading: `${sectionHeadingStyles} text-amber-dark`,
    icon: `${iconStyles} text-amber-dark`,
    glyph: '⚠',
  },
  information: {
    heading: `${sectionHeadingStyles} text-royal`,
    icon: `${iconStyles} text-royal`,
    glyph: 'ℹ',
  },
} as const;

// Message styles
export const messageStyles = ['font-body text-base', 'text-ink-900', 'mb-1'].join(' ');

// Entity info styles
export const entityInfoStyles = ['flex gap-2', 'text-sm', 'text-ink-600', 'font-body'].join(' ');

// Empty state styles
export const emptyStateStyles = [
  'flex flex-col items-center justify-center',
  'py-8',
  'text-center',
].join(' ');
