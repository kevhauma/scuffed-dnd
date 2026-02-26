// Overlay styles (backdrop)
export const overlayStyles = [
  'fixed inset-0',
  'bg-ink-900/60',
  'flex items-center justify-center',
  'z-50',
  'p-4',
  'backdrop-blur-sm',
].join(' ');

// Dialog box styles - intrinsic only (no margin/positioning)
export const dialogStyles = [
  'bg-parchment-50',
  'rounded-lg',
  'shadow-parchment-lg',
  'border-2 border-ink-700',
  'max-w-2xl',
  'w-full',
  'max-h-[90vh]',
  'overflow-hidden',
  'flex flex-col',
].join(' ');

// Header styles
export const headerStyles = [
  'flex items-center justify-between',
  'p-6 pb-4',
  'border-b border-stone-200',
].join(' ');

// Title styles
export const titleStyles = [
  'font-heading font-bold text-2xl',
  'text-ink-900',
  'm-0',
].join(' ');

// Close button styles
export const closeButtonStyles = [
  'text-ink-700',
  'hover:text-ink-900',
  'text-4xl',
  'leading-none',
  'font-light',
  'w-8 h-8',
  'flex items-center justify-center',
  'transition-colors duration-200',
  'focus:outline-none focus:ring-2 focus:ring-amber focus:ring-offset-2',
  'rounded',
  'cursor-pointer',
  'bg-transparent',
  'border-none',
].join(' ');

// Body styles
export const bodyStyles = [
  'p-6',
  'overflow-y-auto',
  'flex-1',
].join(' ');
