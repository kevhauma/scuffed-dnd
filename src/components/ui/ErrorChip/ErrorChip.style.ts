// Container styles - intrinsic only. The chip lays out its own icon and label (which the library
// allows), but carries no margin, width, or positioning: placement is the caller's decision.
export const containerStyles = [
  'inline-flex items-baseline gap-1.5',
  'px-2 py-0.5',
  'bg-crimson/10',
  'border border-crimson',
  'rounded',
  'cursor-help',
].join(' ');

// Warning glyph styles
export const iconStyles = ['text-crimson', 'font-bold', 'leading-none'].join(' ');
