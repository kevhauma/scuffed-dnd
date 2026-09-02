/**
 * The class strings the roster shares (TICKET-DM-04)
 *
 * Named for the folder rather than for a component, the way `sessions.style.ts`, `live.style.ts` and
 * `rulesets.style.ts` are. The roster's own frame is a **grid** where the rest of the sessions surface
 * is a row of flexed pairs, which is the whole reason this file exists rather than the roster
 * borrowing `sessionRowStyles`: a DM scanning five characters' pools reads down columns, and a wrapped
 * flex row does not have any.
 *
 * Theme tokens only — `parchment-*`, `ink-*`, `stone-*`, `amber`, `crimson`, `forest`, and the two
 * font families.
 */

/** A Member and everything they are playing, set apart from the next Member */
export const groupStyles = [
  'flex flex-col gap-2',
  'rounded border border-brass-dark/40 bg-parchment-100 px-4 py-3',
].join(' ');

/** The Member's own line: who they are on the left, their connection on the right */
export const groupHeaderStyles = 'flex flex-wrap items-center justify-between gap-3';

/** One character, indented under the Member who plays them */
export const characterRowStyles = [
  'flex flex-col gap-2',
  'border-brass-dark/25 border-t pt-2 first:border-t-0 first:pt-0',
].join(' ');

/** The character's name and the buttons that act on them */
export const characterHeaderStyles = 'flex flex-wrap items-baseline justify-between gap-3';

/**
 * The numbers, laid out so they line up down the list
 *
 * `flex-wrap` rather than a fixed grid: the columns are the **ruleset's** resources plus two, so a
 * table playing with one pool and one playing with four both have to read, and neither number is
 * known here.
 */
export const cellsStyles = 'flex flex-wrap items-baseline gap-x-6 gap-y-1';

/** One cell: what it is above, what it says below */
export const cellStyles = 'flex items-baseline gap-1.5';

/** What a cell is called — quiet, because the number is the thing being read */
export const cellLabelStyles = 'font-heading text-ink-600 text-xs uppercase tracking-widest';

/**
 * The open quick-action tray under a character's row
 *
 * Shares {@link characterRowStyles}' divider so the tray reads as part of the row it opened from
 * rather than as a card of its own.
 */
export const actionTrayStyles = 'flex flex-col gap-3 border-brass-dark/25 border-t pt-3';

/**
 * A pool holding more than its maximum (TICKET-RES-03)
 *
 * `amber`, the *pay attention* tone the app already uses — not `crimson`, because the number is not
 * wrong: it is what the Player is tracking, kept rather than silently rewritten when a maximum fell.
 */
export const overMaxStyles = 'text-amber';

/** The characters nobody at the table owns any more — a state, said quietly */
export const departedStyles = `${groupStyles} border-dashed`;

/** One roll in the table's log */
export const rollRowStyles = [
  'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1',
  'border-stone-200 border-b py-2 last:border-b-0',
].join(' ');
