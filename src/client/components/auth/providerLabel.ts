/**
 * What each provider is called on a button (TICKET-AUTH-02)
 *
 * A file of its own because two surfaces need it — [`SocialSignInButtons`](./SocialSignInButtons.tsx)
 * and [`LinkedIdentities`](./LinkedIdentities.tsx) — and neither is the natural owner of the other's
 * wording. It is **not** in `shared/types/socialProvider.ts` with the ids: the server never renders
 * anything, and a display name in the Kernel is presentation smuggled into a rule.
 *
 * Capitalised as each company writes its own name, which is the only correct answer here.
 *
 * **Validates: v3 Req 31.9**
 */

import { SOCIAL_PROVIDER, type SocialProvider } from '#shared/types/socialProvider';

/** The name a person recognises */
export const PROVIDER_LABEL: Record<SocialProvider, string> = {
  [SOCIAL_PROVIDER.GOOGLE]: 'Google',
  [SOCIAL_PROVIDER.DISCORD]: 'Discord',
};
