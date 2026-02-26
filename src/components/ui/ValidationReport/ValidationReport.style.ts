// Container styles - allows positioning via className
export const containerStyles = [
  'w-full',
].join(' ');

// Header styles
export const headerStyles = [
  'flex items-center justify-between',
  'mb-4',
  'pb-3',
  'border-b border-stone-200',
].join(' ');

// Summary styles
export const summaryStyles = [
  'flex gap-4',
  'text-sm',
].join(' ');

// Issue list styles
export const issueListStyles = [
  'space-y-2',
].join(' ');

// Issue item styles
export const issueItemStyles = [
  'flex items-start gap-3',
  'p-3',
  'bg-parchment-100',
  'border border-stone-200',
  'rounded',
  'transition-colors duration-150',
  'hover:bg-parchment-200',
  'cursor-pointer',
  'focus:outline-none focus:ring-2 focus:ring-amber focus:ring-offset-2',
].join(' ');

// Error icon styles
export const errorIconStyles = [
  'text-crimson',
  'text-xl',
  'font-bold',
  'flex-shrink-0',
].join(' ');

// Warning icon styles
export const warningIconStyles = [
  'text-amber',
  'text-xl',
  'font-bold',
  'flex-shrink-0',
].join(' ');

// Message styles
export const messageStyles = [
  'font-body text-base',
  'text-ink-900',
  'mb-1',
].join(' ');

// Entity info styles
export const entityInfoStyles = [
  'flex gap-2',
  'text-sm',
  'text-ink-600',
  'font-body',
].join(' ');

// Empty state styles
export const emptyStateStyles = [
  'flex flex-col items-center justify-center',
  'py-8',
  'text-center',
].join(' ');
