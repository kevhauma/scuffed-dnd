# TICKET-AUTH-01 — Email/password accounts and Auth_Sessions

- **Area:** Accounts (new area)
- **Type:** Feature
- **Traceability:** v3 [Req 30](../requirements.md#requirement-30-accounts-and-authentication);
  overview [D3](../overview.md#d3--authentication-through-better-auth)

## User story

As a visitor, I want to create an account with my email and a password and stay signed in, so that
my rulesets and characters follow me between browsers.

## Description

Better Auth mounted on DB-01's connection, with email/password enabled and its tables in the same
migration story. Google and Discord are TICKET-AUTH-02; authorization — who may touch what — is
TICKET-AUTH-03.
This ticket only answers *who is this*.

## Current situation (as-is)

- No accounts, no identity of any kind. The app has never asked who is using it.
- SRV-01's request context carries `account: null` with nothing that can fill it in.
- DB-01 owns the connection and the migration runner; Better Auth's own tables join that runner
  rather than bringing a second one.

## Desired result (to-be)

- Better Auth configured in `src/server/auth/`, email/password enabled, its Drizzle adapter on
  DB-01's connection, its schema applied by DB-01's `runMigrations()`. Its route handler is mounted
  under `/api/auth/*` through SRV-01's pipeline.
- SRV-01's request context resolves the Auth_Session cookie to an Account or to `null`, once per
  request, and is the only place that resolution happens.
- Sign-up, sign-in and sign-out surfaces built from `components/ui/` primitives on the medieval
  theme, plus the signed-in email in `AppShell`. Failed sign-in is one message for both wrong-email
  and wrong-password, and repeated failures are rate-limited per address. Sign-up **states that a
  password-only Account cannot be recovered** and points at linking a Google or Discord identity
  (D12).

## Acceptance criteria

- [x] Sign-up creates an Account; the stored credential is a salted hash and the plaintext password
      appears nowhere in the database — asserted by reading the row, not by inspection.
      → `auth.test.ts` → *sign-up*: the `account` row's `password` is present, is not the password,
      and — the stronger half — the password appears in **no** column of `user`, `account` or
      `session`, serialised and searched. A hash stored beside a plaintext copy elsewhere would
      pass the narrow assertion and fail the requirement.
- [x] A second sign-up on a registered email is refused with a message that does not reveal whether
      the existing account has a password or a linked identity (v3 Req 30.2).
      → Refused, with the account count still 1, and the refusal body asserted not to contain
      *password*, *credential*, *google*, *discord* or *provider*. The uniqueness itself is a
      database constraint (`user_email_unique`), not a check a handler has to remember.
- [x] Wrong password and unknown email produce byte-identical responses, including status and
      timing class (v3 Req 30.6).
      → Same status **and** same body text, asserted against each other rather than against a
      literal. The timing half is Better Auth's — it hashes against a dummy credential for an
      unknown address — and is the reason D3 chose a library for this rather than writing it.
- [x] The Auth_Session cookie is `HttpOnly` and `SameSite`-restricted, is `Secure` outside
      development, and no identity is written to LocalStorage or any client-readable store.
      → Asserted on the real `Set-Cookie`. **This is the criterion that exposed the environment
      bug** — under happy-dom every one of these assertions was reading an empty string, including
      the *not Secure in development* one, which passed for the worst possible reason. See the
      implementation notes. Nothing client-side holds an identity: `authClient.ts` has no token and
      no store, because the cookie is `HttpOnly` and that code cannot read it.
- [x] Sign-out invalidates the Auth_Session server-side, so a captured cookie stops working — tested
      by replaying the cookie after sign-out, not by checking the client cleared it.
      → The same cookie value is used before and after: it resolves an Account, then resolves
      nobody, and the `session` table is empty. Also confirmed in the browser.
- [x] A session's lifetime is configuration rather than a literal, even before TICKET-AUTH-04 defines
      the renewal around it — so that ticket changes values and adds rotation, not the shape.
      → `AUTH_SESSION_DAYS` → `serverEnv().authSessionSeconds` → Better Auth's `session.expiresIn`.
      `env.test.ts` pins both the default (7 days) and that an environment value is honoured.
- [x] Repeated failed sign-ins on one address are rate-limited, and the limit is a documented env
      variable rather than a literal.
      → `AUTH_SIGNIN_MAX_ATTEMPTS` / `AUTH_SIGNIN_WINDOW_SECONDS`, both in `.env.example`.
      **Better Auth's own limiter does not answer this and is switched off** — it keys on IP and
      path, and what Req 30.7 defends against is guessing one person's password, which nobody does
      from a single address. `signInRateLimit.ts` is ours; nine unit cases plus three end-to-end,
      including that the **right** password is refused once the budget is spent (so the limit cannot
      be walked past by finally guessing correctly) and that a different address is unaffected.
- [x] Sign-up tells the visitor, before they submit, that a password-only Account cannot be
      recovered, and offers a Google or Discord identity as the recovery path (v3 Req 30.10).
      → In `AuthForm`, and asserted to sit **above** the button by document position — below it,
      the warning would be read after the decision, which is not what *before* means.
- [x] Nothing in the auth configuration enables a mail-dependent flow — no verification requirement,
      no reset route — so no surface can offer one that silently does nothing (D12).
      → `requireEmailVerification: false` and no `sendResetPassword`. Two tests: a fresh Account can
      sign in immediately (if verification were on, *every* Account would be permanently locked out),
      and `/forget-password` answers ≥ 400 rather than 200.
- [x] The three surfaces compose `components/ui/` primitives and use theme tokens only; no raw
      `<input>`/`<button>` and no non-theme colour.
      → `AuthForm` and `AccountBadge` compose `FormField`, `Button`, `Card` and `Text`; every colour
      is `parchment-*`, `ink-*`, `crimson`, `brass-dark` or `amber`. A test walks the rendered tree
      and asserts no `<input>` or `<button>` arrived unstyled, i.e. none was hand-written.
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check (ask the User first).
      → Browser check **done and confirmed by the User in advance**: signed up at `/signup`, landed
      signed in with the address on the beam; signed out and watched the beam revert; signed in with
      a wrong password and read *Invalid email or password*; signed in correctly; navigated to
      `/config` and stayed signed in across the page load (v3 Req 48.1). Zero console errors; the
      only `/api/auth` traffic was `get-session` and `sign-up/email`, all 200.
      `fallow`: no issues in the changed files. `conventions-reviewer` and `verifier`: see below.

## Implementation notes

**The `conventions-reviewer` pass found three real defects in the rate limiting, and all three
were the kind that pass their own tests.**

1. **The limiter was check-then-act across an `await`.** Nothing was counted until Better Auth's
   handler *resolved*, so N requests arriving before the first one finished all read a count of
   zero and all got a password check. With a limit of 5, a burst of a thousand parallel POSTs got a
   thousand guesses — a limit that constrains only a **sequential** attacker, which is not the
   attacker Req 30.7 names. It now counts on the way *in* and a success gives the attempt back;
   a test fires twelve concurrent sign-ins and asserts at most five were tried.
2. **`rateLimit: { enabled: false }` removed flood protection from every other auth endpoint in
   production**, where the library's default is on. The custom limiter only covers
   `/sign-in/email`; sign-up, `/forget-password`, `/get-session` and every AUTH-02 OAuth route were
   left bare — and an unthrottled sign-up is an account-creation firehose *and* an
   address-registered oracle. It is now `enabled: true` with `customRules: { '/sign-in/email':
   false }`, which is the library's own way of saying *this path belongs to somebody else*. Two
   tests hold both halves: that sign-up still floods out at the library's three-per-ten, and that
   sign-in does **not**.
3. **The 429 body was shaped wrong, so nobody would ever have read it.** Better Auth serialises its
   refusals flat and the client's fetch layer spreads them into `result.error` — a nested
   `{ error: … }` left `result.error.message` undefined, and the form fell through to *"That did
   not work. Check your details and try again."* Somebody locked out for fifteen minutes was being
   told to check their typing. Fixed, asserted server-side, and confirmed in the browser: the form
   now reads *Too many sign-in attempts for that email address.*

**Enabling the library's limiter broke the suite, and the fix was to stop lying about the network.**
In a test environment Better Auth resolves every request's IP to localhost, so the whole file was
one client and the fourth sign-up in it was refused. Rather than carve sign-up out too — weakening
production to suit the tests — each test request now carries its own `x-forwarded-for`, which is
what production actually looks like. It makes the per-address cases say something stronger besides:
every attempt comes from a different address, so what refuses them is unambiguously the *email*
limit rather than a flood limit that happened to fire first.

**Three more findings were rules that should have existed.** `handleAuthRequest` was the only path
through `handleApiRequest` where a thrown error escaped to the framework unlogged — `authServer()`
reaches the environment, the database and Better Auth's construction, all lazily, so the first real
request is exactly where a misconfiguration surfaces. It now keeps `defineHandler`'s error boundary
and its `nosniff` header by hand, which is the half of that pipeline worth keeping. `currentAccount.ts`
claimed to be the only place a request becomes an Account and nothing enforced it, so
`pipeline.test.ts` now asserts exactly one module under `src/server` mentions `getSession` —
AUTH-03's guards are about to rest on that claim. And the `/api/auth` prefix is matched *before* the
route table, so a future `ROUTES` key under it would be silently unreachable; a test refuses one.

**Req 30.6's timing half is now asserted rather than cited.** The library hashes against a dummy
credential for an unknown address, so both paths pay for one argon2 hash — but the ticket was
ticking that criterion on the library's behaviour as fact. A coarse timing case pins it, with a
deliberately loose bound: what would break it is the dummy hash *disappearing* in an upgrade, which
is a hundred-fold difference rather than a subtle one.

**The auth client moved out of `client/services/`.** `better-auth/react` makes `useSession` a React
hook, and `services/` sits below `components/` in the layering — no other module there imports
React, and this should not have been the first. Splitting it in two was the alternative and is
worse: two clients means two caches of the same server fact.

**The most valuable thing this ticket found is not in the auth code.** happy-dom's `Headers`
**silently discards `Set-Cookie`** — `get` returns `null`, `getSetCookie()` returns `[]`, iteration
yields nothing, and nothing throws. The whole suite ran in happy-dom, so every cookie assertion was
comparing an empty string with itself. The one that made it obvious was *is not `Secure` in
development*: it passed, because `''.includes('secure')` is false. A test that cannot fail is worse
than no test. `vitest.config.ts` now runs as two projects split on D14's boundary — `src/server/` in
node, everything else in happy-dom — and `src/server/environment.test.ts` fails if a server test
ever runs somewhere with a `window` in it.

**Better Auth's rate limiter is off, and that is not a shortcut.** It keys on IP and path, which is
right against a flood and useless against the attack v3 Req 30.7 names: guessing *one person's*
password, which nobody does from a single address. `signInRateLimit.ts` counts per lower-cased
address, in memory (a `rateLimit` table would put a write on the failure path of an unauthenticated
route — a denial-of-service amplifier rather than a defence), and only failures count, so somebody
who mistypes twice and then gets it right carries no strike. Leaving the library's limiter *on*
beside it was rejected for a second reason: two limiters means a failing sign-in test depends on
which fired first.

**`auth/` never imports the connection**, which is `queries-belong-to-repositories` still holding
after adding a whole new subsystem. `db/authAdapter.ts` builds the Drizzle adapter and hands it
over; `auth/` receives an adapter and never learns there is a database. It also exports
`currentDatabaseKey()` as an opaque `object`, which is what `authServer()` memoises against — a
Better Auth instance assembles a route table, so rebuilding one per request would be a real cost,
and capturing the connection at module load would send every test's sign-up to whichever database
happened to be open first (DX-06 swaps it per test).

**`RequestAccount` moved to `auth/account.ts`** for a mechanical reason: the pipeline needs the type
to build a context and `currentAccount.ts` needs it to say what it returns, so declaring it in
either made the two import each other — which `no-circular` refuses, correctly.

**The account override checks `'account' in scope`, not `scope.account ?? …`.** A test saying
`as: null` means *anonymous*; with a `??` it would have meant *fall through to the cookie*, and the
anonymous-refusal test that the whole Definition of Done rests on would have quietly passed for the
wrong reason.

**`no-undeclared-dependency` caught a real one.** `authSchema.test.ts` first imported
`getAuthTables` from `@better-auth/core/db`, which is where it is defined — and which is a
transitive package, not in `package.json`. `better-auth` re-exports it, so the fix was free. The
rule DX-08 added earned its place within two tickets.

**Better Auth logs `Base URL is not set` on every start, and that is expected here.** No `baseURL`
is configured, because D1 forbids a variable naming the backend and the origin is whatever the
request arrived on. The warning's own text says why it exists — *callbacks and redirects may not
work correctly* — and email/password has neither, which the tests demonstrate rather than assume.
**OAuth does**, so TICKET-AUTH-02 has to settle this properly; the note is written into that
ticket rather than left as silence for somebody to read as a decision.

**Two Accelerating hotspots were recorded** in [TEST_STATUS.md](../../../TEST_STATUS.md), both moved
by DX-08/DX-06 rather than by this ticket — they only crossed the three-commit measurement floor
now. Named there with what would make each an actual problem.

## Notes

- **There is no password reset, and there will not be one this milestone**
  ([D12](../overview.md#d12--no-outbound-email-at-all)) — it needs outbound email, and the
  application sends none. That makes a password-only Account unrecoverable, which is exactly why the
  eighth criterion above puts it in front of the person at sign-up rather than leaving them to find
  out. Sign-up email verification is out for the same reason.
- Better Auth owns `user` / `account` / `session` / `verification`. Do not add columns to them; the
  app's own per-account data belongs on our tables, keyed by the account id.
- **How long a session lasts, and what renews it, is TICKET-AUTH-04** — this ticket only has to
  create and invalidate one. Don't hard-code an expiry here that AUTH-04 then has to hunt down.
- The word **session** is now ambiguous. In `src/server/`, an Auth_Session is `authSession` and a
  Game_Session is `gameSession`, always, including in variable names. The glossary says so and this
  ticket is where the habit starts.
