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

- [ ] Closing the browser entirely and reopening it leaves the Account signed in — verified against
      the cookie's persisted expiry, not just within one tab.
- [ ] A session used inside its idle lifetime is renewed and keeps working past the original idle
      expiry; one left unused past it is refused.
- [ ] A session is refused past its **absolute** lifetime no matter how continuously it was used —
      asserted by driving the clock, so "renew forever" cannot pass.
- [ ] Renewal rotates the identifier: the pre-renewal cookie stops working immediately afterwards.
- [ ] Sign-out, and "sign out everywhere", each invalidate; a renewal attempt with an invalidated
      cookie is refused rather than reviving it.
- [ ] The active-sessions list shows an Account its own sessions only, and revoking one leaves the
      others working.
- [ ] No Provider refresh token is persisted — asserted by reading the `account` row after a Google
      and a Discord sign-in (v3 Req 48.10).
- [ ] A page load with a valid session shows the signed-in shell without rendering a signed-out state
      first — asserted on the rendered output, not by timing.
- [ ] A session expiring while the app is open produces an "expired, sign in again" surface and
      AUTH-03's return-to-destination redirect — never a bare permission error or a silently failed
      action.
- [ ] The browser-lifetime option at sign-in produces a cookie with no persisted expiry, and that
      session does not survive a browser restart.
- [ ] Both lifetimes are documented env variables with stated defaults, not literals.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check that closes and reopens the browser (ask the User first).

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
