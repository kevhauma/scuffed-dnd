/**
 * Dialog Component Styles
 *
 * A notice nailed to an oak board: a timber header with brass rivets in it, a parchment body below,
 * and the whole thing framed in a brass keyline. The room behind it goes dark and warm rather than
 * neutral grey — `oak-900` at 80% is the tavern with the candle moved to the front of the table.
 *
 * The panel is one of the two documented places a base component owns its own placement (the other
 * is `FormulaEditor`'s popover), so `relative` here is the panel positioning its own rivets, not
 * layout imposed on a parent.
 */

// Overlay styles (backdrop)
export const overlayStyles = [
  'fixed inset-0',
  'bg-oak-900/80',
  'flex items-center justify-center',
  'z-50',
  'p-4',
  'backdrop-blur-[3px]',
].join(' ');

// Dialog box styles - the panel owns its own placement
export const dialogStyles = [
  'relative',
  'bg-parchment-100',
  'surface-vellum',
  'rounded-lg',
  'shadow-parchment-lg',
  'border-2 border-oak-800',
  'ring-1 ring-inset ring-brass/40',
  'max-w-2xl',
  'w-full',
  'max-h-[90vh]',
  'overflow-hidden',
  'flex flex-col',
].join(' ');

// Header styles — the oak board the notice is nailed to
export const headerStyles = [
  'relative',
  'flex items-center justify-between gap-4',
  'px-6 py-4',
  'bg-oak-800',
  'surface-fibre',
  'border-b-2 border-brass-dark',
].join(' ');

// Title styles
export const titleStyles = [
  'font-heading font-semibold tracking-wide text-xl',
  'text-parchment-50',
  'm-0',
].join(' ');

/** The four studs holding the board, one per corner of the header */
export const rivetStyles = 'absolute text-brass';

// Close button styles — a brass ring set into the timber
export const closeButtonStyles = [
  'shrink-0',
  'w-8 h-8',
  'flex items-center justify-center',
  'text-2xl leading-none font-heading',
  'text-parchment-300',
  'bg-oak-900/60',
  'border border-brass-dark',
  'rounded-full',
  'transition-all duration-150',
  'hover:text-parchment-50 hover:border-brass hover:bg-crimson-dark',
  'focus:outline-none focus:ring-2 focus:ring-amber',
  'cursor-pointer',
].join(' ');

// Body styles
export const bodyStyles = ['p-6', 'overflow-y-auto', 'flex-1'].join(' ');
