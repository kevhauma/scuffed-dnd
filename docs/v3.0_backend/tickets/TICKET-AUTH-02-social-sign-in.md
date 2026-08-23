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

- [ ] A first sign-in through **either** provider creates exactly one Account with the profile's
      email and name.
- [ ] A provider profile whose verified email matches an existing password Account links to it —
      signing in either way afterwards reaches the same Account and the same rulesets (v3 Req 31.3).
- [ ] One Account holds **both** identities: signing in with Google, then linking Discord, then
      signing in with Discord reaches the same Account (v3 Req 31.5).
- [ ] A provider identity already bound to a different Account is refused rather than moved.
- [ ] A profile with an unverified email, and one carrying no email at all, are each refused with no
      Account and no link created (v3 Req 31.4).
- [ ] Every rule above is asserted **once per provider** against a shared implementation — a test
      that runs the same table for both, so the two cannot diverge (v3 Req 31.7).
- [ ] With neither provider's credentials set the server starts, both buttons are absent, and every
      email/password test still passes; with exactly one set, only that button appears and the other
      provider's absence changes nothing (v3 Req 31.6).
- [ ] Neither client secret appears in any client-side module — covered by SRV-01's server-only
      boundary test for the env module.
- [ ] `.env.example` documents both pairs as optional, with the redirect URI each provider must have
      registered.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check (ask the User first).

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
- **Resist a provider registry.** Two providers configured side by side is data; an abstraction for
  *n* providers is a framework, and Better Auth already owns that layer. What must be shared is the
  identity-rule path (31.7), not a plugin system.
- Testing OAuth means stubbing each provider's token and profile endpoints. Put the stub in DX-06's
  fixtures, parameterised by provider, so the shared-rule test in the sixth criterion is one table
  rather than two files.
