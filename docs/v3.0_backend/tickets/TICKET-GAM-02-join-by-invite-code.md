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

## Implementation notes (2026-08-26)

**A minimal `/sessions` surface came with this ticket, and it is deliberately not the lobby.**
GAM-01 built the session routes and no UI, so without something here a DM could not obtain a code and
this feature would exist only as an API. What landed is the smallest thing that makes it real: start
a table from a ruleset you own, see the games you are in, and — for a DM — the invitation. **The
roster stays GAM-04's**: who is at a table, removing somebody, leaving, transferring the DM role.
Nothing here shows other people.

**Four routes, and two of them are the only ones in the milestone reached without a membership.**
`POST`/`DELETE /api/sessions/:id/invite` are the DM's; `GET`/`POST /api/invites/:code` are how
somebody who is *not* a Member becomes one. What stands in for a guard there is the code itself, the
limiter, and the four distinct refusals.

**`redeemInvite` never spells `sessionId`**, and `seatSessionMember` takes the loaded session row
rather than an id because of it. `routeGuards.test.ts` reads a handler naming a session id as *this
route had better call a resource guard*, and redeeming a code is precisely the act that cannot. Same
trade as GAM-01's `insertUnseatedCharacter`: name the thing in the repository rather than teach the
detector an exception.

**Archived is three different answers on purpose.** Issuing is refused (inviting somebody to a game
that has ended), redeeming is refused (nobody new joins), and **revoking is allowed** — a DM who
archived a game first must still be able to invalidate a link they posted publicly, and a rule that
stops somebody tidying up after themselves is pointed the wrong way.

**The sign-up page gained AUTH-03's return-to-route behaviour, which it never had.** See criterion
six.

## Acceptance criteria

- [x] A second Account redeems a code and becomes a `player` Member; the session's member list shows
      both.
      (`invites.test.ts` *"seats a second Account as a player"* — the membership row is read back and
      the DM's row is asserted still `dm`, which the partial unique index exists to guarantee. The
      *member list* half is `listSessionsForAccount`'s join, covered in
      `gameSessionRepository.test.ts`; the surface that renders a roster is GAM-04's. Live: a second
      account signed up, joined, and its `/sessions` shows **You play here / Tuesday night**.)
- [x] Redeeming twice returns the existing membership and does not create a second row (v3 Req 38.7).
      (`invites.test.ts`'s three cases — *"succeeds and says nothing changed"*, *"creates no second
      membership row"* (counted with raw SQL) and *"lets the DM redeem their own code without losing
      the role"*, which is the paste-into-the-group-chat case. Idempotent **by constraint**:
      `seatSessionMember` is `ON CONFLICT DO NOTHING` plus a read-back, so a double-click cannot race
      it. Live: following the link a second time said *"You are already at 'Tuesday night' — nothing
      changed."*)
- [x] Expired, revoked and unknown codes each produce their own message; reissuing invalidates the
      previous code, tested by redeeming the old one afterwards.
      (`invites.test.ts` *"says something different for unknown, revoked, expired and archived"* —
      four messages collected into a `Set` and asserted to have four members, which is the only shape
      a shared "invalid code" cannot satisfy. Reissuing is *"retires the previous code, proven by
      redeeming it afterwards"*, the criterion's own wording, plus *"leaves exactly one live code
      behind"*.)
- [x] A code is generated from a cryptographically secure source, is long enough not to be
      guessable, and avoids visually ambiguous characters — a code is read aloud and typed by hand.
      (`inviteCode.test.ts` — `crypto.getRandomValues` asserted called and `Math.random` asserted
      **not**; ten characters of Crockford's Base32, so 32^10 ≈ fifty bits; and two cases over two
      thousand drawn characters, one that `I`/`L`/`O` never appear and one that all 32 do — the
      second matters because an alphabet that excluded too much would pass the first while quietly
      shrinking the space. `normalizeInviteCode` reads `O` as `0` and `I`/`L` as `1`, so hearing a
      code wrong is not a failure; `invites.test.ts` proves it end to end by redeeming a code
      lower-cased, unhyphenated, space-padded and with every `0` typed as `O`.)
- [x] Redeeming into an archived session is refused.
      (`invites.test.ts`'s refusal set includes it, and `previewInvite` deliberately answers **200
      with `isJoinable: false`** instead — *this game has ended* is a sentence to read on a page
      rather than an error to decode, while the redeem itself is a 409.)
- [x] Following an invite link while signed out reaches sign-in and returns to the join afterwards,
      reusing AUTH-03's return-to-route behaviour rather than a second implementation.
      (Live: `/join/KFTB6-V3HRJ` signed out redirected to
      `/signin?redirect=%2Fjoin%2FKFTB6-V3HRJ`. **The browser check then found a real gap and it is
      fixed here**: *Create one* linked to a bare `/signup`, and `/signup` had no `redirect` handling
      at all — so an invitee **without an account**, which is the common case for an invitation
      rather than an edge of it, created one and landed on the home page with the invitation gone.
      Both auth surfaces now share `destinationSearch`, one refusal of an off-origin destination
      rather than two copies of a security check, and the switch link carries the destination both
      ways. Re-checked live: sign-up landed back on `/join/KFTB6-V3HRJ` and the join went through.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check with two accounts in two browsers (ask the User first).
      (`npx vitest run` **2625 passed** / 0 failed / 0 skipped, +99 over GAM-01; `npx tsc --noEmit`
      at the documented 2-error baseline; `yarn run check` clean (578 modules, 2650 dependencies,
      zero dependency violations) and `yarn run lint --max-diagnostics=1000` clean;
      `fallow audit --base main` verdict **pass** with **0 introduced** findings and 1 inherited
      (`fallow` itself in `dependencies`). Its findings were fixed rather than suppressed: four
      component-complexity ones became `Body`/`SessionRow`/`LiveCode`/`Form` splits — which is
      `AccountRulesetHome`'s own idiom — and one dead export, `resolveInvite`, became module-private,
      which is the check independently confirming the review's *one entry point* fix.
      **`conventions-reviewer` found twelve, and the two that mattered are recorded in
      [TEST_STATUS.md](../../../TEST_STATUS.md)**: `GET /api/invites/:code` bypassing the rate
      limiter, which made the feature's whole security argument false; and `InviteCodePanel`
      rendering an expired code as the live invitation, which is what turned the wire field from
      `inviteCode: string` into `invite: { code, expiresAt }`. **The browser check ran with two
      accounts**: the first issued a code from `/sessions`, the second signed up through the
      invitation and joined, then re-followed the link to prove the idempotence, and its `/sessions`
      shows the table with no invite affordance.)

## Notes

- **Idempotent redemption is not a nicety.** Someone will click the link twice, or bookmark it, or
  paste it into the group chat and click their own paste. An error there reads as "you are not
  welcome", which is exactly wrong.
- Rate-limit redemption attempts per Account and per code. A short human-typeable code and unlimited
  attempts is a guessable code, whatever its length.
- The code lives on the session rather than one row per invitee, which is why revoke-and-reissue is
  the only revocation. Per-person revocation is GAM-03's email invite or GAM-04's remove-member —
  do not grow a third mechanism here.
