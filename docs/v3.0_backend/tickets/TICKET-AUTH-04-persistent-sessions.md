# TICKET-AUTH-04 — Persistent sessions with rolling renewal

- **Area:** Accounts
- **Type:** Feature
- **Traceability:** v3
  [Req 48](../requirements.md#requirement-48-session-persistence-and-renewal),
  [Req 30.4, 30.5](../requirements.md#requirement-30-accounts-and-authentication); overview
  [D13](../overview.md#d13--sessions-are-long-lived-and-rolling-not-an-accessrefresh-pair)

## User story

As an account holder, I want to stay signed in when I close the tab and come back tomorrow, so that
sitting down to play does not start with typing a password.

## Description

Closes the gap AUTH-01 left: it issues an Auth_Session but says nothing about how long one lives or
what renews it. This ticket makes the cookie outlive the browser process, renews it on use, bounds
it absolutely, and gives an Account a way to see and revoke what it holds.

**It is a cookie with rolling renewal, not an access/refresh token pair** — see
[D13](../overview.md#d13--sessions-are-long-lived-and-rolling-not-an-accessrefresh-pair) for why,
and criterion 8 below for what happens to the Providers' own refresh tokens.

## Current situation (as-is)

- AUTH-01 issues an `HttpOnly`, `SameSite`-restricted Auth_Session cookie and invalidates it
  server-side on sign-out — proven by replaying the cookie afterwards. What it does **not** define
  is expiry, renewal, or what happens when a session ages out mid-use.
- AUTH-02 links Google and Discord identities. Better Auth stores each provider's tokens on its
  `account` table by default, including refresh tokens this application has no use for.
- AUTH-03 redirects an unauthenticated visitor from a protected route and returns them afterwards —
  the behaviour an expiry-mid-session must reuse rather than reimplement.
- SRV-01's env loader is the only reader of `process.env` and already carries optional pairs, so two
  more lifetime values follow an established shape.

## Desired result (to-be)

- Two configured lifetimes and the renewal between them: an **idle lifetime** that a use extends,
  and an **absolute lifetime** that no amount of activity extends past. Renewal happens server-side
  on a request the User was making anyway, rotating the session identifier and invalidating the
  previous one, and the cookie carries an explicit expiry so it survives closing the browser.
- Revocation that renewal cannot undo: sign-out kills one, an Account can kill **all** of them, and
  an active-sessions list shows enough to recognise each. Provider refresh tokens are **not stored**
  — nothing here calls a Provider API.
- The client restores signed-in state on load with no signed-out flash, presents a mid-session expiry
  as an expired session routed through AUTH-03's return-to-destination redirect, and offers a
  browser-lifetime session at sign-in for someone on a device that is not theirs.

## Acceptance criteria

- [x] Closing the browser entirely and reopening it leaves the Account signed in — verified against
      the cookie's persisted expiry, not just within one tab. (`src/server/auth/session.test.ts` —
      *carries an expiry, so closing the browser does not sign you out*, asserted on the
      `Set-Cookie` header rather than on the configuration that produces it: a cookie with neither
      `Max-Age` nor `Expires` is a *session* cookie the browser drops on exit. A literal
      close-and-reopen is not something the in-app browser can do, so the persisted-expiry
      assertion is the proof; the browser confirmed the session survives full document reloads.)
- [x] A session used inside its idle lifetime is renewed and keeps working past the original idle
      expiry; one left unused past it is refused. (`session.test.ts` — *renews a session used inside
      its window…* and *refuses one left unused past its idle window*, both by driving
      `vi.useFakeTimers({ toFake: ['Date'] })` through the real Better Auth handler. Only `Date` is
      faked; faking timers too would suspend the promises the file awaits.)
- [x] A session is refused past its **absolute** lifetime no matter how continuously it was used —
      asserted by driving the clock, so "renew forever" cannot pass. (`session.test.ts` — *refuses a
      session past its ceiling however continuously it was used*: used every twenty days, well
      inside a thirty-day idle window, so nothing ages out — and refused on day 91. Plus *measures
      the ceiling from the first sign-in* and *never renews past the ceiling, even on the last day*.
      **The mechanism is one line**: renewal writes `min(now + idle, createdAt + absolute)`, which
      makes the ceiling an ordinary expiry the library already refuses everywhere — see
      [`sessionLifetime.ts`](../../../src/server/auth/sessionLifetime.ts).)
- [x] Renewal rotates the identifier: the pre-renewal cookie stops working ~~immediately~~ **once
      its grace window closes** afterwards.

      > **Amended 2026-08-25, with the User's decision.** This criterion and the ticket's own third
      > note contradicted each other — the note asks that two tabs renewing at once must not
      > invalidate each other, and names a grace period as the answer. The note is right, and the
      > hazard is real rather than theoretical: Better Auth *deletes the cookie* when a token it does
      > not recognise arrives, so the losing side of a two-tab race signs **every** tab out. The
      > previous identifier now stays resolvable for `AUTH_SESSION_GRACE_SECONDS` (30 by default) —
      > seconds against an absolute lifetime of months.

      (`session.test.ts` — *replaces the identifier on renewal*, *hands the browser the new
      identifier*, *keeps the previous identifier working for the grace window*, *stops honouring
      the previous identifier once the window closes*, and *survives two requests renewing in the
      same instant*.)
- [x] Sign-out, and "sign out everywhere", each invalidate; a renewal attempt with an invalidated
      cookie is refused rather than reviving it. (`session.test.ts` — *invalidates on sign-out, and
      renewal cannot resurrect it* and *signs out everywhere when asked*, the second asserting the
      table is empty rather than that two cookies stopped working. **A third case came out of
      review and pins a real defect**: *signs out by the cookie that was presented, even after a
      rotation*. Better Auth deletes by the token the **cookie** carried, not the one it resolved
      to — and inside the grace window those differ — so signing out after a rotation deleted
      nothing at all. The cookie was cleared, the person believed they had signed out, and the row
      stayed live for whoever held the current identifier.)
- [x] The active-sessions list shows an Account its own sessions only, and revoking one leaves the
      others working. (`session.test.ts` — *lists an Account its own sessions*, *shows one Account
      nothing of another's*, *revokes one session and leaves the others working*.
      `ActiveSessions.test.tsx` covers the card, including that the **current** session is listed
      and labelled rather than hidden — a list that quietly omits it is one whose count does not
      match the server's. Browser, 2026-08-25: three sessions listed, ending one left the others
      signed in, *Sign out everywhere* ended all of them and landed on `/`.)
- [x] No Provider refresh token is persisted — asserted by reading the `account` row after a Google
      and a Discord sign-in (v3 Req 48.10). (`src/server/auth/socialSignIn.test.ts` — *keeps no
      Provider refresh token*, inside the `describe.each` so it runs once per provider, reading the
      stored row rather than trusting the configuration. Dropped by a
      `databaseHooks.account.create/update.before` in `authServer.ts`. The access and id tokens are
      left alone deliberately: they are minutes-long and the library uses the id token during the
      flow itself — it is the *long-lived* credential that has no reader here.)
- [x] A page load with a valid session shows the signed-in shell without rendering a signed-out state
      first — asserted on the rendered output, not by timing. (`AccountBadge.test.tsx` — *should
      show no sign-in link at all before the answer arrives*: no link, no button, nothing.
      `RequireAccount.test.tsx` holds the same line for a protected route — *does not redirect while
      the answer is still unknown*. Both assert on what is rendered; `useAuth`'s `isPending` being a
      real third state is what makes it possible.)
- [x] A session expiring while the app is open produces an "expired, sign in again" surface and
      AUTH-03's return-to-destination redirect — never a bare permission error or a silently failed
      action. (`RequireAccount.test.tsx` — *marks the redirect as an expiry when the session went
      away mid-use*, and its companion that says nothing to somebody who was never signed in. **The
      difference is the transition, not the state**: both are `isSignedIn: false`, and only a
      component that saw the other answer first can tell them apart. `routes/authRoutes.test.tsx`
      covers the surface, including that it is a `status` and not an `alert` — a ninety-day ceiling
      doing its job is not an error. AUTH-03's redirect is reused unchanged, which is the second
      caller its *one mechanism taking a destination* was built for. Browser, 2026-08-25.)
- [x] The browser-lifetime option at sign-in produces a cookie with no persisted expiry, and that
      session does not survive a browser restart. (`session.test.ts` — *offers a browser-lifetime
      session for a device that is not yours*: `rememberMe: false` produces a `Set-Cookie` with
      neither `Max-Age` nor `Expires`, which is exactly what a browser drops on exit.
      `AuthForm.test.tsx` covers the wiring by **unchecking** the box — asserting only the default
      would pass even if the checkbox's ref never reached the input — and that sign-up does not
      offer it. Browser, 2026-08-25: *Keep me signed in on this device*, checked by default, on the
      sign-in surface only.)
- [x] Both lifetimes are documented env variables with stated defaults, not literals. (Four of
      them: `AUTH_SESSION_DAYS` (30, idle), `AUTH_SESSION_ABSOLUTE_DAYS` (90, ceiling),
      `AUTH_SESSION_UPDATE_HOURS` (24, how often it renews and rotates) and
      `AUTH_SESSION_GRACE_SECONDS` (30). All in `env.ts`'s table and `.env.example`, which
      `env.test.ts` asserts name the same set. **The numbers were the User's decision**, taken
      before implementation rather than proposed after it.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check that closes and reopens the browser (ask the User first).
      (2260 passing / 0 failing / 0 skipped, typecheck at the documented 2-error baseline, lint and
      `yarn run arch` clean, `fallow` with no introduced dead code, complexity or duplication.
      **`conventions-reviewer` found two real defects and both now have the test that reproduces
      them** — see criteria 4 and 5, and the implementation notes on renewal frequency. Browser
      check done for everything a browser can show; a literal close-and-reopen is not available in
      the in-app browser, so criterion 1 rests on the `Set-Cookie` assertion instead.)

## Notes

- **Idle plus absolute, not one number.** A single long expiry either logs people out mid-campaign
  or leaves a stolen cookie valid for months. The pair gives "come back tomorrow and you are still
  in" *and* a hard ceiling, and it is the reason criterion 3 drives a clock rather than trusting the
  configuration to be sensible.
- **Rotation is what makes a long session defensible.** Without it, a cookie captured once is good
  for the whole absolute lifetime. With it, the window closes at the legitimate browser's next
  request. Watch the concurrency case — two tabs renewing at once must not invalidate each other;
  a short grace period on the previous identifier is the usual answer and should be tested, not
  assumed.
- **Not storing Provider refresh tokens is a deliberate subtraction**, and it is the right default
  precisely because the feature that would need them does not exist. The day something wants to read
  a Discord server's member list, that is a ticket that adds the storage *and* the encryption
  argument together — not a credential sitting in the database for a year first.
- The default lifetimes are a User-facing decision, not a technical one. Propose something like a
  30-day idle window and a 90-day ceiling, and put the numbers in the ticket's implementation notes
  where the User can disagree with them.

  > **Settled: 30 days idle, 90 days absolute, renewed and rotated once a day, 30-second grace.**
  > Asked and answered before implementation. Come back after three weeks away and you are still
  > in — a fortnightly game fits inside it — and a cookie stolen today is dead within three months
  > however continuously it is used.

## Implementation notes

**Capping `expiresAt` breaks the library's own once-per-`updateAge` test, and that had to be fixed
rather than lived with.** Better Auth decides whether to renew with
`expiresAt - idle + updateAge <= now`, which assumes `expiresAt` is always `lastRenewal + idle`.
Once the ceiling binds — the last month of a ninety-day chain — `expiresAt` stops moving and that
test is permanently true, so *every* request would have renewed and rotated: a write per session
poll, and a grace window turned from a rare race into every concurrent pair. `isDueForRenewal`
measures from `updatedAt` instead, which is what the library meant to ask.

**Four adapter operations are wrapped, and `findMany` is the one only a failing test found.**
`deleteWithHooks` looks a row up with `findMany({ limit: 1 })` before deleting and skips the delete
when that finds nothing — so wrapping `delete` alone left signing-out-during-grace deleting nothing
at all, silently.

**One accepted consequence, recorded rather than discovered.** `/list-sessions` returns full session
tokens and the account page holds them in React state, because `revokeSession({ token })` is the API
the library offers. An XSS on `/account` could therefore exfiltrate every device's session token.
The `data-model` skill's line about the Auth_Session being unreadable by client code is amended to
say so rather than left to contradict this.
