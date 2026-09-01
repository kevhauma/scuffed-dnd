/**
 * The class strings this folder shares (TICKET-LIVE-03)
 *
 * Named for the folder rather than for a component, the way `sessions.style.ts`, `rulesets.style.ts`
 * and `auth/authSurfaces.style.ts` are: the badge and the notice are two readings of one subject —
 * *is this still live* — and the tones have to agree between them.
 *
 * **The badge scale is spelled here rather than imported from `sessions.style.ts`.** That file's
 * `badgeStyles` is the identical type scale, and it stays there: this folder is imported by the
 * lobby today and by TICKET-DM-04's roster tomorrow, and a components/live that reached into
 * components/sessions for a string would make the dependency point backwards. Two copies of one
 * utility line is the cheaper of the two, and a *third* home for it is the moment to hoist a shared
 * badge scale into `components/shared/`.
 */

/** The setting every small state word on a live surface shares */
const badgeStyles = 'font-heading text-xs uppercase tracking-widest';

/** *They are watching this table* — `forest`, the theme's one affirmative tone */
export const presentBadgeStyles = `${badgeStyles} text-forest`;

/**
 * *The feed is live and they are not on it*
 *
 * `ink-600` rather than a colour: being away is not a fault and not a warning, it is simply the
 * other half of a fact we currently have. It has to be **legibly different from unknown**, which is
 * why this is the readable ink and that one is the quiet stone.
 */
export const awayBadgeStyles = `${badgeStyles} text-ink-600`;

/**
 * *We cannot tell* — the state TICKET-GAM-04 introduced, kept rather than retired
 *
 * `stone-400` and not `stone-500`: the theme defines `stone-100` through `stone-400`, and Tailwind
 * v4's `@theme` *extends* the default palette rather than replacing it, so `stone-500` silently
 * resolves to stock Tailwind grey — the GAM-02 review's finding, which is why the tone is written
 * down here rather than reached for from memory.
 */
export const unknownBadgeStyles = `${badgeStyles} text-stone-400`;

/**
 * The frame every connection notice shares — a line of text, not a dialog
 *
 * `block` because the notice is an `<output>`, which carries the `status` role natively and is
 * inline by default: without it the padding below would overlap the lines around it.
 */
const noticeStyles = 'block rounded border px-4 py-2';

/**
 * *This may be out of date* — `amber`, the tone the app already uses for *pay attention*
 *
 * Not `crimson`: a dropped connection is a thing to know about rather than a thing that went wrong,
 * and a red banner over a sheet that is still perfectly usable over HTTP would say the opposite of
 * what v3 Req 44.9 promises.
 */
export const staleNoticeStyles = `${noticeStyles} border-amber/50 bg-amber/10`;

/** *This feed has ended* — for a room that was refused or taken away, which nothing will fix */
export const lostNoticeStyles = `${noticeStyles} border-crimson/50 bg-crimson/10`;
