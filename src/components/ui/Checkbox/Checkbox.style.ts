// Checkbox styles - intrinsic only (no margin/positioning)
export const checkboxStyles = [
  'w-5 h-5',
  'text-royal', // Checked color
  'bg-white',
  'border-2 border-stone-200',
  'rounded',
  'transition-all duration-200',
  'focus:outline-none focus:ring-2 focus:ring-amber focus:ring-offset-2',
  'hover:border-stone-300',
  'cursor-pointer',
  'checked:bg-royal checked:border-royal',
  'checked:hover:bg-[#243447] checked:hover:border-[#243447]',
].join(' ');

// Label text styles
export const labelStyles = [
  'font-body text-base',
  'text-ink-900',
  'cursor-pointer',
  'select-none',
].join(' ');

// Disabled state styles
export const disabledStyles = [
  'opacity-50',
  'cursor-not-allowed',
].join(' ');
