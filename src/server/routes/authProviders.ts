/**
 * `GET /api/auth-providers` — which sign-in buttons to draw (TICKET-AUTH-02)
 *
 * The client cannot know whether an operator configured Google, Discord, both or neither: those are
 * server-side variables, and a button for a provider that is not configured is a button that fails
 * (v3 Req 31.6). So the server says, and it says **names only** — a provider id is public the
 * moment its button is on the page, and no client secret is anywhere near this response.
 *
 * **It is deliberately outside `/api/auth`.** That whole subtree is delegated to Better Auth before
 * the route table is consulted (see [`apiRouter.ts`](../http/apiRouter.ts)), so a path under it
 * would never reach here — it would 404 from the library instead, which is a confusing way to
 * discover a naming collision.
 *
 * **Public, and correctly so.** There is nothing to authorize: an anonymous visitor is exactly who
 * needs this answer, because they are the one looking at the sign-in page.
 *
 * **Validates: v3 Req 31.6, 31.8**
 */

import type { SocialProvider } from '#shared/types/socialProvider';
import { configuredSocialProviders } from '../auth/socialProviders';
import { serverEnv } from '../env';
import { defineHandler } from '../http/pipeline';

/** What `/api/auth-providers` reports — local, like `health.ts`'s: nothing imports a route's shape */
interface AuthProvidersReport {
  /** The configured providers, in offer order; empty when the deployment has none */
  providers: SocialProvider[];
}

export const authProviders = defineHandler(
  (): AuthProvidersReport => ({ providers: configuredSocialProviders(serverEnv()) })
);
