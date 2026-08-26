/**
 * The tables, one row each (TICKET-GAM-02)
 *
 * **The row's badge is the assertion worth making.** v3 Req 36.8's discipline applied one aggregate
 * over: a row has to say what you are at that table at all times, because whether you can invite
 * anybody follows from it — and a surface that left it to be inferred would leave a player hunting
 * for a button that is not theirs.
 *
 * The other half is that **the invitation is only ever behind a DM's row**, which is the client
 * mirroring a rule the server already enforces rather than being trusted to.
 *
 * **Validates: v3 Req 37.1, 38.1**
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GameSessionSummary, MemberRole } from '#shared/types/api';
import { MEMBER_ROLE, SESSION_STATUS } from '#shared/types/api';
import { SessionList } from './SessionList';
import type { SessionInviteState } from './useSessionInvite';

/** One table, as the listing carries it */
function session(overrides: Partial<GameSessionSummary> = {}): GameSessionSummary {
  return {
    id: 'session-1',
    rulesetId: 'ruleset-1',
    name: 'Tuesday night',
    status: SESSION_STATUS.ACTIVE,
    role: MEMBER_ROLE.DM,
    snapshotTakenAt: 1_760_000_000_000,
    createdAt: 1_760_000_000_000,
    updatedAt: 1_760_000_000_000,
    ...overrides,
  };
}

/** A live invitation, a fortnight out */
const LIVE_INVITE = { code: 'A1B2C-3D4E5', expiresAt: Date.now() + 1_000_000 };

/** The invite hook's state, inert unless a case says otherwise */
function invite(overrides: Partial<SessionInviteState> = {}): SessionInviteState {
  return {
    invite: LIVE_INVITE,
    isPending: false,
    isBusy: false,
    error: null,
    issue: vi.fn(),
    revoke: vi.fn(),
    ...overrides,
  };
}

/** The list with everything defaulted to "one table you run" */
function renderList(props: Partial<React.ComponentProps<typeof SessionList>> = {}) {
  const onToggle = vi.fn();

  render(
    <SessionList
      sessions={[session()]}
      isPending={false}
      openSessionId={null}
      onToggle={onToggle}
      invite={invite()}
      {...props}
    />
  );

  return { onToggle };
}

describe('SessionList', () => {
  it.each([
    [MEMBER_ROLE.DM, 'You run this'],
    [MEMBER_ROLE.PLAYER, 'You play here'],
  ])('says what you are at a table you are %s of', (role, label) => {
    renderList({ sessions: [session({ role: role as MemberRole })] });

    expect(screen.getByText(label)).toBeTruthy();
  });

  it('marks an archived table without dressing it as a fault', () => {
    renderList({ sessions: [session({ status: SESSION_STATUS.ARCHIVED })] });

    expect(screen.getByText('Archived')).toBeTruthy();
    // A state, not an error — nothing announces it
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('offers the invitation only on a table you run', () => {
    renderList({ sessions: [session({ role: MEMBER_ROLE.PLAYER })] });

    expect(screen.queryByRole('button', { name: 'Invite' })).toBeNull();
  });

  it('opens the invitation on request', () => {
    const { onToggle } = renderList();

    fireEvent.click(screen.getByRole('button', { name: 'Invite' }));

    expect(onToggle).toHaveBeenCalledWith('session-1');
  });

  it('shows the code only while the row is open', () => {
    renderList({ openSessionId: 'session-1' });

    expect(screen.getByText('A1B2C-3D4E5')).toBeTruthy();
  });

  it('keeps the code hidden while the row is closed', () => {
    renderList({ openSessionId: null });

    expect(screen.queryByText('A1B2C-3D4E5')).toBeNull();
  });

  it('never shows a code on a player’s row, whatever the hook holds', () => {
    // The server omits `inviteCode` for a player, so the hook would hold `null` — but the row does
    // not expand at all, which is the client mirroring the rule rather than relying on it
    renderList({ sessions: [session({ role: MEMBER_ROLE.PLAYER })], openSessionId: 'session-1' });

    expect(screen.queryByText('A1B2C-3D4E5')).toBeNull();
  });

  it('says nothing is here rather than showing an empty list', () => {
    renderList({ sessions: [] });

    expect(screen.getByText(/not in any games yet/)).toBeTruthy();
  });

  it('offers no way to invite into an archived table (the GAM-02 review)', () => {
    // The server refuses `issueInvite` on one, so a button here would always 409 — and the DM
    // could not have predicted it from anything on screen
    renderList({
      sessions: [session({ status: SESSION_STATUS.ARCHIVED })],
      openSessionId: 'session-1',
      invite: invite({ invite: null }),
    });

    expect(screen.queryByRole('button', { name: 'Create an invite code' })).toBeNull();
    expect(screen.getByText(/nobody new can join it/)).toBeTruthy();
  });

  it('still lets a DM take a code back on an archived table', () => {
    // Deliberately allowed by the server: a DM who archived first must still be able to invalidate
    // a link they posted publicly
    renderList({
      sessions: [session({ status: SESSION_STATUS.ARCHIVED })],
      openSessionId: 'session-1',
    });

    expect(screen.getByRole('button', { name: 'Take it back' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New code' })).toBeNull();
  });

  it('distinguishes "still looking" from "none"', () => {
    renderList({ isPending: true, sessions: [] });

    expect(screen.getByText(/Checking your games/)).toBeTruthy();
    expect(screen.queryByText(/not in any games yet/)).toBeNull();
  });
});
