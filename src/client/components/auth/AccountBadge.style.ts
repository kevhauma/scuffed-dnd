/**
 * Class strings for the account badge (TICKET-AUTH-01)
 *
 * One string, and it is on the **beam** — oak, not parchment — which is why it is
 * `parchment-300 → parchment-50` rather than `AuthForm.style.ts`'s `ink-900`. The two look alike
 * and read on opposite grounds; see that file for why they are not shared yet.
 */

/** *Sign in*, sitting on the dark beam beside the mode switcher */
export const signInLinkStyles = [
  'rounded font-heading text-sm tracking-wide',
  'text-parchment-300 underline decoration-brass-dark underline-offset-4',
  'hover:text-parchment-50',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber',
].join(' ');
