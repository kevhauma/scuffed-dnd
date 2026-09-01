/**
 * The class strings this folder shares (TICKET-GAM-02)
 *
 * Named for the folder rather than for a component, the way `rulesets.style.ts` and
 * `auth/authSurfaces.style.ts` are: six files import these, and a `SessionsPanel.style.ts` that
 * `JoinSessionPanel` reads is a name that invites somebody to delete the wrong line.
 */

/** A section: its heading, its lead and its rows */
export const sectionStyles = 'flex flex-col gap-3';

/**
 * One row: what it is on the left, what can be done to it on the right
 *
 * A table, an addressed invitation, one waiting for you — the same frame for all three,
 * deliberately, because they are read in the same column and a second border treatment would say
 * they were different kinds of thing.
 */
export const sessionRowStyles = [
  'flex flex-wrap items-center justify-between gap-3',
  'rounded border border-brass-dark/40 bg-parchment-100 px-4 py-3',
].join(' ');

/**
 * The setting every small state word on this surface shares (TICKET-GAM-03)
 *
 * The **tone** is the caller's, because that is the part carrying the meaning — an invitation
 * somebody declined and one that simply ran out should not be the same colour. The five below it
 * and the five in `AddressedInvitePanel`'s `STATE_BADGE` compose this rather than respelling it, so
 * one type scale cannot become two.
 */
export const badgeStyles = 'font-heading text-xs uppercase tracking-widest';

/** *You run this one* — `amber`, the tone the app reserves for the DM's own things */
export const dmBadgeStyles = `${badgeStyles} text-amber`;

/** *You play at this one* — `royal`, matching the marker the browser home uses */
export const playerBadgeStyles = `${badgeStyles} text-royal`;

/**
 * An archived table, said quietly rather than in red — it is a state, not a fault
 *
 * `stone-400` rather than `stone-500`: the theme defines `stone-100` through `stone-400`, and
 * Tailwind v4's `@theme` *extends* the default palette rather than replacing it — so `stone-500`
 * silently resolved to stock Tailwind grey, which CLAUDE.md's theme-tokens-only rule is precisely
 * about (the GAM-02 review).
 */
export const archivedBadgeStyles = `${badgeStyles} text-stone-400`;

/*
 * `unknownBadgeStyles` lived here until TICKET-LIVE-03 and has **moved rather than gone**: the
 * lobby's connection column is now `components/live/PresenceBadge`, which TICKET-DM-04's roster
 * renders too, so the tone belongs beside the component that owns the state.
 * `components/live/live.style.ts` carries it, along with the note about `stone-500` silently
 * resolving to stock Tailwind grey — the GAM-02 review's finding, which is worth keeping wherever
 * the token is chosen.
 */

/**
 * The code itself, set so it can be read aloud from across a table
 *
 * Monospaced and widely tracked because that is what the whole alphabet decision was for: the
 * characters have to be distinguishable at a glance by somebody typing them into a phone.
 */
export const inviteCodeStyles = [
  'font-mono text-xl tracking-[0.3em] text-ink-900',
  'rounded border border-brass-dark/40 bg-parchment-50 px-4 py-2',
].join(' ');

/** What a refusal is shown in — the shape the rulesets folder uses, which is not its to lend */
export const alertStyles = 'rounded border border-crimson/50 bg-crimson/10 px-4 py-3';
