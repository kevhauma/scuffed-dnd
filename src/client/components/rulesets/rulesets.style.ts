/**
 * The class strings this folder shares (TICKET-RUL-01)
 *
 * **Named for the folder rather than for a component**, because four files import it and a
 * `RulesetsPanel.style.ts` that `RulesetCard` reads is a name that invites somebody to delete
 * `rulesetRowStyles` believing it belongs to the panel. The convention — `Name.style.ts` beside
 * `Name.tsx` holding *that* component's classes — still holds for anything only one component uses;
 * this is the folder's own, the way `auth/authSurfaces.style.ts` is.
 *
 * The **home badge** is the load-bearing one. v3 Req 36.8 asks that it be unambiguous at all times
 * whether the ruleset on screen lives in this browser or on the Account, and the cheapest honest
 * way to say so is a label on every row that never varies by row — so the two badges differ in
 * colour rather than only in wording, and neither is styled to read as an approval.
 */

/** A home's section: its heading, its lead and its rows */
export const homeSectionStyles = 'flex flex-col gap-3';

/** One ruleset's row: what it is on the left, what can be done to it on the right */
export const rulesetRowStyles = [
  'flex flex-wrap items-center justify-between gap-3',
  'rounded border border-brass-dark/40 bg-parchment-100 px-4 py-3',
].join(' ');

/** *This browser* — `royal`, matching the marker the active-sessions list uses for the same idea */
export const browserHomeBadgeStyles = 'font-heading text-xs uppercase tracking-widest text-royal';

/** *Your account* — `forest`, the app's other neutral, so the pair reads as two kinds not two ranks */
export const accountHomeBadgeStyles = 'font-heading text-xs uppercase tracking-widest text-forest';

/** A link that navigates rather than acts, so it is not dressed as a button */
export const openLinkStyles = 'font-heading text-sm text-royal underline underline-offset-4';

/** What a refusal is shown in — the shape `AuthAlert` uses, which is not the auth folder's to lend */
export const alertStyles = 'rounded border border-crimson/50 bg-crimson/10 px-4 py-3';
