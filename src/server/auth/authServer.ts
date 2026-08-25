/**
 * Better Auth, configured (TICKET-AUTH-01)
 *
 * The library answers exactly one question — *who is this* — and it was chosen
 * ([D3](../../../docs/v3.0_backend/overview.md#d3--authentication-through-better-auth)) because
 * password hashing, cookie signing, CSRF and the OAuth flows AUTH-02 needs are security-sensitive
 * code this milestone should not be writing by hand. **Authorization is not its job**: who may
 * touch which ruleset is v3 Req 32, it lives in `src/server/`, and no library decides it.
 *
 * ## What is deliberately switched off
 *
 * **Every mail-dependent flow.** `requireEmailVerification` is false and no `sendResetPassword` is
 * configured, so Better Auth's reset route refuses rather than silently doing nothing
 * ([D12](../../../docs/v3.0_backend/overview.md#d12--no-outbound-email-at-all)). The consequence —
 * a password-only Account cannot be recovered — is stated to the visitor at sign-up rather than
 * discovered later (v3 Req 30.10).
 *
 * **Better Auth's own limiter on `/sign-in/email`, and only there.** It keys on IP and path, which
 * is right against a flood and useless against what v3 Req 30.7 names — guessing *one person's*
 * password, which nobody does from a single address. [`signInRateLimit.ts`](./signInRateLimit.ts)
 * owns that path instead. **Everything else keeps the library's limiter**, because turning it off
 * wholesale would leave sign-up, password reset and every AUTH-02 OAuth route with no flood
 * protection at all in production, where its default is on.
 *
 * ## What is deliberately not configured
 *
 * **No `baseURL`.** The server hosts the client bundle, so every request is same-origin and the
 * origin is whatever the request arrived on
 * ([D1](../../../docs/v3.0_backend/overview.md#d1--the-backend-lives-in-this-repo-on-tanstack-start)).
 * A variable naming it would be a variable someone eventually points elsewhere (v3 Req 47.7), and
 * for the same reason there is no CORS layer and no `trustedOrigins` list.
 *
 * **Validates: v3 Req 30.1, 30.3, 30.4, 30.5, 30.9, 48.1**
 */

import { betterAuth } from 'better-auth';
import { authDatabaseAdapter, currentDatabaseKey } from '../db/authAdapter';
import { serverEnv } from '../env';
import { AUTH_PREFIX, SIGN_IN_ROUTE } from './paths';

/**
 * Build an instance against the current database
 *
 * @returns A configured Better Auth
 */
function build() {
  const env = serverEnv();

  return betterAuth({
    database: authDatabaseAdapter(),
    basePath: AUTH_PREFIX,
    // Passed rather than left to Better Auth's own environment read of `BETTER_AUTH_SECRET`:
    // `env.ts` is the only module in `src/` that reads the environment, and `env.test.ts` walks
    // the tree to keep it that way — by grep, which is why this comment does not spell the
    // expression out
    secret: env.authSecret,
    emailAndPassword: {
      enabled: true,
      // D12. Leaving this true would gate every sign-in behind an email nobody can send
      requireEmailVerification: false,
      // Better Auth's default, stated rather than inherited — a minimum this low is a decision
      minPasswordLength: 8,
    },
    session: {
      // A number from the environment rather than a literal, so TICKET-AUTH-04 changes values and
      // adds rotation rather than changing the shape (v3 Req 48.2)
      expiresIn: env.authSessionSeconds,
    },
    advanced: {
      // The cookie has an explicit expiry and so outlives the browser process (v3 Req 48.1);
      // `httpOnly` and `sameSite: lax` are Better Auth's defaults and are what Req 30.4 asks for.
      // `Secure` is on in production and off in development, because a dev server is plain HTTP
      // and a Secure cookie there is a cookie the browser silently drops.
      useSecureCookies: env.nodeEnv === 'production',
    },
    rateLimit: {
      // On everywhere, not only in production, which is the library's own default. The one path
      // carved out is the one `signInRateLimit.ts` owns: `false` makes the library skip it
      // entirely, so the two limiters answer two different threats rather than racing — and a
      // failing sign-in test cannot depend on which fired first. Better Auth's default rule for
      // `/sign-in*` is 3 requests per 10 seconds, which would otherwise refuse the fourth attempt
      // before our own fifth, and the tests would be asserting the wrong limiter.
      enabled: true,
      customRules: { [SIGN_IN_ROUTE]: false },
    },
  });
}

/**
 * Better Auth's instance type, inferred from {@link build} rather than restated
 *
 * `ReturnType<typeof betterAuth>` would be the *unnarrowed* `Auth<BetterAuthOptions>`, which the
 * configured instance is not assignable to — the library threads the options object through its own
 * type. Taking it from the builder means the type is whatever we actually configured.
 */
export type AuthServer = ReturnType<typeof build>;

/** One instance per distinct database — see {@link currentDatabaseKey} for why that is the key */
let cached: { key: object; auth: AuthServer } | null = null;

/**
 * The process's Better Auth
 *
 * Rebuilt when the database underneath it changes, which in production never happens and in a test
 * happens once per `withTestDatabase`. Without that, every test's sign-up would land in whichever
 * database was open when this module was first imported.
 *
 * @returns The configured instance
 */
export function authServer(): AuthServer {
  const key = currentDatabaseKey();
  if (cached?.key !== key) cached = { key, auth: build() };
  return cached.auth;
}
