// Container styles - intrinsic only. The chip lays out its own icon and label (which the library
// allows), but carries no margin, width, or positioning: placement is the caller's decision.
//
// A blot of wax on the page: crimson wash, crimson keyline, and a light inner ring so it sits
// *on* the parchment rather than being cut out of it.
export const containerStyles = [
  'inline-flex items-baseline gap-1.5',
  'px-2 py-0.5',
  'bg-crimson/12',
  'border border-crimson/70',
  'ring-1 ring-inset ring-parchment-50/50',
  'rounded',
  'cursor-help',
].join(' ');

// Warning glyph styles
export const iconStyles = ['text-crimson', 'font-bold', 'leading-none'].join(' ');
