  // Base styles - intrinsic only (no margin/positioning)
  export const baseStyles = [
    'inline-flex items-center justify-center',
    'font-heading font-semibold',
    'border-2',
    'rounded-md',
    'transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-amber focus:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' ');

  // Variant styles
  export const variantStyles = {
    primary: [
      'bg-royal text-parchment-50',
      'border-royal',
      'hover:bg-[#243447] hover:border-[#243447]',
      'active:bg-[#1a2633] active:shadow-inner',
      'shadow-parchment',
    ].join(' '),
    secondary: [
      'bg-parchment-100 text-ink-900',
      'border-ink-700',
      'hover:bg-parchment-200 hover:border-ink-800',
      'active:bg-parchment-300 active:shadow-inner',
      'shadow-parchment',
    ].join(' '),
    danger: [
      'bg-crimson text-parchment-50',
      'border-crimson',
      'hover:bg-[#6b2424] hover:border-[#6b2424]',
      'active:bg-[#4a1919] active:shadow-inner',
      'shadow-parchment',
    ].join(' '),
    ghost: [
      'bg-transparent text-ink-800',
      'border-transparent',
      'hover:bg-parchment-200 hover:border-stone-200',
      'active:bg-parchment-300',
    ].join(' '),
  };

  // Size styles (padding and font size only)
  export const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };