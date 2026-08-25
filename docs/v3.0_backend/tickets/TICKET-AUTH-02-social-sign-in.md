# TICKET-AUTH-02 — Social sign-in: Google and Discord

- **Area:** Accounts
- **Type:** Feature
- **Traceability:** v3 [Req 31](../requirements.md#requirement-31-social-sign-in-google-and-discord);
  overview [D12](../overview.md#d12--no-outbound-email-at-all)

## User story

As a visitor, I want to sign in with Google or Discord, so that I do not have to manage another
password for a game I play once a fortnight — and so that the identity I bring to my group's table
is the one they already know me by.

## Description

Two OAuth providers on AUTH-01's Better Auth instance, plus the one rule that is genuinely ours to
decide: what happens when a provider profile's email already has an Account.

**Discord earns its place on the same argument the whole milestone rests on** — this is software for
a group of people who play together, and that group is very often already a Discord server. Being
able to sign in as the person your table knows is worth more here than a second generic OAuth button
would be.

## Current situation (as-is)

- AUTH-01 gave us accounts, Auth_Sessions and the sign-in surface, with email/password only.
- SRV-01's env loader already fails at start-up on missing **required** variables — these are the
  first *optional* ones it carries, and there are now two independent pairs of them.
- **There is no password reset** ([D12](../overview.md#d12--no-outbound-email-at-all)), which makes
  this ticket the only account-recovery mechanism the milestone has, not a convenience.

## Desired result (to-be)

- Both providers configured with the authorization-code flow and PKCE, secrets read only through
  `src/server/env.ts` and never reaching the client bundle — and each **independently optional**, so
  either, both, or neither may be configured.
- One provider-agnostic path for the identity rules: a first social sign-in creates an Account from
  the **verified** provider email and display name; an unverified or absent email is refused; a
  verified email matching an existing Account **links** to it rather than creating a second; a
  provider identity already bound elsewhere is refused.
- "Continue with Google" and "Continue with Discord" on the sign-in and sign-up surfaces, each
  present only when that provider is configured, plus a linked-identities view where a signed-in
  Account can add the provider it does not yet have.

## Acceptance criteria

- [x] A first sign-in through **either** provider creates exactly one Account with the profile's
      email and name. (`src/server/auth/socialSignIn.test.ts` — *creates exactly one Account from
      the verified profile*, run by `describe.each` for both providers against a real migrated
      database: one `user` row carrying the email and `Ada Lovelace`, one `account` row bound to the
      provider's own subject id. *Signs the same Account back in on a second visit* holds the count
      at one.)
- [x] A provider profile whose verified email matches an existing password Account links to it —
      signing in either way afterwards reaches the same Account and the same rulesets (v3 Req 31.3).
      (`socialSignIn.test.ts` — *links onto an existing password Account with the same address*: one
      `user` row, two `account` rows (`credential` + the provider), both on that one user id. This
      needed `accountLinking.requireLocalEmailVerified: false` in
      [`authServer.ts`](../../../src/server/auth/authServer.ts) — the library defaults to demanding
      a *verified local* address, and D12 means no password Account ever has one, so the criterion
      was unreachable without it. The trust that check stands in for comes from the provider's own
      verified flag, which `identityRules.ts` refuses without.)
- [x] One Account holds **both** identities: signing in with Google, then linking Discord, then
      signing in with Discord reaches the same Account (v3 Req 31.5). (`socialSignIn.test.ts` —
      *signs in with Google, links Discord, and signs in with Discord to the same Account*: one
      `user` row and `['discord', 'google']` on it, driven through the real `/link-social` and
      callback routes.)
- [x] A provider identity already bound to a different Account is refused rather than moved.
      (`socialSignIn.test.ts` — *is refused rather than moved*: Ada owns a Google identity, the
      profile then arrives claiming Grace's address while carrying Ada's subject id — the shape a
      takeover would have — and the link is refused with the `account` row still pointing at Ada.
      Note recorded while building: the plain "different email" case is refused one door earlier by
      `LINKING_DIFFERENT_EMAILS_NOT_ALLOWED`, and two Accounts cannot share an email, so a *moved
      profile email* is the only way to reach the already-linked guard at all.)
- [x] A profile with an unverified email, and one carrying no email at all, are each refused with no
      Account and no link created (v3 Req 31.4). (`socialSignIn.test.ts` — *refuses an unverified
      address* and *refuses a profile with no email at all*, both asserting zero `user` and zero
      `account` rows, plus *refuses to link an unverified address onto an Account that already
      exists*, which leaves only the `credential` row. The create-user half is **ours**: Better
      Auth's own unverified check fires only when linking onto an existing user, so an unverified
      profile would otherwise have created a fresh Account.)
- [x] Every rule above is asserted **once per provider** against a shared implementation — a test
      that runs the same table for both, so the two cannot diverge (v3 Req 31.7).
      (`src/server/auth/identityRules.test.ts` runs `describe.each(SOCIAL_PROVIDERS)` over the pure
      rule; `socialSignIn.test.ts` runs the same shape end to end, also `describe.each`. The
      implementation is one function, reached through Better Auth's single `user.validateUserInfo`
      gate — called before `create-user`, before `link-account` and on every provider `sign-in`,
      for every provider — so there is no per-provider branch to diverge.)
- [x] With neither provider's credentials set the server starts, both buttons are absent, and every
      email/password test still passes; with exactly one set, only that button appears and the other
      provider's absence changes nothing (v3 Req 31.6). (Server: `apiRouter.test.ts` — *reports no
      providers when the deployment has configured none* — runs in a file that sets no OAuth
      variables, and `auth.test.ts`'s 25 email/password cases are **unchanged**. Environment:
      `env.test.ts` — *leaves the other provider off when only %s is configured*, both directions.
      Client: `SocialSignInButtons.test.tsx` — *should render nothing when the deployment configured
      no provider* and *should offer only %s when only it is configured*; `AuthForm.test.tsx` asserts
      both surfaces either way. Browser, 2026-08-25: with an empty `.env` the sign-in card is
      AUTH-01's unchanged and `/api/auth-providers` returns `{"providers":[]}`; with only
      `GOOGLE_*` set, `/signup` shows *Continue with Google* and no Discord button.)
- [x] Neither client secret appears in any client-side module — covered by SRV-01's server-only
      boundary test for the env module. (Both pairs are read only in
      [`env.ts`](../../../src/server/env.ts); `env.test.ts` — *is the only reader of process.env in
      src/* still names that one file, and `yarn run arch` reports no boundary violation, so no
      `client/` module can reach it. The one thing that crosses to the browser is
      `/api/auth-providers`, which returns provider **names**.)
- [x] `.env.example` documents both pairs as optional, with the redirect URI each provider must have
      registered. (New *Social sign-in* section naming `AUTH_ALLOWED_HOSTS` and the four credential
      variables, with `<your origin>/api/auth/callback/{google,discord}` as the redirect URIs.
      Written as a path with a placeholder origin rather than a URL, because `env.test.ts` — *names
      no origin* — forbids a literal one, and the origin genuinely is whatever the deployment
      answers on.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check (ask the User first). (`verifier`: 2115 passing / 0 failing / 0
      skipped, +75 over AUTH-01, typecheck at the documented 2-error baseline, `yarn run lint` and
      `yarn run arch` clean. `conventions-reviewer` raised nine findings, none a defect and the
      serious ones all *third-instance* calls — acted on: `AuthAlert` extracted from three
      hand-written copies, `AuthForm.style.ts` → `authSurfaces.style.ts` (three modules were
      importing a fourth's stylesheet), `SignedOutNotice` extracted from `routes/account.tsx`, the
      single-caller `callbackURL` prop dropped, `AccountBadge`'s new `/account` link given the test
      that would have caught a wrong `to`, a bare `'production'` converted to `NODE_ENV.PRODUCTION`,
      the SSO branch restored to the identity adapter, and a comment of mine corrected: what keeps
      `socialSignIn.test.ts`'s `process.env` writes out of the other files is Vitest's *process*
      isolation, not its module registry. One finding was declined — a shared constant for
      `/api/auth-providers`, spelled on both sides of the boundary; the same drift already exists for
      `/api/auth`, and the right fix is one shared api-path module once RUL-01 brings several paths,
      not a module for one. `fallow audit --base main` found one introduced finding — an unused
      `AuthProvidersReport` type export — deleted in this change; no complexity finding on anything
      added, and `src/server/http/apiRouter.ts` came back Accelerating and is recorded in
      TEST_STATUS.md's hotspot table. Browser check: done, and covering what is checkable without
      real provider credentials — see criterion 7. **A genuine OAuth round trip is not verified**;
      it needs registered Google/Discord clients, and the flow is instead driven end to end in
      `socialSignIn.test.ts` against stubbed provider endpoints.)

## Notes

- **Linking on matching email is a deliberate trust decision**, and it rests entirely on the provider
  having verified the address — which is why 31.4 refuses an unverified one. Without that check,
  anyone able to set an arbitrary unverified email on a provider account could claim a password
  Account. Do not relax it for either provider. **Discord's `verified` flag is the one to read**, and
  a Discord profile can in principle carry no email at all, which 31.4 covers explicitly.
- The reverse direction — a password sign-up on an email that already has a social identity — is
  AUTH-01's 30.2 refusal, and it stays a refusal rather than a link, because we cannot verify the
  person typing the password owns the address.
- **This is the milestone's only account recovery.** D12 removed password reset, so an Account with
  no linked identity and a forgotten password is gone. That is why AUTH-01's sign-up points here, and
  why the linked-identities view is in this ticket rather than deferred to an account-settings page
  nobody has scheduled.
- **This ticket has to settle `baseURL`, and it is a real tension with D1** (found while building
  AUTH-01, recorded here rather than rediscovered). Better Auth is configured with **no `baseURL`**,
  because D1 forbids a variable naming the backend — and it logs
  `Base URL is not set … Without it the origin is derived from the incoming request, and callbacks
  and redirects may not work correctly` on every start. For email/password that warning is
  harmless and AUTH-01's tests prove it: there are no callbacks. **OAuth is exactly the case it
  warns about.** A redirect URI has to be absolute, has to match what is registered with Google and
  Discord, and deriving it from the request `Host` header means an attacker-controlled header can
  steer a callback.

  The option to reach for is Better Auth's **dynamic `baseURL` with `allowedHosts`**, which is not
  the thing D1 rules out: it does not name *a backend to talk to*, it names which hosts this
  deployment answers on — the same kind of statement as a certificate's subject. Whatever is
  decided, decide it here and write it into D1 as a follow-on note, rather than leaving AUTH-01's
  silence to be read as a decision.

  > **Settled: `AUTH_ALLOWED_HOSTS`, and it is optional until a provider exists.** Better Auth's
  > dynamic `baseURL` with `allowedHosts`, fed from a comma-separated list of the hostnames this
  > deployment answers on. It is not the thing D1 rules out — it names *this* server rather than one
  > to talk to, the way a certificate's subject does — and it is what stops a forged `Host` header
  > steering an OAuth callback. With no provider configured the list is empty, the option is not
  > passed, and the behaviour is AUTH-01's unchanged; configure a provider without it and the server
  > **refuses to start**, naming the variable. Written into
  > [D1](../overview.md#d1--the-backend-lives-in-this-repo-on-tanstack-start) as a follow-on note.

- **A second conditional refusal came out of building this, and it is worth keeping**: half a
  credential pair — an id with no secret, or the reverse — is a start-up failure naming the missing
  half rather than a silently disabled provider. Silently ignoring one set variable is how an
  operator ends up staring at an absent button with the id right there in their `.env`.
- **Resist a provider registry.** Two providers configured side by side is data; an abstraction for
  *n* providers is a framework, and Better Auth already owns that layer. What must be shared is the
  identity-rule path (31.7), not a plugin system.
- Testing OAuth means stubbing each provider's token and profile endpoints. Put the stub in DX-06's
  fixtures, parameterised by provider, so the shared-rule test in the sixth criterion is one table
  rather than two files.
