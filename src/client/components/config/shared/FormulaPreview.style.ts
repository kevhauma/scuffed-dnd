/**
 * Formula Preview Styles
 *
 * The ladder is a real table because it is real tabular data — a level and what the formula
 * produces at it — and a screen reader reading "level 15, 4.5" is the whole point of the column
 * headers. `CurveGrid.style.ts` is the precedent for a feature component owning a `<table>`.
 */

export const tableStyles = 'w-full border-collapse text-left';

export const captionStyles = 'text-left mb-1';

export const headerCellStyles = 'p-1 border-b border-stone-300';

export const levelCellStyles = 'p-1 border-b border-stone-200 font-mono w-16';

export const resultCellStyles = 'p-1 border-b border-stone-200 font-mono';
