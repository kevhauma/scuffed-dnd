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

- [ ] Sign-up creates an Account; the stored credential is a salted hash and the plaintext password
      appears nowhere in the database — asserted by reading the row, not by inspection.
- [ ] A second sign-up on a registered email is refused with a message that does not reveal whether
      the existing account has a password or a linked identity (v3 Req 30.2).
- [ ] Wrong password and unknown email produce byte-identical responses, including status and
      timing class (v3 Req 30.6).
- [ ] The Auth_Session cookie is `HttpOnly` and `SameSite`-restricted, is `Secure` outside
      development, and no identity is written to LocalStorage or any client-readable store.
- [ ] Sign-out invalidates the Auth_Session server-side, so a captured cookie stops working — tested
      by replaying the cookie after sign-out, not by checking the client cleared it.
- [ ] A session's lifetime is configuration rather than a literal, even before TICKET-AUTH-04 defines
      the renewal around it — so that ticket changes values and adds rotation, not the shape.
- [ ] Repeated failed sign-ins on one address are rate-limited, and the limit is a documented env
      variable rather than a literal.
- [ ] Sign-up tells the visitor, before they submit, that a password-only Account cannot be
      recovered, and offers a Google or Discord identity as the recovery path (v3 Req 30.10).
- [ ] Nothing in the auth configuration enables a mail-dependent flow — no verification requirement,
      no reset route — so no surface can offer one that silently does nothing (D12).
- [ ] The three surfaces compose `components/ui/` primitives and use theme tokens only; no raw
      `<input>`/`<button>` and no non-theme colour.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check (ask the User first).

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
