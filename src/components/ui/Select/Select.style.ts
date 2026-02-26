// Base styles - intrinsic only (no margin/positioning)
export const baseStyles = [
  'w-full',
  'px-3 py-2',
  'font-body text-base',
  'text-ink-900',
  'bg-white',
  'border-2 border-stone-200',
  'rounded-md',
  'transition-all duration-200',
  'focus:outline-none focus:ring-2 focus:ring-amber focus:ring-offset-2 focus:border-amber',
  'hover:border-stone-300',
  'cursor-pointer',
  'appearance-none',
  'bg-[url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%234f4739\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")]',
  'bg-[length:12px] bg-[right_0.75rem_center] bg-no-repeat',
  'pr-10', // Extra padding for dropdown arrow
].join(' ');

// Disabled state styles
export const disabledStyles = [
  'opacity-50',
  'cursor-not-allowed',
  'bg-parchment-100',
].join(' ');
