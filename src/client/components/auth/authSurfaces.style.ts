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

/**
 * *Your session expired* — royal rather than crimson, on purpose (TICKET-AUTH-04)
 *
 * Nothing went wrong: a ninety-day ceiling doing exactly what it is for is not an error, and
 * dressing it as one teaches people to read crimson as "ignore this". v3 Req 48.9's whole content
 * is that this is not a permission error.
 */
export const expiredNoticeStyles = [
  // `block` because `<output>` is inline by default, so `w-full` and `max-w-md` do nothing without
  // it — the notice spanned the whole page with its border out at the edges until this was added
  'block mx-auto mb-4 w-full max-w-md',
  'rounded border border-royal/40 bg-parchment-100 px-3 py-2',
].join(' ');

/** *Create one* / *Sign in* — an inline link inside a caption, on parchment */
export const switchLinkStyles = [
  'underline decoration-brass-dark underline-offset-2',
  'hover:text-ink-900',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber',
].join(' ');
