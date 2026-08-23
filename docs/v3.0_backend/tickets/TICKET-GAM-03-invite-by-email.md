# TICKET-GAM-03 — Invite by email, delivered on-platform

- **Area:** Game sessions
- **Type:** Feature
- **Traceability:** v3 [Req 38.3, 38.5, 38.6, 38.7](../requirements.md#requirement-38-invitations);
  overview [D12](../overview.md#d12--no-outbound-email-at-all)

## User story

As a DM, I want to invite someone by their email address and have the invitation just show up for
them when they sign in, so that I do not have to chase them with a link.

## Description

The addressed counterpart to GAM-02's open code, and a **real delivery mechanism that sends no
email**. The DM types an address; the Account holding that address sees a pending invitation in the
app and accepts or declines it. Nothing is sent anywhere, and nothing has to be pasted into a chat.

The email address is the *address book*, not a transport. If no Account holds it yet, the Invite
waits and appears the moment someone registers it.

## Current situation (as-is)

- GAM-02 gave us redemption, membership creation and the join surface. Its code is a session-wide
  open door: anyone holding it joins, and the DM has to deliver it themselves.
- `session_invite.email` exists in DB-01's schema and is unused; GAM-02 only writes the code form.
- There is no `Mailer`, no SMTP configuration and no outbound network call anywhere in
  `src/server/` — and [D12](../overview.md#d12--no-outbound-email-at-all) keeps it that way.
- An Account has no notion of anything waiting for it. There is no inbox, no notification, no
  cross-session surface at all — every surface so far is scoped to one ruleset or one session.

## Desired result (to-be)

- A DM creates an Invite addressed to an email. It is redeemable only by the Account holding that
  address; a pending Invite for an unregistered address is picked up by whoever registers it, within
  its lifetime.
- A **pending invitations** surface on the invitee's own dashboard — session name, who invited them,
  when it expires — with accept and decline. Accepting joins as `player`; declining is a recorded
  outcome the DM can see, distinct from an expired or revoked Invite.
- The DM's pending-invitations list showing each address and its state — pending, accepted, declined,
  expired, revoked — with individual revocation.

## Acceptance criteria

- [ ] A DM invites an address; the Account holding it sees the pending invitation on sign-in and
      joins by accepting — no link, no code, no copy-paste anywhere in the flow.
- [ ] An Account that does **not** hold the address never sees the Invite and cannot redeem it, even
      given its id.
- [ ] Inviting an address with no Account holds the Invite pending; registering that address
      afterwards surfaces it, provided it has not expired.
- [ ] Declining is distinct from expiring and from being revoked: the invitee stops seeing it, the
      DM sees `declined`, and the same address can be invited again afterwards.
- [ ] Revoking one addressed Invite leaves the session's shared code and every other pending Invite
      working.
- [ ] Inviting an address that is already a Member is reported as such rather than creating a
      redundant Invite; inviting an address twice returns the existing pending Invite rather than a
      second one.
- [ ] Nothing in `src/server/` opens an outbound connection for this — asserted by the dependency
      check, not by inspection (D12).
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check with two accounts (ask the User first).

## Notes

- **On-platform delivery is what makes D12 cost nothing.** The first draft of this ticket had the DM
  copy a link and send it themselves, which was a worse product justified by a missing dependency.
  This is better than email would have been: it cannot land in spam, it cannot be forwarded to the
  wrong person, and it is revocable after the fact.
- **Matching is on the address the Account registered**, which this milestone does not verify at
  sign-up ([overview.md](../overview.md#not-in-this-milestone-deliberately)). So the binding is soft:
  someone could register an address they do not own and receive its invitations. Stated rather than
  papered over — when sign-up verification lands, this binding becomes as strong as it reads, with
  no change to this code.
- **The invitations surface is the first thing in the app that is scoped to an Account rather than
  to a ruleset or a session.** Expect it to become the dashboard's notification area later; keep the
  query keyed by account and address so a second kind of pending item can join it without a rewrite.
- Live push is deliberately **not** here. LIVE-01's rooms are per-session and an invitee is by
  definition not in the room yet, so the list is fetched on load and on focus. A cross-account
  channel is a bigger idea than this ticket and would be its own decision.
