/**
 * What has become of an invitation, and how a path names one (TICKET-GAM-03)
 *
 * **The five states are derived rather than stored**, so this is where the derivation is pinned.
 * Two properties are worth more than the other three put together:
 *
 * - **Answered beats withdrawn beats ran-out.** A row that was accepted a fortnight ago is
 *   *accepted*, not *expired* — reading the clock first would rewrite history every fortnight, and
 *   nothing else in the tree would notice.
 * - **Five distinct sentences**, asserted to differ from one another rather than merely to be
 *   non-empty (v3 Req 38.4). A shared "no longer valid" would pass any weaker check, which is the
 *   lesson GAM-02's four refusals taught.
 *
 * **Validates: v3 Req 38.4**
 */

import { describe, expect, it } from 'vitest';
import { INVITE_STATE, type InviteState } from '#shared/types/api';
import type { SessionInviteRow } from '../../repositories/sessionInviteRepository';
import {
  invitationIdFrom,
  inviteStateOf,
  settledRefusal,
  toAddressedInvite,
} from './invitationPayloads';

/** The moment every case is judged against */
const NOW = 1_760_000_000_000;

/** One stored invitation, pending unless a case says otherwise */
function row(overrides: Partial<SessionInviteRow> = {}): SessionInviteRow {
  return {
    id: 'invite-1',
    sessionId: 'session-1',
    code: null,
    email: 'ada@example.test',
    expiresAt: NOW + 1_000,
    revokedAt: null,
    declinedAt: null,
    redeemedAt: null,
    redeemedByAccountId: null,
    createdAt: NOW - 1_000,
    ...overrides,
  };
}

describe('inviteStateOf', () => {
  it.each([
    ['pending', {}, INVITE_STATE.PENDING],
    ['accepted', { redeemedAt: NOW, redeemedByAccountId: 'account-2' }, INVITE_STATE.ACCEPTED],
    ['declined', { declinedAt: NOW }, INVITE_STATE.DECLINED],
    ['revoked', { revokedAt: NOW }, INVITE_STATE.REVOKED],
    ['expired', { expiresAt: NOW }, INVITE_STATE.EXPIRED],
  ])('reads a %s row', (_name, overrides, expected) => {
    expect(inviteStateOf(row(overrides), NOW)).toBe(expected);
  });

  it('keeps an accepted invitation accepted once its lifetime has passed', () => {
    // The ordering property: the clock is read **last**, so history is not rewritten by time
    const accepted = row({ redeemedAt: NOW - 5_000, expiresAt: NOW - 1 });

    expect(inviteStateOf(accepted, NOW)).toBe(INVITE_STATE.ACCEPTED);
  });

  it('keeps a declined invitation declined once its lifetime has passed', () => {
    expect(inviteStateOf(row({ declinedAt: NOW - 5_000, expiresAt: NOW - 1 }), NOW)).toBe(
      INVITE_STATE.DECLINED
    );
  });

  it('expires exactly at the boundary rather than a millisecond after it', () => {
    expect(inviteStateOf(row({ expiresAt: NOW }), NOW)).toBe(INVITE_STATE.EXPIRED);
    expect(inviteStateOf(row({ expiresAt: NOW + 1 }), NOW)).toBe(INVITE_STATE.PENDING);
  });
});

describe('settledRefusal', () => {
  it('gives every state its own sentence, and refuses with a 409', () => {
    const states: Partial<SessionInviteRow>[] = [
      { redeemedAt: NOW },
      { declinedAt: NOW },
      { revokedAt: NOW },
      { expiresAt: NOW },
    ];

    const refusals = states.map((overrides) => settledRefusal(row(overrides), NOW));

    expect(new Set(refusals.map((refusal) => refusal.message)).size).toBe(4);
    expect(refusals.every((refusal) => refusal.status === 409)).toBe(true);
  });
});

describe('toAddressedInvite', () => {
  it('carries the address and the derived state, and no code', () => {
    const wire = toAddressedInvite(row({ declinedAt: NOW }), NOW);

    expect(wire).toEqual({
      id: 'invite-1',
      email: 'ada@example.test',
      state: INVITE_STATE.DECLINED as InviteState,
      expiresAt: NOW + 1_000,
    });
  });
});

describe('invitationIdFrom', () => {
  it.each([
    ['/api/invitations/invite-1', 'invite-1'],
    ['/api/invitations/invite-1/accept', 'invite-1'],
    ['/api/invitations/invite-1/decline', 'invite-1'],
    // The collection itself names nothing, and nothing deeper is a real shape
    ['/api/invitations', ''],
    ['/api/invitations/a/b/c', ''],
    ['/api/sessions/session-1', ''],
  ])('reads %s as %s', (path, expected) => {
    expect(invitationIdFrom(new URL(path, 'http://localhost'))).toBe(expected);
  });
});
