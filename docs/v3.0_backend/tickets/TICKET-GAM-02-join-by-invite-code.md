# TICKET-GAM-02 — Join by invite code

- **Area:** Game sessions
- **Type:** Feature
- **Traceability:** v3 [Req 38.1, 38.2, 38.4, 38.7](../requirements.md#requirement-38-invitations)

## User story

As a DM, I want to hand my table a code or a link, so that they can join without me collecting five
email addresses first.

## Description

The path a real table actually uses, and the one that has to work on a Friday night — a string the
DM reads aloud. TICKET-GAM-03 adds the addressed variant, which needs no link at all because it is
delivered on-platform; this one needs nothing but the string, and works for someone the DM cannot
name an address for.

## Current situation (as-is)

- GAM-01 gave us sessions with a DM and AUTH-03's membership guards, but the only Member is the
  creator — there is no way for a second Account to be one.
- `session_invite` exists in DB-01's schema with `code`, `email`, `expires_at`, `revoked_at` and
  `redeemed_at` columns, unused.

## Desired result (to-be)

- A per-session Invite_Code, redeemable by any signed-in Account to join as `player`, with a
  shareable link that carries it. The DM can revoke and reissue, invalidating the previous code.
- Redemption outcomes are distinct and stated: expired, revoked, unknown, already a member (which
  **succeeds**, returning the existing membership rather than erroring), and archived session.
- A join surface: following the link while signed out routes through sign-in and lands back on the
  join, and following it while signed in shows what is being joined before joining.

## Acceptance criteria

- [ ] A second Account redeems a code and becomes a `player` Member; the session's member list shows
      both.
- [ ] Redeeming twice returns the existing membership and does not create a second row (v3 Req 38.7).
- [ ] Expired, revoked and unknown codes each produce their own message; reissuing invalidates the
      previous code, tested by redeeming the old one afterwards.
- [ ] A code is generated from a cryptographically secure source, is long enough not to be
      guessable, and avoids visually ambiguous characters — a code is read aloud and typed by hand.
- [ ] Redeeming into an archived session is refused.
- [ ] Following an invite link while signed out reaches sign-in and returns to the join afterwards,
      reusing AUTH-03's return-to-route behaviour rather than a second implementation.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check with two accounts in two browsers (ask the User first).

## Notes

- **Idempotent redemption is not a nicety.** Someone will click the link twice, or bookmark it, or
  paste it into the group chat and click their own paste. An error there reads as "you are not
  welcome", which is exactly wrong.
- Rate-limit redemption attempts per Account and per code. A short human-typeable code and unlimited
  attempts is a guessable code, whatever its length.
- The code lives on the session rather than one row per invitee, which is why revoke-and-reissue is
  the only revocation. Per-person revocation is GAM-03's email invite or GAM-04's remove-member —
  do not grow a third mechanism here.
