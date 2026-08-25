/**
 * Class strings shared by the auth surfaces (TICKET-AUTH-01, TICKET-AUTH-02)
 *
 * The two boxes and the one link, out of the JSX for the reason the conventions give: a class
 * string long enough to wrap is a class string nobody re-reads in place.
 *
 * **This was `AuthForm.style.ts` until AUTH-02**, and the rename is the point. A `Name.style.ts`
 * belongs to `Name.tsx`; once `SocialSignInButtons`, `LinkedIdentities` and the `/account` route
 * were all importing from it, one component owned three others' strings. A folder-level file says
 * what is actually true — these are the *auth folder's* surface tones — without pretending a
 * primitive was extracted.
 *
 * Deliberately **not** merged with `AccountBadge.style.ts`, whose link string is a near-duplicate
 * of {@link switchLinkStyles}. The two differ where it matters: one is read on parchment and the
 * other on oak, so sharing them would mean a variant prop before anything needs one.
 */

/** The unwelcome-news box on sign-up: crimson enough to be read, not loud enough to be an error */
export const warningStyles = 'rounded border border-crimson/40 bg-parchment-100 px-3 py-2';

/** The server's refusal. Full-strength crimson, because this one *is* an error */
export const alertStyles = 'rounded border border-crimson bg-parchment-100 px-3 py-2';

/** *Create one* / *Sign in* — an inline link inside a caption, on parchment */
export const switchLinkStyles = [
  'underline decoration-brass-dark underline-offset-2',
  'hover:text-ink-900',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber',
].join(' ');
