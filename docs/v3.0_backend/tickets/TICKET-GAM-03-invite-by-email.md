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

- [x] A DM invites an address; the Account holding it sees the pending invitation on sign-in and
      joins by accepting — no link, no code, no copy-paste anywhere in the flow.
      (`POST /api/sessions/:id/invitations` → [inviteByEmail.ts](../../../src/server/routes/sessions/inviteByEmail.ts),
      `GET /api/invitations` → [listInvitations.ts](../../../src/server/routes/invitations/listInvitations.ts),
      `POST /api/invitations/:id/accept` → [acceptInvitation.ts](../../../src/server/routes/invitations/acceptInvitation.ts).
      `invitations.test.ts` — *should show the table, who asked and when it runs out — with no code
      anywhere*, which asserts the serialised card contains no `code` at all, and *should seat the
      invitee as a player when they accept*. Accepting twice answers `joined: false` rather than an
      error, per v3 Req 38.8 — *should answer a second acceptance with the membership rather than an
      error*.)
- [x] An Account that does **not** hold the address never sees the Invite and cannot redeem it, even
      given its id. (`requireInvitee` in [guards.ts](../../../src/server/auth/guards.ts) matches the
      row's `email` against the address the Account registered; every failure — missing id, shared
      code, somebody else's letter — is the same 404 as v3 Req 32.5 asks. `invitations.test.ts` —
      *should not show it to anybody else, nor let them redeem it by its id*, which passes the real
      invitation id to a second Account and asserts the answer is identical to the one a made-up id
      gets.)
- [x] Inviting an address with no Account holds the Invite pending; registering that address
      afterwards surfaces it, provided it has not expired.
      (`listPendingInvitationsFor` is keyed on the **address**, never on an account id, so nothing
      has to bind them later. `invitations.test.ts` — *should wait for an address nobody has
      registered yet, and surface it when they do*, which seeds the Account **after** the
      invitation.)
- [x] Declining is distinct from expiring and from being revoked: the invitee stops seeing it, the
      DM sees `declined`, and the same address can be invited again afterwards.
      (`inviteStateOf` derives five states from four timestamps and `settledRefusal` gives each its
      own sentence — `invitationPayloads.test.ts` asserts the four spent ones differ from one
      another rather than merely being non-empty. `invitations.test.ts` — *should make declining
      distinct from expiring, and re-invitable afterwards* and *should leave a declined invitation
      saying so rather than restamping it revoked*.)
- [x] Revoking one addressed Invite leaves the session's shared code and every other pending Invite
      working. (`revokeSessionInvites` filters `email IS NULL` and `revokeInviteById` works by id;
      `DELETE /api/invitations/:id` refuses a shared-code row with a 404 so the two mechanisms
      cannot reach each other in either direction. `invitations.test.ts` — *should leave the code
      alone when one letter is taken back*, *should leave the letters alone when the code is
      reissued or taken back*, *should refuse to take the shared code back through the addressed
      route*, and *should keep an addressed invitation out of the DM's code panel*.)
- [x] Inviting an address that is already a Member is reported as such rather than creating a
      redundant Invite; inviting an address twice returns the existing pending Invite rather than a
      second one. (`invitations.test.ts` — *should report an existing Member rather than inviting
      them again* (409, and the outbox stays empty) and *should hand back the pending invitation
      rather than minting a second one*. The duplicate check is on **pending**, so a declined or
      expired address may be invited again.)
- [x] Nothing in `src/server/` opens an outbound connection for this — asserted by the dependency
      check, not by inspection (D12). (`the-server-sends-no-mail` in
      [`.dependency-cruiser.mjs`](../../../.dependency-cruiser.mjs), proven against
      [`sendsMail.ts`](../../../src/server/boundaryFixtures/sendsMail.ts) in
      `architecture/boundaries.test.ts`. Its reach and its limit — a global `fetch` is not an import
      — are recorded in [`architecture/README.md`](../../../architecture/README.md)'s
      *What dependency-cruiser cannot express* table.)
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check with two accounts (ask the User first).

      **Everything but the second account is done.** `npx vitest run` 2707 passed / 0 failed /
      0 skipped, three consecutive runs; `npx tsc --noEmit` at the documented 2-error baseline;
      `yarn run check` clean. The `conventions-reviewer` subagent — which folds in `fallow audit`,
      `dead-code` and `health --hotspots` — reviewed the diff, and its findings are applied,
      including a real defect: `DELETE /api/invitations/:id` would have revoked the session's
      **shared code** if handed that row's id, which is the fifth criterion crossed in the one
      direction no test covered.

      **Verified live at `localhost:3000`, signed in as one account (`player2@example.com`), on a
      table it runs (*Friday night*):**
      - Typing `  Newcomer@Example.TEST ` stores and shows `newcomer@example.test` — normalised on
        the way in, so case and stray spaces still reach the Account.
      - It appears as **Waiting**, with its expiry a fortnight out, and a *Take it back* beside it.
      - Inviting the same address again leaves **one** row carrying the **same expiry timestamp** —
        the existing invitation handed back, not a second one.
      - Inviting the DM's own address is refused in the server's own words — *player2@example.com is
        already at this table, so there is nothing to invite them to* — with no row created, and the
        address is **left in the box** rather than thrown away with the refusal.
      - Taking it back turns the row **Taken back** (quiet stone, no expiry, no button) while the
        shared code `VC1JP-SF2DS` stays live and unchanged — criterion 5, one direction.
      - Inviting that same address afterwards creates a **new** Waiting row above the Taken back
        one: settled means re-invitable, and the history is kept.
      - Pressing *New code* reissues to `FN3D7-E0N8V` and **both letters are untouched** —
        criterion 5, the other direction.

      **What is not verified: the invitee's own side** — the *Waiting for you* card, accept and
      decline. It needs a **second** signed-in Account, and creating one means typing a password
      into a sign-up form, which this agent may not do. A pending invitation to
      `player1@example.com` for *Friday night* is left in the dev database as the setup: signing in
      as a second Account holding that address closes the rest of this box in three clicks.

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

### Decided while building

- **`session_invite.code` became nullable** (migration `0004_addressed_invites`), so an addressed
  invitation has no code *at all* rather than a secret one nobody is shown. The alternative — give
  it a generated code and rely on every lookup filtering it out — puts a working credential in a
  column, which stops being unreachable the first time somebody widens a query. `NULL` makes *this
  invitation is not redeemable by code* a property of the **row**. SQLite counts `NULL`s as
  distinct, so the unique index on `code` is untouched; the migration test asserts both halves.
- **Accepting twice succeeds**, answering `joined: false` with the existing membership. A first
  draft refused it with a 409 on the reasoning that an addressed invitation is *spent* by the first
  acceptance. That contradicts **v3 Req 38.8** — *return the existing membership rather than an
  error* — which is scoped to an Invite and not to a code, and the requirement is right: somebody
  will click twice, and *you are not welcome* is the wrong answer to give them for it. Caught by the
  `conventions-reviewer` pass.
- **The DM's outbox is its own route** (`GET /api/sessions/:id/invitations`) rather than riding on
  `GET /api/sessions/:id` the way the shared code does. The code is one string and part of what a DM
  sees when they look at their table; this is an unbounded list that grows for the life of the game,
  and putting it on the session read would make every player's page load carry a query written for
  one person.
- **Nothing in `docs/imports/` changed**, and that is the right answer rather than an omission: this
  ticket adds no `Configuration` entity and reshapes no persisted document. `session_invite` is the
  server's own model (D4), and the source spreadsheet has nothing to say about invitations.
