/**
 * The `/api/invitations` routes (TICKET-GAM-03)
 *
 * One module per route, for the reason `routes/rulesets/index.ts` gives: `routeGuards.test.ts` scans
 * a **module** for an owned identifier and a guard call, so four handlers sharing a file would let
 * one `requireInvitee` stand for all four.
 *
 * **The collection is the Account's, not a session's**, which is why it is a root rather than
 * another folder under `sessions/`: an invitee is by definition not a Member of the session yet, so
 * a path that made them name one would be a path they have no right to walk. The DM's half — send
 * one, list what this table has sent — lives under `routes/sessions/` for the mirror-image reason.
 */

export * from './acceptInvitation';
export * from './declineInvitation';
export * from './invitationPayloads';
export * from './listInvitations';
export * from './revokeInvitation';
